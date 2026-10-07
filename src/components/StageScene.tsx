import { useImperativeHandle, useRef, type Ref } from 'react';
import { STAGE } from '../lib/puppetGeometry';
import type { PuppetRig, Side } from '../types';
import { Puppet, type PuppetHandle } from './Puppet';

export interface StageSceneHandle {
  applyRig(side: Side, rig: PuppetRig, flicker: number): void;
}

const GOLD = '#c99545';
const GOLD_LIGHT = '#e3b85e';
const CLOTH_DARK = '#2a0b07';

/** Repeating ornaments for the top valance and the foreground rail. */
function OrnamentDefs() {
  return (
    <defs>
      <linearGradient id="orn-cloth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#521913" />
        <stop offset="1" stopColor="#2c0b07" />
      </linearGradient>
      <linearGradient id="orn-rail" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a1510" />
        <stop offset="0.55" stopColor="#300c08" />
        <stop offset="1" stopColor="#1c0705" />
      </linearGradient>
      <linearGradient id="orn-valance-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4a2410" stopOpacity="0.32" />
        <stop offset="1" stopColor="#4a2410" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="orn-ground-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5a3214" stopOpacity="0" />
        <stop offset="1" stopColor="#5a3214" stopOpacity="0.22" />
      </linearGradient>
      <linearGradient id="orn-tassel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1a0705" />
        <stop offset="0.45" stopColor="#5b1a12" />
        <stop offset="1" stopColor="#1a0705" />
      </linearGradient>
      <radialGradient id="orn-bead" cx="0.35" cy="0.35" r="0.7">
        <stop offset="0" stopColor="#f6dc95" />
        <stop offset="1" stopColor="#9c6a2a" />
      </radialGradient>

      {/* Lung-lungan: a running vine scroll with leaves and a kawung flower */}
      <pattern id="orn-vine" width="60" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 15 C7.5 4 22.5 4 30 15 S52.5 26 60 15" fill="none" stroke={GOLD} strokeWidth="1.3" />
        <path d="M14 10.5 C17 5 23 4 27 6 C24 10 18 12 14 10.5 Z" fill={GOLD} opacity="0.9" />
        <path d="M46 19.5 C43 25 37 26 33 24 C36 20 42 18 46 19.5 Z" fill={GOLD} opacity="0.9" />
        <path d="M8 9 C9 5 13 4 14.5 6.5 C15.5 8.5 13 10 12 8.5" fill="none" stroke={GOLD} strokeWidth="0.9" />
        <path d="M52 21 C51 25 47 26 45.5 23.5 C44.5 21.5 47 20 48 21.5" fill="none" stroke={GOLD} strokeWidth="0.9" />
        <g transform="translate(30 15)" fill={GOLD_LIGHT}>
          <ellipse rx="1.7" ry="3.4" transform="rotate(45) translate(0 -3.6)" />
          <ellipse rx="1.7" ry="3.4" transform="rotate(135) translate(0 -3.6)" />
          <ellipse rx="1.7" ry="3.4" transform="rotate(225) translate(0 -3.6)" />
          <ellipse rx="1.7" ry="3.4" transform="rotate(315) translate(0 -3.6)" />
          <circle r="1.3" fill="#b8452f" />
        </g>
        <circle cx="0" cy="15" r="1.7" fill="#b8452f" />
        <circle cx="60" cy="15" r="1.7" fill="#b8452f" />
      </pattern>

      {/* Hanging scalloped fringe under the valance */}
      <pattern id="orn-fringe" width="30" height="20" patternUnits="userSpaceOnUse">
        <path d="M0 0 H30 V2 C24 2 19 7 15 17 C11 7 6 2 0 2 Z" fill={CLOTH_DARK} stroke={GOLD} strokeWidth="1" />
        <circle cx="15" cy="7" r="1.5" fill={GOLD_LIGHT} />
      </pattern>

      {/* Tumpal: a row of triangles, the classic Indonesian border motif */}
      <pattern id="orn-tumpal" width="34" height="24" patternUnits="userSpaceOnUse">
        <path d="M0 23 L17 2 L34 23 Z" fill="#6e1b14" stroke={GOLD} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M8 21 L17 9.5 L26 21" fill="none" stroke={GOLD} strokeWidth="0.8" opacity="0.7" />
        <circle cx="17" cy="16" r="1.6" fill={GOLD_LIGHT} />
      </pattern>
    </defs>
  );
}

function Valance() {
  return (
    <g>
      <rect x="0" y="58" width="1000" height="46" fill="url(#orn-valance-shade)" />
      <rect x="0" y="0" width="1000" height="46" fill="url(#orn-cloth)" />
      <rect x="0" y="0" width="1000" height="6" fill="#1b0805" />
      <rect x="0" y="10" width="1000" height="30" fill="url(#orn-vine)" />
      <path d="M0 7 H1000 M0 42 H1000" stroke={GOLD} strokeWidth="1.3" />
      <rect x="0" y="44" width="1000" height="20" fill="url(#orn-fringe)" />
    </g>
  );
}

/** The hanging tassel at the top centre; sways almost imperceptibly (see .scene__tassel). */
function Tassel() {
  return (
    <g className="scene__tassel">
      <path d="M500 46 V80" stroke="#2a0f08" strokeWidth="2" />
      <circle cx="500" cy="82" r="5" fill="url(#orn-bead)" stroke="#3a1a0a" strokeWidth="0.8" />
      <ellipse cx="500" cy="93" rx="4.6" ry="6.4" fill="#8e2a22" stroke={GOLD} strokeWidth="0.8" />
      <path d="M496 90 Q500 94 504 90 M496 96 Q500 100 504 96" fill="none" stroke={GOLD_LIGHT} strokeWidth="0.7" opacity="0.7" />
      <circle cx="500" cy="102.5" r="3" fill="url(#orn-bead)" />
      <path d="M494.5 105 H505.5 L508 113 H492 Z" fill="url(#orn-bead)" stroke="#3a1a0a" strokeWidth="0.6" />
      <path d="M492 113 C490 132 489.5 150 491 168 L509 168 C510.5 150 510 132 508 113 Z" fill="url(#orn-tassel)" />
      <path
        d="M494 116 L493.5 166 M497 116 L496.8 167 M500 116 V167 M503 116 L503.2 167 M506 116 L506.5 166"
        stroke={GOLD_LIGHT}
        strokeWidth="0.6"
        opacity="0.28"
      />
      <path d="M492 119 H508" stroke={GOLD} strokeWidth="1.4" />
    </g>
  );
}

function Rail() {
  const top = STAGE.railTop;
  return (
    <g>
      <rect x="0" y={top - 42} width="1000" height="42" fill="url(#orn-ground-shade)" />
      <rect x="0" y={top} width="1000" height={STAGE.height - top} fill="url(#orn-rail)" />
      <rect x="0" y={top - 2} width="1000" height="4" fill={GOLD} />
      <rect x="0" y={top + 2} width="1000" height="1.5" fill="#1b0805" />
      <rect x="0" y={top + 4} width="1000" height="24" fill="url(#orn-tumpal)" />
      <path d={`M0 ${top + 29} H1000 M0 ${top + 62} H1000`} stroke={GOLD} strokeWidth="1.2" />
      <rect x="0" y={top + 32} width="1000" height="30" fill="url(#orn-vine)" opacity="0.85" />
      <rect x="0" y={top + 64} width="1000" height={STAGE.height - top - 64} fill="#170604" />
    </g>
  );
}

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

  useImperativeHandle(
    ref,
    () => ({
      applyRig(side, rig, flicker) {
        figures.current[side]?.apply(rig);
        silhouettes.current[side]?.apply(rig);

        // Light comes from the blencong lamp at the top centre: the shadow falls
        // away from it, grows and softens as the puppet is drawn toward the lamp.
        const { lamp } = STAGE;
        const grow = 1.025 + rig.depth * 0.05;
        const dx = 14 + (rig.x - lamp.x) * 0.022 + flicker * 0.6;
        const dy = 17 + rig.depth * 12 + flicker * 0.4;
        const tx = dx + lamp.x * (1 - grow);
        const ty = dy + lamp.y * (1 - grow);
        const group = shadowGroups.current[side];
        if (group) {
          group.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${grow.toFixed(4)})`);
          group.setAttribute('opacity', (0.42 - rig.depth * 0.1).toFixed(3));
        }
        const blur = Math.round((6 + rig.depth * 7) * 2) / 2;
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

      <g fill="#2e1409">
        {sides.map((side) => (
          <g key={side} ref={(el) => void (shadowGroups.current[side] = el)} filter={`url(#shadow-blur-${side})`} opacity="0.32">
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
