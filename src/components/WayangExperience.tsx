import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnimationFrame, useLatest } from '../hooks/useAnimationFrame';
import { useCamera } from '../hooks/useCamera';
import { useHandTracking } from '../hooks/useHandTracking';
import { useParallax } from '../hooks/useParallax';
import { useReducedMotion, useSettings } from '../hooks/usePreferences';
import { AmbientAudio } from '../lib/ambientAudio';
import { HandAssigner } from '../lib/handAssignment';
import { palmCenter } from '../lib/handMath';
import { keepApart } from '../lib/puppetMapping';
import { PuppetController } from '../lib/puppetMotion';
import { readDebugFlags } from '../lib/settings';
import { HandSimulator } from '../lib/simulatedHands';
import { stageStatus } from '../lib/status';
import { SIDES, type AssignedHands, type HandFrame, type Side } from '../types';
import { Backdrop } from './Backdrop';
import { DebugPanel, type DebugPanelHandle } from './DebugPanel';
import type { HandOverlayHandle } from './HandOverlay';
import type { StageSceneHandle } from './StageScene';
import { StageControls } from './StageControls';
import { StatusPill } from './StatusPill';
import { TheaterStage } from './TheaterStage';
import { WebcamPreview } from './WebcamPreview';

/** Mutable per-frame state, deliberately kept out of React. */
interface Engine {
  assigner: HandAssigner;
  puppets: Record<Side, PuppetController>;
  simulator: HandSimulator | null;
  assigned: AssignedHands;
  frame: HandFrame | null;
  frameAt: number;
  /** Which puppets are held, as "lr", "l-", "-r" or "--"; reported to React once it settles. */
  held: { reported: string; pending: string; since: number };
}

function createEngine(simulate: boolean): Engine {
  return {
    assigner: new HandAssigner(),
    puppets: { left: new PuppetController('left'), right: new PuppetController('right') },
    simulator: simulate ? new HandSimulator() : null,
    assigned: { left: null, right: null },
    frame: null,
    frameAt: -Infinity,
    held: { reported: '--', pending: '--', since: 0 },
  };
}

/** A small irregular wobble, like an oil lamp's flame, applied to the shadows. */
const lampFlicker = (t: number) => 0.6 * Math.sin(t * 7.3) * Math.sin(t * 1.7) + 0.4 * Math.sin(t * 12.9 + 1);

const OVERLAY_STALE_MS = 500;
const HELD_SETTLE_MS = 250;

export function WayangExperience() {
  const flags = useMemo(readDebugFlags, []);
  const [settings, updateSettings] = useSettings();
  const camera = useCamera();
  const reducedMotion = useReducedMotion();
  const cameraLive = camera.status === 'requesting' || camera.status === 'active';
  const tracking = useHandTracking(!flags.simulate && cameraLive);
  const [held, setHeld] = useState<Record<Side, boolean>>({ left: false, right: false });
  const [soundOn, setSoundOn] = useState(false);

  const sceneRef = useRef<StageSceneHandle>(null);
  const overlayRef = useRef<HandOverlayHandle>(null);
  const debugRef = useRef<DebugPanelHandle>(null);
  const audioRef = useRef<AmbientAudio | null>(null);
  const engineRef = useRef<Engine | null>(null);
  if (engineRef.current === null) engineRef.current = createEngine(flags.simulate);

  useParallax(!reducedMotion);

  // Start the camera by itself only when permission was already granted; otherwise
  // wait for the visitor to press "Enable camera". Also react to permission changes.
  const startCamera = camera.start;
  const cameraStatusRef = useLatest(camera.status);
  const cameraEnabledRef = useLatest(settings.cameraEnabled);
  useEffect(() => {
    if (flags.simulate || !navigator.permissions?.query) return;
    let cancelled = false;
    let permission: PermissionStatus | null = null;
    const onChange = () => {
      const status = cameraStatusRef.current;
      if (permission?.state === 'granted' && cameraEnabledRef.current && (status === 'idle' || status === 'denied')) {
        void startCamera();
      }
    };
    navigator.permissions
      .query({ name: 'camera' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        permission = result;
        result.addEventListener('change', onChange);
        onChange();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      permission?.removeEventListener('change', onChange);
    };
  }, [flags.simulate, startCamera, cameraStatusRef, cameraEnabledRef]);

  const enableCamera = useCallback(() => {
    updateSettings({ cameraEnabled: true });
    void startCamera();
  }, [updateSettings, startCamera]);

  const stopCamera = camera.stop;
  const setCameraOn = useCallback(
    (on: boolean) => {
      updateSettings({ cameraEnabled: on });
      if (on) void startCamera();
      else stopCamera();
    },
    [updateSettings, startCamera, stopCamera],
  );

  const toggleSound = useCallback(() => {
    if (!AmbientAudio.isSupported()) return;
    audioRef.current ??= new AmbientAudio();
    if (soundOn) audioRef.current.stop();
    else void audioRef.current.start();
    setSoundOn(!soundOn);
  }, [soundOn]);

  useEffect(
    () => () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    [],
  );

  const live = useLatest({ settings, cameraActive: camera.status === 'active', reducedMotion, soundOn });

  // The one animation loop: tracking → assignment → motion → render.
  useAnimationFrame((now, dt) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { settings, cameraActive, reducedMotion, soundOn } = live.current;
    const video = camera.videoRef.current;

    let frame: HandFrame | null = null;
    if (engine.simulator) frame = engine.simulator.next(now);
    else if (cameraActive && video) frame = tracking.trackerRef.current?.process(video, now, settings.mirror) ?? null;

    if (frame) {
      engine.frame = frame;
      engine.frameAt = now;
      engine.assigned = engine.assigner.assign(frame.hands, now);
      for (const side of SIDES) {
        const pickedUp = engine.puppets[side].observe(engine.assigned[side], frame.aspect, now, settings);
        if (pickedUp && soundOn) audioRef.current?.knock(side);
      }
      if (settings.showLandmarks) overlayRef.current?.draw(frame, engine.assigned, video);
    }
    if (!settings.showLandmarks || now - engine.frameAt > OVERLAY_STALE_MS) overlayRef.current?.clear();

    const amplitude = reducedMotion ? 0.3 : 1;
    const flicker = reducedMotion ? 0 : lampFlicker(now / 1000);
    const { left, right } = engine.puppets;
    keepApart(left.prepareTarget(now, dt, amplitude), right.prepareTarget(now, dt, amplitude));
    for (const side of SIDES) {
      const puppet = engine.puppets[side];
      sceneRef.current?.applyRig(side, puppet.integrate(dt, settings), flicker, dt, puppet.presence);
    }

    // Tell React which puppets are held only once that settles.
    const heldKey = SIDES.map((side) => (engine.puppets[side].isTracking(now) ? side[0] : '-')).join('');
    const report = engine.held;
    if (heldKey !== report.pending) {
      report.pending = heldKey;
      report.since = now;
    } else if (heldKey !== report.reported && now - report.since > HELD_SETTLE_MS) {
      report.reported = heldKey;
      setHeld({ left: heldKey[0] === 'l', right: heldKey[1] === 'r' });
    }

    if (flags.debug) {
      debugRef.current?.update(now, () =>
        describeDebug(engine, now, engine.simulator ? 'simulated' : `camera · ${tracking.trackerRef.current?.fps.toFixed(1) ?? '–'} fps`),
      );
    }
  });

  const status = stageStatus({
    camera: camera.status,
    tracking: tracking.status,
    hands: Number(held.left) + Number(held.right),
    cameraEnabled: settings.cameraEnabled,
    simulated: flags.simulate,
  });

  return (
    <main className="experience">
      <h1 className="visually-hidden">Dalang: a Wayang Kulit theatre for two hands</h1>
      <Backdrop />
      <div className="composition">
        <TheaterStage sceneRef={sceneRef}>
          <StageControls
            soundOn={soundOn}
            soundAvailable={AmbientAudio.isSupported()}
            onToggleSound={toggleSound}
            settings={settings}
            cameraOn={cameraLive}
            cameraAvailable={camera.status !== 'unsupported' && !flags.simulate}
            onCameraChange={setCameraOn}
            onSettingsChange={updateSettings}
          />
          <StatusPill status={status} />
        </TheaterStage>
        <WebcamPreview
          videoRef={camera.videoRef}
          overlayRef={overlayRef}
          status={camera.status}
          mirror={settings.mirror}
          live={camera.status === 'active' || flags.simulate}
          held={held}
          cameraEnabled={settings.cameraEnabled}
          onEnable={enableCamera}
          simulated={flags.simulate}
        />
      </div>
      {flags.debug && <DebugPanel ref={debugRef} />}
    </main>
  );
}

function describeDebug(engine: Engine, now: number, source: string): string {
  const fixed = (n: number | undefined, digits = 2) => (n === undefined ? '–' : n.toFixed(digits));
  const lines = [`source  ${source}`];
  engine.frame?.hands.forEach((hand, i) => {
    const slot = hand === engine.assigned.left ? 'L' : hand === engine.assigned.right ? 'R' : '·';
    const palm = palmCenter(hand.landmarks);
    lines.push(
      `hand ${i}  ${hand.handedness ?? '?'} ${fixed(hand.handednessScore)} → ${slot}   xy ${fixed(palm.x)},${fixed(palm.y)}`,
    );
  });
  const slots = engine.assigner.debugState(now);
  for (const side of SIDES) {
    const puppet = engine.puppets[side];
    const f = puppet.features;
    const s = slots[side];
    lines.push(
      `${side.padEnd(5)}  ${puppet.isTracking(now) ? 'held ' : 'rest '} age ${s.ageMs === Infinity ? '∞' : Math.round(s.ageMs)}ms  palm ${fixed(s.palm?.x)},${fixed(s.palm?.y)}`,
    );
    if (f) {
      lines.push(
        `       idx ${fixed(f.indexExtension)} open ${fixed(f.openness)} pinch ${fixed(f.pinch)} tilt ${fixed(f.tilt, 0)}° size ${fixed(f.size)}`,
      );
    }
  }
  return lines.join('\n');
}
