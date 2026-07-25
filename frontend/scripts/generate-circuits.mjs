/**
 * Generate src/data/circuits.ts from the public, OpenStreetMap-derived
 * `bacinger/f1-circuits` dataset (real circuit centre-lines).
 *
 *   node scripts/generate-circuits.mjs
 *
 * Each LineString is projected (equirectangular, longitude corrected for latitude),
 * fitted to its own aspect-correct viewBox, flipped north-up, and simplified with
 * Ramer-Douglas-Peucker. Edit the curated keyword map below to add/rename circuits,
 * then re-run. The dataset is cached to scripts/.f1-circuits.geojson after first fetch.
 */

import fs from 'fs';

const SRC_URL = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson';
const CACHE = new URL('./.f1-circuits.geojson', import.meta.url);
const OUT = new URL('../src/data/circuits.ts', import.meta.url);

// Curated map: dataset id -> [match tokens, official corner count]. Order = match
// priority; keywords are matched (case-insensitively) against
// "<circuitName> <country> <raceName>". Corner counts are the widely-cited official
// figures (the geometry is too simplified to count reliably); length + city come
// straight from the dataset.
const CIRCUITS = [
  ['gb-1948', ['silverstone', 'british', 'great britain'], 18],
  ['bh-2002', ['bahrain', 'sakhir'], 15],
  ['sa-2021', ['jeddah', 'saudi'], 27],
  ['au-1953', ['albert park', 'melbourne', 'australian', 'australia'], 14],
  ['jp-1962', ['suzuka', 'japanese', 'japan'], 18],
  ['cn-2004', ['shanghai', 'chinese', 'china'], 16],
  ['us-2022', ['miami'], 19],
  ['it-1953', ['imola', 'enzo e dino', 'emilia'], 19],
  ['mc-1929', ['monaco', 'monte carlo', 'montecarlo'], 19],
  ['es-1991', ['catalunya', 'barcelona'], 16],
  ['ca-1978', ['gilles', 'villeneuve', 'montreal', 'montréal', 'canadian', 'canada'], 14],
  ['at-1969', ['red bull ring', 'spielberg', 'a1-ring', 'austrian', 'austria'], 10],
  ['es-2026', ['madring', 'madrid'], 22],
  ['be-1925', ['spa', 'francorchamps', 'belgian', 'belgium'], 19],
  ['it-1922', ['monza', 'italian'], 11],
  ['hu-1986', ['hungaroring', 'budapest', 'hungarian', 'hungary'], 14],
  ['nl-1948', ['zandvoort', 'dutch', 'netherlands'], 14],
  ['az-2016', ['baku', 'azerbaijan'], 20],
  ['sg-2008', ['marina bay', 'singapore'], 19],
  ['us-2012', ['americas', 'austin'], 20],
  ['mx-1962', ['rodriguez', 'rodríguez', 'mexico', 'mexican'], 17],
  ['br-1940', ['interlagos', 'carlos pace', 'sao paulo', 'são paulo', 'brazil', 'brazilian'], 15],
  ['us-2023', ['las vegas', 'vegas'], 17],
  ['qa-2004', ['losail', 'lusail', 'qatar'], 16],
  ['ae-2009', ['yas marina', 'abu dhabi', 'yas island'], 16],
  // historical / non-championship venues, for older seasons in the dataset
  ['fr-1969', ['paul ricard', 'castellet'], 15],
  ['fr-1960', ['magny-cours', 'magny cours'], 17],
  ['de-1932', ['hockenheim'], 17],
  ['de-1927', ['nürburgring', 'nurburgring', 'eifel'], 16],
  ['ru-2014', ['sochi', 'russian'], 18],
  ['tr-2005', ['istanbul', 'turkish', 'turkey'], 14],
  ['pt-2008', ['algarve', 'portimão', 'portimao', 'portuguese'], 15],
  ['pt-1972', ['estoril'], 13],
  ['it-1914', ['mugello', 'tuscan', 'toscana'], 15],
  ['my-1999', ['sepang', 'malaysian', 'malaysia'], 15],
  ['br-1977', ['jacarepagu', 'jacarepaguá'], 10],
  ['us-1909', ['indianapolis', 'indy'], 13],
  ['ar-1952', ['galvez', 'gálvez', 'buenos aires', 'argentine', 'argentina'], 15],
  ['za-1961', ['kyalami', 'johannesburg', 'south africa'], 16],
  ['us-1956', ['watkins glen', 'watkins'], 11],
];

const TARGET = 100; // longest side of the fitted shape, in viewBox units
const PAD = 6;

function project(coords) {
  const lat0 = (coords.reduce((s, c) => s + c[1], 0) / coords.length) * Math.PI / 180;
  const k = Math.cos(lat0); // equirectangular longitude correction at the circuit's latitude
  return coords.map(([lon, lat]) => [lon * k, lat]);
}

// Ramer-Douglas-Peucker on an open polyline.
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const norm = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / norm;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > eps) {
    return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
  }
  return [a, b];
}

// RDP on a closed ring: anchor at the first vertex and the one farthest from it, so each
// half is an open chain with distinct endpoints (plain RDP degenerates when start≈end,
// which is exactly the case for a lap).
function simplifyClosed(pts, eps) {
  const n = pts.length;
  if (n < 4) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > fd) { fd = d; far = i; }
  }
  const a = rdp(pts.slice(0, far + 1), eps);
  const b = rdp(pts.slice(far).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

// --- annotation geometry (derived from the full-resolution loop) ---------------

const norm = (d) => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/** Resample a closed loop to evenly spaced points, `step` viewBox units apart. */
function resampleClosed(pts, step) {
  const Q = pts.concat([pts[0]]);
  const cum = [0];
  for (let i = 1; i < Q.length; i++) cum.push(cum[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]));
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let d = 0; d < total; d += step) {
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    out.push([Q[j][0] + (Q[j + 1][0] - Q[j][0]) * t, Q[j][1] + (Q[j + 1][1] - Q[j][1]) * t]);
  }
  return { rs: out, total };
}

/**
 * Derive corner apexes and overtaking zones from a resampled loop. Curvature at each
 * point is the heading change across a small window; peaks are corners, long flat runs
 * are straights. Corners are ranked by sharpness and the top `official` are kept, so the
 * count matches the real circuit while positions sit on genuine turns.
 */
function annotate(rs, step, official, centroid) {
  const n = rs.length;
  const w = Math.max(1, Math.round(3.4 / step));
  const heading = (i) => {
    const a = rs[((i % n) + n) % n], b = rs[(((i + 1) % n) + n) % n];
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const curv = new Array(n);
  for (let i = 0; i < n; i++) curv[i] = norm(heading(i + w) - heading(i - w));
  const absC = curv.map(Math.abs);

  // Corner candidates: local maxima of |curvature| above a low threshold.
  const cand = [];
  for (let i = 0; i < n; i++) {
    if (absC[i] < 0.22) continue;
    let isMax = true;
    for (let k = -w; k <= w; k++) if (absC[(((i + k) % n) + n) % n] > absC[i]) { isMax = false; break; }
    if (isMax) cand.push({ i, mag: absC[i] });
  }
  // Non-max suppression by minimum spacing, then keep the sharpest `official`.
  const minGap = Math.max(1, Math.round(2.6 / step));
  cand.sort((a, b) => b.mag - a.mag);
  const kept = [];
  for (const c of cand) if (kept.every((k) => { const g = Math.min(((c.i - k.i) % n + n) % n, ((k.i - c.i) % n + n) % n); return g >= minGap; })) kept.push(c);
  const top = kept.slice(0, official || kept.length).sort((a, b) => a.i - b.i);
  const turns = top.map((c, idx) => {
    const [x, y] = rs[c.i];
    let nx = x - centroid[0], ny = y - centroid[1];
    const len = Math.hypot(nx, ny) || 1;
    return { n: idx + 1, x: +(x + (nx / len) * 5).toFixed(1), y: +(y + (ny / len) * 5).toFixed(1) };
  });

  // Overtaking zones: the longest near-straight runs (candidate DRS straights).
  const runs = [];
  let s = -1;
  for (let i = 0; i <= n; i++) {
    const straight = i < n && absC[i] < 0.10;
    if (straight && s < 0) s = i;
    if (!straight && s >= 0) { runs.push([s, i - 1]); s = -1; }
  }
  runs.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const total = n * step;
  const drs = runs
    .filter((r) => (r[1] - r[0]) * step > 12)
    .slice(0, 2)
    .map((r) => [+((r[0] * step) / total).toFixed(3), +((r[1] * step) / total).toFixed(3)]);

  return { turns, drs };
}

function build(coords, official) {
  const p = project(coords);
  const xs = p.map((c) => c[0]), ys = p.map((c) => c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const s = TARGET / Math.max(w, h);
  const full = p.map(([x, y]) => [(x - minX) * s + PAD, (maxY - y) * s + PAD]); // fit + flip Y
  const vbW = +(w * s + 2 * PAD).toFixed(1);
  const vbH = +(h * s + 2 * PAD).toFixed(1);

  // Annotations from the full-resolution loop.
  const step = 1.0;
  const { rs } = resampleClosed(full, step);
  const centroid = rs.reduce((a, q) => [a[0] + q[0] / rs.length, a[1] + q[1] / rs.length], [0, 0]);
  const { turns, drs } = annotate(rs, step, official, centroid);

  // Simplified ribbon path for rendering.
  const fitted = simplifyClosed(full, 0.4);
  const f = (v) => v.toFixed(2);
  let d = `M ${f(fitted[0][0])} ${f(fitted[0][1])}`;
  for (let i = 1; i < fitted.length; i++) d += ` L ${f(fitted[i][0])} ${f(fitted[i][1])}`;
  return { vbW, vbH, path: d + ' Z', npts: fitted.length, turns, drs };
}

async function loadGeo() {
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  process.stderr.write(`Fetching ${SRC_URL} ...\n`);
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(CACHE, text);
  return JSON.parse(text);
}

const geo = await loadGeo();
const byId = new Map(geo.features.map((ft) => [ft.properties.id, ft]));

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const rows = [];
let chars = 0;
for (const [id, keywords, corners] of CIRCUITS) {
  const ft = byId.get(id);
  if (!ft) { process.stderr.write(`MISSING ${id}\n`); continue; }
  const b = build(ft.geometry.coordinates, corners);
  chars += b.path.length;
  const lengthKm = ft.properties.length ? +(ft.properties.length / 1000).toFixed(3) : null;
  const city = ft.properties.Location || '';
  const kw = keywords.map((k) => `'${esc(k)}'`).join(', ');
  const turns = b.turns.map((t) => `{ n: ${t.n}, x: ${t.x}, y: ${t.y} }`).join(', ');
  const drs = b.drs.map((r) => `[${r[0]}, ${r[1]}]`).join(', ');
  rows.push(
    `  { key: '${id}', keywords: [${kw}], vbW: ${b.vbW}, vbH: ${b.vbH}, ` +
    `lengthKm: ${lengthKm}, corners: ${corners}, city: '${esc(city)}', ` +
    `sectorBreaks: [0.333, 0.667], drs: [${drs}], turns: [${turns}], path: '${b.path}' },`,
  );
  process.stderr.write(`${id.padEnd(10)} ${ft.properties.Name.padEnd(30)} ${lengthKm}km ${corners}c turns=${b.turns.length} drs=${b.drs.length}\n`);
}

const file = `/**
 * Accurate F1 circuit outlines for the animated track map. GENERATED FILE - do not edit.
 *
 * Geometry is real: each path is the circuit centre-line from the public,
 * OpenStreetMap-derived \`bacinger/f1-circuits\` dataset, projected (equirectangular,
 * longitude corrected for latitude), fitted to its own aspect-correct viewBox, flipped
 * north-up, and simplified (Ramer-Douglas-Peucker). Regenerate with:
 *
 *     node scripts/generate-circuits.mjs
 *
 * \`circuitFor(name, country, race)\` matches on keywords found in any of those strings;
 * unknown circuits fall back to a generic loop so the map is always present.
 */

export interface Turn {
  n: number;
  x: number;
  y: number;
}

export interface CircuitShape {
  key: string;
  vbW: number;
  vbH: number;
  /** Official circuit length in km, or null if unknown. */
  lengthKm: number | null;
  /** Official corner count, or null if unknown. */
  corners: number | null;
  /** City the circuit is in (from the dataset), or '' if unknown. */
  city: string;
  /** Timing-sector boundaries as arc-length fractions (approximate: even thirds). */
  sectorBreaks: [number, number];
  /** Overtaking (DRS) zones as [start, end] arc-length fractions of the lap. */
  drs: [number, number][];
  /** Corner apexes with their number and label position (offset outward). */
  turns: Turn[];
  path: string;
}

interface RawCircuit extends CircuitShape {
  keywords: string[];
}

const CIRCUITS: RawCircuit[] = [
${rows.join('\n')}
];

const GENERIC: CircuitShape = {
  key: 'generic',
  vbW: 100,
  vbH: 62,
  lengthKm: null,
  corners: null,
  city: '',
  sectorBreaks: [0.333, 0.667],
  drs: [],
  turns: [],
  path: 'M 20 34 L 26 22 L 38 15 L 52 15 L 62 21 L 70 14 L 82 17 L 88 28 L 84 40 L 72 44 L 62 39 L 52 45 L 56 54 L 44 55 L 33 49 L 24 53 L 16 44 Z',
};

export function circuitFor(circuitName?: string, country?: string, raceName?: string): CircuitShape {
  const hay = \`\${circuitName ?? ''} \${country ?? ''} \${raceName ?? ''}\`.toLowerCase();
  const match = CIRCUITS.find((c) => c.keywords.some((k) => hay.includes(k)));
  return match ?? GENERIC;
}
`;

fs.writeFileSync(OUT, file);
process.stderr.write(`\nWrote ${OUT.pathname.replace(/^\//, '')} (${CIRCUITS.length} circuits, ~${(chars / 1024).toFixed(1)}KB of paths)\n`);
