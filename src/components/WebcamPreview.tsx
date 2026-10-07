import type { Ref, RefObject } from 'react';
import type { CameraStatus } from '../types';
import { HandOverlay, type HandOverlayHandle } from './HandOverlay';
import { CameraIcon, RetryIcon } from './icons';

interface WebcamPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: Ref<HandOverlayHandle>;
  status: CameraStatus;
  mirror: boolean;
  /** The camera is intentionally off (not an error). */
  cameraEnabled: boolean;
  onEnable: () => void;
  simulated: boolean;
}

function CameraPrompt({ status, cameraEnabled, onEnable }: Pick<WebcamPreviewProps, 'status' | 'cameraEnabled' | 'onEnable'>) {
  if (status === 'requesting') {
    return (
      <div className="webcam__prompt">
        <span className="webcam__spinner" aria-hidden="true" />
        <p className="webcam__note">Waiting for camera…</p>
      </div>
    );
  }
  if (status === 'unsupported') {
    return (
      <div className="webcam__prompt">
        <p className="webcam__title">Camera not available</p>
        <p className="webcam__note">This browser can’t share a camera</p>
      </div>
    );
  }
  if (status === 'denied' || status === 'error') {
    return (
      <div className="webcam__prompt">
        <p className="webcam__title">{status === 'denied' ? 'Camera blocked' : 'Camera unavailable'}</p>
        <button type="button" className="webcam__button webcam__button--small" onClick={onEnable}>
          <RetryIcon />
          Retry
        </button>
        {status === 'denied' && <p className="webcam__note">Allow camera access for this site</p>}
      </div>
    );
  }
  return (
    <div className="webcam__prompt">
      <button type="button" className="webcam__button" onClick={onEnable}>
        <CameraIcon />
        {cameraEnabled ? 'Enable camera' : 'Turn camera on'}
      </button>
    </div>
  );
}

/** The mirrored webcam card under the stage, with the hand-landmark overlay on top. */
export function WebcamPreview({ videoRef, overlayRef, status, mirror, cameraEnabled, onEnable, simulated }: WebcamPreviewProps) {
  const active = status === 'active';
  return (
    <div className={`webcam${active ? ' webcam--active' : ''}${simulated ? ' webcam--simulated' : ''}`}>
      <video
        ref={videoRef}
        className={`webcam__video${mirror ? ' webcam__video--mirrored' : ''}`}
        autoPlay
        muted
        playsInline
        aria-label="Your camera preview"
      />
      <HandOverlay ref={overlayRef} />
      {!active && !simulated && <CameraPrompt status={status} cameraEnabled={cameraEnabled} onEnable={onEnable} />}
    </div>
  );
}
