import { useState } from 'react';
import { api } from '../api/client';
import type { DriverSummary, TireCompound, UndercutResult } from '../types';
import { COMPOUND_LABEL } from '../types';

const COMPOUNDS: TireCompound[] = ['SOFT', 'MEDIUM', 'HARD'];

interface Props {
  raceId: number;
  attackingDriver: DriverSummary;
  rivals: DriverSummary[];
}

export default function UndercutPanel({ raceId, attackingDriver, rivals }: Props) {
  const [defendingDriverId, setDefendingDriverId] = useState<number | ''>(rivals[0]?.id ?? '');
  const [pitLap, setPitLap] = useState(20);
  const [compound, setCompound] = useState<TireCompound>('SOFT');
  const [result, setResult] = useState<UndercutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (defendingDriverId === '') return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.evaluateUndercut({
        raceId,
        attackingDriverId: attackingDriver.id,
        defendingDriverId,
        attackingPitLap: pitLap,
        attackingCompound: compound,
      });
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="attacker">
          <div style={{ padding: '8px 10px', fontFamily: 'var(--font-data)', fontSize: 14, color: 'var(--text-primary)' }}>
            {attackingDriver.code}
          </div>
        </Field>

        <Field label="defender">
          <select
            value={defendingDriverId}
            onChange={(e) => setDefendingDriverId(Number(e.target.value))}
            style={selectStyle}
          >
            {rivals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </select>
        </Field>

        <Field label="pit on lap">
          <input
            type="number"
            min={1}
            value={pitLap}
            onChange={(e) => setPitLap(Number(e.target.value) || 1)}
            style={{ ...selectStyle, width: 72, fontFamily: 'var(--font-data)' }}
          />
        </Field>

        <Field label="fit compound">
          <select value={compound} onChange={(e) => setCompound(e.target.value as TireCompound)} style={selectStyle}>
            {COMPOUNDS.map((c) => (
              <option key={c} value={c}>
                {COMPOUND_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>

        <button
          onClick={run}
          disabled={loading || defendingDriverId === ''}
          style={{
            background: 'var(--f1-red)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 16px',
            fontWeight: 600,
            fontSize: 13,
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? 'Calculating…' : 'Evaluate'}
        </button>
      </div>

      {error && (
        <p style={{ color: 'var(--accent-negative)', fontFamily: 'var(--font-data)', fontSize: 13, marginTop: 10 }}>
          {error}
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${result.undercutSucceeds ? 'var(--accent-positive)' : 'var(--accent-negative)'}`,
            background: 'var(--bg-panel-inset)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 20,
              color: result.undercutSucceeds ? 'var(--accent-positive)' : 'var(--accent-negative)',
              marginBottom: 4,
            }}
          >
            {result.undercutSucceeds ? 'UNDERCUT WORKS' : 'UNDERCUT FAILS'}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
            {result.attackingDriverCode} would emerge{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {result.marginSeconds.toFixed(2)}s {result.undercutSucceeds ? 'ahead of' : 'behind'}
            </strong>{' '}
            {result.defendingDriverCode} once both have stopped ({result.defendingDriverCode}'s actual stop was lap{' '}
            {result.defendingActualPitLap}).
          </p>
          <div style={{ display: 'flex', gap: 24, fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--text-faint)' }}>
            <span>gap before stop: {result.gapAtAttackingPitLapSeconds.toFixed(2)}s</span>
            <span>gap after sequence: {result.gapAfterSequenceSeconds.toFixed(2)}s</span>
          </div>
        </div>
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
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 10px',
  fontSize: 14,
};
