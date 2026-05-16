import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import PageWrapper from '../components/PageWrapper'
import useAppStore from '../store/useAppStore'
import { supabase } from '../lib/supabase'

const RED = '#DC2626'
const RED_DIM = 'rgba(220,38,38,0.15)'
const RED_GLOW = 'rgba(220,38,38,0.08)'

const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(220,38,38,0.15)',
  borderRadius: 16,
  padding: 28,
  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
}

const inputStyle = {
  background: '#fff3f3',
  border: '1px solid rgba(220,38,38,0.2)',
  color: '#111827',
  padding: '0.75rem 1rem',
  borderRadius: 10,
}

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
      const { data: members } = await supabase.from('members').select('*').eq('room_id', room.id).order('member_no')
      setFoundRoom(room)
      setExistingMembers(members || [])
      setStep(2)
    } catch {
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
      const { count } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', foundRoom.id)
      const nextNo = (count || 0) + 1
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

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ width: '100%', maxWidth: 500, position: 'relative', zIndex: 1 }}
        >
          <button
            onClick={() => (step === 1 ? navigate('/') : setStep(1))}
            style={{
              background: 'none',
              border: 'none',
              color: RED,
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
            ← {step === 1 ? 'Back' : 'Change room'}
          </button>

          <h2 className="font-display" style={{ fontSize: 36, marginBottom: 6, color: '#111827' }}>
            Join a Room
          </h2>
          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28 }}>
            Enter the 6-character room code shared by your group leader.
          </p>

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={cardStyle}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: RED,
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  Room Code *
                </label>
                <input
                  className="input-base"
                  placeholder="e.g. AB12CD"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleFindRoom()}
                  style={{
                    textAlign: 'center',
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    ...inputStyle,
                  }}
                  maxLength={6}
                />
              </div>

              <RedButton onClick={handleFindRoom} disabled={loading || code.length < 6}>
                {loading ? 'Searching...' : 'Find Room →'}
              </RedButton>
            </div>
          )}

          {step === 2 && foundRoom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Found room banner */}
              <div
                style={{
                  background: 'rgba(220,38,38,0.06)',
                  border: '1px solid rgba(220,38,38,0.2)',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <span
                  style={{
                    background: 'rgba(220,38,38,0.1)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    color: RED,
                    padding: '2px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  ✓ Room found
                </span>
                <div style={{ fontWeight: 700, fontSize: 18, marginTop: 8, color: '#111827' }}>
                  {foundRoom.name}
                </div>
                <div style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>
                  {existingMembers.length} member{existingMembers.length !== 1 ? 's' : ''} already joined
                </div>
              </div>

              {/* Profile form */}
              <div style={cardStyle}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: RED,
                    textTransform: 'uppercase',
                    marginBottom: 16,
                  }}
                >
                  Your Profile
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { label: 'FULL NAME', key: 'name', placeholder: 'Your full name', required: true },
                    { label: 'PERFORMANCE RATING', key: 'performance_rating', placeholder: 'e.g. 7', required: true, suffix: '(1 – 10)', type: 'number' },
                    { label: 'SKILLS', key: 'skills', placeholder: 'e.g. Design, Research' },
                    { label: 'STRENGTHS', key: 'strengths', placeholder: 'e.g. Creativity, Teamwork' },
                  ].map(({ label, key, placeholder, required, suffix, type }) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        {label}{' '}
                        {required ? <span style={{ color: RED }}>*</span> : <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span>}
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
                        style={inputStyle}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                      EXPERIENCES <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span>
                    </label>
                    <textarea
                      className="input-base"
                      placeholder="Brief background..."
                      rows={3}
                      value={form.experiences}
                      onChange={e => setForm(f => ({ ...f, experiences: e.target.value }))}
                      style={{ resize: 'vertical', ...inputStyle, borderRadius: 10 }}
                    />
                  </div>
                </div>
              </div>

              <RedButton onClick={handleJoin} disabled={loading}>
                {loading ? 'Joining...' : 'Join Room →'}
              </RedButton>
            </div>
          )}
        </motion.div>
      </div>
    </PageWrapper>
  )
}

function RedButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '16px',
        fontSize: 16,
        fontWeight: 700,
        background: disabled ? 'rgba(220,38,38,0.6)' : '#DC2626',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: '0 4px 16px rgba(220,38,38,0.25)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#b91c1c' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#DC2626' }}
    >
      {children}
    </button>
  )
}