import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import useAppStore from '../store/useAppStore'
import { supabase } from '../lib/supabase'

export default function JoinRoom() {
  const navigate = useNavigate()
  const { setRoom, setCurrentMember } = useAppStore()

  const [step, setStep] = useState(1)
  const [code, setCode] = useState('')
  const [foundRoom, setFoundRoom] = useState(null)
  const [existingMembers, setExistingMembers] = useState([])
  const [form, setForm] = useState({
    name: '',
    performance_rating: '',
    skills: '',
    strengths: '',
    experiences: '',
  })
  const [loading, setLoading] = useState(false)

  const handleFindRoom = async () => {
    if (!code.trim()) return
    setLoading(true)
    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single()

      if (error || !room) { toast.error('Room not found. Check the code.'); return }
      if (room.status === 'done') { toast.error('This session has ended.'); return }
      if (room.status === 'voting') { toast.error('Voting has already started in this room.'); return }
      if (room.status === 'locked') { toast.error('This room is locked. Registration is closed.'); return }

      const { data: members } = await supabase
        .from('members')
        .select('*')
        .eq('room_id', room.id)
        .order('member_no')

      setFoundRoom(room)
      setExistingMembers(members || [])
      setStep(2)
    } catch (err) {
      toast.error('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!form.name.trim() || !form.performance_rating) {
      toast.error('Name and performance rating are required')
      return
    }
    const rating = parseInt(form.performance_rating)
    if (isNaN(rating) || rating < 1 || rating > 10) {
      toast.error('Performance rating must be between 1 and 10')
      return
    }
    setLoading(true)
    try {
      const nextNo = existingMembers.length + 1

      const { data: member, error } = await supabase
        .from('members')
        .insert({
          room_id: foundRoom.id,
          member_no: nextNo,
          name: form.name.trim(),
          performance_rating: rating,
          skills: form.skills.trim() || null,
          strengths: form.strengths.trim() || null,
          experiences: form.experiences.trim() || null,
          is_creator: false,
        })
        .select()
        .single()

      if (error) throw error

      setRoom(foundRoom)
      setCurrentMember(member)
     // setMembers([...existingMembers, member])
      toast.success('Joined successfully!')
      navigate('/lobby')
    } catch (err) {
      toast.error('Failed to join room.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 500 }}
        >
          <button
            onClick={() => step === 1 ? navigate('/') : setStep(1)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← {step === 1 ? 'Back' : 'Change room'}
          </button>

          <h2 className="font-display" style={{ fontSize: 36, marginBottom: 6 }}>Join a Room</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
            Enter the 6-character room code shared by your group leader.
          </p>

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="glass-card" style={{ padding: 28 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 10 }}>
                  ROOM CODE *
                </label>
                <input
                  className="input-base"
                  placeholder="e.g. AB12CD"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleFindRoom()}
                  style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, letterSpacing: '0.15em' }}
                  maxLength={6}
                />
              </div>

              <button
                className="btn-primary"
                onClick={handleFindRoom}
                disabled={loading || code.length < 6}
                style={{ width: '100%', padding: '16px', fontSize: 16 }}
              >
                {loading ? 'Searching...' : 'Find Room →'}
              </button>
            </div>
          )}

          {step === 2 && foundRoom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="glass-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ background: 'rgba(61,214,163,0.1)', border: '1px solid rgba(61,214,163,0.2)', color: 'var(--accent-teal)', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    ✓ Room found
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>{foundRoom.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                  {existingMembers.length} member{existingMembers.length !== 1 ? 's' : ''} already joined
                </div>
              </div>

              <div className="glass-card" style={{ padding: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 16 }}>
                  YOUR PROFILE
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      FULL NAME <span style={{ color: '#f87171' }}>*</span>
                    </label>
                    <input
                      className="input-base"
                      placeholder="Your full name"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      PERFORMANCE RATING <span style={{ color: '#f87171' }}>*</span>
                      <span style={{ fontWeight: 400, marginLeft: 4 }}>(1 – 10)</span>
                    </label>
                    <input
                      className="input-base"
                      type="number"
                      min={1}
                      max={10}
                      placeholder="e.g. 7"
                      value={form.performance_rating}
                      onChange={e => setForm(f => ({ ...f, performance_rating: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      SKILLS <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(OPTIONAL)</span>
                    </label>
                    <input
                      className="input-base"
                      placeholder="e.g. Design, Research"
                      value={form.skills}
                      onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      STRENGTHS <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(OPTIONAL)</span>
                    </label>
                    <input
                      className="input-base"
                      placeholder="e.g. Creativity, Teamwork"
                      value={form.strengths}
                      onChange={e => setForm(f => ({ ...f, strengths: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      EXPERIENCES <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(OPTIONAL)</span>
                    </label>
                    <textarea
                      className="input-base"
                      placeholder="Brief background..."
                      rows={3}
                      value={form.experiences}
                      onChange={e => setForm(f => ({ ...f, experiences: e.target.value }))}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              <button
                className="btn-gold"
                onClick={handleJoin}
                disabled={loading}
                style={{ width: '100%', padding: '16px', fontSize: 16 }}
              >
                {loading ? 'Joining...' : 'Join Room →'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </PageWrapper>
  )
}