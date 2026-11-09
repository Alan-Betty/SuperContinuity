import { useStore, isLessonDone, lessonEnd, lessonWatched } from '../store/useStore'
import { rangesAsFractions } from '../lib/segments'
import { duration } from '../lib/format'
import type { Course } from '../types'

interface Props {
  course: Course
  currentId?: string
  onSelect?: (lessonId: string) => void
  /** Lesson that just completed: its knot plays the one celebratory animation. */
  celebrateId?: string
  compact?: boolean
}

/**
 * The course as one continuous line. Each lesson is a stretch of thread sized by its length;
 * the thread fills only where you actually watched. Finished lessons get a knot.
 */
export function Thread({ course, currentId, onSelect, celebrateId, compact = false }: Props) {
  const progress = useStore((s) => s.progress)
  const durations = useStore((s) => s.durations)
  const s = { progress, durations, courses: {} }

  const lengths = course.lessons.map((l) => Math.max(0, lessonEnd(s, l) - l.start))
  const allKnown = lengths.every((x) => x > 0)
  const avg = allKnown ? 0 : lengths.filter(Boolean).reduce((a, b) => a + b, 0) / Math.max(1, lengths.filter(Boolean).length) || 1

  const h = compact ? 'h-1' : 'h-2'
  const many = course.lessons.length > 60

  return (
    <div
      className={`flex w-full items-center ${many ? 'gap-px' : compact ? 'gap-0.5' : 'gap-[3px]'}`}
      role={onSelect ? 'group' : 'img'}
      aria-label={`${course.title}: lesson progress`}
    >
      {course.lessons.map((l, i) => {
        const end = lessonEnd(s, l)
        const done = isLessonDone({ ...s }, course, l)
        const fills = done ? [[0, 1] as [number, number]] : end ? rangesAsFractions(lessonWatched(s, course.id, l), l.start, end) : []
        const isCurrent = l.id === currentId
        const grow = allKnown ? lengths[i] : lengths[i] || avg
        const label = `${i + 1}. ${l.title}${end ? `, ${duration(end - l.start)}` : ''}${done ? ', finished' : ''}`
        const Seg = onSelect ? 'button' : 'span'
        return (
          <Seg
            key={l.id}
            {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(l.id), 'aria-current': isCurrent ? 'step' : undefined } : {})}
            title={label}
            aria-label={onSelect ? label : undefined}
            className={`group relative flex min-w-[3px] items-center ${compact ? 'py-0' : 'py-2'} ${onSelect ? 'cursor-pointer' : ''}`}
            style={{ flexGrow: grow, flexBasis: 0 }}
          >
            <span
              className={`relative block w-full overflow-hidden rounded-full bg-thread ${isCurrent && !compact ? 'h-3.5' : h} ${
                onSelect ? 'transition-[filter] group-hover:brightness-90' : ''
              }`}
            >
              {fills.map(([a, b], k) => (
                <span key={k} className="absolute inset-y-0 bg-focus" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%` }} />
              ))}
              {isCurrent && !compact && <span className="absolute inset-0 rounded-full ring-2 ring-inset ring-ink/25" />}
            </span>
            {done && !compact && !many && (
              <span
                className={`absolute -right-[5px] top-1/2 z-10 size-2.5 -translate-y-1/2 rounded-full border-2 border-ground bg-focus ${
                  l.id === celebrateId ? 'animate-knot' : ''
                }`}
              />
            )}
          </Seg>
        )
      })}
    </div>
  )
}
