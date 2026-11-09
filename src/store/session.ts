import { create } from 'zustand'
import { dayKey } from '../lib/stats'
import { useStore } from './useStore'

/**
 * Focus/break session state machine. Not persisted: a reload ends the session,
 * but the watch-time it produced is already saved in `activity`.
 *
 *   idle ──start──▶ focus ──timer──▶ break ──timer──▶ ready ──start──▶ focus …
 *                     │                 └──skip────────────────────────▲
 *                     └──stop──▶ idle
 */
export type Phase = 'idle' | 'focus' | 'break' | 'ready'

interface SessionState {
  phase: Phase
  /** Seconds left in the current phase. */
  remaining: number
  /** Seconds the current phase started with (for the ring). */
  length: number
  paused: boolean
  /** Focus sessions finished today. */
  completed: number
  completedDay: string
  longBreak: boolean
  /** Day on which the learner chose to keep going past the daily cap. */
  capOverride: string | null

  start(): void
  stop(): void
  togglePause(): void
  skipBreak(): void
  tick(seconds: number): void
  overrideCap(): void
}

const settings = () => useStore.getState().settings

export const useSession = create<SessionState>()((set, get) => ({
  phase: 'idle',
  remaining: 0,
  length: 0,
  paused: false,
  completed: 0,
  completedDay: dayKey(),
  longBreak: false,
  capOverride: null,

  start() {
    const len = settings().focusMinutes * 60
    set({ phase: 'focus', remaining: len, length: len, paused: false })
  },
  stop() {
    set({ phase: 'idle', remaining: 0, length: 0, paused: false })
  },
  togglePause() {
    if (get().phase === 'focus') set((s) => ({ paused: !s.paused }))
  },
  skipBreak() {
    if (get().phase === 'break' || get().phase === 'ready') get().start()
  },
  overrideCap() {
    set({ capOverride: dayKey() })
  },
  tick(seconds) {
    const s = get()
    if (s.phase !== 'focus' && s.phase !== 'break') return
    if (s.paused) return
    const remaining = s.remaining - seconds
    if (remaining > 0) {
      set({ remaining })
      return
    }
    if (s.phase === 'focus') {
      const today = dayKey()
      const completed = (s.completedDay === today ? s.completed : 0) + 1
      const cfg = settings()
      const longBreak = completed % Math.max(1, cfg.sessionsBeforeLongBreak) === 0
      const len = (longBreak ? cfg.longBreakMinutes : cfg.breakMinutes) * 60
      set({ phase: 'break', remaining: len, length: len, completed, completedDay: today, longBreak })
    } else {
      set({ phase: 'ready', remaining: 0, length: 0 })
    }
  },
}))

/** True when today's focused time has reached the daily cap and the learner hasn't overridden it. */
export function overCap(): boolean {
  const { activity, settings: cfg } = useStore.getState()
  const today = dayKey()
  if (useSession.getState().capOverride === today) return false
  return cfg.dailyCapMinutes > 0 && (activity[today] ?? 0) >= cfg.dailyCapMinutes * 60
}
