import type { PuppetPalette } from './palettes';

/**
 * Original Wayang Kulit–inspired puppet artwork, drawn facing right with the
 * feet on y = 0 (see lib/puppetGeometry.ts for the rig dimensions).
 *
 * Proportions follow the wayang purwa convention: a small profile head pushed
 * forward on a long slanting neck, a frontal chest with broad shoulders and a
 * narrow waist, a dodot whose back flap sweeps into a point, and very long
 * arms that reach the knees.
 *
 * Every part renders in two modes: full colour, or `sil` (silhouette) where
 * only the outline shapes are emitted with no fill so they inherit the shadow
 * colour. The silhouette copy is what casts the puppet's shadow on the screen.
 *
 * Fine cream dots imitate tatahan, the punched perforations of leather
 * puppets; stacked strokes imitate sunggingan, the graded colour bands.
 */

export const INK = '#2a1108';
const HOLE = '#f8e9c0';

export interface ArtProps {
  /** Prefix for this puppet's gradient and pattern ids. */
  p: string;
  pal: PuppetPalette;
  sil: boolean;
}

interface ShapeProps {
  sil: boolean;
  d: string;
  fill: string;
  strokeWidth?: number;
}

function Shape({ sil, d, fill, strokeWidth = 1.2 }: ShapeProps) {
  if (sil) return <path d={d} />;
  return <path d={d} fill={fill} stroke={INK} strokeWidth={strokeWidth} strokeLinejoin="round" />;
}

function Dots({ d, color = HOLE, size = 1.6, gap = 4.4 }: { d: string; color?: string; size?: number; gap?: number }) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={size} strokeLinecap="round" strokeDasharray={`0.01 ${gap}`} />
  );
}

function Line({ d, color = INK, width = 0.9, opacity }: { d: string; color?: string; width?: number; opacity?: number }) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity} />
  );
}

const drop = (x: number, y: number, size = 1) =>
  `M${x} ${y} c${-2 * size} ${3 * size} ${-2 * size} ${6 * size} 0 ${8 * size} c${2 * size} ${-2 * size} ${2 * size} ${-5 * size} 0 ${-8 * size}z`;

/* ------------------------------------------------------------------------ */
/* Paint definitions                                                         */
/* ------------------------------------------------------------------------ */

export function PuppetDefs({ p, pal }: { p: string; pal: PuppetPalette }) {
  const wave = 'M0 8 C2.5 2 5.5 2 8 8 S13.5 14 16 8';
  return (
    <defs>
      <linearGradient id={`${p}-gold`} x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0" stopColor={pal.gold[0]} />
        <stop offset="0.42" stopColor={pal.gold[1]} />
        <stop offset="0.78" stopColor={pal.gold[2]} />
        <stop offset="1" stopColor={pal.gold[3]} />
      </linearGradient>
      <linearGradient id={`${p}-limb`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={pal.gold[2]} />
        <stop offset="0.42" stopColor={pal.gold[0]} />
        <stop offset="0.72" stopColor={pal.gold[1]} />
        <stop offset="1" stopColor={pal.gold[2]} />
      </linearGradient>
      <linearGradient id={`${p}-shade`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={pal.goldShade[1]} />
        <stop offset="0.45" stopColor={pal.goldShade[0]} />
        <stop offset="1" stopColor={pal.goldShade[1]} />
      </linearGradient>
      <linearGradient id={`${p}-face`} x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor={pal.face[0]} />
        <stop offset="1" stopColor={pal.face[1]} />
      </linearGradient>
      <linearGradient id={`${p}-accent`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={pal.accent.light} />
        <stop offset="0.6" stopColor={pal.accent.base} />
        <stop offset="1" stopColor={pal.accent.base} />
      </linearGradient>
      <linearGradient id={`${p}-rod`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0d0502" />
        <stop offset="0.4" stopColor="#4a2b18" />
        <stop offset="1" stopColor="#100603" />
      </linearGradient>
      {/* Parang batik: diagonal rows of S-shaped bands. */}
      <pattern id={`${p}-kain`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
        <rect width="16" height="16" fill={pal.kain.base} />
        <path d={wave} fill="none" stroke={pal.kain.motif} strokeWidth="2.8" />
        <path d={wave} fill="none" stroke={pal.kain.base} strokeWidth="0.9" />
        <circle cx="4" cy="13.4" r="1.05" fill={pal.kain.motif} />
        <circle cx="12" cy="2.6" r="1.05" fill={pal.kain.motif} />
      </pattern>
      {/* Cindhe: small lozenges for the trousers. */}
      <pattern id={`${p}-cindhe`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill={pal.trousers.base} />
        <path d="M3.5 1.4 L5.6 3.5 L3.5 5.6 L1.4 3.5 Z" fill={pal.trousers.motif} opacity="0.85" />
      </pattern>
      {/* Pleated wiron fold: fine stripes in the border colour. */}
      <pattern id={`${p}-wiron`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
        <rect width="5" height="5" fill={pal.kain.border} />
        <rect width="1.4" height="5" fill={pal.gold[1]} opacity="0.9" />
      </pattern>
    </defs>
  );
}

/* ------------------------------------------------------------------------ */
/* Body                                                                      */
/* ------------------------------------------------------------------------ */

export function PrabaArt({ p, pal, sil }: ArtProps) {
  return (
    <g>
      <Shape
        sil={sil}
        fill={`url(#${p}-gold)`}
        d="M-22 -306 C-42 -330 -68 -344 -96 -342 C-116 -340 -128 -324 -124 -306 C-120 -292 -106 -284 -92 -286 C-102 -296 -103 -308 -93 -314 C-81 -320 -64 -314 -52 -302 C-44 -294 -35 -288 -26 -286 Z"
      />
      {!sil && (
        <>
          <path
            d="M-32 -301 C-50 -320 -72 -332 -94 -330 C-108 -328 -116 -318 -114 -306 C-108 -313 -100 -318 -90 -319 C-74 -320 -56 -310 -42 -296 Z"
            fill={pal.kain.base}
            stroke={INK}
            strokeWidth={0.8}
          />
          <Dots d="M-28 -303 C-46 -325 -70 -337 -94 -337 C-110 -336 -120 -324 -119 -310" />
          {[
            [-62, -323],
            [-80, -327],
            [-98, -324],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={2.7} fill={pal.accent.light} stroke={pal.gold[0]} strokeWidth={0.9} />
          ))}
          <Line d="M-92 -286 C-101 -292 -101 -303 -92 -305 C-85 -306 -83 -298 -89 -296" color={pal.gold[0]} width={1.3} />
        </>
      )}
    </g>
  );
}

export function BodyArt({ p, pal, sil }: ArtProps) {
  const gold = `url(#${p}-gold)`;
  const limb = `url(#${p}-limb)`;
  const accent = `url(#${p}-accent)`;
  const hem = 'M-100 -116 C-86 -112 -64 -110 -40 -110 C-12 -110 30 -112 62 -116';
  return (
    <g>
      {/* Back sash, flowing behind the dodot */}
      <Shape
        sil={sil}
        fill={accent}
        d="M-24 -238 C-48 -230 -74 -212 -92 -194 C-104 -182 -112 -168 -118 -154 L-108 -157 L-112 -145 C-98 -162 -80 -184 -64 -200 C-52 -212 -38 -222 -22 -226 Z"
      />
      {!sil && <Line d="M-27 -233 C-52 -221 -82 -196 -106 -160" color={pal.gold[0]} width={1.1} opacity={0.8} />}

      {/* Shins and feet */}
      <Shape sil={sil} fill={limb} d="M-55 -84 C-59 -62 -59 -42 -56 -22 L-45 -22 C-43 -42 -40 -62 -37 -84 Z" />
      <Shape sil={sil} fill={limb} d="M61 -84 C63 -62 66 -42 66 -22 L78 -22 C80 -42 80 -64 80 -84 Z" />
      <Shape
        sil={sil}
        fill={gold}
        d="M-56 -24 C-63 -17 -67 -9 -66 -3 C-65 0 -61 0 -57 0 L-9 0 C-3 0 -1 -3 -5 -6 C-15 -10 -31 -15 -45 -24 Z"
      />
      <Shape
        sil={sil}
        fill={gold}
        d="M66 -24 C60 -17 57 -9 58 -3 C59 0 63 0 67 0 L119 0 C125 0 127 -3 123 -6 C113 -10 95 -15 78 -24 Z"
      />
      {!sil && (
        <>
          <Line d="M-41 -70 C-42 -56 -44 -44 -46 -32" opacity={0.4} width={0.7} />
          <Line d="M77 -72 C77 -58 76 -46 75 -34" opacity={0.4} width={0.7} />
          <Line d="M-15 -3.5 L-14 0 M-21 -5 L-20 0 M-27 -6.5 L-26 0" width={0.7} opacity={0.7} />
          <Line d="M107 -3.5 L108 0 M101 -5 L102 0 M95 -6.5 L96 0" width={0.7} opacity={0.7} />
          <Shape sil={false} fill={gold} strokeWidth={0.9} d="M-58 -32 C-53 -30 -48 -30 -44 -32 L-43.5 -22 C-48 -20 -53 -20 -57.5 -22 Z" />
          <Shape sil={false} fill={gold} strokeWidth={0.9} d="M64 -32 C69 -30 74 -30 79 -32 L79 -22 C74 -20 69 -20 64.5 -22 Z" />
          <Line d="M-57.6 -27 C-53 -25.5 -48 -25.5 -43.8 -27" color={pal.accent.base} width={1.8} />
          <Line d="M64.3 -27 C69 -25.5 74 -25.5 78.9 -27" color={pal.accent.base} width={1.8} />
        </>
      )}

      {/* Patterned trousers with gilded cuffs */}
      <Shape sil={sil} fill={`url(#${p}-cindhe)`} d="M-56 -118 L-24 -116 C-27 -104 -31 -92 -34 -80 L-58 -80 C-61 -93 -60 -106 -56 -118 Z" />
      <Shape sil={sil} fill={`url(#${p}-cindhe)`} d="M50 -120 L84 -118 C83 -104 82 -92 82 -80 L58 -80 C55 -94 53 -107 50 -120 Z" />
      {!sil && (
        <>
          <Shape sil={false} fill={gold} strokeWidth={0.9} d="M-59.5 -87 L-32.5 -87 L-33.5 -78 L-58.5 -78 Z" />
          <Shape sil={false} fill={gold} strokeWidth={0.9} d="M56.5 -87 L83.5 -87 L82.5 -78 L57.5 -78 Z" />
          <Dots d="M-56.5 -82.5 L-35 -82.5" size={1.4} gap={3.4} />
          <Dots d="M59.5 -82.5 L81 -82.5" size={1.4} gap={3.4} />
        </>
      )}

      {/* Dodot: the back flap sweeps out into a point, the front falls steeply */}
      <Shape
        sil={sil}
        fill={`url(#${p}-kain)`}
        d={`M-26 -230 C-42 -212 -64 -186 -86 -162 C-98 -148 -108 -134 -114 -118 L-100 -116 ${hem.replace('M-100 -116 ', '')} C70 -150 52 -200 24 -232 Z`}
      />
      {/* Wiron: the pleated front fold */}
      <Shape sil={sil} fill={`url(#${p}-wiron)`} d="M24 -232 C46 -202 62 -160 64 -116 L50 -114 C48 -156 36 -196 16 -230 Z" />
      {!sil && (
        <>
          <Line d="M-8 -226 C-18 -194 -32 -156 -46 -114" opacity={0.3} width={0.8} />
          <Line d="M6 -226 C10 -190 18 -152 26 -112" opacity={0.3} width={0.8} />
          <Line d={hem} color={pal.kain.border} width={5.5} />
          <Line d={hem} color={pal.gold[1]} width={1.4} />
          <Line d="M-26 -230 C-42 -212 -64 -186 -86 -162 C-98 -148 -108 -134 -114 -118" color={pal.kain.border} width={4.5} />
          <Line d="M-25 -231 C-41 -213 -63 -187 -85 -163 C-97 -149 -107 -135 -113 -119" color={pal.gold[1]} width={1.2} />
          <Dots d="M-24 -222 C-40 -204 -60 -180 -80 -158 C-90 -146 -98 -134 -104 -122" size={1.4} gap={4} />
          <Dots d="M-94 -113 C-70 -108 -30 -107 10 -108 C30 -109 44 -110 56 -112" size={1.3} gap={4.2} />
        </>
      )}

      {/* Neck and frontal V-shaped torso with broad shoulders */}
      <Shape sil={sil} fill={limb} d="M12 -305 C18 -318 26 -332 34 -344 L52 -336 C44 -326 36 -316 32 -305 Z" />
      <Shape
        sil={sil}
        fill={gold}
        d="M10 -306 C-8 -308 -28 -308 -44 -303 C-52 -300 -52 -290 -46 -280 C-38 -266 -30 -248 -24 -230 L20 -232 C27 -248 38 -264 48 -278 C54 -288 56 -298 50 -304 C42 -307 36 -307 30 -307 Z"
      />
      {!sil && (
        <>
          <Line d="M48 -284 C38 -275 26 -273 14 -277" opacity={0.45} width={0.8} />
          <Line d="M-40 -284 C-30 -276 -18 -274 -6 -277" opacity={0.3} width={0.8} />
          <Line d="M6 -276 C6 -264 5 -252 3 -240" opacity={0.25} width={0.8} />
          <Dots d="M-41 -280 C-34 -265 -28 -250 -24.5 -238" size={1.3} gap={4} />
          <Dots d="M44 -279 C36 -265 28 -251 22.5 -240" size={1.3} gap={4} />
          {/* Kalung necklace, ulur chain and pendants */}
          <Shape
            sil={false}
            fill={accent}
            strokeWidth={0.9}
            d="M-36 -304 C-14 -286 22 -282 50 -301 C49 -296 47 -292 44 -289 C22 -276 -12 -278 -32 -297 Z"
          />
          <Dots d="M-31 -299.5 C-10 -285 20 -282 45 -295" color={pal.gold[0]} size={2.2} gap={4} />
          {[
            [-18, -284],
            [-5, -280.5],
            [8, -279.5],
            [21, -280.5],
            [33, -284],
          ].map(([x, y]) => (
            <path key={x} d={drop(x, y, 0.8)} fill={gold} stroke={INK} strokeWidth={0.5} />
          ))}
          <Dots d="M8 -278 C7 -268 7 -258 8 -250" color={pal.gold[0]} size={1.9} gap={3.4} />
          <path d="M8 -251 L12.5 -244 L8 -237 L3.5 -244 Z" fill={gold} stroke={INK} strokeWidth={0.7} />
          <circle cx={8} cy={-244} r={1.6} fill={pal.jewel} />
        </>
      )}

      {/* Belt with buckle */}
      <Shape sil={sil} fill={accent} d="M-28 -246 C-10 -242 10 -244 28 -249 L26 -226 C9 -222 -10 -222 -27 -224 Z" />
      {!sil && (
        <>
          <Line d="M-27.6 -240.5 C-10 -237 10 -239 27.4 -243.5" color={pal.gold[0]} width={1.3} />
          <Line d="M-27.2 -229.5 C-10 -226.5 10 -227.5 26.4 -231.5" color={pal.gold[0]} width={1.3} />
          <Dots d="M-25 -235 C-10 -232 10 -233 24 -237" size={1.4} gap={3.8} />
          <ellipse cx={23} cy={-236} rx={4.6} ry={6.8} fill={gold} stroke={INK} strokeWidth={0.8} />
          <circle cx={23} cy={-236} r={2} fill={pal.jewel} />
        </>
      )}

      {/* Rapek front panel and uncal pendant */}
      <Shape sil={sil} fill={accent} d="M-2 -226 C3 -180 9 -120 13 -62 L20 -44 L27 -62 C31 -120 36 -180 31 -228 Z" />
      {!sil && (
        <>
          <Line d="M2 -222 C6 -180 11 -122 15.5 -66 L20 -54 L24.5 -66 C28 -122 32 -180 28 -224" color={pal.gold[0]} width={1.1} />
          <Dots d="M15 -220 C16.5 -170 18.5 -112 20 -64" size={1.4} gap={4.2} />
          <circle cx={20} cy={-42} r={2.4} fill={gold} stroke={INK} strokeWidth={0.6} />
          <Dots d="M4 -222 C3 -200 3 -172 4 -151" color={pal.gold[0]} size={2.4} gap={4} />
          <circle cx={4} cy={-144} r={4.6} fill={gold} stroke={INK} strokeWidth={0.8} />
          <circle cx={4} cy={-144} r={2} fill={pal.jewel} />
          <path d={drop(4, -139.5, 1.1)} fill={gold} stroke={INK} strokeWidth={0.6} />
        </>
      )}

      {/* Front sash */}
      <Shape
        sil={sil}
        fill={accent}
        d="M26 -242 C48 -238 66 -224 78 -206 C86 -194 90 -180 92 -166 L84 -172 L82 -158 C78 -178 68 -198 54 -212 C44 -222 34 -228 24 -230 Z"
      />
      {!sil && <Line d="M28 -238 C50 -232 68 -216 82 -194 C86 -186 89 -176 90 -170" color={pal.gold[0]} width={1.1} opacity={0.85} />}
    </g>
  );
}

/** The gapit: the split horn spine that clamps the puppet and becomes the dalang's handle. */
export function GapitArt({ p, sil }: { p: string; sil: boolean }) {
  const d = 'M-4 -318 C-4 -322 0 -322 0.2 -318 L14.5 380 L4.5 380 Z';
  if (sil) return <path d={d} />;
  return (
    <g>
      <path d={d} fill={`url(#${p}-rod)`} />
      <Line d="M-2 -314 L9.5 376" color="#6a442a" width={0.7} opacity={0.7} />
      <path d="M0 30 L8.4 30 L8.5 36 L0.1 36 Z M0.4 56 L8.8 56 L8.9 62 L0.5 62 Z" fill="#c9a25c" opacity={0.9} />
    </g>
  );
}

/* ------------------------------------------------------------------------ */
/* Heads                                                                     */
/* ------------------------------------------------------------------------ */

/** Heads are drawn a touch large and scaled down about the neck pin. */
const HEAD_SCALE = 'translate(40 -336) scale(0.92) translate(-40 336)';

export function SatriaHead({ p, pal, sil }: ArtProps) {
  const gold = `url(#${p}-gold)`;
  return (
    <g transform={HEAD_SCALE}>
      <Shape sil={sil} fill={pal.hair} d="M28 -398 C12 -394 5 -378 8 -361 C10 -349 18 -339 30 -336 L36 -346 C28 -360 26 -380 30 -396 Z" />
      {/* Gelung supit urang: hair bun with two backward "shrimp claw" curls */}
      <Shape
        sil={sil}
        fill={pal.hair}
        d="M-28 -416 C-46 -416 -60 -405 -62 -392 C-62 -383 -54 -379 -47 -383 C-42 -387 -46 -394 -51 -392 C-47 -401 -37 -405 -25 -403 Z"
      />
      <Shape
        sil={sil}
        fill={pal.hair}
        d="M-12 -445 C-30 -458 -54 -452 -62 -436 C-66 -426 -60 -417 -51 -419 C-44 -421 -45 -431 -52 -431 C-46 -440 -30 -441 -18 -431 Z"
      />
      <Shape
        sil={sil}
        fill={pal.hair}
        d="M54 -399 C59 -415 53 -432 39 -443 C23 -454 0 -454 -15 -446 C-28 -438 -34 -425 -32 -411 C-30 -400 -20 -394 -6 -396 L28 -401 Z"
      />
      {/* Jungkat comb lying along the front of the bun */}
      <Shape sil={sil} fill={gold} d="M44 -414 C52 -420 56 -430 55 -440 C49 -434 44 -426 40 -419 Z" />
      <Shape
        sil={sil}
        fill={gold}
        d="M-16 -437 C-30 -437 -40 -428 -42 -417 C-43 -409 -38 -403 -31 -403 C-34 -409 -32 -415 -26 -417 C-30 -411 -26 -405 -20 -405 C-14 -411 -11 -424 -16 -437 Z"
      />
      {!sil && (
        <>
          <Line d="M-16 -440 C-32 -450 -50 -446 -56 -434" color={pal.gold[1]} opacity={0.6} />
          <Line d="M-30 -410 C-44 -410 -54 -402 -56 -392" color={pal.gold[1]} opacity={0.6} />
          <Dots d="M50 -414 C48 -428 38 -440 22 -446 C8 -450 -6 -448 -16 -442" color={pal.gold[0]} size={1.8} />
          <Dots d="M30 -404 C12 -404 -6 -404 -22 -408" color={pal.gold[0]} size={1.5} gap={4} />
          <path d="M-20 -430 C-28 -428 -34 -422 -34 -415 C-30 -419 -26 -421 -22 -420 Z" fill={pal.accent.base} />
          <circle cx={-24} cy={-426} r={1.3} fill={INK} />
          <Line d="M46 -420 C50 -426 52 -432 52 -437" color={pal.accent.base} width={1.2} />
        </>
      )}

      {/* Face: refined profile with the long, pointed nose of a satria */}
      <Shape
        sil={sil}
        fill={`url(#${p}-face)`}
        d="M26 -394 L54 -396 C67 -384 83 -369 102 -355 C96 -350 90 -349 85 -350 C86 -347 87 -345 85 -343 L81 -342 C84 -340 84 -338 81 -336 C79 -333 77 -331 72 -331 C62 -331 50 -330 40 -334 L30 -344 C24 -360 22 -378 26 -394 Z"
      />
      {!sil && (
        <>
          <Line d="M57 -391 C69 -380 84 -367 98 -357" color={pal.faceLight} width={2.4} opacity={0.55} />
          <Line d="M89 -352.5 C91 -354.5 94 -354.5 95.5 -352.5" />
          <Line d="M80.5 -342.3 L86 -343.4" />
          <path d="M58 -369 C64 -374.5 74 -373 83 -366 C74 -365.5 64 -365.5 58 -369 Z" fill="#f6ead0" stroke={INK} strokeWidth={1} />
          <circle cx={76} cy={-368.3} r={1.7} fill={INK} />
          <Line d="M56.5 -369.5 C64 -376.5 75 -375 84.5 -366" width={1.6} />
          <path d="M51 -378 C61 -385 74 -382 86 -372.5 C74 -378.5 62 -380.5 51 -376 Z" fill={INK} />
          <Line d="M32 -382 C27 -372 27 -360 31 -351 C33 -347 31 -343 27 -345" color={pal.hair} width={3.2} />
          <Dots d="M42 -338 C52 -334.5 62 -334 70 -334.5" color={pal.faceLight} size={1.2} gap={3.6} />
        </>
      )}

      {/* Jamang diadem */}
      <Shape sil={sil} fill={gold} d="M24 -405 C36 -406 48 -404 59 -399 L57 -390 C46 -395 35 -397 24 -397 Z" />
      {!sil && (
        <>
          <Line d="M25 -401 C36 -402 47 -400.5 57.5 -395" color={pal.accent.base} width={2} />
          <Dots d="M26 -401 C36 -402 46 -400.6 56 -395.6" size={1.3} gap={3.6} />
        </>
      )}

      {/* Sumping ear ornament, earring */}
      <Shape
        sil={sil}
        fill={gold}
        d="M35 -372 C22 -378 4 -372 -10 -360 C-20 -352 -26 -340 -28 -330 C-18 -338 -6 -346 8 -352 C18 -356 28 -358 35 -360 Z"
      />
      {!sil && (
        <>
          <path
            d="M30 -368 C18 -371 4 -366 -6 -357 C-13 -351 -18 -344 -20 -338 C-12 -344 -2 -350 10 -355 C18 -358 25 -360 30 -362 Z"
            fill={pal.accent.base}
          />
          <Dots d="M30 -365 C16 -365 2 -358 -14 -342" size={1.5} gap={3.8} />
          <Line d="M35 -362 L34.5 -352" color={pal.gold[1]} width={1.2} />
          <path d={drop(34.5, -352, 0.9)} fill={gold} stroke={INK} strokeWidth={0.5} />
          <circle cx={35} cy={-366} r={4.2} fill={gold} stroke={INK} strokeWidth={0.9} />
          <circle cx={35} cy={-366} r={1.8} fill={pal.jewel} />
        </>
      )}
    </g>
  );
}

export function RajaHead({ p, pal, sil }: ArtProps) {
  const gold = `url(#${p}-gold)`;
  return (
    <g transform={HEAD_SCALE}>
      <Shape sil={sil} fill={pal.hair} d="M28 -398 C12 -394 5 -378 8 -361 C10 -349 18 -339 30 -336 L36 -346 C28 -360 26 -380 30 -396 Z" />
      {/* Loose curling hair down the back */}
      <Shape
        sil={sil}
        fill={pal.hair}
        d="M16 -374 C-2 -362 -12 -344 -14 -326 C-15 -314 -10 -305 -2 -307 C3 -309 1 -316 -3 -316 C-2 -327 5 -340 16 -350 Z"
      />
      <Shape
        sil={sil}
        fill={pal.hair}
        d="M10 -356 C-6 -346 -18 -330 -22 -314 C-24 -305 -18 -298 -11 -301 C-7 -303 -9 -309 -13 -308 C-11 -320 -3 -333 9 -342 Z"
      />
      {/* Plume sweeping back from the crown */}
      <Shape
        sil={sil}
        fill={`url(#${p}-accent)`}
        d="M22 -436 C6 -447 -16 -449 -33 -439 C-44 -431 -47 -416 -40 -405 C-35 -412 -26 -417 -16 -417 C-5 -417 8 -414 20 -409 Z"
      />
      {/* Makutha crown, its peak curling backward */}
      <Shape
        sil={sil}
        fill={gold}
        d="M22 -402 C16 -424 13 -448 14 -466 C14 -476 10 -482 3 -487 C16 -490 29 -485 39 -475 C51 -463 62 -450 64 -432 C65 -418 61 -408 60 -400 Z"
      />
      {/* Garuda mungkur: a backward-facing garuda at the base of the crown */}
      <Shape
        sil={sil}
        fill={gold}
        d="M22 -416 C5 -418 -13 -416 -28 -405 C-37 -398 -41 -387 -37 -378 C-33 -384 -27 -387 -20 -385 C-24 -379 -22 -372 -16 -370 C-10 -379 1 -389 22 -396 Z"
      />
      {!sil && (
        <>
          <Dots d="M-6 -340 C-9 -330 -10 -320 -8 -312 M-14 -328 C-17 -320 -18 -312 -16 -306" color={pal.gold[0]} size={1.8} gap={6} />
          <Line d="M-38 -409 C-44 -419 -38 -431 -28 -431 C-20 -431 -18 -423 -24 -421" color={pal.gold[0]} width={1.2} />
          <Dots d="M18 -435 C4 -443 -14 -444 -28 -437" color={pal.gold[0]} size={1.6} />
          <Line d="M21.5 -411 C34 -413.5 48 -412.5 60.5 -408" color={pal.kain.base} width={5} />
          <Dots d="M23 -411.2 C34 -413.4 48 -412.4 59 -408.4" size={1.4} gap={3.6} />
          {[
            [26, -428],
            [37, -431],
            [48, -430],
            [58, -425],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={2.8} fill={pal.jewel} stroke={pal.gold[0]} strokeWidth={0.8} />
          ))}
          <Line d="M17 -447 C30 -452 46 -450 60 -443" color={pal.accent.base} width={3.6} />
          <Dots d="M18 -447.2 C30 -451.8 46 -449.8 59 -443.4" color={pal.gold[0]} size={1.4} gap={3.4} />
          <Line d="M18 -462 C24 -470 32 -474 40 -472" color={pal.kain.base} width={2.4} />
          <Line d="M30 -416 C27 -436 28 -456 32 -470" opacity={0.35} width={0.7} />
          <Line d="M48 -414 C50 -432 50 -450 46 -464" opacity={0.35} width={0.7} />
          <circle cx={6} cy={-484} r={2.4} fill={pal.jewel} stroke={pal.gold[0]} strokeWidth={0.8} />
          <path
            d="M14 -411 C0 -411 -14 -407 -24 -399 C-30 -394 -32 -388 -30 -383 C-25 -388 -18 -391 -10 -392 C0 -395 8 -399 14 -402 Z"
            fill={pal.kain.base}
          />
          <circle cx={-22} cy={-396} r={1.6} fill={INK} />
          <Line d="M-37 -378 C-40 -372 -36 -368 -32 -370" color={pal.gold[0]} width={1.2} />
        </>
      )}

      {/* Face: bolder, upturned profile with a round eye and a curled moustache */}
      <Shape
        sil={sil}
        fill={`url(#${p}-face)`}
        d="M27 -397 L52 -399 C61 -392 70 -381 80 -370 C88 -363 98 -358 108 -359 C107 -353 101 -350 93 -350 C92 -346 92 -343 89 -341 L84 -340 C86 -337 85 -333 81 -331 C71 -328 55 -328 42 -333 L31 -344 C25 -360 23 -381 27 -397 Z"
      />
      {!sil && (
        <>
          <Line d="M55 -394 C64 -385 72 -375 82 -367 C90 -361 98 -360 104 -360" color={pal.faceLight} width={2.4} opacity={0.5} />
          <circle cx={68} cy={-371} r={5.4} fill="#f6ead0" stroke={INK} strokeWidth={1.2} />
          <circle cx={70.2} cy={-371} r={2.7} fill={INK} />
          <Line d="M61 -374 C64 -379 72 -380 76 -374" width={1.8} />
          <path d="M55 -382 C63 -390 76 -388 85 -378 C76 -384 64 -385 55 -379 Z" fill={INK} />
          <Line d="M95 -353 C97 -355 100 -355 101.5 -353" />
          <path d="M93 -350 C86 -349 77 -348.5 70 -350 C66 -351 64 -354 66 -357 C67 -353.5 70 -352.5 74 -352.6 C80 -352.6 87 -352 93 -350 Z" fill={INK} />
          <Line d="M84 -340 L89 -341.5" width={1} />
          <Dots d="M44 -336 C56 -331.5 70 -330.5 81 -333" color={INK} size={1.7} gap={3} />
          <Dots d="M46 -340 C56 -336 66 -335.5 74 -337" color={INK} size={1.4} gap={3.2} />
        </>
      )}

      {/* Jamang with three turida points */}
      <Shape sil={sil} fill={gold} d="M23 -406 L60 -401 L58 -392 L23 -397 Z" />
      <Shape sil={sil} fill={gold} d="M29 -405 L33 -415 L37 -404.5 Z M40 -404 L45 -414 L49 -403 Z M51 -402.5 L57 -411 L59.5 -401.5 Z" />
      {!sil && <Line d="M24 -401.5 L58.5 -396.5" color={pal.kain.base} width={2} />}

      {/* Sumping, larger and more flamboyant than the satria's */}
      <Shape
        sil={sil}
        fill={gold}
        d="M34 -373 C20 -381 -2 -378 -18 -364 C-30 -354 -36 -338 -36 -326 C-26 -336 -14 -344 2 -350 C14 -355 26 -358 34 -360 Z"
      />
      {!sil && (
        <>
          <path
            d="M29 -369 C16 -374 0 -371 -12 -361 C-21 -354 -26 -344 -28 -336 C-19 -344 -8 -350 4 -354 C14 -357 22 -359 29 -362 Z"
            fill={pal.accent.base}
          />
          <Dots d="M29 -365 C14 -366 -2 -360 -20 -342" size={1.5} gap={3.8} />
          <Line d="M34 -361 L33.5 -351" color={pal.gold[1]} width={1.2} />
          <path d={drop(33.5, -351, 0.9)} fill={gold} stroke={INK} strokeWidth={0.5} />
          <circle cx={34} cy={-366} r={4.6} fill={gold} stroke={INK} strokeWidth={0.9} />
          <circle cx={34} cy={-366} r={2} fill={pal.jewel} />
        </>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------------ */
/* Arms: drawn hanging straight down from their own pivot at (0, 0)          */
/* ------------------------------------------------------------------------ */

interface LimbProps extends ArtProps {
  far: boolean;
}

export function UpperArmArt({ p, pal, sil, far }: LimbProps) {
  return (
    <g>
      <Shape
        sil={sil}
        fill={far ? `url(#${p}-shade)` : `url(#${p}-limb)`}
        d="M-11 -1 C-11 -15 11 -15 11 -1 C10 34 7 74 6 104 C6 112 -6 112 -6 104 C-7 74 -10 34 -11 -1 Z"
      />
      {/* Kelat bahu armband with a small naga wing */}
      <Shape sil={sil} fill={`url(#${p}-gold)`} d="M-9 16 C-17 10 -24 10 -30 4 C-28 13 -22 20 -10 27 Z" />
      {!sil && (
        <>
          <path d="M-12 18 C-17 14.5 -21 13.5 -25 10 C-22.5 16 -18 19.5 -12 23 Z" fill={pal.accent.base} />
          <path d="M-10.6 15 C-4 13 4 12 10.4 13 L9.7 30 C3 29 -3 30 -9.9 32 Z" fill={pal.accent.base} stroke={INK} strokeWidth={0.9} />
          <Line d="M-10.4 16.5 C-4 14.5 4 13.5 10.3 14.5" color={pal.gold[0]} width={1.4} />
          <Line d="M-9.8 30.5 C-3 28.5 3 27.5 9.6 28.5" color={pal.gold[0]} width={1.4} />
          <Dots d="M-8.6 22.6 L8.8 21.4" size={1.5} gap={3.4} />
          <Line d="M5 40 C4 60 3 80 2 98" opacity={0.35} width={0.7} />
          <Dots d="M-1 40 C-1 60 -1 80 0 96" size={1.1} gap={5} />
        </>
      )}
    </g>
  );
}

export function ForearmArt({ p, pal, sil, far }: LimbProps) {
  return (
    <g>
      <Shape
        sil={sil}
        fill={far ? `url(#${p}-shade)` : `url(#${p}-limb)`}
        d="M-6 -6 C-6 28 -5 64 -4 98 C-4 104 4 104 4 98 C5 64 6 28 6 -6 C6 -12 -6 -12 -6 -6 Z"
      />
      {!sil && (
        <>
          <path d="M-5.4 82 L5.4 82 L4.9 95 L-4.9 95 Z" fill={`url(#${p}-gold)`} stroke={INK} strokeWidth={0.8} />
          <Line d="M-5.1 88.5 L5.1 88.5" color={pal.accent.base} width={2} />
          <circle r={2.6} fill={pal.gold[2]} stroke={INK} strokeWidth={0.8} />
          <circle r={0.9} fill={INK} />
        </>
      )}
    </g>
  );
}

/** A long, elegant wayang hand: four fingers held together, thumb turned out. */
export function HandArt({ p, sil, far }: LimbProps) {
  return (
    <g>
      <Shape
        sil={sil}
        fill={far ? `url(#${p}-shade)` : `url(#${p}-limb)`}
        d="M-4.5 -3 C-6 6 -6.5 14 -5.5 22 C-4.5 34 -2 46 2 56 C3.5 59 6.5 58 6.8 54 C7 44 6.5 32 6 22 C9 21 13 22 17.5 25 C19.5 26 20 24 18.5 22.5 C14 18 9.5 12 5.5 6 C5 2 4.5 -1 4.5 -3 Z"
      />
      {!sil && (
        <>
          <Line d="M-1.6 24 C-0.6 36 0.8 46 3.2 54" width={0.55} opacity={0.5} />
          <Line d="M1.8 23 C2.8 34 3.8 44 5 52" width={0.55} opacity={0.5} />
          <Line d="M7 21 C10 20.5 13.5 21.5 16.5 23.5" width={0.55} opacity={0.45} />
        </>
      )}
    </g>
  );
}

/** A tuding arm rod, tied to the palm at (0, 0) and running down past the rail. */
export function RodArt({ p, pal, sil, length }: ArtProps & { length: number }) {
  const d = `M-1.3 0 L1.3 0 L2.7 ${length} L-2.7 ${length} Z`;
  if (sil) {
    return (
      <g>
        <path d={d} />
        <circle r={2.4} />
      </g>
    );
  }
  return (
    <g>
      <path d={d} fill={`url(#${p}-rod)`} />
      <Line d={`M-0.3 6 L0.6 ${length - 4}`} color="#6a442a" width={0.6} opacity={0.6} />
      <Line d="M-2 11 L2 11 M-2.1 15 L2.1 15" color={pal.gold[1]} width={1.2} />
      <circle r={2.4} fill="#1a0b05" stroke="#7a5230" strokeWidth={0.7} />
    </g>
  );
}
