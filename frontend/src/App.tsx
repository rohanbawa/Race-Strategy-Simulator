import { Route, Routes, Link } from 'react-router-dom';
import RaceSelectPage from './pages/RaceSelectPage';
import RaceWorkbenchPage from './pages/RaceWorkbenchPage';

export default function App() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: '1px solid var(--line)',
          borderTop: '3px solid var(--f1-red)',
          background: 'var(--bg-panel)',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--f1-red)' }} />
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '0.02em',
              color: 'var(--text-primary)',
            }}
          >
            PIT WALL
          </span>
        </Link>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)' }}>
          race strategy simulator
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<RaceSelectPage />} />
          <Route path="/races/:raceId" element={<RaceWorkbenchPage />} />
        </Routes>
      </main>
    </div>
  );
}
