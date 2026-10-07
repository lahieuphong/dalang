import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { PUPPET, rigTransforms, type ArmGeometry, type RigTransforms } from '../lib/puppetGeometry';
import { idleRig } from '../lib/puppetMapping';
import type { PuppetRig, Side } from '../types';
import { PALETTES, type PuppetPalette, type PuppetVariant } from './puppet/palettes';
import {
  BodyArt,
  ForearmArt,
  GapitArt,
  HandArt,
  PrabaArt,
  PuppetDefs,
  RajaHead,
  RodArt,
  SatriaHead,
  UpperArmArt,
} from './puppet/PuppetArt';

export interface PuppetHandle {
  apply(rig: PuppetRig): void;
}

interface PuppetProps {
  side: Side;
  /** Render only the outline shapes (used to cast the puppet's shadow). */
  silhouette?: boolean;
  ref?: Ref<PuppetHandle>;
}

const VARIANT: Record<Side, PuppetVariant> = { left: 'satria', right: 'raja' };

type GroupKey = keyof RigTransforms;

interface ArmProps {
  arm: ArmGeometry;
  far: boolean;
  p: string;
  pal: PuppetPalette;
  sil: boolean;
  initial: RigTransforms;
  setRef: (key: GroupKey) => (el: SVGGElement | null) => void;
}

/** Shoulder → elbow → wrist chain; each joint rotates about its own pin. */
function Arm({ arm, far, p, pal, sil, initial, setRef }: ArmProps) {
  const upper: GroupKey = far ? 'backUpper' : 'frontUpper';
  const fore: GroupKey = far ? 'backFore' : 'frontFore';
  return (
    <g transform={`translate(${arm.shoulder.x} ${arm.shoulder.y})`}>
      <g ref={setRef(upper)} transform={initial[upper]}>
        <UpperArmArt p={p} pal={pal} sil={sil} far={far} />
        <g transform={`translate(0 ${arm.upper})`}>
          <g ref={setRef(fore)} transform={initial[fore]}>
            <ForearmArt p={p} pal={pal} sil={sil} far={far} />
            <g transform={`translate(0 ${arm.fore})`}>
              {far ? (
                <HandArt p={p} pal={pal} sil={sil} far />
              ) : (
                <g ref={setRef('frontHand')} transform={initial.frontHand}>
                  <HandArt p={p} pal={pal} sil={sil} far={false} />
                </g>
              )}
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

/**
 * One Wayang puppet as an articulated SVG rig. The pose is driven imperatively
 * through `apply(rig)` from the animation loop, never through React renders.
 *
 * Layering, back to front: praba, far arm and its rod, sashes, legs, kain,
 * torso, gapit (main rod), head, near arm, near arm rod.
 */
export function Puppet({ side, silhouette = false, ref }: PuppetProps) {
  const variant = VARIANT[side];
  const pal = PALETTES[variant];
  const p = `wp-${side}`;
  const groups = useRef<Partial<Record<GroupKey, SVGGElement>>>({});
  const initial = useMemo(() => rigTransforms(side, idleRig(side, 0, 1)), [side]);

  const setRef = useMemo(() => {
    const cache = new Map<GroupKey, (el: SVGGElement | null) => void>();
    return (key: GroupKey) => {
      let callback = cache.get(key);
      if (!callback) {
        callback = (el) => {
          if (el) groups.current[key] = el;
          else delete groups.current[key];
        };
        cache.set(key, callback);
      }
      return callback;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      apply(rig) {
        const transforms = rigTransforms(side, rig);
        for (const key of Object.keys(transforms) as GroupKey[]) {
          groups.current[key]?.setAttribute('transform', transforms[key]);
        }
      },
    }),
    [side],
  );

  const sil = silhouette;
  return (
    <g ref={setRef('root')} transform={initial.root} className={sil ? undefined : `puppet puppet--${side}`}>
      {!sil && <PuppetDefs p={p} pal={pal} />}
      {variant === 'raja' && <PrabaArt p={p} pal={pal} sil={sil} />}
      <g ref={setRef('backRod')} transform={initial.backRod}>
        <RodArt p={p} pal={pal} sil={sil} length={PUPPET.rodLength} />
      </g>
      <Arm arm={PUPPET.back} far p={p} pal={pal} sil={sil} initial={initial} setRef={setRef} />
      <BodyArt p={p} pal={pal} sil={sil} />
      <GapitArt p={p} sil={sil} />
      <g ref={setRef('head')} transform={initial.head}>
        {variant === 'raja' ? <RajaHead p={p} pal={pal} sil={sil} /> : <SatriaHead p={p} pal={pal} sil={sil} />}
      </g>
      <Arm arm={PUPPET.front} far={false} p={p} pal={pal} sil={sil} initial={initial} setRef={setRef} />
      <g ref={setRef('frontRod')} transform={initial.frontRod}>
        <RodArt p={p} pal={pal} sil={sil} length={PUPPET.rodLength} />
      </g>
    </g>
  );
}
