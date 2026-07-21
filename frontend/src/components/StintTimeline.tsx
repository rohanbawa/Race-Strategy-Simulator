import type { PitStopInfo, StintInfo } from '../types';
import { COMPOUND_COLOR_VAR, COMPOUND_LABEL } from '../types';

interface Props {
  stints: StintInfo[];
  pitStops: PitStopInfo[];
  totalLaps: number;
  label: string;
}

export default function StintTimeline({ stints, pitStops, totalLaps, label }: Props) {
  if (totalLaps <= 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)' }}>
          {totalLaps} laps
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 32,
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          border: '1px solid var(--line)',
          display: 'flex',
        }}
      >
        {stints.map((stint) => {
          const widthPct = ((stint.endLap - stint.startLap + 1) / totalLaps) * 100;
          const color = `var(${COMPOUND_COLOR_VAR[stint.compound]})`;
          return (
            <div
              key={stint.stintNumber}
              title={`${COMPOUND_LABEL[stint.compound]} · laps ${stint.startLap}-${stint.endLap}`}
              style={{
                width: `${widthPct}%`,
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: '1px solid var(--bg-void)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: stint.compound === 'HARD' || stint.compound === 'MEDIUM' ? '#15151e' : '#ffffff',
                  opacity: 0.85,
                }}
              >
                {widthPct > 8 ? COMPOUND_LABEL[stint.compound].toUpperCase() : ''}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
        {pitStops.map((stop) => (
          <div
            key={stop.stopNumber}
            title={`Pit stop ${stop.stopNumber} — lap ${stop.lap} — ${stop.stationaryTimeSeconds.toFixed(1)}s`}
            style={{
              position: 'absolute',
              left: `${(stop.lap / totalLaps) * 100}%`,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-data)',
              fontSize: 10,
              color: 'var(--accent-warning)',
            }}
          >
            ▲
          </div>
        ))}
      </div>
    </div>
  );
}
