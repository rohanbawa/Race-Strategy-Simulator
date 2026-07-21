import type { PlannedStint, TireCompound } from '../types';
import { COMPOUND_COLOR_VAR, COMPOUND_LABEL } from '../types';

const COMPOUNDS: TireCompound[] = ['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'];

interface Props {
  plan: PlannedStint[];
  onChange: (plan: PlannedStint[]) => void;
  totalLaps: number;
}

export default function StrategyBuilder({ plan, onChange, totalLaps }: Props) {
  const sumLaps = plan.reduce((s, p) => s + p.lengthLaps, 0);
  const overUnder = sumLaps - totalLaps;

  const update = (index: number, patch: Partial<PlannedStint>) => {
    const next = plan.map((p, i) => (i === index ? { ...p, ...patch } : p));
    onChange(next);
  };

  const removeStint = (index: number) => {
    if (plan.length <= 1) return;
    onChange(plan.filter((_, i) => i !== index));
  };

  const addStint = () => {
    onChange([...plan, { compound: 'MEDIUM', lengthLaps: Math.max(1, totalLaps - sumLaps) || 10 }]);
  };

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.map((stint, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr 100px 32px',
              alignItems: 'center',
              gap: 10,
              background: 'var(--bg-panel-raised)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: `var(${COMPOUND_COLOR_VAR[stint.compound]})`,
                justifySelf: 'center',
              }}
            />
            <select
              value={stint.compound}
              onChange={(e) => update(i, { compound: e.target.value as TireCompound })}
              style={{
                background: 'var(--bg-panel-inset)',
                color: 'var(--text-primary)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
              }}
            >
              {COMPOUNDS.map((c) => (
                <option key={c} value={c}>
                  {COMPOUND_LABEL[c]}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={stint.lengthLaps}
              onChange={(e) => update(i, { lengthLaps: Math.max(1, Number(e.target.value) || 1) })}
              style={{
                background: 'var(--bg-panel-inset)',
                color: 'var(--text-primary)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                fontFamily: 'var(--font-data)',
                fontSize: 14,
                width: '100%',
              }}
            />
            <button
              onClick={() => removeStint(i)}
              disabled={plan.length <= 1}
              aria-label="Remove stint"
              style={{
                background: 'none',
                border: 'none',
                color: plan.length <= 1 ? 'var(--text-faint)' : 'var(--accent-negative)',
                cursor: plan.length <= 1 ? 'default' : 'pointer',
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <button
          onClick={addStint}
          style={{
            background: 'none',
            border: '1px dashed var(--line-bright)',
            color: 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + add stint
        </button>
        <span
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: 12,
            color: overUnder === 0 ? 'var(--text-muted)' : 'var(--accent-warning)',
          }}
        >
          {sumLaps} / {totalLaps} laps planned
          {overUnder !== 0 && (overUnder > 0 ? ` (auto-trimmed by ${overUnder})` : ` (last stint auto-extended by ${-overUnder})`)}
        </span>
      </div>
    </div>
  );
}
