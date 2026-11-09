import type { Activity } from '../types'

export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

/** A day counts toward the streak with at least this many focused seconds. */
export const STREAK_MIN_SECONDS = 10 * 60

/** Consecutive qualifying days ending today (or yesterday, if today isn't done yet). */
export function streak(activity: Activity, today: Date = new Date()): number {
  const ok = (d: Date) => (activity[dayKey(d)] ?? 0) >= STREAK_MIN_SECONDS
  let cursor = ok(today) ? today : addDays(today, -1)
  let n = 0
  while (ok(cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

export interface XpInput {
  focusedSeconds: number
  lessonsCompleted: number
  recallNotes: number
  coursesCompleted: number
}

export function xp({ focusedSeconds, lessonsCompleted, recallNotes, coursesCompleted }: XpInput): number {
  return Math.floor(focusedSeconds / 60) + lessonsCompleted * 20 + recallNotes * 10 + coursesCompleted * 150
}

/** Level n needs 50·n² total XP (level 1 at 0). */
export function level(totalXp: number): { level: number; into: number; span: number } {
  const lvl = Math.floor(Math.sqrt(totalXp / 50)) + 1
  const base = 50 * (lvl - 1) ** 2
  const next = 50 * lvl ** 2
  return { level: lvl, into: totalXp - base, span: next - base }
}

/** Average focused seconds per active day over the last `days` days. */
export function averageDaily(activity: Activity, days = 14, today: Date = new Date()): number {
  let total = 0
  let active = 0
  for (let i = 0; i < days; i++) {
    const s = activity[dayKey(addDays(today, -i))] ?? 0
    if (s > 0) {
      total += s
      active++
    }
  }
  return active ? total / active : 0
}

/** Days to finish `remainingSeconds` at `perDaySeconds`. Falls back to the daily goal. */
export function etaDays(remainingSeconds: number, perDaySeconds: number): number {
  if (remainingSeconds <= 0) return 0
  if (perDaySeconds <= 0) return Infinity
  return Math.ceil(remainingSeconds / perDaySeconds)
}

export function totalFocused(activity: Activity): number {
  return Object.values(activity).reduce((a, b) => a + b, 0)
}
