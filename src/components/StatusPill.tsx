import { useEffect, useState } from 'react';
import type { StageStatus } from '../lib/status';

interface Entry extends StageStatus {
  id: number;
}

const FADE_MS = 220;

/** Small capsule at the stage's lower left; crossfades between messages. */
export function StatusPill({ status }: { status: StageStatus }) {
  const [current, setCurrent] = useState<Entry>({ ...status, id: 0 });
  const [previous, setPrevious] = useState<Entry | null>(null);

  if (status.text !== current.text || status.tone !== current.tone) {
    setPrevious(current);
    setCurrent({ ...status, id: current.id + 1 });
  }

  useEffect(() => {
    if (!previous) return;
    const timer = window.setTimeout(() => setPrevious(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [previous]);

  return (
    <div className={`status status--${current.tone}`} role="status" aria-live="polite">
      <span className="status__dot" aria-hidden="true" />
      <span className="status__text">
        <span key={current.id} className="status__line status__line--in">
          {current.text}
        </span>
        {previous && (
          <span key={previous.id} className="status__line status__line--out" aria-hidden="true">
            {previous.text}
          </span>
        )}
      </span>
    </div>
  );
}
