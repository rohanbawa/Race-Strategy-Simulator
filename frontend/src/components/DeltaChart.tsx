import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CautionPeriod, LapSim } from '../types';

export interface DeltaSeries {
  key: string;
  name: string;
  color: string;
  laps: LapSim[];
}

interface Props {
  series: DeltaSeries[];
  cautionPeriods?: CautionPeriod[];
}

/**
 * Overlays one cumulative-delta curve per strategy on a single lap axis, so two or
 * three what-if plans can be compared head to head. Each plan keeps its own colour
 * (matched to its editor and summary card); the zero line is the actual race.
 */
export default function DeltaChart({ series, cautionPeriods }: Props) {
  // All plans share the same lap axis (same race), so merge by lap number into one row.
  const byLap = new Map<number, Record<string, number>>();
  for (const s of series) {
    for (const l of s.laps) {
      const row = byLap.get(l.lap) ?? { lap: l.lap };
      row[s.key] = l.cumulativeDeltaSeconds;
      byLap.set(l.lap, row);
    }
  }
  const data = [...byLap.values()].sort((a, b) => a.lap - b.lap);
  const multi = series.length > 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-muted)' }}>
          cumulative delta vs. actual race
        </span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)' }}>
          below zero = what-if is faster
        </span>
      </div>
      <ResponsiveContainer width="100%" height={multi ? 250 : 220}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          {cautionPeriods?.map((c, i) => (
            <ReferenceArea
              key={i}
              x1={c.startLap}
              x2={c.endLap}
              fill="var(--accent-warning)"
              fillOpacity={0.12}
              stroke="var(--accent-warning)"
              strokeOpacity={0.4}
              ifOverflow="extendDomain"
            />
          ))}
          <XAxis
            dataKey="lap"
            type="number"
            domain={['dataMin', 'dataMax']}
            stroke="var(--text-faint)"
            tick={{ fontFamily: 'var(--font-data)', fontSize: 11, fill: 'var(--text-faint)' }}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-faint)"
            tick={{ fontFamily: 'var(--font-data)', fontSize: 11, fill: 'var(--text-faint)' }}
            tickLine={false}
            tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}s`}
            width={52}
          />
          <ReferenceLine y={0} stroke="var(--line-bright)" strokeWidth={1.5} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-panel-raised)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              fontFamily: 'var(--font-data)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-muted)' }}
            labelFormatter={(lap) => `Lap ${lap}`}
            formatter={(v: number, name: string) => [`${v > 0 ? '+' : ''}${v.toFixed(2)}s`, name]}
          />
          {multi && (
            <Legend
              wrapperStyle={{ fontFamily: 'var(--font-data)', fontSize: 12 }}
              iconType="plainline"
            />
          )}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
