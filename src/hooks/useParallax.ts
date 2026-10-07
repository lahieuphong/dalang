import { useEffect } from 'react';

/**
 * Publishes the pointer position as --par-x / --par-y (-1..1) on the root
 * element for the extremely subtle depth parallax. Off for touch input and
 * reduced motion.
 */
export function useParallax(enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement;
    const reset = () => {
      root.style.setProperty('--par-x', '0');
      root.style.setProperty('--par-y', '0');
    };
    if (!enabled || !window.matchMedia('(pointer: fine)').matches) {
      reset();
      return;
    }

    let frame = 0;
    let x = 0;
    let y = 0;
    const onMove = (event: PointerEvent) => {
      x = (event.clientX / window.innerWidth) * 2 - 1;
      y = (event.clientY / window.innerHeight) * 2 - 1;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        root.style.setProperty('--par-x', x.toFixed(3));
        root.style.setProperty('--par-y', y.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
      reset();
    };
  }, [enabled]);
}
