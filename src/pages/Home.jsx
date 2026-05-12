import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageWrapper from '../components/PageWrapper'

export default function Home() {
  const navigate = useNavigate()

  return (
    <PageWrapper>
      <div className="page bg-grid" style={{ justifyContent: 'center', minHeight: '100vh' }}>
        {/* Glow orbs */}
        <div style={{
          position: 'fixed', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(79,142,247,0.12) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        <div className="page-inner" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Logo mark */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: '2rem' }}
          >
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 64, height: 64,
              background: 'var(--accent-blue-dim)',
              border: '1px solid rgba(79,142,247,0.3)',
              borderRadius: 16,
              marginBottom: '1.5rem',
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L4 28h24L16 4z" stroke="#4F8EF7" strokeWidth="2" strokeLinejoin="round" fill="none"/>
                <circle cx="16" cy="14" r="2" fill="#F7C948"/>
                <path d="M11 28h10" stroke="#4F8EF7" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 8vw, 4rem)', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.75rem' }}>
              Vote<span style={{ color: 'var(--accent-blue)' }}>Leader</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 360, margin: '0 auto' }}>
              Elect your group leader fairly — powered by voting theory.
            </p>
          </motion.div>

          {/* Action cards */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: 480, margin: '0 auto 2.5rem' }}
          >
            <ActionCard
              icon={<PlusIcon />}
              title="Create Room"
              desc="Start a new voting session"
              accent="var(--accent-blue)"
              accentDim="var(--accent-blue-dim)"
              onClick={() => navigate('/create')}
            />
            <ActionCard
              icon={<JoinIcon />}
              title="Join Room"
              desc="Enter with a room code"
              accent="var(--accent-gold)"
              accentDim="var(--accent-gold-dim)"
              onClick={() => navigate('/join')}
            />
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 600 }}>
              How it works
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {['Create Room', 'Register Members', 'Cast Ballots', 'Reveal Winner'].map((step, i) => (
                <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 100,
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                  }}>
                    {i + 1}. {step}
                  </span>
                  {i < 3 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  )
}

function ActionCard({ icon, title, desc, accent, accentDim, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid var(--border)`,
        borderRadius: 'var(--radius)',
        padding: '1.5rem 1rem',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        color: 'inherit',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.background = accentDim
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 32px ${accentDim}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--bg-surface)'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ color: accent, marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{desc}</div>
    </button>
  )
}

function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>
    </svg>
  )
}

function JoinIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  )
}