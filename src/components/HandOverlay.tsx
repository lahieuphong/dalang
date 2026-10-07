import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { drawHands } from '../lib/drawHands';
import type { AssignedHands, HandFrame } from '../types';

export interface HandOverlayHandle {
  draw(frame: HandFrame, assigned: AssignedHands, video: HTMLVideoElement | null): void;
  clear(): void;
}

/** Transparent canvas over the webcam preview, sized for the device pixel ratio. */
export function HandOverlay({ ref }: { ref?: Ref<HandOverlayHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useRef({ width: 0, height: 0 });
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.current = { width: rect.width, height: rect.height };
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty.current = false;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      draw(frame, assigned, video) {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        drawHands(ctx, frame, assigned, {
          width: size.current.width,
          height: size.current.height,
          // Simulated frames have no video; assume a 16:9 source.
          videoWidth: video?.videoWidth || 16,
          videoHeight: video?.videoHeight || 9,
        });
        dirty.current = frame.hands.length > 0;
      },
      clear() {
        if (!dirty.current) return;
        canvasRef.current?.getContext('2d')?.clearRect(0, 0, size.current.width, size.current.height);
        dirty.current = false;
      },
    }),
    [],
  );

  return <canvas ref={canvasRef} className="webcam__overlay" aria-hidden="true" />;
}
