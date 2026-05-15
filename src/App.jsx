import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'

import Home from './pages/Home'
import CreateRoom from './pages/CreateRoom'
import JoinRoom from './pages/JoinRoom'
import Lobby from './pages/Lobby'
import PreVote from './pages/PreVote'
import Ballot from './pages/Ballot'
import Results from './pages/Results'
import Goodbye from './pages/Goodbye'

export default function App() {
  const location = useLocation()

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#222636',
            color: '#E8EAF0',
            border: '1px solid rgba(255,255,255,0.07)',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#4F8EF7', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#fff' } },
        }}
      />
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<Home key="home" />} />
          <Route path="/create" element={<CreateRoom key="create" />} />
          <Route path="/join" element={<JoinRoom key="join" />} />
          <Route path="/lobby" element={<Lobby key="lobby" />} />
          <Route path="/pre-vote" element={<PreVote key="pre-vote" />} />
          <Route path="/ballot" element={<Ballot key="ballot" />} />
          <Route path="/results" element={<Results key="results" />} />
          <Route path="/goodbye" element={<Goodbye key="goodbye" />} />
        </Routes>
      </AnimatePresence>
    </>
  )
}