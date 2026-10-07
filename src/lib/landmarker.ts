import type { HandLandmarker } from '@mediapipe/tasks-vision';

const MEDIAPIPE_VERSION = '1.0.1';

const resolve = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;

/** Served from our own origin first (see scripts/setup-mediapipe.mjs); the public CDN is only a fallback. */
const SOURCES = [
  { wasm: () => resolve('mediapipe/wasm'), model: () => resolve('models/hand_landmarker.task') },
  {
    wasm: () => `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
    model: () =>
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
];

const CLOSE_DELAY_MS = 4000;

interface Shared {
  promise: Promise<HandLandmarker>;
  refs: number;
  closeTimer: number | undefined;
}

let shared: Shared | null = null;
let gpuUnavailable = false;

async function createLandmarker(): Promise<HandLandmarker> {
  // Loaded on demand so the theatre paints before any ML code is fetched.
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const delegates: ('GPU' | 'CPU')[] = gpuUnavailable ? ['CPU'] : ['GPU', 'CPU'];
  let lastError: unknown = new Error('Hand landmarker could not be created');

  for (const source of SOURCES) {
    let gpuFailed = false;
    for (const delegate of delegates) {
      try {
        const fileset = await FilesetResolver.forVisionTasks(source.wasm());
        const landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: source.model(), delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        // Only blame the GPU when the CPU path works with the very same files.
        if (gpuFailed) gpuUnavailable = true;
        return landmarker;
      } catch (error) {
        lastError = error;
        if (delegate === 'GPU') gpuFailed = true;
        if (import.meta.env.DEV) console.warn(`[hand-tracking] ${delegate} delegate failed`, error);
      }
    }
  }
  throw lastError;
}

export interface LandmarkerLease {
  promise: Promise<HandLandmarker>;
  release(): void;
}

/**
 * Shares one HandLandmarker across the app. Leases are ref-counted and the
 * model is closed a few seconds after the last release, so React StrictMode's
 * mount → unmount → mount cycle never builds a second model.
 */
export function acquireHandLandmarker(): LandmarkerLease {
  if (!shared) {
    const entry: Shared = { promise: createLandmarker(), refs: 0, closeTimer: undefined };
    entry.promise.catch(() => {
      if (shared === entry) shared = null;
    });
    shared = entry;
  }
  const entry = shared;
  entry.refs += 1;
  window.clearTimeout(entry.closeTimer);

  let released = false;
  return {
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      entry.refs -= 1;
      if (entry.refs > 0) return;
      entry.closeTimer = window.setTimeout(() => {
        if (entry.refs > 0) return;
        if (shared === entry) shared = null;
        entry.promise.then((landmarker) => landmarker.close()).catch(() => undefined);
      }, CLOSE_DELAY_MS);
    },
  };
}

/** Called when a GPU landmarker keeps failing at inference time: rebuild it on the CPU. */
export function discardHandLandmarker() {
  gpuUnavailable = true;
  const entry = shared;
  shared = null;
  entry?.promise.then((landmarker) => landmarker.close()).catch(() => undefined);
}
