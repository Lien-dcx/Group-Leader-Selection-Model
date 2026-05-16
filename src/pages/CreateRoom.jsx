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

      await supabase.from('rooms').update({ creator_id: memberData.id }).eq('id', roomData.id)

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
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#fff3f3',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red grid background */}
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
        {/* Red glow orb */}
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

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 600, position: 'relative', zIndex: 1 }}
        >
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#DC2626',
              cursor: 'pointer',
              fontSize: 14,
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600,
              opacity: 0.8,
            }}
          >
            ← Back
          </button>

          <h2
            className="font-display"
            style={{ fontSize: 36, marginBottom: 6, color: '#111827' }}
          >
            Create a Room
          </h2>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28 }}>
            You'll be registered as Member #1 and become the room creator.
          </p>

          {/* Room Details */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(220,38,38,0.15)',
              borderRadius: 16,
              padding: 28,
              marginBottom: 16,
              boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#DC2626',
                marginBottom: 16,
                textTransform: 'uppercase',
              }}
            >
              Room Details
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: 6,
                }}
              >
                ROOM / SESSION NAME <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                className="input-base"
                placeholder="e.g. CS102 Group 4"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                style={{
                  background: '#fff3f3',
                  border: '1px solid rgba(220,38,38,0.2)',
                  color: '#111827',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                }}
              />
            </div>
          </div>

          {/* Your Profile */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(220,38,38,0.15)',
              borderRadius: 16,
              padding: 28,
              marginBottom: 20,
              boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: '#DC2626',
                marginBottom: 16,
                textTransform: 'uppercase',
              }}
            >
              Your Profile
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'FULL NAME', key: 'name', placeholder: 'Your full name', required: true },
                { label: 'PERFORMANCE RATING', key: 'performance_rating', placeholder: 'e.g. 8', required: true, suffix: '(1 – 10)', type: 'number' },
                { label: 'SKILLS', key: 'skills', placeholder: 'e.g. Python, Project Management' },
                { label: 'STRENGTHS', key: 'strengths', placeholder: 'e.g. Leadership, Communication' },
              ].map(({ label, key, placeholder, required, suffix, type }) => (
                <div key={key}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: 6,
                    }}
                  >
                    {label}{' '}
                    {required ? (
                      <span style={{ color: '#DC2626' }}>*</span>
                    ) : (
                      <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span>
                    )}
                    {suffix && <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 4 }}>{suffix}</span>}
                  </label>
                  <input
                    className="input-base"
                    type={type || 'text'}
                    min={type === 'number' ? 1 : undefined}
                    max={type === 'number' ? 10 : undefined}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{
                      background: '#fff3f3',
                      border: '1px solid rgba(220,38,38,0.2)',
                      color: '#111827',
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                    }}
                  />
                </div>
              ))}

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: 6,
                  }}
                >
                  EXPERIENCES <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span>
                </label>
                <textarea
                  className="input-base"
                  placeholder="Brief background..."
                  rows={3}
                  value={form.experiences}
                  onChange={e => setForm(f => ({ ...f, experiences: e.target.value }))}
                  style={{
                    resize: 'vertical',
                    background: '#fff3f3',
                    border: '1px solid rgba(220,38,38,0.2)',
                    color: '#111827',
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: 16,
              fontWeight: 700,
              background: loading ? 'rgba(220,38,38,0.5)' : '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#b91c1c' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#DC2626' }}
          >
            {loading ? 'Creating...' : 'Create Room & Continue →'}
          </button>
        </motion.div>
      </div>
    </PageWrapper>
  )
}