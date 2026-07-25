import { useRef, useState } from 'react';
import type { CautionPeriod, PlannedStint, TireCompound } from '../types';
import { COMPOUND_COLOR_VAR, COMPOUND_LABEL } from '../types';

// Click a stint to cycle its compound through this order.
const COMPOUND_CYCLE: TireCompound[] = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

interface Props {
  plan: PlannedStint[];
  onChange: (plan: PlannedStint[]) => void;
  totalLaps: number;
  cautionPeriods?: CautionPeriod[];
}

/**
 * A tactile stint editor: drag the dividers between stints to move the pit laps,
 * click a stint to change its tyre, and add/remove stints - no number inputs. The
 * plan's lap total is held constant, so dragging a divider transfers laps between
 * the two adjacent stints.
 */
export default function EditableStintTimeline({ plan, onChange, totalLaps, cautionPeriods }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (totalLaps <= 0 || plan.length === 0) return null;

  // Cumulative end-lap after each stint; the internal dividers sit at cum[0..n-2].
  const cum: number[] = [];
  let acc = 0;
  for (const s of plan) {
    acc += s.lengthLaps;
    cum.push(acc);
  }
  const planned = acc;

  const startLapOf = (i: number) => (i === 0 ? 1 : cum[i - 1] + 1);

  const cycleCompound = (i: number) => {
    const next = COMPOUND_CYCLE[(COMPOUND_CYCLE.indexOf(plan[i].compound) + 1) % COMPOUND_CYCLE.length];
    onChange(plan.map((s, idx) => (idx === i ? { ...s, compound: next } : s)));
  };

  const moveDivider = (j: number, clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const leftEnd = j === 0 ? 0 : cum[j - 1]; // end lap of the stint before the pair
    const pairLaps = plan[j].lengthLaps + plan[j + 1].lengthLaps;
    let boundaryLap = Math.round(((clientX - rect.left) / rect.width) * totalLaps);
    boundaryLap = Math.max(leftEnd + 1, Math.min(leftEnd + pairLaps - 1, boundaryLap));
    const newLenJ = boundaryLap - leftEnd;
    onChange(
      plan.map((s, idx) =>
        idx === j ? { ...s, lengthLaps: newLenJ } : idx === j + 1 ? { ...s, lengthLaps: pairLaps - newLenJ } : s,
      ),
    );
  };

  const addStint = () => {
    // Split the longest stint in two so the lap total is preserved.
    let longest = 0;
    plan.forEach((s, i) => {
      if (s.lengthLaps > plan[longest].lengthLaps) longest = i;
    });
    if (plan[longest].lengthLaps < 2) return;
    const half = Math.floor(plan[longest].lengthLaps / 2);
    const next: PlannedStint[] = [];
    plan.forEach((s, i) => {
      if (i === longest) {
        next.push({ compound: s.compound, lengthLaps: half });
        next.push({ compound: nextCompound(s.compound), lengthLaps: s.lengthLaps - half });
      } else {
        next.push(s);
      }
    });
    onChange(next);
  };

  const removeStint = (i: number) => {
    if (plan.length <= 1) return;
    // Give this stint's laps to a neighbour (previous, or next if it's the first),
    // then drop it - so the plan's lap total is unchanged.
    const mergeInto = i === 0 ? 1 : i - 1;
    const addedLaps = plan[i].lengthLaps;
    onChange(
      plan
        .map((s, idx) => (idx === mergeInto ? { ...s, lengthLaps: s.lengthLaps + addedLaps } : s))
        .filter((_, idx) => idx !== i),
    );
  };

  return (
    <div>
      <div
        ref={barRef}
        style={{
          position: 'relative',
          height: 40,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--line)',
          display: 'flex',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {plan.map((stint, i) => {
          const widthPct = (stint.lengthLaps / planned) * 100;
          const dark = stint.compound === 'HARD' || stint.compound === 'MEDIUM';
          return (
            <div
              key={i}
              onClick={() => cycleCompound(i)}
              title={`${COMPOUND_LABEL[stint.compound]} · laps ${startLapOf(i)}–${cum[i]} · click to change tyre`}
              style={{
                width: `${widthPct}%`,
                background: `var(${COMPOUND_COLOR_VAR[stint.compound]})`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRight: i < plan.length - 1 ? '1px solid var(--bg-void)' : 'none',
                borderTopLeftRadius: i === 0 ? 'var(--radius-sm)' : 0,
                borderBottomLeftRadius: i === 0 ? 'var(--radius-sm)' : 0,
                borderTopRightRadius: i === plan.length - 1 ? 'var(--radius-sm)' : 0,
                borderBottomRightRadius: i === plan.length - 1 ? 'var(--radius-sm)' : 0,
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: dark ? '#15151e' : '#ffffff',
                }}
              >
                {widthPct > 9 ? COMPOUND_LABEL[stint.compound].toUpperCase() : ''}
              </span>
              {widthPct > 12 && (
                <span
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 10,
                    color: dark ? 'rgba(21,21,30,0.7)' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  {stint.lengthLaps} laps
                </span>
              )}
              {plan.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStint(i);
                  }}
                  aria-label={`Remove stint ${i + 1}`}
                  title="Remove this stint"
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 3,
                    width: 14,
                    height: 14,
                    lineHeight: '12px',
                    padding: 0,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(0,0,0,0.28)',
                    color: dark ? '#15151e' : '#fff',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {/* Draggable dividers between stints (pit laps). */}
        {plan.slice(0, -1).map((_, j) => {
          const leftPct = (cum[j] / planned) * 100;
          const active = dragIndex === j;
          return (
            <div
              key={`divider-${j}`}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragIndex(j);
              }}
              onPointerMove={(e) => dragIndex === j && moveDivider(j, e.clientX)}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId);
                setDragIndex(null);
              }}
              title={`Pit after lap ${cum[j]} — drag to move`}
              style={{
                position: 'absolute',
                left: `${leftPct}%`,
                top: -3,
                bottom: -3,
                width: 16,
                transform: 'translateX(-50%)',
                cursor: 'col-resize',
                touchAction: 'none',
                display: 'flex',
                justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  width: active ? 4 : 2,
                  height: '100%',
                  background: active ? '#ffffff' : 'var(--text-primary)',
                  boxShadow: '0 0 0 1px var(--bg-void)',
                  borderRadius: 2,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Pit-lap markers + labels under each divider. */}
      <div style={{ position: 'relative', height: 16, marginTop: 3 }}>
        {plan.slice(0, -1).map((_, j) => (
          <div
            key={`piti-${j}`}
            style={{
              position: 'absolute',
              left: `${(cum[j] / planned) * 100}%`,
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-data)',
              fontSize: 10,
              color: 'var(--accent-warning)',
              whiteSpace: 'nowrap',
            }}
          >
            ▲ L{cum[j]}
          </div>
        ))}
      </div>

      {cautionPeriods && cautionPeriods.length > 0 && (
        <div style={{ position: 'relative', height: 14, marginTop: 2 }}>
          {cautionPeriods.map((c, i) => (
            <div
              key={i}
              title={`${c.type === 'SC' ? 'Safety Car' : 'Virtual Safety Car'} (detected) · laps ${c.startLap}-${c.endLap} — pit here to save time`}
              style={{
                position: 'absolute',
                left: `${((c.startLap - 1) / totalLaps) * 100}%`,
                width: `${((c.endLap - c.startLap + 1) / totalLaps) * 100}%`,
                height: '100%',
                background: 'rgba(255, 212, 0, 0.22)',
                border: '1px solid var(--accent-warning)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 700, color: 'var(--accent-warning)' }}>
                {((c.endLap - c.startLap + 1) / totalLaps) * 100 > 4 ? c.type : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 12 }}>
        <button
          onClick={addStint}
          style={{
            background: 'none',
            border: '1px dashed var(--line-bright)',
            color: 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '7px 12px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + add stint
        </button>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--text-faint)' }}>
          drag dividers to move pit laps · click a stint to change tyre
        </span>
      </div>
    </div>
  );
}

function nextCompound(c: TireCompound): TireCompound {
  if (c === 'SOFT') return 'MEDIUM';
  if (c === 'MEDIUM') return 'HARD';
  if (c === 'HARD') return 'MEDIUM';
  return c;
}
