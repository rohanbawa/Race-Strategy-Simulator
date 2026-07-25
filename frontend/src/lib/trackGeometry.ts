/**
 * Small helpers for slicing a circuit path (a closed `M x y L x y … Z` string) into
 * arc-length ranges, so the track can be drawn in per-sector colours and its overtaking
 * zones highlighted. All coordinates are in the circuit's own viewBox space.
 */

export type Pt = [number, number];

/** Parse the vertices out of a track path string. */
export function parsePoints(path: string): Pt[] {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/** Cumulative arc length at each vertex, closing the loop (cum[n] === total). */
export function cumLengths(pts: Pt[]): { cum: number[]; total: number } {
  const n = pts.length;
  const cum = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    const a = pts[i - 1];
    const b = pts[i % n];
    cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return { cum, total: cum[n] };
}

function locate(cum: number[], arc: number): number {
  for (let i = 0; i < cum.length - 1; i++) if (arc <= cum[i + 1]) return i;
  return cum.length - 2;
}

function lerp(pts: Pt[], i: number, t: number): Pt {
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * A sub-path covering the arc-length range [aFrac, bFrac] of the loop (fractions of
 * total length, 0..1), with interpolated endpoints so it starts/ends exactly on the
 * boundaries. Returns an `M … L …` string (no `Z`).
 */
export function sliceArc(pts: Pt[], cum: number[], total: number, aFrac: number, bFrac: number): string {
  const n = pts.length;
  const a = Math.max(0, Math.min(1, aFrac)) * total;
  const b = Math.max(0, Math.min(1, bFrac)) * total;
  if (b <= a) return '';
  const ia = locate(cum, a);
  const ib = locate(cum, b);
  const pa = lerp(pts, ia, (a - cum[ia]) / ((cum[ia + 1] - cum[ia]) || 1));
  const pb = lerp(pts, ib, (b - cum[ib]) / ((cum[ib + 1] - cum[ib]) || 1));
  const out: Pt[] = [pa];
  for (let i = ia + 1; i <= ib; i++) out.push(pts[i % n]);
  out.push(pb);
  const f = (v: number) => v.toFixed(2);
  return out.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p[0])} ${f(p[1])}`).join(' ');
}

/** Midpoint (by arc length) of a range, for placing a label. */
export function midpoint(pts: Pt[], cum: number[], total: number, aFrac: number, bFrac: number): Pt {
  const m = ((aFrac + bFrac) / 2) * total;
  const i = locate(cum, m);
  return lerp(pts, i, (m - cum[i]) / ((cum[i + 1] - cum[i]) || 1));
}
