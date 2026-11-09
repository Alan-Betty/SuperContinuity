import type { Range } from '../types'

export const COMPLETE_RATIO = 0.9

/** Merge overlapping / touching ranges (gap tolerance in seconds). Returns a new sorted array. */
export function mergeRanges(ranges: Range[], tolerance = 1): Range[] {
  const sorted = ranges
    .filter(([a, b]) => b > a)
    .map(([a, b]) => [a, b] as Range)
    .sort((x, y) => x[0] - y[0])
  const out: Range[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && r[0] <= last[1] + tolerance) last[1] = Math.max(last[1], r[1])
    else out.push(r)
  }
  return out
}

export function addRange(ranges: Range[], r: Range): Range[] {
  return mergeRanges([...ranges, r])
}

/** Seconds of [start, end] covered by ranges. */
export function coveredSeconds(ranges: Range[], start: number, end: number): number {
  if (end <= start) return 0
  let total = 0
  for (const [a, b] of ranges) {
    const lo = Math.max(a, start)
    const hi = Math.min(b, end)
    if (hi > lo) total += hi - lo
  }
  return total
}

export function coverage(ranges: Range[], start: number, end: number): number {
  if (end <= start) return 0
  return Math.min(1, coveredSeconds(ranges, start, end) / (end - start))
}

/** Ranges clipped to [start, end] and expressed as fractions 0..1 of that span (for drawing). */
export function rangesAsFractions(ranges: Range[], start: number, end: number): Range[] {
  const span = end - start
  if (span <= 0) return []
  const out: Range[] = []
  for (const [a, b] of ranges) {
    const lo = Math.max(a, start)
    const hi = Math.min(b, end)
    if (hi > lo) out.push([(lo - start) / span, (hi - start) / span])
  }
  return out
}
