import { memo } from 'react';

/**
 * The page behind the theatre: layered warm gradients, faint kawung batik,
 * grain and vignette (in CSS), plus original Javanese-style cloud ornaments
 * (in the spirit of mega mendung) framing the corners.
 *
 * Each cloud is one flowing outline. Its concentric bands are drawn as
 * progressively narrower strokes of the same outline, clipped to the inside,
 * so every band follows the shape; spiral curls roll in at its ends.
 */

interface Spiral {
  x: number;
  y: number;
  r: number;
  dir: 1 | -1;
  turns: number;
  start: number;
}

interface CloudSpec {
  id: string;
  outline: string;
  spirals: Spiral[];
}

const CLOUDS: CloudSpec[] = [
  {
    id: 'cloud-long',
    outline:
      'M40 150 C20 150 10 130 22 114 C30 102 50 100 58 110 C60 86 80 72 104 76 C116 50 150 38 178 50 C196 34 232 34 248 56 C270 50 296 62 300 84 C322 82 346 96 350 118 C372 120 386 138 376 152 C368 164 348 164 340 154 C300 166 250 158 210 162 C160 168 110 160 80 160 C64 164 48 160 40 150 Z',
    spirals: [
      { x: 42, y: 130, r: 17, dir: 1, turns: 1.7, start: 3.4 },
      { x: 358, y: 138, r: 15, dir: -1, turns: 1.6, start: 0.2 },
      { x: 186, y: 98, r: 26, dir: 1, turns: 1.9, start: 4.2 },
    ],
  },
  {
    id: 'cloud-round',
    outline:
      'M60 150 C36 150 26 124 44 108 C50 80 80 62 108 70 C124 44 166 40 186 62 C212 58 236 78 232 104 C252 112 256 140 236 150 C220 160 200 154 192 148 C160 160 110 158 84 152 C76 158 66 156 60 150 Z',
    spirals: [
      { x: 60, y: 130, r: 16, dir: 1, turns: 1.7, start: 3.2 },
      { x: 224, y: 130, r: 15, dir: -1, turns: 1.6, start: 0 },
      { x: 140, y: 102, r: 24, dir: -1, turns: 1.8, start: 1 },
    ],
  },
  {
    id: 'cloud-curl',
    outline: 'M40 90 C18 90 10 64 28 50 C40 32 72 30 86 48 C104 44 122 56 118 76 C116 92 98 98 88 90 C76 98 56 98 40 90 Z',
    spirals: [
      { x: 56, y: 66, r: 17, dir: 1, turns: 1.8, start: 3.6 },
      { x: 102, y: 74, r: 10, dir: -1, turns: 1.4, start: 0.4 },
    ],
  },
];

/** Concentric bands from the edge inward: [half stroke width, colour], widest first. */
const BANDS: readonly (readonly [number, string])[] = [
  [17.5, '#9a6a36'],
  [16, '#5c2c14'],
  [7, '#b07a40'],
  [5.5, '#4e2410'],
];
const INNER_FILL = '#6a351a';
const CONTOUR = '#140803';

function spiralPath({ x, y, r, dir, turns, start }: Spiral): string {
  const steps = 60;
  const inner = r * 0.08;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = start + dir * t * turns * Math.PI * 2;
    const radius = inner + (r - inner) * t;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(angle) * radius).toFixed(1)} ${(y + Math.sin(angle) * radius).toFixed(1)}`;
  }
  return d;
}

function CloudShape({ spec }: { spec: CloudSpec }) {
  const clip = `${spec.id}-clip`;
  return (
    <g id={spec.id}>
      <clipPath id={clip}>
        <path d={spec.outline} />
      </clipPath>
      <path d={spec.outline} fill={INNER_FILL} />
      <g clipPath={`url(#${clip})`} fill="none" strokeLinejoin="round">
        {BANDS.map(([half, color]) => (
          <path key={half} d={spec.outline} stroke={color} strokeWidth={half * 2} />
        ))}
      </g>
      <path d={spec.outline} fill="none" stroke={CONTOUR} strokeWidth={6} strokeLinejoin="round" />
      <g fill="none" strokeLinecap="round">
        {spec.spirals.map((spiral) => {
          const d = spiralPath(spiral);
          return (
            <g key={`${spiral.x}-${spiral.y}`}>
              <path d={d} stroke={CONTOUR} strokeWidth={4} />
              <path d={d} stroke="#c08848" strokeWidth={1.4} />
            </g>
          );
        })}
      </g>
    </g>
  );
}

interface Placement {
  href: string;
  transform: string;
  opacity: number;
}

/** Each corner composition lives in a 620 × 440 box. */
const CORNERS: { key: string; clouds: Placement[] }[] = [
  {
    key: 'tl',
    clouds: [
      { href: '#cloud-round', transform: 'translate(330 120) scale(0.62)', opacity: 0.5 },
      { href: '#cloud-curl', transform: 'translate(70 225) scale(0.95)', opacity: 0.45 },
      { href: '#cloud-long', transform: 'translate(-40 -10) scale(1.2)', opacity: 1 },
    ],
  },
  {
    key: 'tr',
    clouds: [
      { href: '#cloud-curl', transform: 'translate(80 235) scale(1)', opacity: 0.5 },
      { href: '#cloud-round', transform: 'translate(150 -20) scale(1.45)', opacity: 1 },
    ],
  },
  {
    key: 'bl',
    clouds: [
      { href: '#cloud-curl', transform: 'translate(70 90) scale(1)', opacity: 0.5 },
      { href: '#cloud-long', transform: 'translate(170 175) scale(1.05)', opacity: 0.85 },
      { href: '#cloud-round', transform: 'translate(-60 120) scale(1.55)', opacity: 1 },
    ],
  },
  {
    key: 'br',
    clouds: [
      { href: '#cloud-round', transform: 'translate(300 80) scale(0.85)', opacity: 0.7 },
      { href: '#cloud-long', transform: 'translate(-40 150) scale(1.4)', opacity: 1 },
    ],
  },
];

const CURLS = ['l', 'r'] as const;

export const Backdrop = memo(function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__glow" />
      <div className="backdrop__pattern" />
      <svg className="backdrop__defs" width="0" height="0">
        <defs>
          {CLOUDS.map((spec) => (
            <CloudShape key={spec.id} spec={spec} />
          ))}
        </defs>
      </svg>
      {CORNERS.map((corner) => (
        <svg key={corner.key} className={`clouds clouds--${corner.key}`} viewBox="0 0 620 440">
          {corner.clouds.map((cloud, i) => (
            <use key={i} href={cloud.href} transform={cloud.transform} opacity={cloud.opacity} />
          ))}
        </svg>
      ))}
      {CURLS.map((key) => (
        <svg key={key} className={`clouds clouds--curl clouds--curl-${key}`} viewBox="0 0 130 110">
          <use href="#cloud-curl" />
        </svg>
      ))}
      <div className="backdrop__grain" />
      <div className="backdrop__vignette" />
    </div>
  );
});
