import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ActualStrategy, CautionPeriod, PlannedStint, RaceDetail, SimulationResult } from '../types';
import StintTimeline from '../components/StintTimeline';
import EditableStintTimeline from '../components/EditableStintTimeline';
import DeltaChart, { type DeltaSeries } from '../components/DeltaChart';
import UndercutPanel from '../components/UndercutPanel';

const PLAN_COLORS = ['#3987e5', '#d95926', '#9085e9']; // blue / orange / violet — CVD-validated
const PLAN_NAMES = ['A', 'B', 'C'];
const MAX_PLANS = 3;

interface PlanState {
  id: number;
  stints: PlannedStint[];
  result: SimulationResult | null;
}

export default function RaceWorkbenchPage() {
  const { raceId } = useParams();
  const raceIdNum = Number(raceId);

  const [detail, setDetail] = useState<RaceDetail | null>(null);
  const [driverId, setDriverId] = useState<number | null>(null);
  const [actual, setActual] = useState<ActualStrategy | null>(null);
  const [plans, setPlans] = useState<PlanState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [resultsStale, setResultsStale] = useState(false);
  const [cautionPeriods, setCautionPeriods] = useState<CautionPeriod[]>([]);

  const idRef = useRef(1);
  const newId = () => idRef.current++;

  useEffect(() => {
    api.getRace(raceIdNum).then((d) => {
      setDetail(d);
      if (d.drivers.length > 0) setDriverId(d.drivers[0].id);
    }).catch((e) => setError(e.message));
    api.getCautionPeriods(raceIdNum).then(setCautionPeriods).catch(() => setCautionPeriods([]));
  }, [raceIdNum]);

  useEffect(() => {
    if (driverId == null) return;
    api.getActualStrategy(raceIdNum, driverId).then((a) => {
      setActual(a);
      const stints = a.stints.map((s) => ({ compound: s.compound, lengthLaps: s.endLap - s.startLap + 1 }));
      setPlans([{ id: newId(), stints, result: null }]);
      setResultsStale(false);
    }).catch((e) => setError(e.message));
  }, [raceIdNum, driverId]);

  const totalLaps = detail?.race.totalLaps ?? 0;
  const selectedDriver = detail?.drivers.find((d) => d.id === driverId) ?? null;
  const rivals = useMemo(
    () => detail?.drivers.filter((d) => d.id !== driverId) ?? [],
    [detail, driverId],
  );

  const updatePlan = (id: number, stints: PlannedStint[]) => {
    setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, stints } : p)));
    setResultsStale(true);
  };

  const addPlan = () => {
    setPlans((ps) => {
      if (ps.length >= MAX_PLANS) return ps;
      const clone = ps[ps.length - 1].stints.map((s) => ({ ...s }));
      return [...ps, { id: newId(), stints: clone, result: null }];
    });
    setResultsStale(true);
  };

  const removePlan = (id: number) => {
    setPlans((ps) => (ps.length <= 1 ? ps : ps.filter((p) => p.id !== id)));
  };

  const runComparison = async () => {
    if (driverId == null || plans.length === 0) return;
    setSimulating(true);
    setError(null);
    try {
      const results = await Promise.all(
        plans.map((p) => api.simulate({ raceId: raceIdNum, driverId, plannedStints: p.stints })),
      );
      setPlans((ps) => ps.map((p, i) => ({ ...p, result: results[i] })));
      setResultsStale(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSimulating(false);
    }
  };

  const series: DeltaSeries[] = plans.flatMap((p, i) =>
    p.result ? [{ key: `plan-${p.id}`, name: `Plan ${PLAN_NAMES[i]}`, color: PLAN_COLORS[i], laps: p.result.laps }] : [],
  );
  const anyResult = series.length > 0;
  const anyPartial = plans.some((p) => p.result && !p.result.actualDataComplete);

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
          <StintTimeline
            stints={actual.stints}
            pitStops={actual.pitStops}
            totalLaps={totalLaps}
            label={`${actual.driverCode} — actual`}
            cautionPeriods={cautionPeriods}
          />
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

      <Panel title="Build & compare what-if strategies">
        {cautionPeriods.length > 0 && (
          <div
            style={{
              border: '1px solid var(--accent-warning)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 212, 0, 0.08)',
              padding: '10px 14px',
              marginBottom: 18,
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--accent-warning)', fontWeight: 700 }}>Caution windows detected</span>
            <span style={{ color: 'var(--text-muted)' }}> — pitting inside one (shaded yellow on the bars) costs far less time. Drag a divider onto one to try it:</span>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontFamily: 'var(--font-data)' }}>
              {cautionPeriods.map((c, i) => (
                <span key={i} style={{ color: 'var(--text-primary)' }}>
                  {c.type} · laps {c.startLap}–{c.endLap}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {plans.map((p, i) => (
            <div key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: PLAN_COLORS[i] }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  Plan {PLAN_NAMES[i]}
                </span>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)' }}>
                  {p.stints.reduce((s, x) => s + x.lengthLaps, 0)} laps · {Math.max(0, p.stints.length - 1)} stop
                  {p.stints.length - 1 === 1 ? '' : 's'}
                </span>
                {plans.length > 1 && (
                  <button
                    onClick={() => removePlan(p.id)}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-faint)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontFamily: 'var(--font-data)',
                    }}
                  >
                    ✕ remove
                  </button>
                )}
              </div>
              <EditableStintTimeline
                plan={p.stints}
                onChange={(stints) => updatePlan(p.id, stints)}
                totalLaps={totalLaps}
                cautionPeriods={cautionPeriods}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={runComparison}
            disabled={simulating}
            style={{
              background: 'var(--f1-red)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '11px 20px',
              fontWeight: 700,
              fontSize: 14,
              cursor: simulating ? 'default' : 'pointer',
              opacity: simulating ? 0.7 : 1,
            }}
          >
            {simulating ? 'Running…' : plans.length > 1 ? `Run comparison (${plans.length})` : 'Run simulation'}
          </button>
          {plans.length < MAX_PLANS && (
            <button
              onClick={addPlan}
              style={{
                background: 'var(--bg-panel-inset)',
                color: 'var(--text-primary)',
                border: '1px solid var(--line-bright)',
                borderRadius: 'var(--radius-sm)',
                padding: '11px 16px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              + Add strategy
            </button>
          )}
          {resultsStale && anyResult && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--accent-warning)' }}>
              edited — re-run to update the comparison
            </span>
          )}
        </div>
      </Panel>

      {anyResult && (
        <Panel title={plans.length > 1 ? 'Strategy comparison' : 'What-if result'}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {actual && (
              <SummaryCard title="Actual" accent="var(--line-bright)">
                <BigTime value={formatDuration(actual.totalRaceTimeSeconds)} />
                <MetricLine label="finished" value={actual.finishPosition ? `P${actual.finishPosition}` : '—'} />
                <MetricLine label="stops" value={String(actual.pitStops.length)} />
              </SummaryCard>
            )}
            {plans.map((p, i) =>
              p.result ? (
                <SummaryCard key={p.id} title={`Plan ${PLAN_NAMES[i]}`} accent={PLAN_COLORS[i]}>
                  <BigTime value={formatDuration(p.result.simulatedTotalTimeSeconds)} />
                  <MetricLine
                    label={p.result.actualDataComplete ? 'delta vs actual' : 'delta (partial)'}
                    value={
                      p.result.deltaSeconds != null
                        ? `${p.result.deltaSeconds > 0 ? '+' : ''}${p.result.deltaSeconds.toFixed(2)}s`
                        : '—'
                    }
                    color={
                      p.result.deltaSeconds != null
                        ? p.result.deltaSeconds > 0
                          ? 'var(--accent-negative)'
                          : 'var(--accent-positive)'
                        : undefined
                    }
                  />
                  <MetricLine
                    label="projected finish"
                    value={p.result.projectedFinishPosition != null ? `P${p.result.projectedFinishPosition}` : '—'}
                  />
                  <MetricLine label="stops" value={String(p.result.pitStopCount)} />
                </SummaryCard>
              ) : null,
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <DeltaChart series={series} cautionPeriods={cautionPeriods} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {plans.map((p, i) =>
              p.result ? (
                <StintTimeline
                  key={p.id}
                  stints={p.result.plannedStints}
                  pitStops={p.result.laps
                    .filter((l) => l.isPitLap)
                    .map((l, idx) => ({ stopNumber: idx + 1, lap: l.lap, stationaryTimeSeconds: 0, totalTimeLossSeconds: null }))}
                  totalLaps={totalLaps}
                  label={`Plan ${PLAN_NAMES[i]} — what-if`}
                  cautionPeriods={cautionPeriods}
                />
              ) : null,
            )}
            {actual && (
              <StintTimeline
                stints={actual.stints}
                pitStops={actual.pitStops}
                totalLaps={totalLaps}
                label={`${actual.driverCode} — actual`}
                cautionPeriods={cautionPeriods}
              />
            )}
          </div>

          {anyPartial && (
            <p style={{ color: 'var(--accent-warning)', fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              Some laps in this race are missing recorded actual times, so any delta above is a partial
              sum and no projected finish position is shown for those plans.
            </p>
          )}
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

function SummaryCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-panel-inset)',
        border: '1px solid var(--line)',
        borderTop: `3px solid ${accent}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function BigTime({ value }: { value: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-data)',
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 8,
        letterSpacing: '0.01em',
      }}
    >
      {value}
    </div>
  );
}

function MetricLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '2px 0' }}>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, fontWeight: 600, color: color ?? 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

// Always h:mm:ss.mmm so every race-time readout shares one format, regardless of length.
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = (totalSeconds % 60).toFixed(3);
  return `${h}:${String(m).padStart(2, '0')}:${s.padStart(6, '0')}`;
}
