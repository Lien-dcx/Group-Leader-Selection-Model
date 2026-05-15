import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

export default function Ballot() {
  const navigate = useNavigate()
  const { room, currentMember, updateRoomStatus } = useAppStore()
  const isCreator = currentMember?.is_creator
  const [candidates, setCandidates] = useState([])
  const [ranking, setRanking] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [voteCount, setVoteCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    if (!room || !currentMember) { navigate('/'); return }
    fetchData()

    const channel = supabase
      .channel(`ballot-${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ballots',
        filter: `room_id=eq.${room.id}`,
      }, () => fetchVoteCount())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`,
      }, payload => {
        if (payload.new.status === 'done') {
          updateRoomStatus('done')
          navigate('/results')
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [room])

  async function fetchData() {
    const { data: allMembers } = await supabase
      .from('members').select('*').eq('room_id', room.id).order('member_no')
    if (!allMembers) return

    const others = allMembers.filter(m => m.id !== currentMember.id)
    setCandidates(others)
    setRanking(others)
    setTotalCount(allMembers.length)

    const { data: myBallot } = await supabase
      .from('ballots').select('id').eq('room_id', room.id).eq('voter_id', currentMember.id).maybeSingle()
    if (myBallot) setSubmitted(true)

    await fetchVoteCount()
    setLoading(false)
  }

  async function fetchVoteCount() {
    const { count } = await supabase
      .from('ballots')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)
    setVoteCount(count || 0)
  }

  async function submitBallot() {
    setSubmitting(true)
    try {
      const rankings = ranking.map((m, idx) => ({
        candidate_id: m.id,
        rank: idx + 1,
      }))

      const { error: ballotErr } = await supabase.from('ballots').insert({
        room_id: room.id,
        voter_id: currentMember.id,
        rankings,
      })
      if (ballotErr) throw ballotErr

      setSubmitted(true)
      toast.success('Ballot submitted!')
      await fetchVoteCount()

      // Auto-end if all voted
      const newCount = voteCount + 1
      if (newCount >= totalCount) {
        await supabase.from('rooms').update({ status: 'done' }).eq('id', room.id)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit ballot. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function endVoting() {
    setEnding(true)
    const { error } = await supabase.from('rooms').update({ status: 'done' }).eq('id', room.id)
    if (error) { toast.error('Failed to end voting.'); setEnding(false); return }
    updateRoomStatus('done')
    navigate('/results')
  }

  if (!room || !currentMember) return null
  const allVoted = voteCount >= totalCount

  return (
    <PageWrapper>
      <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ background: 'rgba(247,201,72,0.1)', border: '1px solid rgba(247,201,72,0.2)', color: 'var(--accent-gold)', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
              ● VOTING OPEN
            </span>
          </div>
          <h1 className="font-display" style={{ fontSize: 30, marginBottom: 4 }}>Cast Your Ballot</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Rank candidates from most to least preferred. Drag to reorder.</p>
        </motion.div>

        {/* Vote counter */}
        <div className="glass-card" style={{ padding: '14px 18px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Votes cast</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              <span style={{ color: allVoted ? '#3DD6A3' : 'var(--accent-blue)' }}>{voteCount}</span>
              <span style={{ color: 'var(--text-dim)' }}> of {totalCount}</span>
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: totalCount > 0 ? `${(voteCount / totalCount) * 100}%` : '0%' }}
              transition={{ duration: 0.4 }}
              style={{ height: '100%', background: allVoted ? '#3DD6A3' : 'linear-gradient(90deg, var(--accent-blue), var(--accent-gold))', borderRadius: 3 }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading ballot...</div>
        ) : submitted ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 className="font-display" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Ballot Submitted!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                {allVoted ? 'Everyone has voted!' : `Waiting for ${totalCount - voteCount} more member${totalCount - voteCount !== 1 ? 's' : ''} to vote…`}
              </p>
              {isCreator && (
                <button className="btn-gold" onClick={endVoting} disabled={ending} style={{ width: '100%', padding: '0.9rem' }}>
                  {ending ? 'Loading results…' : '👑 Reveal Results →'}
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            <div style={{ background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--accent-blue)' }}>Borda Count</strong> — Your top pick gets <strong style={{ color: 'var(--text-primary)' }}>{candidates.length - 1} points</strong>, 2nd gets {candidates.length - 2}, and so on.
            </div>

            <div className="glass-card" style={{ marginBottom: '1.25rem', padding: 20 }}>
              <h2 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Your Ranking — drag to reorder</h2>
              <Reorder.Group axis="y" values={ranking} onReorder={setRanking} style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ranking.map((m, idx) => (
                  <Reorder.Item key={m.id} value={m}>
                    <motion.div
                      layout
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.85rem 1rem',
                        background: idx === 0 ? 'rgba(247,201,72,0.08)' : 'var(--bg-elevated)',
                        border: idx === 0 ? '1px solid rgba(247,201,72,0.25)' : '1px solid var(--border)',
                        borderRadius: 10, cursor: 'grab', userSelect: 'none',
                      }}
                      whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', cursor: 'grabbing' }}
                    >
                      <div style={{
                        minWidth: 32, height: 32, borderRadius: '50%',
                        background: idx === 0 ? 'rgba(247,201,72,0.15)' : 'var(--bg-primary)',
                        border: idx === 0 ? '1.5px solid var(--accent-gold)' : '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.82rem',
                        color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-dim)', flexShrink: 0,
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Member #{m.member_no} · Rating {m.performance_rating}/10</div>
                      </div>
                      <span style={{ color: idx === 0 ? 'var(--accent-gold)' : 'var(--accent-blue)', fontWeight: 700, fontSize: '0.78rem' }}>
                        {candidates.length - 1 - idx} pts
                      </span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
                        <circle cx="4" cy="3" r="1.2" fill="currentColor"/><circle cx="10" cy="3" r="1.2" fill="currentColor"/>
                        <circle cx="4" cy="7" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/>
                        <circle cx="4" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="11" r="1.2" fill="currentColor"/>
                      </svg>
                    </motion.div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </div>

            <button className="btn-gold" onClick={submitBallot} disabled={submitting} style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}>
              {submitting ? 'Submitting…' : '✓ Submit Ballot'}
            </button>

            {isCreator && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn-danger" onClick={endVoting} disabled={ending} style={{ width: '100%' }}>
                  {ending ? 'Ending…' : '⏹ End Voting Early & See Results'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}