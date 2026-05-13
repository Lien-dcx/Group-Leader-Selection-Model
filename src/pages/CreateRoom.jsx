import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import useAppStore from '../store/useAppStore'
import { supabase } from '../lib/supabase'
import { generateRoomCode } from '../utils/votingTheory'

export default function CreateRoom() {
  const navigate = useNavigate()
  const { setRoom, setCurrentMember } = useAppStore()
  const [roomName, setRoomName] = useState('')
  const [form, setForm] = useState({
    name: '',
    performance_rating: '',
    skills: '',
    strengths: '',
    experiences: '',
  })
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!roomName.trim() || !form.name.trim() || !form.performance_rating) {
      toast.error('Please fill in all required fields')
      return
    }
    const rating = parseInt(form.performance_rating)
    if (isNaN(rating) || rating < 1 || rating > 10) {
      toast.error('Performance rating must be between 1 and 10')
      return
    }
    setLoading(true)
    try {
      const code = generateRoomCode()

      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .insert({ code, name: roomName.trim(), status: 'waiting' })
        .select()
        .single()

      if (roomErr) throw roomErr

      const { data: memberData, error: memErr } = await supabase
        .from('members')
        .insert({
          room_id: roomData.id,
          member_no: 1,
          name: form.name.trim(),
          performance_rating: rating,
          skills: form.skills.trim() || null,
          strengths: form.strengths.trim() || null,
          experiences: form.experiences.trim() || null,
          is_creator: true,
        })
        .select()
        .single()

      if (memErr) throw memErr

      await supabase
        .from('rooms')
        .update({ creator_id: memberData.id })
        .eq('id', roomData.id)

      setRoom({ ...roomData, creator_id: memberData.id })
      setCurrentMember(memberData)
      toast.success('Room created!')
      navigate('/lobby')
    } catch (err) {
      toast.error('Failed to create room. Check your Supabase config.')
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
          style={{ width: '100%', maxWidth: 600 }}
        >
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Back
          </button>

          <h2 className="font-display" style={{ fontSize: 36, marginBottom: 6 }}>Create a Room</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
            You'll be registered as Member #1 and become the room creator.
          </p>

          {/* Room Details */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 16 }}>
              ROOM DETAILS
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                ROOM / SESSION NAME <span style={{ color: '#f87171' }}>*</span>
              </label>
              <input
                className="input-base"
                placeholder="e.g. CS102 Group 4"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
              />
            </div>
          </div>

          {/* Your Profile */}
          <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 16 }}>
              YOUR PROFILE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  placeholder="e.g. 8"
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
                  placeholder="e.g. Python, Project Management"
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
                  placeholder="e.g. Leadership, Communication"
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
            className="btn-primary"
            onClick={handleCreate}
            disabled={loading}
            style={{ width: '100%', padding: '16px', fontSize: 16 }}
          >
            {loading ? 'Creating...' : 'Create Room & Continue →'}
          </button>
        </motion.div>
      </div>
    </PageWrapper>
  )
}