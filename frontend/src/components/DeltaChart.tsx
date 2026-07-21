import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LapSim } from '../types';

interface Props {
  laps: LapSim[];
}

export default function DeltaChart({ laps }: Props) {
  const data = laps.map((l) => ({
    lap: l.lap,
    delta: l.cumulativeDeltaSeconds,
    pit: l.isPitLap,
  }));

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
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="deltaPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-negative)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent-negative)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="deltaNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-positive)" stopOpacity={0.02} />
              <stop offset="100%" stopColor="var(--accent-positive)" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="lap"
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
            labelFormatter={(lap) => `Lap ${lap}`}
            formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(2)}s`, 'delta']}
          />
          <Area
            type="monotone"
            dataKey="delta"
            stroke="var(--accent-positive)"
            strokeWidth={2}
            fill="url(#deltaNegative)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
