import type { Settings } from '../types';

/** Bumped when the defaults change meaningfully, so old saved values don't mask them. */
const STORAGE_KEY = 'dalang.preferences.v3';

export const DEFAULT_SETTINGS: Settings = {
  cameraEnabled: true,
  showLandmarks: true,
  mirror: true,
  // Tuned so the defaults are already fast and lively; neither slider is needed to get a responsive puppet.
  sensitivity: 0.5,
  smoothing: 0.3,
};

const isUnit = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;

/** Reads saved preferences, ignoring anything malformed. Permission state is never stored. */
export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    return {
      cameraEnabled: typeof saved.cameraEnabled === 'boolean' ? saved.cameraEnabled : DEFAULT_SETTINGS.cameraEnabled,
      showLandmarks: typeof saved.showLandmarks === 'boolean' ? saved.showLandmarks : DEFAULT_SETTINGS.showLandmarks,
      mirror: typeof saved.mirror === 'boolean' ? saved.mirror : DEFAULT_SETTINGS.mirror,
      sensitivity: isUnit(saved.sensitivity) ? saved.sensitivity : DEFAULT_SETTINGS.sensitivity,
      smoothing: isUnit(saved.smoothing) ? saved.smoothing : DEFAULT_SETTINGS.smoothing,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode, quota); preferences simply won't persist.
  }
}

export interface DebugFlags {
  /** `?debug=1`: tracking FPS, handedness, assignment and features. */
  debug: boolean;
  /** `?simulate=1`: drive the puppets with synthetic hands instead of the camera. */
  simulate: boolean;
  /**
   * `?tracker=main` / `?tracker=worker`: pin where the hand model runs instead
   * of letting the app choose, for comparison.
   */
  tracker: 'main' | 'worker' | null;
  /** `?delegate=cpu` / `?delegate=gpu`: force the model onto one delegate, for comparison. */
  delegate: 'cpu' | 'gpu' | null;
}

export function readDebugFlags(): DebugFlags {
  const params = new URLSearchParams(window.location.search);
  const on = (key: string) => params.has(key) && params.get(key) !== '0';
  const delegate = params.get('delegate');
  const tracker = params.get('tracker');
  return {
    debug: on('debug'),
    simulate: on('simulate'),
    tracker: tracker === 'main' || tracker === 'worker' ? tracker : null,
    delegate: delegate === 'cpu' || delegate === 'gpu' ? delegate : null,
  };
}
