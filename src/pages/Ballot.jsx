import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/useAppStore'
import PageWrapper from '../components/PageWrapper'

const RED = '#DC2626'

export default function Ballot() {
  const navigate = useNavigate()
  const { room, currentMember, isCreator, updateRoomStatus } = useAppStore()
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
    const { data: myBallot } = await supabase
      .from('ballots').select('id').eq('room_id', room.id).eq('voter_id', currentMember.id).maybeSingle()
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
      const rankings = ranking.map((m, idx) => ({ candidate_id: m.id, rank: idx + 1 }))
      const { error: ballotErr } = await supabase.from('ballots').insert({
        room_id: room.id,
        voter_id: currentMember.id,
        rankings,
      })
      if (ballotErr) throw ballotErr
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

        <div style={{ paddingTop: '2.5rem', maxWidth: 680, margin: '0 auto', padding: '2.5rem 1.5rem', position: 'relative', zIndex: 1 }}>

          {/* Header */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: RED,
                padding: '3px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 12,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: RED, display: 'inline-block' }} />
              Voting Open
            </span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.4rem', color: '#111827' }}>
              Cast Your Ballot
            </h1>
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
              Rank the candidates from most to least preferred. Drag to reorder.
            </p>
          </div>

          {/* Vote counter */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid rgba(220,38,38,0.15)',
              borderRadius: 16,
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: '#111827' }}>Votes Cast</span>
                <span style={{ color: allVoted ? '#16a34a' : RED, fontWeight: 700 }}>
                  {voteCount} / {totalCount}
                </span>
              </div>
              <div style={{ height: 6, background: '#fff3f3', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(220,38,38,0.12)' }}>
                <motion.div
                  animate={{ width: totalCount > 0 ? `${(voteCount / totalCount) * 100}%` : '0%' }}
                  transition={{ duration: 0.4 }}
                  style={{
                    height: '100%',
                    background: allVoted ? '#16a34a' : RED,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
            {allVoted && (
              <span
                style={{
                  background: 'rgba(22,163,74,0.1)',
                  border: '1px solid rgba(22,163,74,0.25)',
                  color: '#16a34a',
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                All voted!
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}><span /><span /><span /></div>
            </div>
          ) : submitted ? (
            <SubmittedState
              voteCount={voteCount}
              totalCount={totalCount}
              allVoted={allVoted}
              isCreator={isCreator}
              onEndVoting={endVoting}
              ending={ending}
            />
          ) : (
            <>
              {/* Borda explanation */}
              <div
                style={{
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.18)',
                  borderRadius: 12,
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.82rem',
                  color: '#6B7280',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: RED }}>Borda Count Method</strong> — Rank all {candidates.length} candidates.
                Your top pick gets <strong style={{ color: '#111827' }}>{candidates.length - 1} points</strong>, 2nd gets {candidates.length - 2}, and so on. Drag to reorder.
              </div>

              {/* Drag-to-rank list */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(220,38,38,0.15)',
                  borderRadius: 16,
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
                }}
              >
                <h2 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '1rem', color: '#6B7280' }}>
                  Your Ranking — drag to reorder
                </h2>
                <Reorder.Group
                  axis="y"
                  values={ranking}
                  onReorder={setRanking}
                  style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                >
                  {ranking.map((m, idx) => (
                    <Reorder.Item key={m.id} value={m}>
                      <motion.div
                        layout
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.85rem 1rem',
                          background: idx === 0 ? 'rgba(245, 158, 11,0.1)' : 'rgba(255, 243, 243, 0.81)',
                          border: `2px solid ${idx === 0 ? 'rgba(245, 158, 11,0.9)' : 'rgba(220,38,38,0.12)'}`,
                          borderRadius: 10,
                          cursor: 'grab',
                          userSelect: 'none',
                        }}
                        whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(220,38,38,0.15)', cursor: 'grabbing' }}
                      >
                        {/* Rank circle */}
                        <div
                          style={{
                            minWidth: 32, height: 32, borderRadius: '50%',
                            background: idx === 0 ? 'rgba(245, 158, 11,0.1)' : '#ffffff',
                            border: idx === 0 ? `1.5px solid ${'#F59E0B' }` : '1px solid rgba(220,38,38,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.82rem',
                            color: idx === 0 ? 'rgb(245, 158, 11)'  : '#9CA3AF',
                            flexShrink: 0,
                          }}
                        >
                          {idx + 1}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827' }}>{m.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                            Member #{m.member_no} · Rating {m.performance_rating}/10
                          </div>
                        </div>
                        {/* Points */}
                        <div style={{ fontSize: '0.78rem' }}>
                          <span style={{ color: idx === 0 ? '#F59E0B' : RED , fontWeight: 700 }}>
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
                onClick={submitBallot}
                disabled={submitting}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  background: submitting ? 'rgba(220,38,38,0.4)' : RED,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#b91c1c' }}
                onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = RED }}
              >
                {submitting ? 'Submitting…' : '✓ Submit Ballot'}
              </button>
            </>
          )}

          {/* Creator end voting */}
          {isCreator && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(220,38,38,0.12)' }}>
              <button
                onClick={endVoting}
                disabled={ending}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  background: 'transparent',
                  color: RED,
                  border: `1px solid rgba(220,38,38,0.35)`,
                  borderRadius: 10,
                  cursor: ending ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!ending) { e.currentTarget.style.background = 'rgba(220,38,38,0.06)' } }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {ending ? 'Ending…' : '⏹ End Voting Early & See Results'}
              </button>
              <p style={{ fontSize: '0.75rem', color: '#9CA3AF', textAlign: 'center', marginTop: '0.5rem' }}>
                Creator only — ends voting for everyone immediately.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function SubmittedState({ voteCount, totalCount, allVoted, isCreator, onEndVoting, ending }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div
        style={{
          background: '#ffffff',
          border: '1px solid rgba(220,38,38,0.15)',
          borderRadius: 16,
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          boxShadow: '0 2px 12px rgba(220,38,38,0.06)',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '0.5rem', color: '#111827' }}>
          Ballot Submitted!
        </h2>
        <p style={{ color: '#6B7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {allVoted
            ? 'Everyone has voted. Waiting for the creator to reveal results.'
            : `Waiting for ${totalCount - voteCount} more member${totalCount - voteCount !== 1 ? 's' : ''} to vote…`}
        </p>
        {isCreator ? (
          <button
            onClick={onEndVoting}
            disabled={ending}
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: '0.95rem',
              fontWeight: 700,
              background: ending ? 'rgba(220,38,38,0.4)' : '#DC2626',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: ending ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
            }}
          >
            {ending ? 'Loading results…' : '👑 Reveal Results →'}
          </button>
        ) : (
          <div className="dot-pulse" style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
            <span /><span /><span />
          </div>
        )}
      </div>
    </motion.div>
  )
}