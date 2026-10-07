import { useImperativeHandle, useRef, type Ref } from 'react';
import { STAGE } from '../lib/puppetGeometry';
import { RIG_KEYS } from '../lib/puppetMapping';
import type { PuppetRig, Side } from '../types';
import { Puppet, type PuppetHandle } from './Puppet';

export interface StageSceneHandle {
  applyRig(side: Side, rig: PuppetRig, flicker: number, dt: number): void;
}

const GOLD = '#b4813c';
const GOLD_LIGHT = '#d4a65a';
const RED = '#6e2519';
const DARK = '#24100a';

/** The valance band at the top of the screen, and the hanging fringe under it. */
const VALANCE_BAND = 40;
const VALANCE_BOTTOM = 52;
/** How quickly a shadow catches up with its puppet (1/s); it trails by a few frames. */
const SHADOW_FOLLOW = 24;

/** Repeating ornaments for the top valance and the foreground rail. */
function OrnamentDefs() {
  return (
    <defs>
      <linearGradient id="orn-cloth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3b1a0e" />
        <stop offset="1" stopColor="#25100a" />
      </linearGradient>
      <linearGradient id="orn-rail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a180d" />
        <stop offset="1" stopColor="#1e0c06" />
      </linearGradient>
      <linearGradient id="orn-valance-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a2410" stopOpacity="0.28" />
        <stop offset="1" stopColor="#4a2410" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="orn-ground-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a3214" stopOpacity="0" />
        <stop offset="1" stopColor="#5a3214" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id="orn-tassel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0f0603" />
        <stop offset="0.45" stopColor="#2c170d" />
        <stop offset="1" stopColor="#0f0603" />
      </linearGradient>

      {/* Lung-lungan: a running vine with deep-red four-petal flowers and leaves */}
      <pattern id="orn-floral" width="56" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 15 C9 5 19 5 28 15 S47 25 56 15" fill="none" stroke={GOLD} strokeWidth="1.1" />
        <path d="M11 10 C14 4.5 20 3.5 24 5.5 C21 9.5 15 11.5 11 10 Z" fill={RED} stroke={GOLD} strokeWidth="0.7" />
        <path d="M13 9.4 C16 7.4 19 6.4 22 6.2" fill="none" stroke={GOLD_LIGHT} strokeWidth="0.5" />
        <path d="M45 20 C42 25.5 36 26.5 32 24.5 C35 20.5 41 18.5 45 20 Z" fill={RED} stroke={GOLD} strokeWidth="0.7" />
        <path d="M43 20.6 C40 22.6 37 23.6 34 23.8" fill="none" stroke={GOLD_LIGHT} strokeWidth="0.5" />
        <path d="M5 9 C6 5 10 4 11.5 6.5 C12.5 8.5 10 10 9 8.5" fill="none" stroke={GOLD} strokeWidth="0.8" />
        <path d="M51 21 C50 25 46 26 44.5 23.5 C43.5 21.5 46 20 47 21.5" fill="none" stroke={GOLD} strokeWidth="0.8" />
        <g transform="translate(28 15)" fill={RED} stroke={GOLD} strokeWidth="0.7">
          <ellipse rx="2.3" ry="4" transform="rotate(45) translate(0 -4.4)" />
          <ellipse rx="2.3" ry="4" transform="rotate(135) translate(0 -4.4)" />
          <ellipse rx="2.3" ry="4" transform="rotate(225) translate(0 -4.4)" />
          <ellipse rx="2.3" ry="4" transform="rotate(315) translate(0 -4.4)" />
          <circle r="1.6" fill={GOLD_LIGHT} stroke="none" />
        </g>
        <circle cx="0" cy="15" r="1.4" fill={GOLD} />
        <circle cx="56" cy="15" r="1.4" fill={GOLD} />
      </pattern>

      {/* Hanging scalloped fringe under the valance */}
      <pattern id="orn-fringe" width="18" height="12" patternUnits="userSpaceOnUse">
        <path d="M0 0 H18 V1.5 C14 1.5 11 5 9 11 C7 5 4 1.5 0 1.5 Z" fill={DARK} stroke={GOLD} strokeWidth="0.8" />
        <circle cx="9" cy="4.6" r="1" fill={GOLD_LIGHT} />
      </pattern>

      {/* Tumpal: a row of triangles, the classic Indonesian border motif */}
      <pattern id="orn-tumpal" width="26" height="18" patternUnits="userSpaceOnUse">
        <path d="M0 17.5 L13 1.5 L26 17.5 Z" fill={RED} stroke={GOLD} strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M6.5 16 L13 8 L19.5 16" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.7" />
        <circle cx="13" cy="12.5" r="1.2" fill={GOLD_LIGHT} />
      </pattern>
    </defs>
  );
}

function Valance() {
  return (
    <g>
      <rect x="0" y={VALANCE_BOTTOM - 4} width="1000" height="36" fill="url(#orn-valance-shade)" />
      <rect x="0" y="0" width="1000" height={VALANCE_BAND} fill="url(#orn-cloth)" />
      <rect x="0" y="0" width="1000" height="3" fill="#140804" />
      <g transform="translate(0 6)">
        <rect width="1000" height="30" fill="url(#orn-floral)" opacity="0.92" />
      </g>
      <path d="M0 4.5 H1000 M0 37.5 H1000" stroke={GOLD} strokeWidth="1" />
      <g transform={`translate(0 ${VALANCE_BAND})`}>
        <rect width="1000" height={VALANCE_BOTTOM - VALANCE_BAND} fill="url(#orn-fringe)" />
      </g>
    </g>
  );
}

/** The hanging tassel at the top centre; sways almost imperceptibly (see .scene__tassel). */
function Tassel() {
  return (
    <g className="scene__tassel">
      <path d="M500 46 V62" stroke="#1a0d08" strokeWidth="1.6" />
      <circle cx="500" cy="63.5" r="2.8" fill={GOLD} stroke="#1a0d08" strokeWidth="0.6" />
      <ellipse cx="500" cy="71" rx="3.6" ry="5" fill="#1f0f09" stroke="#6b4a2a" strokeWidth="0.6" />
      <path d="M496.6 68.5 Q500 71 503.4 68.5 M496.6 73 Q500 75.5 503.4 73" fill="none" stroke={GOLD} strokeWidth="0.5" opacity="0.6" />
      <path d="M495.5 76 H504.5 L506 81 H494 Z" fill="#2a160d" stroke="#8a6230" strokeWidth="0.6" />
      <path d="M494 81 C492.5 96 492 110 493.5 124 L506.5 124 C508 110 507.5 96 506 81 Z" fill="url(#orn-tassel)" />
      <path
        d="M496 84 L495.6 123 M498.6 84 L498.4 123.5 M501.4 84 L501.6 123.5 M504 84 L504.4 123"
        stroke="#b88a4c"
        strokeWidth="0.5"
        opacity="0.2"
      />
      <path d="M494 86 H506" stroke={GOLD} strokeWidth="0.9" opacity="0.8" />
    </g>
  );
}

/** The foreground rail: it hides the lower legs and the rods' ends, like the banana-trunk stand. */
function Rail() {
  const top = STAGE.railTop;
  return (
    <g>
      <rect x="0" y={top - 40} width="1000" height="40" fill="url(#orn-ground-shade)" />
      <rect x="0" y={top} width="1000" height={STAGE.height - top} fill="url(#orn-rail)" />
      <rect x="0" y={top - 1.5} width="1000" height="3" fill={GOLD} />
      <g transform={`translate(0 ${top + 2})`}>
        <rect width="1000" height="18" fill="url(#orn-tumpal)" />
      </g>
      <path d={`M0 ${top + 21.5} H1000 M0 ${top + 53.5} H1000`} stroke={GOLD} strokeWidth="1" />
      <g transform={`translate(0 ${top + 23})`}>
        <rect width="1000" height="30" fill="url(#orn-floral)" opacity="0.85" />
      </g>
      <rect x="0" y={top + 55} width="1000" height={STAGE.height - top - 55} fill="#140603" />
    </g>
  );
}

const copyRig = (rig: PuppetRig): PuppetRig => ({ ...rig });

/**
 * The lit screen's contents in a fixed 1000 × 860 coordinate space:
 * cast shadows, both puppets, the carved valance, tassel and front rail.
 */
export function StageScene({ ref }: { ref?: Ref<StageSceneHandle> }) {
  const figures = useRef<Partial<Record<Side, PuppetHandle | null>>>({});
  const silhouettes = useRef<Partial<Record<Side, PuppetHandle | null>>>({});
  const shadowGroups = useRef<Partial<Record<Side, SVGGElement | null>>>({});
  const blurs = useRef<Partial<Record<Side, SVGFEGaussianBlurElement | null>>>({});
  const lastBlur = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const trailing = useRef<Partial<Record<Side, PuppetRig>>>({});

  useImperativeHandle(
    ref,
    () => ({
      applyRig(side, rig, flicker, dt) {
        figures.current[side]?.apply(rig);

        // The shadow follows its puppet with a few frames of lag, which reads as depth.
        let shadow = trailing.current[side];
        if (!shadow) shadow = trailing.current[side] = copyRig(rig);
        const follow = 1 - Math.exp(-SHADOW_FOLLOW * dt);
        for (const key of RIG_KEYS) shadow[key] += (rig[key] - shadow[key]) * follow;
        silhouettes.current[side]?.apply(shadow);

        // Light comes from the blencong lamp at the top centre: the shadow falls
        // away from it, grows and softens as the puppet is drawn toward the lamp.
        const { lamp } = STAGE;
        const grow = 1.02 + shadow.depth * 0.04;
        const dx = 13 + (shadow.x - lamp.x) * 0.012 + flicker * 0.5;
        const dy = 12 + shadow.depth * 8 + flicker * 0.3;
        const tx = dx + lamp.x * (1 - grow);
        const ty = dy + lamp.y * (1 - grow);
        const group = shadowGroups.current[side];
        if (group) {
          group.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${grow.toFixed(4)})`);
          group.setAttribute('opacity', (0.4 - shadow.depth * 0.1).toFixed(3));
        }
        const blur = Math.round((6 + shadow.depth * 6) * 2) / 2;
        if (blur !== lastBlur.current[side]) {
          lastBlur.current[side] = blur;
          blurs.current[side]?.setAttribute('stdDeviation', String(blur));
        }
      },
    }),
    [],
  );

  const sides: Side[] = ['left', 'right'];
  return (
    <svg className="scene" viewBox={`0 0 ${STAGE.width} ${STAGE.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <OrnamentDefs />
      <defs>
        {sides.map((side) => (
          <filter key={side} id={`shadow-blur-${side}`} x="-30%" y="-20%" width="160%" height="140%">
            <feGaussianBlur ref={(el) => void (blurs.current[side] = el)} stdDeviation="7" />
          </filter>
        ))}
      </defs>

      <g fill="#2b1309">
        {sides.map((side) => (
          <g key={side} ref={(el) => void (shadowGroups.current[side] = el)} filter={`url(#shadow-blur-${side})`} opacity="0.36">
            <Puppet side={side} silhouette ref={(handle) => void (silhouettes.current[side] = handle)} />
          </g>
        ))}
      </g>

      {sides.map((side) => (
        <Puppet key={side} side={side} ref={(handle) => void (figures.current[side] = handle)} />
      ))}

      <Rail />
      <Valance />
      <Tassel />
    </svg>
  );
}
