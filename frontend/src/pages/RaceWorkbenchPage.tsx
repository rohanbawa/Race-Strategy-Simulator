import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ActualStrategy, PlannedStint, RaceDetail, SimulationResult } from '../types';
import StintTimeline from '../components/StintTimeline';
import StrategyBuilder from '../components/StrategyBuilder';
import DeltaChart from '../components/DeltaChart';
import UndercutPanel from '../components/UndercutPanel';

export default function RaceWorkbenchPage() {
  const { raceId } = useParams();
  const raceIdNum = Number(raceId);

  const [detail, setDetail] = useState<RaceDetail | null>(null);
  const [driverId, setDriverId] = useState<number | null>(null);
  const [actual, setActual] = useState<ActualStrategy | null>(null);
  const [plan, setPlan] = useState<PlannedStint[]>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    api.getRace(raceIdNum).then((d) => {
      setDetail(d);
      if (d.drivers.length > 0) setDriverId(d.drivers[0].id);
    }).catch((e) => setError(e.message));
  }, [raceIdNum]);

  useEffect(() => {
    if (driverId == null) return;
    setSimResult(null);
    api.getActualStrategy(raceIdNum, driverId).then((a) => {
      setActual(a);
      setPlan(a.stints.map((s) => ({ compound: s.compound, lengthLaps: s.endLap - s.startLap + 1 })));
    }).catch((e) => setError(e.message));
  }, [raceIdNum, driverId]);

  const totalLaps = detail?.race.totalLaps ?? 0;
  const selectedDriver = detail?.drivers.find((d) => d.id === driverId) ?? null;
  const rivals = useMemo(
    () => detail?.drivers.filter((d) => d.id !== driverId) ?? [],
    [detail, driverId],
  );

  const runSimulation = async () => {
    if (driverId == null) return;
    setSimulating(true);
    setError(null);
    try {
      const result = await api.simulate({ raceId: raceIdNum, driverId, plannedStints: plan });
      setSimResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSimulating(false);
    }
  };

  if (error) {
    return <div style={{ padding: 28, color: 'var(--accent-negative)', fontFamily: 'var(--font-data)' }}>{error}</div>;
  }
  if (!detail) {
    return <div style={{ padding: 28, color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 28px', width: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 700, color: 'var(--f1-red)' }}>
          {detail.race.season} · ROUND {detail.race.round}
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 32, margin: '4px 0' }}>
          {detail.race.name}
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>{detail.race.circuitName}, {detail.race.country}</p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 340 }}>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
            Driver
          </span>
          <select
            value={driverId ?? ''}
            onChange={(e) => setDriverId(Number(e.target.value))}
            style={{
              background: 'var(--bg-panel-inset)',
              color: 'var(--text-primary)',
              border: '1px solid var(--line-bright)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px',
              fontFamily: 'var(--font-data)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {detail.drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.fullName} ({d.constructorName})
              </option>
            ))}
          </select>
        </label>
      </div>

      {actual && (
        <Panel title="What actually happened">
          <StintTimeline stints={actual.stints} pitStops={actual.pitStops} totalLaps={totalLaps} label={`${actual.driverCode} — actual`} />
          <div style={{ display: 'flex', gap: 28, marginTop: 14, fontFamily: 'var(--font-data)', fontSize: 13 }}>
            <span style={{ color: 'var(--text-muted)' }}>
              race time: <span style={{ color: 'var(--text-primary)' }}>{formatDuration(actual.totalRaceTimeSeconds)}</span>
            </span>
            {actual.finishPosition && (
              <span style={{ color: 'var(--text-muted)' }}>
                finished: <span style={{ color: 'var(--text-primary)' }}>P{actual.finishPosition}</span>
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              stops: <span style={{ color: 'var(--text-primary)' }}>{actual.pitStops.length}</span>
            </span>
          </div>
        </Panel>
      )}

      <Panel title="Build a what-if strategy">
        {plan.length > 0 && (
          <StrategyBuilder plan={plan} onChange={setPlan} totalLaps={totalLaps} />
        )}
        <button
          onClick={runSimulation}
          disabled={simulating}
          style={{
            marginTop: 16,
            background: 'var(--f1-red)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '11px 20px',
            fontWeight: 700,
            fontSize: 14,
            cursor: simulating ? 'default' : 'pointer',
          }}
        >
          {simulating ? 'Running…' : 'Run simulation'}
        </button>
      </Panel>

      {simResult && (
        <Panel title="What-if result">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <StintTimeline
              stints={simResult.plannedStints}
              pitStops={simResult.laps
                .filter((l) => l.isPitLap)
                .map((l, i) => ({ stopNumber: i + 1, lap: l.lap, stationaryTimeSeconds: 0, totalTimeLossSeconds: null }))}
              totalLaps={totalLaps}
              label={`${simResult.driverCode} — what-if`}
            />
            {actual && (
              <StintTimeline
                stints={actual.stints}
                pitStops={actual.pitStops}
                totalLaps={totalLaps}
                label={`${actual.driverCode} — actual`}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 32, marginBottom: 8, flexWrap: 'wrap' }}>
            <Stat label="simulated time" value={formatDuration(simResult.simulatedTotalTimeSeconds)} />
            {simResult.actualTotalTimeSeconds != null && (
              <Stat
                label={simResult.actualDataComplete ? 'actual time' : 'actual time (partial)'}
                value={formatDuration(simResult.actualTotalTimeSeconds)}
              />
            )}
            {simResult.deltaSeconds != null && (
              <Stat
                label="delta"
                value={`${simResult.deltaSeconds > 0 ? '+' : ''}${simResult.deltaSeconds.toFixed(2)}s`}
                accent={simResult.deltaSeconds > 0 ? 'var(--accent-negative)' : 'var(--accent-positive)'}
              />
            )}
            <Stat label="stops" value={String(simResult.pitStopCount)} />
            <Stat
              label="projected finish"
              value={simResult.projectedFinishPosition != null ? `P${simResult.projectedFinishPosition}` : '—'}
              accent={
                simResult.projectedFinishPosition != null && simResult.actualFinishPosition != null
                  ? simResult.projectedFinishPosition < simResult.actualFinishPosition
                    ? 'var(--accent-positive)'
                    : simResult.projectedFinishPosition > simResult.actualFinishPosition
                    ? 'var(--accent-negative)'
                    : undefined
                  : undefined
              }
            />
          </div>

          {simResult.projectedFinishPosition != null && simResult.actualFinishPosition != null && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 6px 0' }}>
              Actually finished <strong style={{ color: 'var(--text-primary)' }}>P{simResult.actualFinishPosition}</strong>
              {' · '}this strategy projects to{' '}
              <strong style={{ color: 'var(--text-primary)' }}>P{simResult.projectedFinishPosition}</strong>
              {' '}(ranked against the field's actual times, assuming no one else's pace changes).
            </p>
          )}

          {!simResult.actualDataComplete && (
            <p style={{ color: 'var(--accent-warning)', fontSize: 12, marginBottom: 16 }}>
              Some laps in this race are missing recorded actual times, so the actual-time comparison
              above is a partial sum and no projected finish position is shown.
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <DeltaChart laps={simResult.laps} />
          </div>
        </Panel>
      )}

      {selectedDriver && rivals.length > 0 && (
        <Panel title="Undercut / overcut">
          <UndercutPanel raceId={raceIdNum} attackingDriver={selectedDriver} rivals={rivals} />
        </Panel>
      )}
    </div>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-data)', fontSize: 22, fontWeight: 600, color: accent ?? 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = (totalSeconds % 60).toFixed(3);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s.padStart(6, '0')}`;
  return `${m}:${s.padStart(6, '0')}`;
}
