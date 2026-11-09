import { useEffect, useRef } from 'react'
import { isLessonDone, lessonCoverage, lessonLength, useStore } from '../store/useStore'
import { duration } from '../lib/format'
import type { Course } from '../types'
import { Icon } from './Icon'

export function LessonList({ course, currentId, onSelect }: { course: Course; currentId: string; onSelect(id: string): void }) {
  const progress = useStore((s) => s.progress)
  const durations = useStore((s) => s.durations)
  const s = { progress, durations, courses: {} }
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  return (
    <ol ref={listRef} className="scroll-quiet space-y-px overflow-y-auto">
      {course.lessons.map((l, i) => {
        const done = isLessonDone(s, course, l)
        const cov = lessonCoverage(s, course.id, l)
        const len = lessonLength(s, l)
        const current = l.id === currentId
        return (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onSelect(l.id)}
              aria-current={current}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                current ? 'bg-focus-soft' : 'hover:bg-sunken'
              }`}
            >
              <span
                className={`num mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  done ? 'bg-focus text-white' : current ? 'bg-ink text-ground' : 'bg-sunken text-muted'
                }`}
              >
                {done ? <Icon name="check" size={13} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`line-clamp-2 text-sm leading-snug ${done && !current ? 'text-muted' : ''} ${current ? 'font-medium' : ''}`}>
                  {l.title}
                </span>
                <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                  {len > 0 && <span className="num">{duration(len)}</span>}
                  {!done && cov > 0.02 && (
                    <span className="flex flex-1 items-center gap-2">
                      <span className="h-1 max-w-24 flex-1 overflow-hidden rounded-full bg-thread">
                        <span className="block h-full bg-focus" style={{ width: `${cov * 100}%` }} />
                      </span>
                      <span className="num">{Math.round(cov * 100)}%</span>
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
