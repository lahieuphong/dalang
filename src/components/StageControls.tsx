import { useCallback, useRef, useState } from 'react';
import type { Settings } from '../types';
import { GearIcon, SoundOffIcon, SoundOnIcon } from './icons';
import { SettingsPopover } from './SettingsPopover';

interface StageControlsProps {
  soundOn: boolean;
  soundAvailable: boolean;
  onToggleSound: () => void;
  settings: Settings;
  cameraOn: boolean;
  cameraAvailable: boolean;
  onCameraChange: (on: boolean) => void;
  onSettingsChange: (patch: Partial<Settings>) => void;
}

/** The two round controls in the theatre's top-right corner. */
export function StageControls({
  soundOn,
  soundAvailable,
  onToggleSound,
  settings,
  cameraOn,
  cameraAvailable,
  onCameraChange,
  onSettingsChange,
}: StageControlsProps) {
  const [open, setOpen] = useState(false);
  const settingsButton = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) settingsButton.current?.focus();
  }, []);

  const soundLabel = !soundAvailable ? 'Sound unavailable' : soundOn ? 'Turn sound off' : 'Turn sound on';

  return (
    <div className="controls">
      <button
        type="button"
        className="control"
        aria-pressed={soundOn}
        aria-label={soundLabel}
        title={soundLabel}
        disabled={!soundAvailable}
        onClick={onToggleSound}
      >
        {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
      </button>
      <button
        ref={settingsButton}
        type="button"
        className="control"
        aria-label="Settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <GearIcon />
      </button>
      {open && (
        <SettingsPopover
          settings={settings}
          cameraOn={cameraOn}
          cameraAvailable={cameraAvailable}
          onCameraChange={onCameraChange}
          onChange={onSettingsChange}
          onClose={close}
          triggerRef={settingsButton}
        />
      )}
    </div>
  );
}
