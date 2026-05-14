import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import {
  computebordaScores,
  classifyPowerRoles,
} from '../utils/votingTheory'
import PageWrapper from '../components/PageWrapper'

export default function Results() {
  const navigate = useNavigate()
  const { room, currentMember, isCreator, clearSession } = useAppStore()
  const [ranked, setRanked]       = useState([])
  const [banzhaf, setBanzhaf]     = useState({ dictator: null, vetoPlayers: [], dummies: [] })
  const [firstChoice, setFirstChoice] = useState([])
  const [loading, setLoading]     = useState(true)
  const [ending, setEnding]       = useState(false)

  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!room || !currentMember) { navigate('/'); return }
    fetchResults()
}, [hydrated, room])

  async function fetchResults() {
    const [{ data: members, error: mErr }, { data: ballots, error: bErr }] = await Promise.all([
      supabase.from('members').select('*').eq('room_id', room.id).order('member_no'),
      supabase.from('ballots').select('*').eq('room_id', room.id),
    ])
    if (mErr || bErr) { toast.error('Failed to load results.'); setLoading(false); return }
    if (!members || !ballots) { setLoading(false); return }

    // Borda scores

    // First-choice votes — rank === 1 means top pick
    const fcMap = {}
    members.forEach(m => { fcMap[m.id] = 0 })
    ballots.forEach(ballot => {
      const top = ballot.rankings.find(entry => entry.rank === 1)
      if (top && fcMap[top.candidate_id] !== undefined) fcMap[top.candidate_id]++
    })
    const rWithFC = r.map(m => ({ ...m, first_choice_votes: fcMap[m.id] || 0 }))

    // Banzhaf — classifyPowerRoles returns an array, reshape it
    const classified = classifyPowerRoles(rWithFC)
    const dictator   = classified.find(m => m.powerRole === 'dictator') || null
    const vetoPlayers = classified.filter(m => m.powerRole === 'veto')
    const dummies     = classified.filter(m => m.powerRole === 'dummy')

    setRanked(rWithFC)
    setFirstChoice(rWithFC)
    setBanzhaf({ dictator, vetoPlayers, dummies })
    setLoading(false)
  }

  async function endSession() {
    setEnding(true)
    const winner = ranked[0]
    await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
    //useAppStore.setState({ room: { ...room, winner_name: winner?.name } })
    useAppStore.setState({ results: ranked }) 
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

  function exportPDF() {
    window.print()
    toast.success('Print dialog opened — save as PDF.')
  }

  if (!room || !currentMember) return null
  const winner = ranked[0]
  const maxScore = Math.max(...ranked.map(m => m.bordaScore), 1)

  return (
    <PageWrapper>
      <div className="page" style={{ paddingTop: '2.5rem' }}>
        <div className="page-inner">

          {/* Header */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>Final Results</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', marginBottom: '0.3rem' }}>{room.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{ranked.length} members · {ranked.length} ballots cast</p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}><span /><span /><span /></div>
            </div>
          ) : (
            <>
              {/* Winner card */}
              {winner && (
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    background: 'linear-gradient(135deg, rgba(247,201,72,0.12) 0%, rgba(247,201,72,0.05) 100%)',
                    border: '1.5px solid rgba(247,201,72,0.35)',
                    borderRadius: 'var(--radius)',
                    padding: '2rem',
                    textAlign: 'center',
                    marginBottom: '1.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👑</div>
                  <p style={{ color: 'var(--accent-gold)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Group Leader
                  </p>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', color: 'var(--accent-gold)', marginBottom: '0.4rem' }}>
                    {winner.name}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {winner.bordaScore} Borda points · Member #{winner.member_no}
                  </p>
                </motion.div>
              )}

              {/* Leaderboard */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1.1rem' }}>
                  Rankings
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                          padding: '0.85rem 1rem',
                          background: i === 0 ? 'rgba(247,201,72,0.07)' : 'var(--bg-raised)',
                          border: i === 0 ? '1px solid rgba(247,201,72,0.2)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{
                          minWidth: 28, height: 28, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.8rem',
                          background: i === 0 ? 'var(--accent-gold-dim)' : 'var(--bg-base)',
                          color: i === 0 ? 'var(--accent-gold)' : i === 1 ? 'var(--text-secondary)' : 'var(--text-muted)',
                          border: `1px solid ${i === 0 ? 'rgba(247,201,72,0.3)' : 'var(--border)'}`,
                          flexShrink: 0,
                        }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {m.name}
                            {i === 0 && <span style={{ fontSize: '0.9rem' }}>👑</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {fc?.first_choice_votes ?? 0} first-choice vote{fc?.first_choice_votes !== 1 ? 's' : ''}
                          </div>
                        </div>
                        {/* Score bar */}
                        <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: i === 0 ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                            {m.bordaScore} pts
                          </span>
                          <div style={{ width: '100%', height: 4, background: 'var(--bg-base)', borderRadius: 2, overflow: 'hidden' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(m.bordaScore / maxScore) * 100}%` }}
                              transition={{ delay: 0.3 + i * 0.07, duration: 0.5 }}
                              style={{
                                height: '100%',
                                background: i === 0 ? 'var(--accent-gold)' : 'var(--accent-blue)',
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>

              {/* Banzhaf Power Index */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                  Voting Power Analysis
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '1.1rem' }}>
                  Based on Banzhaf Power Index approximation
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <PowerRole
                    icon="⚡"
                    title="Dictator"
                    color="#f87171"
                    colorDim="rgba(248,113,113,0.1)"
                    member={banzhaf.dictator?.name || null}
                    noMemberText="No dictator — power is distributed."
                    explanation="A dictator's support alone is enough to win. Every winning coalition includes them, and removing them causes every coalition to lose."
                  />
                  <PowerRole
                    icon="🛡"
                    title="Veto Player(s)"
                    color="var(--accent-blue)"
                    colorDim="var(--accent-blue-dim)"
                    member={banzhaf.vetoPlayers.length > 0 ? banzhaf.vetoPlayers.map(m => m.name).join(', ') : null}
                    noMemberText="No veto players identified."
                    explanation="A veto player can block any decision. Without their support, no majority is possible — but they aren't powerful enough to win alone."
                  />
                  <PowerRole
                    icon="👻"
                    title="Dummy Player(s)"
                    color="var(--text-muted)"
                    colorDim="var(--bg-raised)"
                    member={banzhaf.dummies.length > 0 ? banzhaf.dummies.map(m => m.name).join(', ') : null}
                    noMemberText="No dummy players — everyone received votes."
                    explanation="A dummy received zero Borda points. Their presence or absence never changes the outcome of any coalition."
                  />
                </div>
              </div>

              {/* Export + end */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button className="btn-ghost" onClick={exportCSV} style={{ fontSize: '0.85rem' }}>
                    ⬇ Export CSV
                  </button>
                  <button className="btn-ghost" onClick={exportPDF} style={{ fontSize: '0.85rem' }}>
                    🖨 Print / PDF
                  </button>
                </div>
                {isCreator && (
                  <button
                    className="btn-danger"
                    onClick={endSession}
                    disabled={ending}
                    style={{ width: '100%' }}
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

function PowerRole({ icon, title, color, colorDim, member, noMemberText, explanation }) {
  return (
    <div style={{
      background: colorDim,
      border: `1px solid ${color === 'var(--text-muted)' ? 'var(--border)' : color.replace(')', ',0.2)').replace('rgb', 'rgba').replace('var(--accent-blue-dim)', 'rgba(79,142,247,0.2)')}`,
      borderRadius: 'var(--radius-sm)',
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '1rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color }}>{title}</span>
        {member && (
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginLeft: '0.25rem' }}>
            — {member}
          </span>
        )}
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {member ? explanation : noMemberText}
      </p>
    </div>
  )
}