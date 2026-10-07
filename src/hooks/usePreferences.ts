import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { loadSettings, saveSettings } from '../lib/settings';
import type { Settings } from '../types';

/** Settings persisted to localStorage. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => saveSettings(settings), [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings((current) => ({ ...current, ...patch })), []);
  return [settings, update];
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}
