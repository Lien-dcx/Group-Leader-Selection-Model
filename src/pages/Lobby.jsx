import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

const RED = '#DC2626'

export default function Lobby() {
  const navigate = useNavigate()
  const { room, currentMember, updateRoomStatus } = useAppStore()
  const [members, setMembers] = useState([])
  const [locking, setLocking] = useState(false)
  const isCreator = currentMember?.is_creator

  useEffect(() => {
    if (!room || !currentMember) navigate('/')
  }, [room, currentMember])

  useEffect(() => {
    if (!room) return
    supabase.from('members').select('*').eq('room_id', room.id).order('member_no')
      .then(({ data }) => { if (data) setMembers(data) })
  }, [room])

  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`lobby-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'members',
        filter: `room_id=eq.${room.id}`,
      }, payload => {
        setMembers(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new].sort((a, b) => a.member_no - b.member_no)
        })
        toast(`${payload.new.name} joined the room!`, { icon: '👋' })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`,
      }, payload => {
        if (payload.new.status === 'locked') {
          updateRoomStatus('locked')
          toast.success('Room is locked. Preparing analysis…')
          setTimeout(() => navigate('/pre-vote'), 1200)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [room])

  async function lockRoom() {
    if (members.length < 2) { toast.error('You need at least 2 members to start voting.'); return }
    setLocking(true)
    const { error } = await supabase.from('rooms').update({ status: 'locked' }).eq('id', room.id)
    if (error) { toast.error('Failed to lock room.'); setLocking(false); return }
    updateRoomStatus('locked')
    navigate('/pre-vote')
  }

  async function copyCode() {
    await navigator.clipboard.writeText(room?.code || '')
    toast.success('Room code copied!')
  }

  if (!room || !currentMember) return null

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

        <div style={{ padding: '32px 24px', maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.25)',
                      color: RED,
                      padding: '2px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    ● WAITING
                  </span>
                </div>
                <h1 className="font-display" style={{ fontSize: 30, marginBottom: 4, color: '#111827' }}>
                  {room.name}
                </h1>
                <p style={{ color: '#6B7280', fontSize: 14 }}>
                  {isCreator
                    ? 'Share the code below with your group members.'
                    : "You're in! Waiting for the creator to lock the room."}
                </p>
              </div>

              {/* Room code badge */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(245,158,11,0.2)',
                  borderRadius: 14,
                  padding: '12px 20px',
                  textAlign: 'center',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.08)',
                }}
              >
                <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Room Code
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: '0.18em',
                    color: 'rgb(245, 158, 11)',
                  }}
                >
                  {room.code}
                </div>
                <button
                  onClick={copyCode}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#9CA3AF',
                    cursor: 'pointer',
                    fontSize: 11,
                    marginTop: 4,
                  }}
                >
                  tap to copy
                </button>
              </div>
            </div>
          </motion.div>

          {/* Members list */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: RED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Members — {members.length} joined
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {members.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      background: m.id === currentMember?.id ? 'rgba(220,38,38,0.1)' : '#ffffff',
                      border: `1px solid ${m.id === currentMember?.id ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.12)'}`,
                      borderRadius: 12,
                      padding: '14px 16px',
                      boxShadow: '0 1px 4px rgba(220,38,38,0.04)',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: m.is_creator ? 'rgba(254, 255, 166, 0.57)' : '#fff3f3',
                        border: `1px solid ${m.is_creator ? 'rgba(245, 158, 11,0.35)' : 'rgba(220,38,38,0.15)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        fontWeight: 700,
                        color: m.is_creator ? 'rgb(245, 158, 11)' : '#9CA3AF',
                        flexShrink: 0,
                      }}
                    >
                      {m.member_no}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{m.name}</span>
                        {m.is_creator && (
                          <span
                            style={{
                              background: 'rgba(254, 255, 166, 0.57)',
                              color: 'rgb(245, 158, 11)',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: 10,
                            }}
                          >
                            CREATOR
                          </span>
                        )}
                        {m.id === currentMember?.id && !m.is_creator && (
                          <span
                            style={{
                              background: 'rgba(220,38,38,0.08)',
                              color: RED,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: 10,
                            }}
                          >
                            YOU
                          </span>
                        )}
                      </div>
                      {(m.skills || m.strengths) && (
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[m.skills, m.strengths].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: getRatingColor(m.performance_rating) }}>
                        {m.performance_rating}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>/ 10</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {members.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9CA3AF', fontSize: 14 }}>
                  No members yet. Share the room code!
                </div>
              )}
            </div>
          </div>

          {isCreator && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 16,
                  padding: 20,
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, color: '#111827' }}>Ready to begin?</div>
                    <div style={{ fontSize: 13, color: '#6B7280' }}>
                      Locking the room will close registration and move to analysis.
                    </div>
                  </div>
                  <button
                    onClick={lockRoom}
                    disabled={locking || members.length < 2}
                    style={{
                      padding: '10px 20px',
                      fontWeight: 700,
                      fontSize: 14,
                      background: (locking || members.length < 2) ? 'rgba(220,38,38,0.4)' : RED,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      cursor: (locking || members.length < 2) ? 'not-allowed' : 'pointer',
                      boxShadow: '0 3px 12px rgba(220,38,38,0.25)',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!locking && members.length >= 2) e.currentTarget.style.background = '#b91c1c' }}
                    onMouseLeave={e => { if (!locking && members.length >= 2) e.currentTarget.style.background = RED }}
                  >
                    {locking ? 'Locking...' : `Lock Room (${members.length} members)`}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {!isCreator && (
            <div style={{ textAlign: 'center', padding: '16px', color: '#9CA3AF', fontSize: 13 }}>
              Waiting for the room creator to lock the session and start...
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function getRatingColor(r) {
  if (r >= 8) return '#22C55E'
  if (r >= 5) return '#DC2626'
  return '#6B7280'
}