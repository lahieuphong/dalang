import type { ReactNode, Ref } from 'react';
import { StageScene, type StageSceneHandle } from './StageScene';

const CORNER = (
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <path d="M3 37 V12 C3 7 7 3 12 3 H37" fill="none" stroke="#e3b85e" strokeWidth="1.6" />
    <path d="M8 30 C8 18 18 8 30 8" fill="none" stroke="#c99545" strokeWidth="1.1" opacity="0.8" />
    <path d="M10 10 C14 12 15 15 13 18 C11 15 9 13 10 10 Z M10 10 C12 14 15 15 18 13 C15 11 13 9 10 10 Z" fill="#e3b85e" />
    <circle cx="10" cy="10" r="2" fill="#9e2e27" stroke="#e3b85e" strokeWidth="0.8" />
  </svg>
);

/**
 * The ornate theatre: carved frame, lamp-lit parchment screen, the puppet
 * scene, and slots for the in-stage UI (controls and status).
 */
export function TheaterStage({ sceneRef, children }: { sceneRef: Ref<StageSceneHandle>; children: ReactNode }) {
  return (
    <section className="theater" aria-label="Wayang Kulit shadow theatre">
      <div className="theater__frame">
        {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
          <span key={corner} className={`theater__corner theater__corner--${corner}`}>
            {CORNER}
          </span>
        ))}
        <div className="theater__screen">
          <div className="screen__paper" />
          <div className="screen__lamp" />
          <StageScene ref={sceneRef} />
          <div className="screen__vignette" />
          {children}
        </div>
      </div>
    </section>
  );
}
