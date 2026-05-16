import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import PageWrapper from '../components/PageWrapper'

export default function Home() {
  const navigate = useNavigate()

  return (
    <PageWrapper>
      <div
        className="page"
        style={{
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#fff3f3',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Red grid background — subtle */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(220,38,38,0.14) 1px, transparent 1px),
              linear-gradient(90deg, rgba(220, 38, 38, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Red spotlight / glow orb */}
        <div
          style={{
            position: 'fixed',
            top: '-10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 600,
            height: 280,
            background:
              'radial-gradient(ellipse, rgba(220,38,38,0.20) 0%, rgba(220,38,38,0.03) 50%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          className="page-inner"
          style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: '2rem' }}
          >
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2.5rem, 8vw, 4rem)',
                color: '#111827',
                lineHeight: 1.1,
                marginBottom: '0.75rem',
                marginTop: '-0.5rem',
              }}
            >
              Vote<span style={{ color: '#DC2626' }}>Leader</span>
            </h1>
            <p
              style={{
                color: '#6B7280',
                fontSize: '1.05rem',
                maxWidth: 360,
                margin: '0 auto',
              }}
            >
              Elect your group leader fairly — powered by voting theory.
            </p>
          </motion.div>

          {/* Action cards */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              maxWidth: 480,
              margin: '0 auto 2.5rem',
            }}
          >
            <ActionCard
              icon={<PlusIcon />}
              title="Create Room"
              desc="Start a new voting session"
              accent="#DC2626"
              accentDim="rgba(220,38,38,0.4)"
              accentHover="rgba(220,38,38,0.4)"
              borderAccent="rgba(220,38,38,0.50)"
              onClick={() => navigate('/create')}
            />
            <ActionCard
              icon={<JoinIcon />}
              title="Join Room"
              desc="Enter with a room code"
              accent="#DC2626"
              accentDim="rgba(255, 255, 255, 0.25)"
              accentHover="rgba(220,38,38,0.4)"
              borderAccent="rgba(220,38,38,0.50)"
              onClick={() => navigate('/join')}
            />
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <p
              style={{
                color: '#ff0000',
                fontSize: '0.78rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '1rem',
                fontWeight: 600,
              }}
            >
              How it works
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              {['Create Room', 'Register Members', 'Cast Ballots', 'Reveal Winner'].map(
                (step, i) => (
                  <div
                    key={step}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span
                      style={{
                        background: '#ffffff',
                        border: '1px solid rgba(220,38,38,0.18)',
                        borderRadius: 100,
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.78rem',
                        color: '#374151',
                        boxShadow: '0 1px 4px rgba(220,38,38,0.06)',
                      }}
                    >
                      {i + 1}. {step}
                    </span>
                    {i < 3 && (
                      <span style={{ color: '#DC2626', fontSize: '0.75rem', opacity: 0.5 }}>
                        →
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  )
}

function ActionCard({ icon, title, desc, accent, accentDim, accentHover, borderAccent, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#fdd7d7',
        border: '1px solid rgba(220,38,38,0.12)',
        borderRadius: 'var(--radius)',
        padding: '1.5rem 1rem',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        color: 'inherit',
        boxShadow: '0 1px 6px rgba(220,38,38,0.05)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = borderAccent
        e.currentTarget.style.background = accentDim
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = `0 8px 32px ${accentDim}`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(220,38,38,0.12)'
        e.currentTarget.style.background = '#fdd7d7'
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = '0 1px 6px rgba(220,38,38,0.05)'
      }}
    >
      <div
        style={{
          color: accent,
          marginBottom: '0.75rem',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontWeight: 700,
          fontSize: '1rem',
          marginBottom: '0.3rem',
          color: '#111827',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{desc}</div>
    </button>
  )
}

function PlusIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function JoinIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}