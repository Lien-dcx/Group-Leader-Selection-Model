import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

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
    if (members.length < 2) {
      toast.error('You need at least 2 members to start voting.')
      return
    }
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
      <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 640, margin: '0 auto' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ background: 'rgba(61,214,163,0.1)', border: '1px solid rgba(61,214,163,0.2)', color: 'var(--accent-teal)', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  ● WAITING
                </span>
              </div>
              <h1 className="font-display" style={{ fontSize: 30, marginBottom: 4 }}>{room.name}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                {isCreator ? 'Share the code below with your group members.' : "You're in! Waiting for the creator to lock the room."}
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: '0.08em' }}>ROOM CODE</div>
              <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, letterSpacing: '0.15em', color: 'var(--accent-gold)' }}>
                {room.code}
              </div>
              <button onClick={copyCode} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, marginTop: 4 }}>
                tap to copy
              </button>
            </div>
          </div>
        </motion.div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              MEMBERS — {members.length} joined
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
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: m.id === currentMember?.id ? 'rgba(79,142,247,0.06)' : 'var(--bg-surface)',
                    border: `1px solid ${m.id === currentMember?.id ? 'rgba(79,142,247,0.2)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '14px 16px',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: m.is_creator ? 'rgba(247,201,72,0.15)' : 'var(--bg-elevated)',
                    border: `1px solid ${m.is_creator ? 'rgba(247,201,72,0.3)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700,
                    color: m.is_creator ? 'var(--accent-gold)' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}>
                    {m.member_no}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
                      {m.is_creator && (
                        <span style={{ background: 'rgba(247,201,72,0.1)', color: 'var(--accent-gold)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                          CREATOR
                        </span>
                      )}
                      {m.id === currentMember?.id && !m.is_creator && (
                        <span style={{ background: 'rgba(79,142,247,0.1)', color: 'var(--accent-blue)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                          YOU
                        </span>
                      )}
                    </div>
                    {(m.skills || m.strengths) && (
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[m.skills, m.strengths].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: getRatingColor(m.performance_rating) }}>
                      {m.performance_rating}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>/ 10</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {members.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)', fontSize: 14 }}>
                No members yet. Share the room code!
              </div>
            )}
          </div>
        </div>

        {isCreator && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="glass-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Ready to begin?</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Locking the room will close registration and move to analysis.
                  </div>
                </div>
                <button className="btn-gold" onClick={lockRoom} disabled={locking || members.length < 2}>
                  {locking ? 'Locking...' : `Lock Room (${members.length} members)`}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {!isCreator && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dim)', fontSize: 13 }}>
            Waiting for the room creator to lock the session and start...
          </div>
        )}
      </div>
    </PageWrapper>
  )
}

function getRatingColor(r) {
  if (r >= 8) return '#3DD6A3'
  if (r >= 5) return 'var(--accent-blue)'
  return 'var(--text-muted)'
}