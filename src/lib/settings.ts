import type { Settings } from '../types';

const STORAGE_KEY = 'dalang.preferences.v1';

export const DEFAULT_SETTINGS: Settings = {
  cameraEnabled: true,
  showLandmarks: true,
  mirror: true,
  sensitivity: 0.5,
  smoothing: 0.65,
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
}

export function readDebugFlags(): DebugFlags {
  const params = new URLSearchParams(window.location.search);
  const on = (key: string) => params.has(key) && params.get(key) !== '0';
  return { debug: on('debug'), simulate: on('simulate') };
}
