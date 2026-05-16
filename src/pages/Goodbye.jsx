import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageWrapper from '../components/PageWrapper'
import useAppStore from '../store/useAppStore'

const RED = '#DC2626'

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
        {/* Glow orb — centered bottom for celebration feel */}
        <div
          style={{
            position: 'fixed',
            bottom: '-5%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 700,
            height: 300,
            background: 'radial-gradient(ellipse, rgba(220,38,38,0.14) 0%, rgba(220,38,38,0.02) 50%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        {/* Top glow */}
        <div
          style={{
            position: 'fixed',
            top: '-10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 500,
            height: 220,
            background: 'radial-gradient(ellipse, rgba(220,38,38,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ maxWidth: 440, width: '100%', textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>

          <h1
            className="font-display"
            style={{ fontSize: 36, marginBottom: 12, color: RED }}
          >
            Session Complete
          </h1>

          {room && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(220,38,38,0.18)',
                borderRadius: 16,
                padding: 24,
                marginBottom: 28,
                textAlign: 'left',
                boxShadow: '0 2px 16px rgba(220,38,38,0.08)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <SummaryRow label="Room" value={room.name} />
                <SummaryRow label="Date" value={today} />
                {winner && <SummaryRow label="Elected Leader" value={winner.name} valueColor={RED} />}
                {winner && <SummaryRow label="Winning Score" value={`${winner.bordaScore} Borda pts`} />}
              </div>
            </div>
          )}

          <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
            Congratulations to your new group leader! The election was conducted using Borda Count voting theory.
          </p>

          <button
            onClick={handleNewRoom}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: 16,
              fontWeight: 700,
              background: RED,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(220,38,38,0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#b91c1c' }}
            onMouseLeave={e => { e.currentTarget.style.background = RED }}
          >
            Start a New Session
          </button>
        </motion.div>
      </div>
    </PageWrapper>
  )
}

function SummaryRow({ label, value, valueColor }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid rgba(220,38,38,0.1)',
      }}
    >
      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: valueColor || '#111827' }}>{value}</span>
    </div>
  )
}