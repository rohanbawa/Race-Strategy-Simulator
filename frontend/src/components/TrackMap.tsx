import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { circuitFor } from '../data/circuits';
import { cumLengths, midpoint, parsePoints, sliceArc } from '../lib/trackGeometry';

interface Props {
  circuitName?: string;
  country?: string;
  raceName?: string;
}

// Sector colours (S1 / S2 / S3) and the overtaking-zone highlight.
export const SECTOR_COLORS = ['#e10600', '#33a1f2', '#f4c430'];
export const DRS_COLOR = '#31d67e';

/**
 * A detailed circuit map: the real OSM-derived outline drawn as a dark ribbon, with the
 * racing line coloured by timing sector, numbered corners, and highlighted overtaking
 * (DRS) zones. The sector lines trace themselves out on mount (framer-motion), then the
 * annotations fade in. Each circuit renders in its own aspect-correct viewBox.
 *
 * Corner apexes, sector splits and DRS zones are derived from track geometry (see
 * scripts/generate-circuits.mjs) — recognisable, but approximate, not official telemetry.
 */
export default function TrackMap({ circuitName, country, raceName }: Props) {
  const shape = useMemo(() => circuitFor(circuitName, country, raceName), [circuitName, country, raceName]);
  const reduce = useReducedMotion();
  const gid = `tm-${shape.key}`;

  const geo = useMemo(() => {
    const pts = parsePoints(shape.path);
    const { cum, total } = cumLengths(pts);
    const [b1, b2] = shape.sectorBreaks;
    const sectors = [
      sliceArc(pts, cum, total, 0, b1),
      sliceArc(pts, cum, total, b1, b2),
      sliceArc(pts, cum, total, b2, 1),
    ];
    const drs = shape.drs.map((r) => ({ d: sliceArc(pts, cum, total, r[0], r[1]), mid: midpoint(pts, cum, total, r[0], r[1]) }));
    const start = pts[0];
    const next = pts[1] ?? pts[0];
    const startAng = (Math.atan2(next[1] - start[1], next[0] - start[0]) * 180) / Math.PI;
    return { sectors, drs, start, startAng };
  }, [shape]);

  const annDelay = reduce ? 0 : 2.0; // annotations appear once the line is drawn

  return (
    <svg
      viewBox={`0 0 ${shape.vbW} ${shape.vbH}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ display: 'block', overflow: 'visible' }}
      aria-label={`${circuitName ?? 'Circuit'} track map`}
      role="img"
    >
      <defs>
        <filter id={`${gid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={`${gid}-check`} width="2.2" height="2.2" patternUnits="userSpaceOnUse">
          <rect width="2.2" height="2.2" fill="#ececf2" />
          <rect width="1.1" height="1.1" fill="#15151e" />
          <rect x="1.1" y="1.1" width="1.1" height="1.1" fill="#15151e" />
        </pattern>
      </defs>

      {/* Track ribbon (asphalt): soft light edge under a solid dark body. */}
      <path d={shape.path} fill="none" stroke="var(--line-bright)" strokeWidth={6.6} strokeLinejoin="round" strokeLinecap="round" opacity={0.4} />
      <path d={shape.path} fill="none" stroke="#23232e" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Overtaking (DRS) zones: a bright dashed underlay on the straights. */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: annDelay }}>
        {geo.drs.map((z, i) => (
          <path key={i} d={z.d} fill="none" stroke={DRS_COLOR} strokeWidth={5.6} strokeLinecap="round" strokeDasharray="0.2 3" opacity={0.9} />
        ))}
      </motion.g>

      {/* Racing line, coloured by sector, tracing itself out one sector at a time. */}
      {geo.sectors.map((d, i) =>
        d ? (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke={SECTOR_COLORS[i]}
            strokeWidth={2.3}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter={`url(#${gid}-glow)`}
            initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0.3 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ pathLength: { duration: 0.75, ease: 'easeInOut', delay: reduce ? 0 : i * 0.62 }, opacity: { duration: 0.3, delay: reduce ? 0 : i * 0.62 } }}
          />
        ) : null,
      )}

      {/* Numbered corners + start/finish, fading in after the lap is drawn. */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: annDelay }}>
        {geo.drs.map((z, i) => (
          <g key={i} transform={`translate(${z.mid[0].toFixed(1)} ${z.mid[1].toFixed(1)})`}>
            <rect x={-4.6} y={-2.2} width={9.2} height={4.4} rx={2.2} fill="#0c1a12" stroke={DRS_COLOR} strokeWidth={0.4} />
            <text x={0} y={1.4} textAnchor="middle" fontSize={3} fontWeight={700} fontFamily="var(--font-data)" fill={DRS_COLOR}>
              DRS
            </text>
          </g>
        ))}
        {shape.turns.map((t) => (
          <g key={t.n} transform={`translate(${t.x} ${t.y})`}>
            <circle r={2.9} fill="var(--bg-void)" stroke="var(--line-bright)" strokeWidth={0.4} />
            <text x={0} y={1.15} textAnchor="middle" fontSize={3.1} fontWeight={700} fontFamily="var(--font-data)" fill="var(--text-primary)">
              {t.n}
            </text>
          </g>
        ))}
        <g transform={`translate(${geo.start[0]} ${geo.start[1]}) rotate(${geo.startAng})`}>
          <rect x={-1.15} y={-3.4} width={2.3} height={6.8} rx={0.3} fill={`url(#${gid}-check)`} stroke="#0c0c12" strokeWidth={0.4} />
        </g>
      </motion.g>
    </svg>
  );
}
