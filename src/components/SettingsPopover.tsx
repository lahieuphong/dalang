import { useEffect, useId, useRef, type CSSProperties, type RefObject } from 'react';
import type { Settings } from '../types';

interface SettingsPopoverProps {
  settings: Settings;
  cameraOn: boolean;
  cameraAvailable: boolean;
  onCameraChange: (on: boolean) => void;
  onChange: (patch: Partial<Settings>) => void;
  onClose: (returnFocus: boolean) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="settings__row settings__toggle"
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <span className="switch" aria-hidden="true">
        <span className="switch__knob" />
      </span>
    </button>
  );
}

function Slider({
  label,
  value,
  low,
  high,
  onChange,
}: {
  label: string;
  value: number;
  low: string;
  high: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="settings__slider">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-valuetext={`${Math.round(value * 100)}%`}
        style={{ '--fill': `${value * 100}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="settings__scale" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

/** Compact settings panel. Closes on outside click and Escape; focus moves in on open and back on close. */
export function SettingsPopover({
  settings,
  cameraOn,
  cameraAvailable,
  onCameraChange,
  onChange,
  onClose,
  triggerRef,
}: SettingsPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button:not([disabled]), input')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(true);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, triggerRef]);

  return (
    <div ref={panelRef} className="settings" role="dialog" aria-labelledby={titleId}>
      <h2 id={titleId} className="settings__title">
        Settings
      </h2>
      <Toggle label="Camera" checked={cameraOn} disabled={!cameraAvailable} onChange={onCameraChange} />
      <Toggle label="Hand landmarks" checked={settings.showLandmarks} onChange={(showLandmarks) => onChange({ showLandmarks })} />
      <Toggle label="Mirror preview" checked={settings.mirror} onChange={(mirror) => onChange({ mirror })} />
      <Slider
        label="Motion sensitivity"
        value={settings.sensitivity}
        low="Calm"
        high="Lively"
        onChange={(sensitivity) => onChange({ sensitivity })}
      />
      <Slider
        label="Motion smoothing"
        value={settings.smoothing}
        low="Crisp"
        high="Floating"
        onChange={(smoothing) => onChange({ smoothing })}
      />
    </div>
  );
}
