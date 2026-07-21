import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { RaceSummary, SeasonRace } from '../types';

const FIRST_F1_SEASON = 1950;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - FIRST_F1_SEASON + 1 }, (_, i) => CURRENT_YEAR - i);

export default function RaceSelectPage() {
  const navigate = useNavigate();

  const [races, setRaces] = useState<RaceSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [year, setYear] = useState(CURRENT_YEAR);
  const [calendar, setCalendar] = useState<SeasonRace[] | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [round, setRound] = useState<number | ''>('');

  const [loadingRace, setLoadingRace] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api.listRaces().then(setRaces).catch((e) => setListError(e.message));
  }, []);

  useEffect(() => {
    setCalendar(null);
    setCalendarError(null);
    setRound('');
    setCalendarLoading(true);
    api
      .getSeasonCalendar(year)
      .then((cal) => {
        setCalendar(cal);
        if (cal.length > 0) setRound(cal[0].round);
      })
      .catch((e) => setCalendarError(e.message))
      .finally(() => setCalendarLoading(false));
  }, [year]);

  const selectedRace = calendar?.find((r) => r.round === round) ?? null;

  const loadRace = async () => {
    if (!selectedRace) return;
    setLoadError(null);
    if (selectedRace.ingested && selectedRace.raceId != null) {
      navigate(`/races/${selectedRace.raceId}`);
      return;
    }
    setLoadingRace(true);
    try {
      const summary = await api.ingestRace(year, selectedRace.round);
      navigate(`/races/${summary.id}`);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoadingRace(false);
    }
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '48px 28px', width: '100%' }}>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 40,
            margin: 0,
            letterSpacing: '0.01em',
          }}
        >
          Pick a session
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 15 }}>
          Every stint, pit stop, and lap time below is what actually happened. Pick a year and race
          below to open one — new races are pulled in automatically the first time you select them.
        </p>
      </div>

      <section
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--line)',
          borderTop: '2px solid var(--f1-red)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-panel)',
          padding: 22,
          marginBottom: 28,
        }}
      >
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Year">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={selectStyle}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Race">
            <select
              value={round}
              onChange={(e) => setRound(Number(e.target.value))}
              disabled={calendarLoading || !calendar || calendar.length === 0}
              style={{ ...selectStyle, minWidth: 320 }}
            >
              {calendarLoading && <option>Loading calendar…</option>}
              {!calendarLoading && calendar?.length === 0 && <option>No races found for {year}</option>}
              {calendar?.map((r) => (
                <option key={r.round} value={r.round}>
                  R{String(r.round).padStart(2, '0')} · {r.name}
                  {r.ingested ? ' ✓ loaded' : ''}
                </option>
              ))}
            </select>
          </Field>

          <button
            onClick={loadRace}
            disabled={!selectedRace || loadingRace}
            style={{
              background: 'var(--f1-red)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '11px 22px',
              fontWeight: 700,
              fontSize: 14,
              cursor: !selectedRace || loadingRace ? 'default' : 'pointer',
              opacity: !selectedRace || loadingRace ? 0.6 : 1,
            }}
          >
            {loadingRace ? 'Loading…' : selectedRace?.ingested ? 'Open race' : 'Fetch & open race'}
          </button>
        </div>

        {selectedRace && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            {selectedRace.circuitName}, {selectedRace.country}
            {selectedRace.raceDate ? ` · ${selectedRace.raceDate}` : ''}
            {selectedRace.ingested ? (
              <span style={{ color: 'var(--accent-positive)' }}> · already loaded</span>
            ) : (
              <span style={{ color: 'var(--accent-warning)' }}> · not loaded yet, will fetch from Jolpica + OpenF1</span>
            )}
          </p>
        )}

        {calendarError && (
          <p style={{ color: 'var(--accent-negative)', fontFamily: 'var(--font-data)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            {calendarError}
          </p>
        )}
        {loadError && (
          <p style={{ color: 'var(--accent-negative)', fontFamily: 'var(--font-data)', fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            {loadError}
          </p>
        )}
      </section>

      {listError && (
        <div
          style={{
            border: '1px solid var(--accent-negative)',
            color: 'var(--accent-negative)',
            padding: 16,
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-data)',
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {listError} — is the backend running on :8080?
        </div>
      )}

      {races && races.length > 0 && (
        <>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-muted)',
              margin: '0 0 12px 0',
            }}
          >
            Already loaded
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {races.map((race, i) => (
              <button
                key={race.id}
                onClick={() => navigate(`/races/${race.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 160px 90px',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 20px',
                  background: i % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-panel-raised)',
                  border: 'none',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <span style={{ fontFamily: 'var(--font-data)', color: 'var(--f1-red)', fontSize: 13, fontWeight: 700 }}>
                  R{String(race.round).padStart(2, '0')}
                </span>
                <span>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{race.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{race.circuitName}, {race.country}</div>
                </span>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--text-muted)' }}>
                  {race.raceDate}
                </span>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--text-muted)' }}>
                  {race.totalLaps ?? '—'} laps
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-panel-inset)',
  color: 'var(--text-primary)',
  border: '1px solid var(--line-bright)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  fontFamily: 'var(--font-data)',
  fontSize: 14,
  cursor: 'pointer',
};
