import { useImperativeHandle, useRef, type Ref } from 'react';

export interface DebugPanelHandle {
  /** Re-renders the panel text at most ~6 times a second; `describe` is only called when it does. */
  update(now: number, describe: () => string): void;
}

/** Developer readout, shown only with `?debug=1`. Written straight to the DOM to stay out of React renders. */
export function DebugPanel({ ref }: { ref?: Ref<DebugPanelHandle> }) {
  const textRef = useRef<HTMLPreElement>(null);
  const lastUpdate = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      update(now, describe) {
        if (now - lastUpdate.current < 160 || !textRef.current) return;
        lastUpdate.current = now;
        textRef.current.textContent = describe();
      },
    }),
    [],
  );

  return (
    <aside className="debug" aria-label="Tracking debug information">
      <pre ref={textRef} />
    </aside>
  );
}
