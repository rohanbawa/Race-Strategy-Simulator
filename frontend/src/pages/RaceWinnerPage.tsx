import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type {
  DriverPrediction,
  GridEntry,
  GridInfoResponse,
  PredictionResponse,
  Weather,
} from '../types';

const WEATHER_OPTIONS: { value: Weather; label: string; hint: string }[] = [
  { value: 'DRY', label: 'Dry', hint: 'slicks, car pace decides' },
  { value: 'MIXED', label: 'Mixed', hint: 'damp / crossover — chaos' },
  { value: 'WET', label: 'Wet', hint: 'rain rewards driver skill' },
];

function scLabel(p: number): string {
  if (p < 0.25) return 'Low';
  if (p < 0.55) return 'Medium';
  if (p < 0.8) return 'High';
  return 'Very high';
}

function tyreLabel(s: number): string {
  if (s < 0.25) return 'Minimal';
  if (s < 0.55) return 'Moderate';
  if (s < 0.9) return 'Large';
  return 'Extreme';
}

export default function RaceWinnerPage() {
  const [info, setInfo] = useState<GridInfoResponse | null>(null);
  const [grid, setGrid] = useState<GridEntry[]>([]);
  const [weather, setWeather] = useState<Weather>('DRY');
  const [safetyCar, setSafetyCar] = useState(0.3);
  const [tyreOffset, setTyreOffset] = useState(0.35);

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keeps the latest slider values available to auto-predict without stale closures.
  const conditionsRef = useRef({ safetyCar, tyreOffset });
  conditionsRef.current = { safetyCar, tyreOffset };

  const runPrediction = useCallback(async (currentGrid: GridEntry[], currentWeather: Weather) => {
    if (currentGrid.length === 0) return;
    setPredicting(true);
    setError(null);
    try {
      const res = await api.predictRaceWinner({
        weather: currentWeather,
        safetyCarProbability: conditionsRef.current.safetyCar,
        tyreOffsetSeconds: conditionsRef.current.tyreOffset,
        grid: currentGrid.map((g) => ({ driverId: g.id, position: g.gridPosition })),
        monteCarloSims: 4000,
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPredicting(false);
    }
  }, []);

  // Draw a fresh qualifying grid under the given weather, then predict on it.
  const regenerateGrid = useCallback(
    async (nextWeather: Weather, seed?: number) => {
      setLoadingGrid(true);
      setError(null);
      try {
        const q = await api.generateQualifying(nextWeather, seed);
        setGrid(q.grid);
        await runPrediction(q.grid, nextWeather);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingGrid(false);
      }
    },
    [runPrediction],
  );

  useEffect(() => {
    api.getGridInfo().then(setInfo).catch(() => setInfo(null));
    regenerateGrid('DRY', 2026);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeWeather = (w: Weather) => {
    setWeather(w);
    regenerateGrid(w); // grid depends on weather (wet qualifying is messier)
  };

  const preds = result?.predictions ?? [];
  const maxWin = preds.length > 0 ? Math.max(...preds.map((p) => p.winProbability)) : 1;
  const podium = preds.slice(0, 3);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 700, color: 'var(--f1-red)' }}>
          MACHINE LEARNING · 2026 REGULATIONS
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, margin: '4px 0' }}>
          Predict the race winner
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 720 }}>
          Set the race conditions and a random-forest model — trained on a physics-informed
          Monte-Carlo of the 2026 grid — estimates each driver's win, podium and points odds.
          Adjust safety-car risk, weather and tyre-strategy offset and watch the field reshuffle.
        </p>
      </div>

      <Panel title="Race conditions">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Control label="Weather">
            <div style={{ display: 'flex', gap: 6 }}>
              {WEATHER_OPTIONS.map((opt) => {
                const active = weather === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => changeWeather(opt.value)}
                    title={opt.hint}
                    style={{
                      background: active ? 'var(--f1-red)' : 'var(--bg-panel-inset)',
                      color: active ? '#fff' : 'var(--text-muted)',
                      border: `1px solid ${active ? 'var(--f1-red)' : 'var(--line-bright)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '9px 16px',
                      fontFamily: 'var(--font-display)',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
              {WEATHER_OPTIONS.find((o) => o.value === weather)?.hint}
            </span>
          </Control>

          <Control label={`Safety car chance — ${scLabel(safetyCar)} (${Math.round(safetyCar * 100)}%)`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={safetyCar}
              onChange={(e) => setSafetyCar(Number(e.target.value))}
              style={{ width: 220, accentColor: 'var(--f1-red)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
              a safety car bunches the field & throws a strategy lottery
            </span>
          </Control>

          <Control label={`Tyre offset — ${tyreLabel(tyreOffset)} (${tyreOffset.toFixed(2)} s/lap)`}>
            <input
              type="range"
              min={0}
              max={1.2}
              step={0.05}
              value={tyreOffset}
              onChange={(e) => setTyreOffset(Number(e.target.value))}
              style={{ width: 220, accentColor: 'var(--f1-red)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6 }}>
              bigger compound delta = more strategic upsets (2026 narrow tyres)
            </span>
          </Control>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => runPrediction(grid, weather)}
            disabled={predicting || loadingGrid || grid.length === 0}
            style={primaryBtn(predicting || loadingGrid)}
          >
            {predicting ? 'Predicting…' : 'Run prediction'}
          </button>
          <button
            onClick={() => regenerateGrid(weather)}
            disabled={loadingGrid || predicting}
            style={secondaryBtn(loadingGrid || predicting)}
          >
            {loadingGrid ? 'Qualifying…' : '↻ New qualifying'}
          </button>
        </div>

        {grid.length > 0 && <GridStrip grid={grid} />}
      </Panel>

      {error && (
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
          {error} — is the ML service running on :8000? (see ml-service/README.md)
        </div>
      )}

      {podium.length === 3 && (
        <Panel title="Predicted podium">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[podium[1], podium[0], podium[2]].map((p, i) => (
              <PodiumCard key={p.id} p={p} place={i === 1 ? 1 : i === 0 ? 2 : 3} />
            ))}
          </div>
        </Panel>
      )}

      {preds.length > 0 && (
        <Panel title="Win probability — full field">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 62px 1fr 66px 66px 62px',
                gap: 10,
                padding: '4px 0 8px',
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <span>#</span>
              <span>grid</span>
              <span>win probability</span>
              <span style={{ textAlign: 'right' }}>podium</span>
              <span style={{ textAlign: 'right' }}>points</span>
              <span style={{ textAlign: 'right' }}>avg fin</span>
            </div>
            {preds.map((p, i) => (
              <PredictionRow key={p.id} p={p} rank={i + 1} widthPct={(p.winProbability / maxWin) * 100} />
            ))}
          </div>
        </Panel>
      )}

      {info && <ModelPanel info={info} sims={result?.scenario.monteCarloSims ?? 4000} />}
      {info && <RegulationsPanel notes={info.regulationNotes} overtakingEase={info.overtakingEase} />}
    </div>
  );
}

function GridStrip({ grid }: { grid: GridEntry[] }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
        Generated starting grid
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {grid.map((g) => (
          <span
            key={g.id}
            title={`P${g.gridPosition} — ${g.name} (${g.team})`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-panel-inset)',
              border: '1px solid var(--line)',
              borderLeft: `3px solid ${g.teamColor}`,
              borderRadius: 'var(--radius-sm)',
              padding: '4px 8px',
              fontFamily: 'var(--font-data)',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--text-faint)' }}>P{g.gridPosition}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{g.code}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function PodiumCard({ p, place }: { p: DriverPrediction; place: number }) {
  const medal = place === 1 ? '#ffd400' : place === 2 ? '#c8ccd0' : '#cd7f32';
  return (
    <div
      style={{
        background: 'var(--bg-panel-inset)',
        border: '1px solid var(--line)',
        borderTop: `3px solid ${p.teamColor}`,
        borderRadius: 'var(--radius-md)',
        padding: 16,
        marginTop: place === 1 ? 0 : 20,
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 700, color: medal }}>P{place}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, margin: '2px 0' }}>{p.code}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.name}</div>
      <div style={{ color: 'var(--text-faint)', fontSize: 11, marginBottom: 10 }}>{p.team}</div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 30, fontWeight: 700, color: 'var(--text-primary)' }}>
        {(p.winProbability * 100).toFixed(1)}%
      </div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)' }}>win · from P{p.gridPosition}</div>
    </div>
  );
}

function PredictionRow({ p, rank, widthPct }: { p: DriverPrediction; rank: number; widthPct: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '28px 62px 1fr 66px 66px 62px',
        gap: 10,
        alignItems: 'center',
        padding: '6px 0',
        borderTop: rank === 1 ? 'none' : '1px solid var(--line)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)' }}>{rank}</span>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-muted)' }}>P{p.gridPosition}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ position: 'relative', flex: 1, height: 22, background: 'var(--bg-panel-inset)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${Math.max(widthPct, 1.5)}%`,
              background: p.teamColor,
              opacity: 0.85,
              borderRadius: 3,
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: 8,
              top: 0,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              fontWeight: 700,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          >
            {p.code}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, fontWeight: 700, width: 52, textAlign: 'right' }}>
          {(p.winProbability * 100).toFixed(1)}%
        </span>
      </div>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
        {(p.podiumProbability * 100).toFixed(0)}%
      </span>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
        {(p.pointsProbability * 100).toFixed(0)}%
      </span>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)', textAlign: 'right' }}>
        {p.meanFinish.toFixed(1)}
      </span>
    </div>
  );
}

function ModelPanel({ info, sims }: { info: GridInfoResponse; sims: number }) {
  const m = info.model;
  const topFeatures = Object.entries(m.feature_importances).slice(0, 6);
  const maxImp = topFeatures.length ? topFeatures[0][1] : 1;
  return (
    <Panel title="How this prediction is made">
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 18 }}>
        <Stat label="model" value={m.model_type.replace('Classifier', '')} />
        <Stat label="version" value={m.version} />
        <Stat label="trained on" value={`${m.n_train_races.toLocaleString()} races`} />
        <Stat label="favourite wins" value={`${(m.metrics.top1_accuracy * 100).toFixed(0)}%`} />
        <Stat label="log loss" value={m.metrics.log_loss.toFixed(3)} />
        <Stat label="race sims" value={sims.toLocaleString()} />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 16px 0', maxWidth: 760 }}>
        A <strong style={{ color: 'var(--text-primary)' }}>{m.model_type}</strong> ({m.features.length} features)
        learns win probability from a physics-informed simulation of the 2026 grid, since no 2026 race
        history exists yet. Podium, points and average-finish come from a Monte-Carlo of the same model
        under your exact conditions. The headline win % below sums to 100% across the field.
      </p>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
        What the model weighs most
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {topFeatures.map(([name, imp]) => (
          <div key={name} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 46px', gap: 10, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-muted)' }}>{name}</span>
            <div style={{ height: 8, background: 'var(--bg-panel-inset)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${(imp / maxImp) * 100}%`, height: 8, background: 'var(--f1-red)', opacity: 0.8 }} />
            </div>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)', textAlign: 'right' }}>
              {(imp * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RegulationsPanel({ notes, overtakingEase }: { notes: string[]; overtakingEase: number }) {
  return (
    <Panel title="2026 regulations in the model">
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7 }}>
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
      <p style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        Overtaking-ease factor set to {overtakingEase.toFixed(2)} — active aero + the Manual Override boost
        make passing easier, so grid position matters less than in the DRS era and raw pace matters more.
      </p>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--line)',
        borderTop: '2px solid var(--f1-red)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-panel)',
        padding: 22,
        marginBottom: 20,
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 16,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-muted)',
          margin: '0 0 16px 0',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--f1-red)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '11px 22px',
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function secondaryBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--bg-panel-inset)',
    color: 'var(--text-primary)',
    border: '1px solid var(--line-bright)',
    borderRadius: 'var(--radius-sm)',
    padding: '11px 18px',
    fontWeight: 600,
    fontSize: 14,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
