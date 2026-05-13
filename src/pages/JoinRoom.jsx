import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

export default function JoinRoom() {
  const navigate = useNavigate()
  const { setRoom, setCurrentMember, setIsCreator } = useAppStore()

  const [code, setCode]           = useState('')
  const [myName, setMyName]       = useState('')
  const [rating, setRating]       = useState('')
  const [skills, setSkills]       = useState('')
  const [strengths, setStrengths] = useState('')
  const [experiences, setExperiences] = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleJoin(e) {
    e.preventDefault()
    if (!code.trim() || !myName.trim() || !rating) {
      toast.error('Please fill in all required fields.')
      return
    }

    setLoading(true)
    try {
      // Find the room
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.trim().toUpperCase())
        .single()
      if (roomErr || !room) { toast.error('Room not found. Check the code and try again.'); return }
      if (room.status !== 'waiting') { toast.error('This room is no longer accepting members.'); return }

      // Get current member count to assign next member_no
      const { count } = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .eq('room_id', room.id)

      const nextNo = (count || 0) + 1

      // Register as member
      const { data: member, error: memErr } = await supabase
        .from('members')
        .insert({
          room_id: room.id,
          member_no: nextNo,
          full_name: myName.trim(),
          performance_rating: Number(rating),
          skills: skills.trim() || null,
          strengths: strengths.trim() || null,
          experiences: experiences.trim() || null,
        })
        .select()
        .single()
      if (memErr) throw memErr

      setRoom(room)
      setCurrentMember(member)
      setIsCreator(false)

      toast.success(`Joined as Member #${nextNo}!`)
      navigate('/lobby')
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper>
      <div className="page" style={{ paddingTop: '3rem' }}>
        <div className="page-inner">
          <BackButton />

          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem' }}>Join a Room</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Enter the 6-character room code shared by your group leader.
            </p>
          </div>

          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <div>
                <label className="label">Room Code *</label>
                <input
                  className="input-field"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. XK92TF"
                  maxLength={6}
                  style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }}
                  required
                />
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', fontFamily: 'var(--font-body)' }}>
                Your Profile
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input-field" value={myName} onChange={e => setMyName(e.target.value)} placeholder="Your full name" required />
                </div>
                <div>
                  <label className="label">Performance Rating * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(1 – 10)</span></label>
                  <input className="input-field" type="number" min={1} max={10} value={rating} onChange={e => setRating(e.target.value)} placeholder="e.g. 7" required />
                </div>
                <div>
                  <label className="label">Skills <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="input-field" value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. Design, Research" />
                </div>
                <div>
                  <label className="label">Strengths <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="input-field" value={strengths} onChange={e => setStrengths(e.target.value)} placeholder="e.g. Creativity, Teamwork" />
                </div>
                <div>
                  <label className="label">Experiences <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                  <textarea className="input-field" value={experiences} onChange={e => setExperiences(e.target.value)} placeholder="Brief background..." rows={2} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%', padding: '0.9rem' }}>
              {loading ? 'Joining…' : 'Join Room →'}
            </button>
          </form>
        </div>
      </div>
    </PageWrapper>
  )
}

function BackButton() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate('/')} className="btn-ghost" style={{ marginBottom: '1.5rem', padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}>
      ← Back
    </button>
  )
}