import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react'
import { useToasts } from './toast'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'quiet' | 'ghost' | 'rest' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-ground hover:bg-ink/85',
  quiet: 'bg-surface text-ink border border-line hover:border-muted/60',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
  rest: 'bg-rest text-white hover:bg-rest/90',
  danger: 'text-danger hover:bg-danger/10',
}

export function Button({
  variant = 'quiet',
  icon,
  children,
  className = '',
  size = 'md',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; icon?: IconName; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 px-2.5 text-[13px] gap-1.5', md: 'h-10 px-3.5 text-sm gap-2', lg: 'h-12 px-5 text-[15px] gap-2' }
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  )
}

export function IconButton({
  icon,
  label,
  className = '',
  active = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-grid size-9 shrink-0 place-items-center rounded-lg transition-colors ${
        active ? 'bg-focus-soft text-focus' : 'text-muted hover:bg-sunken hover:text-ink'
      } ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  )
}

/** Circular progress ring. `value` 0..1. */
export function Ring({
  value,
  size = 40,
  stroke = 4,
  tone = 'focus',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: 'focus' | 'rest' | 'ink'
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  const color = { focus: 'stroke-focus', rest: 'stroke-rest', ink: 'stroke-ink' }[tone]
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-thread" />
        {v > 0 && <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className={`${color} transition-[stroke-dashoffset] duration-500`}
        />}
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  )
}

export function Toaster() {
  const items = useToasts((s) => s.items)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-rise rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
            t.tone === 'focus' ? 'bg-focus text-white' : t.tone === 'rest' ? 'bg-rest text-white' : 'bg-ink text-ground'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid min-w-[1.5rem] place-items-center rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-xs text-muted">
      {children}
    </kbd>
  )
}
