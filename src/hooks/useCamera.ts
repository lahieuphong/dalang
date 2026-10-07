import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { CameraStatus } from '../types';

const PREFERRED: MediaStreamConstraints = {
  video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
  audio: false,
};
const FALLBACK: MediaStreamConstraints = { video: { facingMode: 'user' }, audio: false };

const isSupported = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function openStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(PREFERRED);
  } catch (error) {
    // Some devices reject the ideal HD constraints outright; retry with the bare minimum.
    if (error instanceof DOMException && (error.name === 'OverconstrainedError' || error.name === 'NotReadableError')) {
      return navigator.mediaDevices.getUserMedia(FALLBACK);
    }
    throw error;
  }
}

/** Reads camera permission without prompting; null when the browser can't tell us. */
export async function queryCameraPermission(): Promise<PermissionState | null> {
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    return status?.state ?? null;
  } catch {
    return null;
  }
}

export interface CameraController {
  videoRef: RefObject<HTMLVideoElement | null>;
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
  const requestRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>(() => (isSupported() ? 'idle' : 'unsupported'));

  const stop = useCallback(() => {
    requestRef.current += 1;
    stopStream(streamRef.current);
    streamRef.current = null;
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

  return { videoRef, status, start, stop };
}
