import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { computeProjectedWinRates, computeGroupSuccessScore } from '../utils/votingTheory'
import PageWrapper from '../components/PageWrapper'

export default function PreVote() {
  const navigate = useNavigate()
  const { room, currentMember, isCreator, updateRoomStatus } = useAppStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!room || !currentMember) { navigate('/'); return }
    fetchMembers()
    // Listen for room status → voting
    const channel = supabase
      .channel(`prevote-${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`, 
      }, payload => {
        if (payload.new.status === 'voting') {
          updateRoomStatus('voting')
          navigate('/ballot')
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [room])

  async function fetchMembers() {
    const { data } = await supabase.from('members').select('*').eq('room_id', room.id).order('member_no')
    if (data) setMembers(data)
    setLoading(false)
  }

  const { data: roomData } = await supabase
    .from('rooms').select('status').eq('id', room.id).single()
  if (roomData?.status === 'voting') {
    updateRoomStatus('voting')
    navigate('/ballot')
  } // Hello

  async function startVoting() {
    setStarting(true)
    const { error } = await supabase.from('rooms').update({ status: 'voting' }).eq('id', room.id)
    if (error) { toast.error('Failed to start voting.'); setStarting(false); return }
    updateRoomStatus('voting')
    navigate('/ballot')
  }

  if (!room || !currentMember) return null

  const withRates = computeProjectedWinRates(members)
  const groupScore = computeGroupSuccessScore(members)
  const maxRate = Math.max(...withRates.map(m => m.projectedWinRate), 0)

  return (
    <PageWrapper>
      <div className="page" style={{ paddingTop: '2.5rem' }}>
        <div className="page-inner">

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <span className="badge badge-gold" style={{ marginBottom: '0.75rem' }}>Pre-Vote Analysis</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem' }}>{room.name}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Review the group's projected performance before voting begins.
            </p>
          </div>

          {loading ? <LoadingState /> : (
            <>
              {/* Group success score */}
              <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'var(--accent-blue-dim)',
                  border: '2px solid var(--accent-blue)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-blue)', lineHeight: 1 }}>{groupScore}</span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>/ 10</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>Group Success Score</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Average performance rating across all {members.length} members.
                    {groupScore >= 7 ? ' 🟢 Strong group!' : groupScore >= 5 ? ' 🟡 Decent potential.' : ' 🔴 Room to grow.'}
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1.25rem' }}>
                  Projected Win Rate
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {withRates.sort((a, b) => b.win_rate - a.win_rate).map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{m.member_no}. {m.name}</span>
                        <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{m.projectedWinRate}%</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg-raised)', borderRadius: 4, overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.projectedWinRate / maxRate) * 100}%` }}
                          transition={{ delay: 0.2 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          style={{
                            height: '100%',
                            background: i === 0
                              ? 'linear-gradient(90deg, var(--accent-gold), #f9d56a)'
                              : 'linear-gradient(90deg, var(--accent-blue), #6b9ef9)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Member table */}
              <div className="card" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>
                  Member Summary
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Name', 'Rating', 'Win Rate', 'Skills'].map(h => (
                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withRates.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>{m.member_no}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                          {m.name}
                          {m.id === currentMember?.id && <span style={{ color: 'var(--accent-blue)', fontSize: '0.72rem', marginLeft: '0.4rem' }}>(you)</span>}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span style={{ color: ratingColor(m.performance_rating), fontWeight: 700 }}>{m.performance_rating}</span>
                          <span style={{ color: 'var(--text-muted)' }}>/10</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{m.projectedWinRate}%</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{m.skills || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isCreator ? (
                <button
                  className="btn-primary"
                  onClick={startVoting}
                  disabled={starting}
                  style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}
                >
                  {starting ? 'Opening ballots…' : '🗳 Start Voting →'}
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '0.5rem' }}>
                    <span /><span /><span />
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Waiting for the creator to open the ballot…</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function LoadingState() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
        <span /><span /><span />
      </div>
    </div>
  )
}

function ratingColor(r) {
  if (r >= 8) return '#34d399'
  if (r >= 5) return '#F7C948'
  return '#f87171'
}