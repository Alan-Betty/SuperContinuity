const PATHS = {
  play: 'M7 5.5v13l11-6.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  back: 'M15 5l-7 7 7 7',
  settings:
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm7.4-3.2c0-.5 0-1-.1-1.4l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.4-1.4L14 2.6h-4l-.5 2.6c-.9.3-1.7.8-2.4 1.4l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 2.8l-2 1.6 2 3.4 2.4-1c.7.6 1.5 1.1 2.4 1.4l.5 2.6h4l.5-2.6c.9-.3 1.7-.8 2.4-1.4l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.4z',
  note: 'M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5',
  bookmark: 'M7 4h10v16l-5-4-5 4z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  skip: 'M6 5.5v13l9-6.5zM17 5v14',
  stop: 'M7 7h10v10H7z',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 9.5l5-5 5 5M5 20h14',
  flame: 'M12 3c1 3.5 5 5.6 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.4-4.6.2 1.6 1 2.6 2.1 3C11 9 11.2 5.8 12 3z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  keyboard: 'M3 7h18v10H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
} as const

export type IconName = keyof typeof PATHS

const FILLED: IconName[] = ['play', 'pause', 'skip', 'stop', 'flame']

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  const filled = FILLED.includes(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
