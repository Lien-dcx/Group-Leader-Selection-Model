import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import { computeProjectedWinRates, computeGroupSuccessScore } from '../utils/votingTheory'
import PageWrapper from '../components/PageWrapper'

const RED = '#DC2626'

export default function PreVote() {
  const navigate = useNavigate()
  const { room, currentMember, isCreator, updateRoomStatus } = useAppStore()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!room || !currentMember) { navigate('/'); return }
    fetchMembers()
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

        <div style={{ padding: '2.5rem 1.5rem', maxWidth: 680, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: RED,
                padding: '3px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Pre-Vote Analysis
            </span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem', color: '#111827' }}>
              {room.name}
            </h1>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              Review the group's projected performance before voting begins.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }} className="dot-pulse">
                <span /><span /><span />
              </div>
            </div>
          ) : (
            <>
              {/* Group success score */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 16,
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    background: 'rgba(220,38,38,0.08)',
                    border: `2px solid ${RED}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: RED, lineHeight: 1 }}>{groupScore}</span>
                  <span style={{ fontSize: '0.6rem', color: '#9CA3AF', letterSpacing: '0.05em' }}>/ 10</span>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem', color: '#111827' }}>
                    Group Success Score
                  </div>
                  <div style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                    Average performance rating across all {members.length} members.
                    {groupScore >= 7 ? ' 🟢 Strong group!' : groupScore >= 5 ? ' 🟡 Decent potential.' : ' 🔴 Room to grow.'}
                  </div>
                </div>
              </div>

              {/* Bar chart */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 16,
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1.25rem', color: '#111827' }}>
                  Projected Win Rate
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {withRates.sort((a, b) => b.projectedWinRate - a.projectedWinRate).map((m, i) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>{m.member_no}. {m.name}</span>
                        <span style={{ color: i === 0 ? RED : '#F59E0B', fontWeight: 700 }}>{m.projectedWinRate}%</span>
                      </div>
                      <div style={{ height: 8, background: '#fff3f3', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(220,38,38,0.1)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(m.projectedWinRate / maxRate) * 100}%` }}
                          transition={{ delay: 0.2 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          style={{
                            height: '100%',
                            background: i === 0
                              ? `linear-gradient(90deg, ${RED}, #f87171)`
                              : 'linear-gradient(90deg, #F59E0B, #fcd34d)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Member table */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 16,
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  overflowX: 'auto',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <h2 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem', color: '#111827' }}>
                  Member Summary
                </h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(220,38,38,0.12)' }}>
                      {['#', 'Name', 'Rating', 'Win Rate', 'Skills'].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: '0.5rem 0.75rem',
                            textAlign: 'left',
                            color: RED,
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withRates.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(220,38,38,0.08)' }}>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#9CA3AF' }}>{m.member_no}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#111827' }}>
                          {m.name}
                          {m.id === currentMember?.id && (
                            <span style={{ color: RED, fontSize: '0.72rem', marginLeft: '0.4rem' }}>(you)</span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span style={{ color: ratingColor(m.performance_rating), fontWeight: 700 }}>{m.performance_rating}</span>
                          <span style={{ color: '#9CA3AF' }}>/10</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: RED, fontWeight: 600 }}>{m.projectedWinRate}%</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#6B7280', fontSize: '0.78rem' }}>{m.skills || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isCreator ? (
                <button
                  onClick={startVoting}
                  disabled={starting}
                  style={{
                    width: '100%',
                    padding: '0.9rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    background: starting ? 'rgba(220,38,38,0.4)' : RED,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    cursor: starting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (!starting) e.currentTarget.style.background = '#b91c1c' }}
                  onMouseLeave={e => { if (!starting) e.currentTarget.style.background = RED }}
                >
                  {starting ? 'Opening ballots…' : '🗳 Start Voting →'}
                </button>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', padding: '1rem 1rem 1.25rem' }}>
                    <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '0.5rem' }}>
                      <span /><span /><span />
                    </div>
                    <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>Waiting for the creator to open the ballot…</p>
                  </div>
                  <button
                    onClick={() => navigate('/ballot')}
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      background: RED,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 12,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
                    }}
                  >
                    🗳 Go to Ballot →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function ratingColor(r) {
  if (r >= 8) return '#DC2626'
  if (r >= 5) return '#F59E0B'
  return '#9CA3AF'
}