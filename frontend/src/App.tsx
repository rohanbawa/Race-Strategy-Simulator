import { Route, Routes, Link, useLocation, useNavigate } from 'react-router-dom';
import RaceSelectPage from './pages/RaceSelectPage';
import RaceWorkbenchPage from './pages/RaceWorkbenchPage';
import RaceWinnerPage from './pages/RaceWinnerPage';

type Tab = {
  ordinal: number;
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    ordinal: 1,
    label: 'Strategy Sim',
    to: '/',
    isActive: (p) => p === '/' || p.startsWith('/races'),
  },
  {
    ordinal: 2,
    label: 'Predict Race Winner',
    to: '/predict',
    isActive: (p) => p.startsWith('/predict'),
  },
];

export default function App() {
  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          borderBottom: '1px solid var(--line)',
          borderTop: '3px solid var(--f1-red)',
          background: 'var(--bg-panel)',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'stretch',
          gap: 28,
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 0',
          }}
        >
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
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)', marginLeft: 4 }}>
            F1 2026
          </span>
        </Link>

        <Toolbar />
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<RaceSelectPage />} />
          <Route path="/races/:raceId" element={<RaceWorkbenchPage />} />
          <Route path="/predict" element={<RaceWinnerPage />} />
        </Routes>
      </main>
    </div>
  );
}

function Toolbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav aria-label="Sections" style={{ display: 'flex', alignItems: 'stretch' }}>
      {TABS.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <button
            key={tab.to}
            onClick={() => navigate(tab.to)}
            aria-current={active ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? 'var(--f1-red)' : 'transparent'}`,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              padding: '14px 4px',
              marginBottom: -1,
              font: 'inherit',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                borderRadius: '50%',
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                fontWeight: 700,
                background: active ? 'var(--f1-red)' : 'var(--bg-panel-raised)',
                color: active ? '#ffffff' : 'var(--text-faint)',
              }}
            >
              {tab.ordinal}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
