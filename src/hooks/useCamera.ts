import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraStatus } from '../types';

/**
 * Fresh frames matter more than resolution for hand control, and the model
 * only looks at a small crop anyway. So: first insist on a 50+ fps mode at
 * whatever modest resolution the camera offers one (many only do 60 fps at
 * 640×480), then settle for a modest 30 fps mode, then anything at all.
 * What was actually granted is read back from the track, never assumed.
 */
const ATTEMPTS: readonly MediaStreamConstraints[] = [
  { video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { min: 50, ideal: 60 } }, audio: false },
  { video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } }, audio: false },
  { video: { facingMode: 'user' }, audio: false },
];
const RETRYABLE = new Set(['OverconstrainedError', 'NotReadableError', 'AbortError']);

const isSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function openStream(): Promise<MediaStream> {
  let lastError: unknown = new Error('No camera mode could be opened');
  for (const constraints of ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      lastError = error;
      if (!(error instanceof DOMException) || !RETRYABLE.has(error.name)) throw error;
    }
  }
  throw lastError;
}

export interface CameraController {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** What the camera actually delivers (resolution, frame rate), once streaming. */
  trackSettingsRef: RefObject<MediaTrackSettings | null>;
  status: CameraStatus;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Owns the webcam stream and its lifecycle: permission states, stale requests
 * (StrictMode remounts, rapid toggles), unplugged devices and track cleanup.
 */
export function useCamera(): CameraController {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackSettingsRef = useRef<MediaTrackSettings | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>(() => (isSupported() ? 'idle' : 'unsupported'));

  const stop = useCallback(() => {
    requestRef.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
    trackSettingsRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus((current) => (current === 'unsupported' ? current : 'idle'));
  }, []);

  const start = useCallback(async () => {
    if (!isSupported()) {
      setStatus('unsupported');
      return;
    }
    const request = ++requestRef.current;
    stopStream(streamRef.current);
    streamRef.current = null;
    setStatus('requesting');

    try {
      const stream = await openStream();
      if (request !== requestRef.current) {
        stopStream(stream);
        return;
      }
      streamRef.current = stream;
      // Never assume the requested mode was granted; record what we actually got.
      trackSettingsRef.current = stream.getVideoTracks()[0]?.getSettings() ?? null;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current !== stream) return;
        streamRef.current = null;
        setStatus('error');
      });

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      if (request === requestRef.current) setStatus('active');
    } catch (error) {
      if (request !== requestRef.current) return;
      const name = error instanceof DOMException ? error.name : '';
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
      if (import.meta.env.DEV) console.warn('[camera]', error);
    }
  }, []);

  // Recover when a camera is plugged back in after the stream ended.
  useEffect(() => {
    if (status !== 'error' || !isSupported()) return;
    const onDeviceChange = () => void start();
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
  }, [status, start]);

  useEffect(
    () => () => {
      requestRef.current += 1;
      stopStream(streamRef.current);
      streamRef.current = null;
    },
    [],
  );

  return { videoRef, trackSettingsRef, status, start, stop };
}
