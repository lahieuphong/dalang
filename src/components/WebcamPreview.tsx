import type { Ref, RefObject } from 'react';
import type { CameraStatus, Side } from '../types';
import { HandOverlay, type HandOverlayHandle } from './HandOverlay';
import { CameraIcon, RetryIcon } from './icons';

interface WebcamPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: Ref<HandOverlayHandle>;
  status: CameraStatus;
  mirror: boolean;
  /** Frames are flowing (camera on, or simulated hands). */
  live: boolean;
  /** Which puppets a hand is currently holding. */
  held: Record<Side, boolean>;
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

const lampClass = (on: boolean) => `webcam__lamp${on ? ' webcam__lamp--on' : ''}`;

/** Gilded corner bracket with a small four-petal flower, drawn for the top-left corner. */
const CORNER = (
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M3 30 V9 C3 5.5 5.5 3 9 3 H30" fill="none" stroke="#e3b85e" strokeWidth="3" strokeLinecap="round" />
    <path d="M9.5 24 V12.5 C9.5 10.8 10.8 9.5 12.5 9.5 H24" fill="none" stroke="#9c6b2e" strokeWidth="1.4" strokeLinecap="round" />
    <g transform="translate(9 9)" fill="#e3b85e" stroke="#2a1108" strokeWidth="0.6">
      <ellipse rx="1.9" ry="3.3" transform="rotate(45) translate(0 -3.5)" />
      <ellipse rx="1.9" ry="3.3" transform="rotate(135) translate(0 -3.5)" />
      <ellipse rx="1.9" ry="3.3" transform="rotate(225) translate(0 -3.5)" />
      <ellipse rx="1.9" ry="3.3" transform="rotate(315) translate(0 -3.5)" />
      <circle r="1.6" fill="#9e2e27" />
    </g>
    <circle cx="33" cy="3" r="1.6" fill="#e3b85e" />
    <circle cx="3" cy="33" r="1.6" fill="#e3b85e" />
  </svg>
);

/**
 * The webcam under the stage, framed like a streamer's camera overlay but in
 * the theatre's carved-wood-and-gold language: gilded corners, a LIVE tag, a
 * warm glow that brightens as puppets are taken up, and a "Dalang" nameplate
 * whose two lamps light for the left and right puppet.
 */
export function WebcamPreview({
  videoRef,
  overlayRef,
  status,
  mirror,
  live,
  held,
  cameraEnabled,
  onEnable,
  simulated,
}: WebcamPreviewProps) {
  const active = status === 'active';
  const heldCount = Number(held.left) + Number(held.right);
  const className = ['webcam', live && 'webcam--live', heldCount > 0 && `webcam--held-${heldCount}`].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <div className="webcam__viewport">
        <video
          ref={videoRef}
          className={`webcam__video${mirror ? ' webcam__video--mirrored' : ''}${active ? ' webcam__video--on' : ''}`}
          autoPlay
          muted
          playsInline
          aria-label="Your camera preview"
        />
        <HandOverlay ref={overlayRef} />
        <div className="webcam__vignette" aria-hidden="true" />
        {live && (
          <span className="webcam__live" aria-hidden="true">
            <span className="webcam__live-dot" />
            {simulated ? 'Demo' : 'Live'}
          </span>
        )}
        {!active && !simulated && <CameraPrompt status={status} cameraEnabled={cameraEnabled} onEnable={onEnable} />}
      </div>

      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <span key={corner} className={`webcam__corner webcam__corner--${corner}`}>
          {CORNER}
        </span>
      ))}

      <div className="webcam__plate" aria-hidden="true">
        <span className={lampClass(held.left)} />
        <span className="webcam__name">Dalang</span>
        <span className={lampClass(held.right)} />
      </div>
    </div>
  );
}
