import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type {
  DriverPrediction,
  GridEntry,
  GridInfoResponse,
  PredictionResponse,
  Track,
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

function overtakingLabel(e: number): string {
  if (e < 0.3) return 'Very hard';
  if (e < 0.5) return 'Hard';
  if (e < 0.7) return 'Moderate';
  return 'Easy';
}

export default function RaceWinnerPage() {
  const [info, setInfo] = useState<GridInfoResponse | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [grid, setGrid] = useState<GridEntry[]>([]);
  const [weather, setWeather] = useState<Weather>('DRY');
  const [safetyCar, setSafetyCar] = useState(0.3);
  const [tyreOffset, setTyreOffset] = useState(0.35);

  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTrack = tracks.find((t) => t.round === selectedRound) ?? null;

  // Pure predictor: everything it needs is passed in, so handler-driven auto-runs
  // never read stale slider state.
  const predictWith = useCallback(
    async (round: number, currentGrid: GridEntry[], w: Weather, sc: number, tyre: number) => {
      if (currentGrid.length === 0) return;
      setPredicting(true);
      setError(null);
      try {
        const res = await api.predictRaceWinner({
          trackRound: round,
          weather: w,
          safetyCarProbability: sc,
          tyreOffsetSeconds: tyre,
          grid: currentGrid.map((g) => ({ driverId: g.id, position: g.gridPosition })),
          monteCarloSims: 4000,
        });
        setResult(res);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPredicting(false);
      }
    },
    [],
  );

  // Draw a fresh grid for a circuit + weather, then predict on it.
  const regenAndPredict = useCallback(
    async (round: number, w: Weather, sc: number, tyre: number, seed?: number) => {
      setLoadingGrid(true);
      setError(null);
      try {
        const q = await api.generateQualifying(w, round, seed);
        setGrid(q.grid);
        await predictWith(round, q.grid, w, sc, tyre);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoadingGrid(false);
      }
    },
    [predictWith],
  );

  useEffect(() => {
    let cancelled = false;
    api.getGridInfo().then((i) => !cancelled && setInfo(i)).catch(() => setInfo(null));
    api
      .getTracks()
      .then((resp) => {
        if (cancelled) return;
        setTracks(resp.tracks);
        const first = resp.tracks.find((t) => t.round === resp.nextUpcomingRound) ?? resp.tracks[0];
        if (!first) return;
        setSelectedRound(first.round);
        setSafetyCar(first.safetyCarRate);
        regenAndPredict(first.round, 'DRY', first.safetyCarRate, 0.35);
      })
      .catch((e) => setError((e as Error).message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTrack = (round: number) => {
    const t = tracks.find((x) => x.round === round);
    if (!t) return;
    setSelectedRound(round);
    setSafetyCar(t.safetyCarRate); // pre-fill safety-car odds from the circuit's tendency
    regenAndPredict(round, weather, t.safetyCarRate, tyreOffset);
  };

  const changeWeather = (w: Weather) => {
    setWeather(w);
    if (selectedRound != null) regenAndPredict(selectedRound, w, safetyCar, tyreOffset);
  };

  const busy = predicting || loadingGrid;
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
        <p style={{ color: 'var(--text-muted)', margin: 0, maxWidth: 730 }}>
          Pick a round from the 2026 calendar and a random-forest model estimates each driver's win,
          podium and points odds. Every circuit carries its own overtaking difficulty, tyre stress and
          safety-car tendency — so Monaco rewards grid position while Monza rewards raw pace — on top of
          the weather and tyre-offset you set.
        </p>
      </div>

      <Panel title="1 · Pick a race">
        {tracks.length === 0 && !error ? (
          <div style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-data)', fontSize: 13 }}>Loading calendar…</div>
        ) : (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Control label="2026 calendar">
              <select
                value={selectedRound ?? ''}
                onChange={(e) => selectTrack(Number(e.target.value))}
                disabled={busy || tracks.length === 0}
                style={{ ...selectStyle, minWidth: 340 }}
              >
                <optgroup label="Upcoming">
                  {tracks.filter((t) => !t.played).map((t) => (
                    <option key={t.round} value={t.round}>
                      R{String(t.round).padStart(2, '0')} · {t.name} — {t.date}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Completed">
                  {tracks.filter((t) => t.played).map((t) => (
                    <option key={t.round} value={t.round}>
                      R{String(t.round).padStart(2, '0')} · {t.name} ✓
                    </option>
                  ))}
                </optgroup>
              </select>
            </Control>

            {selectedTrack && <TrackInfo track={selectedTrack} />}
          </div>
        )}
      </Panel>

      <Panel title="2 · Race conditions">
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Control label="Weather">
            <div style={{ display: 'flex', gap: 6 }}>
              {WEATHER_OPTIONS.map((opt) => {
                const active = weather === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => changeWeather(opt.value)}
                    disabled={busy}
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
                      cursor: busy ? 'default' : 'pointer',
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
              pre-filled from the circuit; drag to override
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
              amplified on this circuit's tyre stress
            </span>
          </Control>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => selectedRound != null && predictWith(selectedRound, grid, weather, safetyCar, tyreOffset)}
            disabled={busy || grid.length === 0 || selectedRound == null}
            style={primaryBtn(busy)}
          >
            {predicting ? 'Predicting…' : 'Run prediction'}
          </button>
          <button
            onClick={() =>
              selectedRound != null &&
              regenAndPredict(selectedRound, weather, safetyCar, tyreOffset, Math.floor(Math.random() * 1e6))
            }
            disabled={busy || selectedRound == null}
            style={secondaryBtn(busy)}
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
        <Panel title={result?.track ? `Predicted podium — ${result.track.name}` : 'Predicted podium'}>
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

function TrackInfo({ track }: { track: Track }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 320,
        background: 'var(--bg-panel-inset)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{track.circuit}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{track.country}</span>
        <StatusBadge played={track.played} />
      </div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>
        Round {track.round} · {track.date} · {track.laps} laps · {track.kind}
      </div>
      <div style={{ display: 'flex', gap: 22, marginTop: 14, flexWrap: 'wrap' }}>
        <MiniStat label="overtaking" value={overtakingLabel(track.overtakingEase)} frac={track.overtakingEase} />
        <MiniStat label="tyre stress" value={tyreLabel(track.tyreStress - 0.4)} frac={(track.tyreStress - 0.6) / 0.9} />
        <MiniStat label="typical SC" value={scLabel(track.safetyCarRate)} frac={track.safetyCarRate} />
      </div>
    </div>
  );
}

function StatusBadge({ played }: { played: boolean }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-data)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        padding: '2px 7px',
        borderRadius: 3,
        color: played ? 'var(--text-faint)' : 'var(--accent-positive)',
        border: `1px solid ${played ? 'var(--line-bright)' : 'var(--accent-positive)'}`,
      }}
    >
      {played ? 'completed' : 'upcoming'}
    </span>
  );
}

function MiniStat({ label, value, frac }: { label: string; value: string; frac: number }) {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '2px 0 5px' }}>
        {value}
      </div>
      <div style={{ height: 5, background: 'var(--bg-panel)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: 5, background: 'var(--f1-red)', opacity: 0.75 }} />
      </div>
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
        learns win probability from a physics-informed simulation of the 2026 grid — including each circuit's
        overtaking difficulty and tyre stress — since no 2026 race history exists yet. Podium, points and
        average-finish come from a Monte-Carlo of the same model under your exact conditions. The headline
        win % below sums to 100% across the field.
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
        Baseline overtaking-ease {overtakingEase.toFixed(2)} — active aero + the Manual Override boost make
        passing easier than the DRS era; each circuit then adjusts this up or down from that baseline.
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

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-panel-inset)',
  color: 'var(--text-primary)',
  border: '1px solid var(--line-bright)',
  borderRadius: 'var(--radius-sm)',
  padding: '10px 12px',
  fontFamily: 'var(--font-data)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

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
