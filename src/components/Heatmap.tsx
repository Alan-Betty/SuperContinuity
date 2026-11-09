import { addDays, dayKey } from '../lib/stats'
import { duration } from '../lib/format'
import type { Activity } from '../types'

const WEEKS = 16

/** Last 16 weeks of focused time, one square per day, columns are weeks (Mon first). */
export function Heatmap({ activity, goalSeconds }: { activity: Activity; goalSeconds: number }) {
  const today = new Date()
  const dow = (today.getDay() + 6) % 7 // Mon=0
  const start = addDays(today, -(WEEKS - 1) * 7 - dow)
  const cols = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d)
      const future = date > today
      const secs = activity[dayKey(date)] ?? 0
      return { date, future, secs }
    }),
  )
  const level = (secs: number) => (secs <= 0 ? 0 : secs < goalSeconds * 0.34 ? 1 : secs < goalSeconds * 0.67 ? 2 : secs < goalSeconds ? 3 : 4)
  const shade = ['bg-thread', 'bg-focus/30', 'bg-focus/55', 'bg-focus/80', 'bg-focus']

  return (
    <div className="flex gap-[3px]" role="img" aria-label="Focused time per day, last 16 weeks">
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map(({ date, future, secs }) => (
            <span
              key={date.toISOString()}
              title={future ? undefined : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${duration(secs)}`}
              className={`size-[11px] rounded-[3px] ${future ? 'bg-transparent' : shade[level(secs)]}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
