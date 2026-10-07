import { useEffect, useRef, useState, type RefObject } from 'react';
import { acquireHandLandmarker, discardHandLandmarker } from '../lib/landmarker';
import { HandTracker } from '../lib/handTracker';
import type { TrackingStatus } from '../types';

export interface HandTracking {
  status: TrackingStatus;
  /** The live tracker. Read it from the animation loop; it is null until the model is ready. */
  trackerRef: RefObject<HandTracker | null>;
}

/**
 * Loads the shared MediaPipe HandLandmarker while `enabled` and exposes a
 * throttled tracker for the render loop. Per-frame hand data never touches
 * React state; only the coarse loading status does.
 */
export function useHandTracking(enabled: boolean): HandTracking {
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [generation, setGeneration] = useState(0);
  const trackerRef = useRef<HandTracker | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const lease = acquireHandLandmarker();
    setStatus((current) => (current === 'ready' ? current : 'loading'));

    lease.promise.then(
      (landmarker) => {
        if (cancelled) return;
        trackerRef.current = new HandTracker(landmarker, (error) => {
          if (import.meta.env.DEV) console.warn('[hand-tracking] inference keeps failing, rebuilding on CPU', error);
          trackerRef.current = null;
          discardHandLandmarker();
          setGeneration((value) => value + 1);
        });
        setStatus('ready');
      },
      (error: unknown) => {
        if (cancelled) return;
        if (import.meta.env.DEV) console.error('[hand-tracking] could not load the hand landmarker', error);
        setStatus('error');
      },
    );

    return () => {
      cancelled = true;
      trackerRef.current = null;
      lease.release();
      setStatus('idle');
    };
  }, [enabled, generation]);

  return { status, trackerRef };
}
