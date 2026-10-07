import { memo } from 'react';

/**
 * The page behind the theatre: layered warm gradients, faint kawung batik,
 * grain and vignette (in CSS), plus original mega-mendung-style cloud
 * ornaments in the corners, generated here as SVG.
 *
 * Each cloud is a union of circular lobes drawn several times at shrinking
 * radii, which produces the concentric outline bands of Javanese cloud motifs;
 * spiral curls are traced on top.
 */

interface Lobe {
  x: number;
  y: number;
  r: number;
}

interface Curl extends Lobe {
  dir: 1 | -1;
  turns: number;
  start: number;
}

interface CloudSpec {
  lobes: Lobe[];
  curls: Curl[];
}

const LONG_CLOUD: CloudSpec = {
  lobes: [
    { x: 70, y: 150, r: 46 },
    { x: 135, y: 112, r: 56 },
    { x: 210, y: 92, r: 64 },
    { x: 290, y: 108, r: 54 },
    { x: 352, y: 140, r: 42 },
    { x: 120, y: 168, r: 36 },
    { x: 200, y: 162, r: 44 },
    { x: 282, y: 164, r: 38 },
  ],
  curls: [
    { x: 135, y: 114, r: 34, dir: -1, turns: 1.7, start: 0.5 },
    { x: 210, y: 96, r: 41, dir: 1, turns: 1.9, start: 2.6 },
    { x: 290, y: 110, r: 32, dir: 1, turns: 1.6, start: 0 },
    { x: 70, y: 152, r: 26, dir: -1, turns: 1.45, start: 1.2 },
    { x: 352, y: 142, r: 22, dir: 1, turns: 1.4, start: 3 },
  ],
};

const ROUND_CLOUD: CloudSpec = {
  lobes: [
    { x: 80, y: 110, r: 50 },
    { x: 150, y: 86, r: 58 },
    { x: 212, y: 118, r: 42 },
    { x: 132, y: 138, r: 40 },
  ],
  curls: [
    { x: 150, y: 90, r: 39, dir: 1, turns: 2, start: 0.3 },
    { x: 80, y: 112, r: 31, dir: -1, turns: 1.6, start: 2 },
    { x: 212, y: 120, r: 25, dir: 1, turns: 1.5, start: 1 },
  ],
};

/** Outer gold hairline, then alternating dark bands and gold lines toward the centre. */
const BANDS = [
  { grow: 7, fill: '#8d602f' },
  { grow: 5, fill: '#1d0c05' },
  { grow: -5, fill: '#7d5329' },
  { grow: -7, fill: '#271207' },
  { grow: -16, fill: '#6c4522' },
  { grow: -18, fill: '#33190b' },
];

function spiralPath({ x, y, r, dir, turns, start }: Curl): string {
  const steps = 56;
  const inner = r * 0.1;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = start + dir * t * turns * Math.PI * 2;
    const radius = inner + (r - inner) * t;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(angle) * radius).toFixed(1)} ${(y + Math.sin(angle) * radius).toFixed(1)}`;
  }
  return d;
}

function CloudShape({ id, spec }: { id: string; spec: CloudSpec }) {
  return (
    <g id={id}>
      {BANDS.map((band) => (
        <g key={band.grow} fill={band.fill}>
          {spec.lobes.map((lobe) =>
            lobe.r + band.grow > 0 ? <circle key={`${lobe.x}-${lobe.y}`} cx={lobe.x} cy={lobe.y} r={lobe.r + band.grow} /> : null,
          )}
        </g>
      ))}
      <g fill="none" stroke="#a0713a" strokeWidth={2.2} strokeLinecap="round" opacity={0.85}>
        {spec.curls.map((curl) => (
          <path key={`${curl.x}-${curl.y}`} d={spiralPath(curl)} />
        ))}
      </g>
    </g>
  );
}

const CORNERS = [
  {
    key: 'tl',
    clouds: [
      { href: '#cloud-long', transform: 'translate(-80 -70) scale(1.3)', opacity: 1 },
      { href: '#cloud-round', transform: 'translate(320 0) scale(0.78)', opacity: 0.5 },
      { href: '#cloud-long', transform: 'translate(0 205) scale(0.6)', opacity: 0.38 },
    ],
  },
  {
    key: 'tr',
    clouds: [
      { href: '#cloud-round', transform: 'translate(-40 -60) scale(1.45)', opacity: 1 },
      { href: '#cloud-long', transform: 'translate(250 150) scale(0.7)', opacity: 0.45 },
    ],
  },
  {
    key: 'bl',
    clouds: [
      { href: '#cloud-round', transform: 'translate(-60 170) scale(1.35)', opacity: 1 },
      { href: '#cloud-long', transform: 'translate(200 260) scale(0.85)', opacity: 0.55 },
      { href: '#cloud-round', transform: 'translate(40 40) scale(0.55)', opacity: 0.32 },
    ],
  },
  {
    key: 'br',
    clouds: [
      { href: '#cloud-long', transform: 'translate(-30 200) scale(1.25)', opacity: 1 },
      { href: '#cloud-round', transform: 'translate(300 90) scale(0.7)', opacity: 0.42 },
    ],
  },
] as const;

export const Backdrop = memo(function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__glow" />
      <div className="backdrop__pattern" />
      <svg className="backdrop__defs" width="0" height="0">
        <defs>
          <CloudShape id="cloud-long" spec={LONG_CLOUD} />
          <CloudShape id="cloud-round" spec={ROUND_CLOUD} />
        </defs>
      </svg>
      {CORNERS.map((corner) => (
        <svg key={corner.key} className={`clouds clouds--${corner.key}`} viewBox="0 0 620 440">
          {corner.clouds.map((cloud, i) => (
            <use key={i} href={cloud.href} transform={cloud.transform} opacity={cloud.opacity} />
          ))}
        </svg>
      ))}
      <div className="backdrop__grain" />
      <div className="backdrop__vignette" />
    </div>
  );
});
