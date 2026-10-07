const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function SoundOnIcon() {
  return (
    <svg {...base}>
      <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4z" fill="currentColor" fillOpacity="0.18" />
      <path d="M15 9.2a4 4 0 0 1 0 5.6M17.6 6.8a7.4 7.4 0 0 1 0 10.4" />
    </svg>
  );
}

export function SoundOffIcon() {
  return (
    <svg {...base}>
      <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4z" fill="currentColor" fillOpacity="0.18" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...base}>
      <path d="M12 3.5l1.5 2.1 2.5-.6.6 2.5 2.1 1.5-1.2 2.3 1.2 2.3-2.1 1.5-.6 2.5-2.5-.6L12 20.5l-1.5-2.1-2.5.6-.6-2.5-2.1-1.5 1.2-2.3-1.2-2.3 2.1-1.5.6-2.5 2.5.6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function CameraIcon() {
  return (
    <svg {...base}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.4-2h6.2l1.4 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}

export function RetryIcon() {
  return (
    <svg {...base}>
      <path d="M19 12a7 7 0 1 1-2.1-5" />
      <path d="M19 4.5V8h-3.5" />
    </svg>
  );
}
