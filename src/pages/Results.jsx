import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { computebordaScores, classifyPowerRoles } from '../utils/votingTheory'
import PageWrapper from '../components/PageWrapper'

const RED = '#DC2626'

export default function Results() {
  const navigate = useNavigate()
  const { room, currentMember, setResults, updateRoomStatus } = useAppStore()
  const isCreator = currentMember?.is_creator
  const [ranked, setRanked] = useState([])
  const [banzhaf, setBanzhaf] = useState({ dictator: null, vetoPlayers: [], dummies: [] })
  const [firstChoice, setFirstChoice] = useState([])
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)

  const pollingRef = useRef(null)
  const doneRef = useRef(false)
  const attemptRef = useRef(0)

  useEffect(() => {
    if (!room || !currentMember) { navigate('/'); return }
    poll()
    const channel = supabase
      .channel(`results-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ballots',
        filter: `room_id=eq.${room.id}`,
      }, () => { if (!doneRef.current) poll() })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`,
      }, payload => {
        if (payload.new.status === 'done' && !isCreator) {
          updateRoomStatus('done')
          setTimeout(() => navigate('/goodbye'), 500)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel); clearPoll() }
  }, [room])

  function clearPoll() {
    if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null }
  }

  function scheduleNextPoll() {
    clearPoll()
    if (doneRef.current) return
    const delay = Math.min(1000 + Math.floor(attemptRef.current / 3) * 1000, 3000)
    pollingRef.current = setTimeout(poll, delay)
  }

  async function poll() {
    if (doneRef.current) return
    clearPoll()
    attemptRef.current++
    setAttemptCount(attemptRef.current)
    try {
      const [{ data: members, error: mErr }, { data: ballots, error: bErr }] = await Promise.all([
        supabase.from('members').select('*').eq('room_id', room.id).order('member_no'),
        supabase.from('ballots').select('*').eq('room_id', room.id),
      ])
      if (mErr || bErr || !members || !ballots || ballots.length === 0) { scheduleNextPoll(); return }
      doneRef.current = true
      clearPoll()
      const r = computebordaScores(ballots, members)
      const fcMap = {}
      members.forEach(m => { fcMap[m.id] = 0 })
      ballots.forEach(ballot => {
        const top = ballot.rankings.find(entry => entry.rank === 1)
        if (top && fcMap[top.candidate_id] !== undefined) fcMap[top.candidate_id]++
      })
      const rWithFC = r.map(m => ({ ...m, first_choice_votes: fcMap[m.id] || 0 }))
      const classified = classifyPowerRoles(rWithFC)
      setRanked(rWithFC)
      setFirstChoice(rWithFC)
      setBanzhaf({
        dictator: classified.find(m => m.powerRole === 'dictator') || null,
        vetoPlayers: classified.filter(m => m.powerRole === 'veto'),
        dummies: classified.filter(m => m.powerRole === 'dummy'),
      })
      if (setResults) setResults(rWithFC)
      setLoading(false)
    } catch (err) {
      console.error('poll() threw:', err)
      scheduleNextPoll()
    }
  }

  async function endSession() {
    setEnding(true)
    setResults(ranked)
    const { error } = await supabase.from('rooms').update({ status: 'done' }).eq('id', room.id)
    if (error) { toast.error('Failed to end session.'); setEnding(false); return }
    updateRoomStatus('done')
    navigate('/goodbye')
  }

  function exportCSV() {
    const rows = [
      ['Rank', 'Member #', 'Name', 'Borda Score', 'First Choice Votes', 'Performance Rating'],
      ...ranked.map((m, i) => {
        const fc = firstChoice.find(f => f.id === m.id)
        return [i + 1, m.member_no, m.name, m.bordaScore, fc?.first_choice_votes ?? 0, m.performance_rating]
      }),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `voteleader-${room.code}-results.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  if (!room || !currentMember) return null
  const winner = ranked[0]
  const maxScore = Math.max(...ranked.map(m => m.bordaScore), 1)

  return (
    <PageWrapper>
      <div
        style={{
          minHeight: '100vh',
          background: '#fff3f3',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red grid */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(220,38,38,0.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(220,38,38,0.10) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {/* Glow orb */}
        <div
          style={{
            position: 'fixed',
            top: '-10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 280,
            background: 'radial-gradient(ellipse, rgba(220,38,38,0.18) 0%, rgba(220,38,38,0.03) 50%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32, textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: RED,
                padding: '2px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 12,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
              }}
            >
              ✓ Voting Complete
            </div>
            <h1 className="font-display" style={{ fontSize: 32, marginBottom: 4, color: '#111827' }}>Election Results</h1>
            <p style={{ color: '#6B7280', fontSize: 14 }}>{room.name} · {ranked.length} members</p>
          </motion.div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '1rem' }}>
                <span /><span /><span />
              </div>
              <p style={{ color: '#6B7280', fontSize: 14 }}>Tallying votes…</p>
              {attemptCount > 2 && (
                <p style={{ color: '#9CA3AF', fontSize: 12, marginTop: 8 }}>
                  Still waiting for all ballots to be recorded…
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Winner card */}
              {winner && (
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11,0.08) 0%, rgba(245, 229, 11, 0.08) 100%)',
                    border: `2px solid rgba(245, 158, 11,1)`,
                    borderRadius: 20,
                    padding: '2rem',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👑</div>
                  <p
                    style={{
                      color: '#fda000',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginBottom: '0.4rem',
                    }}
                  >
                    Group Leader
                  </p>
                  <h2
                    className="font-display"
                    style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: '#fda000', marginBottom: '0.4rem' }}
                  >
                    {winner.name}
                  </h2>
                  <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                    {winner.bordaScore} Borda points · Member #{winner.member_no}
                  </p>
                </motion.div>
              )}

              {/* Rankings */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 16,
                  marginBottom: '1.25rem',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(220,38,38,0.1)' }}>
                  <h3
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: RED,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Borda Count Rankings
                  </h3>
                </div>
                {ranked.map((m, i) => {
                  const fc = firstChoice.find(f => f.id === m.id)
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.85rem 1.25rem',
                        background: i === 0 ? 'rgba(245, 158, 11,0.07)' : 'transparent',
                        borderBottom: i < ranked.length - 1 ? '1px solid rgba(220, 202, 38, 0.08)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          minWidth: 28, height: 28, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.8rem',
                          background: i === 0 ? 'rgba(245, 158, 11,0.12)' : '#fff3f3',
                          color: i === 0 ? '#fda000' : '#9CA3AF',
                          border: `1px solid ${i === 0 ? 'rgba(245, 158, 11,0.3)' : 'rgba(220,38,38,0.12)'}`,
                          flexShrink: 0,
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>
                          {m.name} {i === 0 && '👑'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                          {fc?.first_choice_votes ?? 0} first-choice vote{fc?.first_choice_votes !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: i === 0 ? '#fda000' : '#9CA3AF' }}>
                          {m.bordaScore} pts
                        </span>
                        <div style={{ width: '100%', height: 4, background: '#fff3f3', borderRadius: 2, overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(m.bordaScore / maxScore) * 100}%` }}
                            transition={{ delay: 0.3 + i * 0.07, duration: 0.5 }}
                            style={{
                              height: '100%',
                              background: i === 0 ? '#ffae23' : 'rgba(220,38,38,0.2)',
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Power analysis */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 16,
                  marginBottom: '1.25rem',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(220,38,38,0.1)' }}>
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: RED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Voting Power Analysis — Banzhaf Power Index
                  </h3>
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <PowerRole icon="" title="Dictator" color={RED} member={banzhaf.dictator?.name || null} noMemberText="No dictator — power is distributed." explanation="A dictator's support alone is enough to win. Every winning coalition includes them, and removing them causes every coalition to lose." />
                  <PowerRole icon="" title="Veto Player(s)" color="#F59E0B" member={banzhaf.vetoPlayers.length > 0 ? banzhaf.vetoPlayers.map(m => m.name).join(', ') : null} noMemberText="No veto players identified." explanation="A veto player can block any decision. Without their support, no majority is possible — but they aren't powerful enough to win alone." />
                  <PowerRole icon="" title="Dummy Player(s)" color="#9CA3AF" member={banzhaf.dummies.length > 0 ? banzhaf.dummies.map(m => m.name).join(', ') : null} noMemberText="No dummy players — everyone received votes." explanation="A dummy received zero Borda points. Their presence or absence never changes the outcome of any coalition." />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: '⬇ Export CSV', onClick: exportCSV },
                    { label: '🖨 Print / PDF', onClick: () => { window.print(); toast.success('Print dialog opened.') } },
                  ].map(({ label, onClick }) => (
                    <button
                      key={label}
                      onClick={onClick}
                      style={{
                        padding: '0.75rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: '#ffffff',
                        color: RED,
                        border: `1px solid rgba(220,38,38,0.25)`,
                        borderRadius: 10,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#ffffff' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {isCreator && (
                  <button
                    onClick={endSession}
                    disabled={ending}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      background: ending ? 'rgba(220,38,38,0.4)' : RED,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      cursor: ending ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(220,38,38,0.3)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!ending) e.currentTarget.style.background = '#b91c1c' }}
                    onMouseLeave={e => { if (!ending) e.currentTarget.style.background = RED }}
                  >
                    {ending ? 'Ending…' : '✕ End Session'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function PowerRole({ icon, title, color, member, noMemberText, explanation }) {
  return (
    <div
      style={{
        background: '#fff3f3',
        border: '1px solid rgba(220,38,38,0.12)',
        borderRadius: 10,
        padding: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color }}>{title}</span>
        {member && (
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827', marginLeft: '0.25rem' }}>— {member}</span>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: '#6B7280', lineHeight: 1.55 }}>
        {member ? explanation : noMemberText}
      </p>
    </div>
  )
}