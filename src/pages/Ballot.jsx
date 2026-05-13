import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

export default function Ballot() {
  const navigate = useNavigate()
  const { room, currentMember, isCreator, updateRoomStatus } = useAppStore()
  const [candidates, setCandidates] = useState([]) // all members except self
  const [ranking, setRanking]       = useState([]) // ordered list (index 0 = rank 1 = top choice)
  const [submitted, setSubmitted]   = useState(false)
  const [voteCount, setVoteCount]   = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ending, setEnding]         = useState(false)

  useEffect(() => {
    if (!room || !currentMember) { navigate('/'); return }
    fetchData()
    const channel = supabase
      .channel(`ballot-${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'members',
        filter: `room_id=eq.${room.id}`,
      }, () => fetchVoteCount())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'rooms',
        filter: `id=eq.${room.id}`,
      }, payload => {
        if (payload.new.status === 'finished') {
          updateRoomStatus('finished')
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

    // Check if already voted
    const { data: myBallot } = await supabase
      .from('ballots').select('id').eq('room_id', room.id).eq('voter_id', currentMember.id).single()
    if (myBallot) setSubmitted(true)

    await fetchVoteCount()
    setLoading(false)
  }

  async function fetchVoteCount() {
    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', room.id)
      .eq('has_voted', true)
    setVoteCount(count || 0)
  }

  async function submitBallot() {
    setSubmitting(true)
    try {
      // Build rankings: index+1 is the rank (1=top choice)
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

      // Mark member as voted
      await supabase.from('members').update({ has_voted: true }).eq('id', currentMember.id)

      setSubmitted(true)
      toast.success('Ballot submitted!')
      await fetchVoteCount()
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit ballot. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function endVoting() {
    setEnding(true)
    const { error } = await supabase.from('rooms').update({ status: 'finished' }).eq('id', room.id)
    if (error) { toast.error('Failed to end voting.'); setEnding(false); return }
    updateRoomStatus('finished')
    navigate('/results')
  }

  if (!room || !currentMember) return null

  const allVoted = voteCount === totalCount

  return (
    <PageWrapper>
      <div className="page" style={{ paddingTop: '2.5rem' }}>
        <div className="page-inner">

          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span className="badge badge-green" style={{ marginBottom: '0.75rem' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
              Voting Open
            </span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem' }}>Cast Your Ballot</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Rank the candidates from most to least preferred. Drag to reorder.
            </p>
          </div>

          {/* Vote counter */}
          <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600 }}>Votes Cast</span>
                <span style={{ color: allVoted ? '#34d399' : 'var(--accent-blue)', fontWeight: 700 }}>
                  {voteCount} / {totalCount}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-raised)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                  animate={{ width: totalCount > 0 ? `${(voteCount / totalCount) * 100}%` : '0%' }}
                  transition={{ duration: 0.4 }}
                  style={{
                    height: '100%',
                    background: allVoted ? '#34d399' : 'var(--accent-blue)',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
            {allVoted && <span className="badge badge-green">All voted!</span>}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}><span /><span /><span /></div>
            </div>
          ) : submitted ? (
            <SubmittedState voteCount={voteCount} totalCount={totalCount} allVoted={allVoted} />
          ) : (
            <>
              {/* Borda explanation */}
              <div style={{
                background: 'var(--accent-blue-dim)',
                border: '1px solid rgba(79,142,247,0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--accent-blue)' }}>Borda Count Method</strong> — Rank all {candidates.length} candidates.
                Your top pick gets <strong style={{ color: 'var(--text-primary)' }}>{candidates.length - 1} points</strong>, 2nd gets {candidates.length - 2}, and so on. Drag to reorder.
              </div>

              {/* Drag-to-rank list */}
              <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  Your Ranking — drag to reorder
                </h2>
                <Reorder.Group axis="y" values={ranking} onReorder={setRanking} style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ranking.map((m, idx) => (
                    <Reorder.Item key={m.id} value={m}>
                      <motion.div
                        layout
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.85rem 1rem',
                          background: idx === 0 ? 'rgba(247,201,72,0.08)' : 'var(--bg-raised)',
                          border: idx === 0 ? '1px solid rgba(247,201,72,0.25)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'grab',
                          userSelect: 'none',
                        }}
                        whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', cursor: 'grabbing' }}
                      >
                        {/* Rank number */}
                        <div style={{
                          minWidth: 32, height: 32,
                          borderRadius: '50%',
                          background: idx === 0 ? 'var(--accent-gold-dim)' : 'var(--bg-base)',
                          border: idx === 0 ? '1.5px solid var(--accent-gold)' : '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.82rem',
                          color: idx === 0 ? 'var(--accent-gold)' : 'var(--text-secondary)',
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>
                        {/* Member info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Member #{m.member_no} · Rating {m.performance_rating}/10
                          </div>
                        </div>
                        {/* Points */}
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <span style={{ color: idx === 0 ? 'var(--accent-gold)' : 'var(--accent-blue)', fontWeight: 700 }}>
                            {candidates.length - 1 - idx} pts
                          </span>
                        </div>
                        {/* Drag grip */}
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

              <button
                className="btn-gold"
                onClick={submitBallot}
                disabled={submitting}
                style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem' }}
              >
                {submitting ? 'Submitting…' : '✓ Submit Ballot'}
              </button>
            </>
          )}

          {/* Creator end voting button */}
          {isCreator && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <button
                className="btn-danger"
                onClick={endVoting}
                disabled={ending}
                style={{ width: '100%' }}
              >
                {ending ? 'Ending…' : '⏹ End Voting Early & See Results'}
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                Creator only — ends voting for everyone immediately.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function SubmittedState({ voteCount, totalCount, allVoted }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Ballot Submitted!
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {allVoted
            ? 'Everyone has voted. Waiting for the creator to reveal results.'
            : `Waiting for ${totalCount - voteCount} more member${totalCount - voteCount !== 1 ? 's' : ''} to vote…`}
        </p>
        <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
          <span /><span /><span />
        </div>
      </div>
    </motion.div>
  )
}