import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageWrapper from '../components/PageWrapper'
import useAppStore from '../store/useAppStore'

export default function Goodbye() {
  const navigate = useNavigate()
  const { room, results, reset } = useAppStore()
  const winner = results?.[0]
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const handleNewRoom = () => {
    reset()
    navigate('/')
  }

  return (
    <PageWrapper>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}
        >
          <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>

          <h1 className="font-display" style={{ fontSize: 36, marginBottom: 12, color: 'var(--accent-gold)' }}>
            Session Complete
          </h1>

          {room && (
            <div className="glass-card" style={{ padding: 24, marginBottom: 28, textAlign: 'left' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SummaryRow label="Room" value={room.name} />
                <SummaryRow label="Date" value={today} />
                {winner && <SummaryRow label="Elected Leader" value={winner.name} valueColor="var(--accent-gold)" />}
                {winner && <SummaryRow label="Winning Score" value={`${winner.bordaScore} Borda pts`} />}
              </div>
            </div>
          )}

          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            Congratulations to your new group leader! The election was conducted using Borda Count voting theory.
          </p>

          <button className="btn-primary" onClick={handleNewRoom} style={{ width: '100%' }}>
            Start a New Session
          </button>
        </motion.div>
      </div>
    </PageWrapper>
  )
}

function SummaryRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: valueColor || 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}