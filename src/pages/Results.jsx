import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { computebordaScores, classifyPowerRoles } from '../utils/votingTheory'
import PageWrapper from '../components/PageWrapper'

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
      }, () => {
        if (!doneRef.current) poll()
      })
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

    return () => {
      supabase.removeChannel(channel)
      clearPoll()
    }
  }, [room])

  function clearPoll() {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current)
      pollingRef.current = null
    }
  }

  function scheduleNextPoll() {
    clearPoll()
    if (doneRef.current) return
    // Back-off: 1s x3, then 2s x3, then 3s max
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

      if (mErr || bErr || !members) {
        scheduleNextPoll()
        return
      }

      if (!ballots || ballots.length === 0) {
        scheduleNextPoll()
        return
      }

      // Got data — stop polling and render
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
      const dictator = classified.find(m => m.powerRole === 'dictator') || null
      const vetoPlayers = classified.filter(m => m.powerRole === 'veto')
      const dummies = classified.filter(m => m.powerRole === 'dummy')

      setRanked(rWithFC)
      setFirstChoice(rWithFC)
      setBanzhaf({ dictator, vetoPlayers, dummies })
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
      <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(61,214,163,0.1)', border: '1px solid rgba(61,214,163,0.2)', color: '#3DD6A3', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
            ✓ VOTING COMPLETE
          </div>
          <h1 className="font-display" style={{ fontSize: 32, marginBottom: 4 }}>Election Results</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{room.name} · {ranked.length} members</p>
        </motion.div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '1rem' }}>
              <span /><span /><span />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Tallying votes…</p>
            {attemptCount > 2 && (
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>
                Still waiting for all ballots to be recorded…
              </p>
            )}
          </div>
        ) : (
          <>
            {winner && (
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(247,201,72,0.12) 0%, rgba(247,201,72,0.05) 100%)',
                  border: '1.5px solid rgba(247,201,72,0.35)',
                  borderRadius: 20, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👑</div>
                <p style={{ color: 'var(--accent-gold)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Group Leader</p>
                <h2 className="font-display" style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: 'var(--accent-gold)', marginBottom: '0.4rem' }}>{winner.name}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{winner.bordaScore} Borda points · Member #{winner.member_no}</p>
              </motion.div>
            )}

            <div className="glass-card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>BORDA COUNT RANKINGS</h3>
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
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.85rem 1.25rem',
                      background: i === 0 ? 'rgba(247,201,72,0.07)' : 'transparent',
                      borderBottom: i < ranked.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{
                      minWidth: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.8rem',
                      background: i === 0 ? 'rgba(247,201,72,0.15)' : 'var(--bg-elevated)',
                      color: i === 0 ? 'var(--accent-gold)' : 'var(--text-dim)',
                      border: `1px solid ${i === 0 ? 'rgba(247,201,72,0.3)' : 'var(--border)'}`,
                      flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name} {i === 0 && '👑'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {fc?.first_choice_votes ?? 0} first-choice vote{fc?.first_choice_votes !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: i === 0 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{m.bordaScore} pts</span>
                      <div style={{ width: '100%', height: 4, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.bordaScore / maxScore) * 100}%` }}
                          transition={{ delay: 0.3 + i * 0.07, duration: 0.5 }}
                          style={{ height: '100%', background: i === 0 ? 'var(--accent-gold)' : 'var(--accent-blue)', borderRadius: 2 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="glass-card" style={{ marginBottom: '1.25rem', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>VOTING POWER ANALYSIS — Banzhaf Power Index</h3>
              </div>
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <PowerRole icon="⚡" title="Dictator" color="#f87171" member={banzhaf.dictator?.name || null} noMemberText="No dictator — power is distributed." explanation="A dictator's support alone is enough to win. Every winning coalition includes them, and removing them causes every coalition to lose." />
                <PowerRole icon="🛡" title="Veto Player(s)" color="var(--accent-blue)" member={banzhaf.vetoPlayers.length > 0 ? banzhaf.vetoPlayers.map(m => m.name).join(', ') : null} noMemberText="No veto players identified." explanation="A veto player can block any decision. Without their support, no majority is possible — but they aren't powerful enough to win alone." />
                <PowerRole icon="👻" title="Dummy Player(s)" color="var(--text-muted)" member={banzhaf.dummies.length > 0 ? banzhaf.dummies.map(m => m.name).join(', ') : null} noMemberText="No dummy players — everyone received votes." explanation="A dummy received zero Borda points. Their presence or absence never changes the outcome of any coalition." />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button className="btn-ghost" onClick={exportCSV} style={{ fontSize: '0.85rem' }}>⬇ Export CSV</button>
                <button className="btn-ghost" onClick={() => { window.print(); toast.success('Print dialog opened.') }} style={{ fontSize: '0.85rem' }}>🖨 Print / PDF</button>
              </div>
              {isCreator && (
                <button className="btn-danger" onClick={endSession} disabled={ending} style={{ width: '100%' }}>
                  {ending ? 'Ending…' : '✕ End Session'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  )
}

function PowerRole({ icon, title, color, member, noMemberText, explanation }) {
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color }}>{title}</span>
        {member && <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginLeft: '0.25rem' }}>— {member}</span>}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
        {member ? explanation : noMemberText}
      </p>
    </div>
  )
}