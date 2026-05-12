import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

export default function Lobby() {
  const navigate = useNavigate()
  const { room, currentMember, isCreator, updateRoomStatus } = useAppStore()
  const [members, setMembers] = useState([])
  const [locking, setLocking] = useState(false)

  // Redirect if no session
  useEffect(() => {
    if (!room || !currentMember) navigate('/')
  }, [room, currentMember])

  // Load initial members
  useEffect(() => {
    if (!room) return
    supabase.from('members').select('*').eq('room_id', room.id).order('member_no')
      .then(({ data }) => { if (data) setMembers(data) })
  }, [room])

  // Realtime: new members joining
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
        toast(`${payload.new.full_name} joined the room!`, { icon: '👋' })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`,
      }, payload => {
        if (payload.new.status === 'locked') {
          updateRoomStatus('locked')
          toast.success('Room is locked. Preparing analysis…')
          setTimeout(() => navigate('/prevote'), 1200)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [room])

  async function lockRoom() {
    if (members.length < 2) {
      toast.error('You need at least 2 members to start voting.')
      return
    }
    setLocking(true)
    const { error } = await supabase.from('rooms').update({ status: 'locked' }).eq('id', room.id)
    if (error) { toast.error('Failed to lock room.'); setLocking(false); return }
    updateRoomStatus('locked')
    navigate('/prevote')
  }

  async function copyCode() {
    await navigator.clipboard.writeText(room?.code || '')
    toast.success('Room code copied!')
  }

  if (!room || !currentMember) return null

  return (
    <PageWrapper>
      <div className="page" style={{ paddingTop: '2.5rem' }}>
        <div className="page-inner">

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>{room.name}</h1>
              <span className="badge badge-blue">
                <LiveDot /> Waiting for members
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {isCreator ? 'Share the room code below with your group members.' : `You're in! Waiting for the creator to lock the room.`}
            </p>
          </div>

          {/* Room code */}
          <div className="card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <p className="label" style={{ marginBottom: '0.75rem' }}>Room Code — Share this</p>
            <div style={{ marginBottom: '1rem' }}>
              <span className="room-code">{room.code}</span>
            </div>
            <button className="btn-ghost" onClick={copyCode} style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
              📋 Copy Code
            </button>
          </div>

          {/* Member list */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem' }}>
                Members
              </h2>
              <span className="badge badge-blue">{members.length} joined</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <AnimatePresence>
                {members.map(m => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-raised)',
                      borderRadius: 'var(--radius-sm)',
                      border: m.id === currentMember?.id ? '1px solid rgba(79,142,247,0.3)' : '1px solid transparent',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--accent-blue-dim)',
                      border: '1px solid rgba(79,142,247,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-blue)',
                      flexShrink: 0,
                    }}>
                      {m.member_no}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {m.full_name}
                        {m.id === currentMember?.id && <span style={{ color: 'var(--accent-blue)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(you)</span>}
                        {room.creator_member_id === m.id && <span style={{ color: 'var(--accent-gold)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>★ creator</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Performance: {m.performance_rating}/10
                        {m.skills && ` · ${m.skills}`}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.75rem', fontWeight: 700,
                      color: ratingColor(m.performance_rating),
                      background: ratingBg(m.performance_rating),
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                    }}>
                      {m.performance_rating}/10
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {members.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Waiting for members to join…
                </div>
              )}
            </div>
          </div>

          {/* Creator actions */}
          {isCreator && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                className="btn-gold"
                onClick={lockRoom}
                disabled={locking || members.length < 2}
                style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}
              >
                {locking ? 'Locking…' : `🔒 Lock Room & Start Analysis (${members.length} members)`}
              </button>
              {members.length < 2 && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Need at least 2 members to proceed.
                </p>
              )}
            </div>
          )}

          {!isCreator && (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '0.5rem' }}>
                <span /><span /><span />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Waiting for the creator to lock the room…</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function LiveDot() {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: '#4ade80',
      animation: 'pulse-dot 1.5s infinite ease-in-out',
    }} />
  )
}

function ratingColor(r) {
  if (r >= 8) return '#34d399'
  if (r >= 5) return '#F7C948'
  return '#f87171'
}
function ratingBg(r) {
  if (r >= 8) return 'rgba(52,211,153,0.12)'
  if (r >= 5) return 'rgba(247,201,72,0.12)'
  return 'rgba(248,113,113,0.12)'
}