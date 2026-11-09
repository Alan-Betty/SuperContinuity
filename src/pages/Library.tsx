import { useMemo, useState } from 'react'
import { ImportBox } from '../components/ImportBox'
import { Thread } from '../components/Thread'
import { Heatmap } from '../components/Heatmap'
import { SettingsDialog } from '../components/SettingsDialog'
import { Icon } from '../components/Icon'
import { Button, IconButton, Ring } from '../components/ui'
import { progressKey, summarize, useStore } from '../store/useStore'
import { dayKey, level, streak, totalFocused, xp } from '../lib/stats'
import { clock, duration, plural } from '../lib/format'
import { thumbnail } from '../lib/youtube'
import { coursePath, navigate } from '../lib/router'
import type { Course } from '../types'

export function Library() {
  const courses = useStore((s) => s.courses)
  const progress = useStore((s) => s.progress)
  const durations = useStore((s) => s.durations)
  const activity = useStore((s) => s.activity)
  const notes = useStore((s) => s.notes)
  const settings = useStore((s) => s.settings)
  const removeCourse = useStore((s) => s.removeCourse)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const s = { progress, durations, courses }
  const list = useMemo(
    () => Object.values(courses).sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt)),
    [courses],
  )
  const summaries = new Map(list.map((c) => [c.id, summarize(s, c)]))
  const recent = list.find((c) => !c.completedAt && c.lastOpenedAt)

  const today = activity[dayKey()] ?? 0
  const goal = settings.dailyGoalMinutes * 60
  const totalXp = xp({
    focusedSeconds: totalFocused(activity),
    lessonsCompleted: [...summaries.values()].reduce((a, x) => a + x.done, 0),
    recallNotes: notes.filter((n) => n.kind === 'recall').length,
    coursesCompleted: list.filter((c) => c.completedAt).length,
  })
  const lvl = level(totalXp)
  const days = streak(activity)
  const empty = list.length === 0

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <a href="#/" className="flex items-center gap-2.5 rounded-md">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="8" className="fill-ink" />
            <path d="M5 16h7m4 0h11" stroke="var(--focus)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="14" cy="16" r="3.2" fill="var(--rest)" />
          </svg>
          <span className="font-display text-[19px] font-semibold tracking-tight">SuperContinuity</span>
        </a>
        <IconButton icon="settings" label="Settings" onClick={() => setSettingsOpen(true)} />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        {empty ? (
          <section className="pt-20 sm:pt-28">
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-6xl">
              Turn any YouTube course into one you’ll actually finish.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Paste a playlist or a long video. You’ll watch it in short focused sessions with real breaks, and it remembers exactly which
              parts you’ve seen.
            </p>
            <div className="mt-8 max-w-2xl">
              <ImportBox large />
            </div>
            <EmptyThread />
          </section>
        ) : (
          <>
            {recent && <ContinueBlock course={recent} />}

            <section aria-label="Your progress" className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-6 border-y border-line py-5">
              <div className="flex items-center gap-3">
                <Ring value={goal ? today / goal : 0} size={52} stroke={5}>
                  <span className="num text-[13px] font-semibold">{Math.floor(today / 60)}</span>
                </Ring>
                <div className="leading-tight">
                  <p className="text-sm font-medium">{today >= goal ? 'Goal reached today' : `${duration(Math.max(0, goal - today))} to today’s goal`}</p>
                  <p className="text-xs text-muted">Goal is {duration(goal)} a day</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Icon name="flame" size={26} className={days > 0 ? 'text-rest' : 'text-thread'} />
                <div className="leading-tight">
                  <p className="num text-sm font-medium">{plural(days, 'day')} in a row</p>
                  <p className="text-xs text-muted">{days > 0 ? 'Keep it going with 10 minutes today' : 'Watch 10 minutes to start a streak'}</p>
                </div>
              </div>
              <div className="min-w-44 flex-1 leading-tight sm:max-w-56">
                <p className="num text-sm font-medium">
                  Level {lvl.level} <span className="font-normal text-muted">with {totalXp} XP</span>
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-thread">
                  <div className="h-full rounded-full bg-ink transition-[width] duration-700" style={{ width: `${(lvl.into / lvl.span) * 100}%` }} />
                </div>
                <p className="num mt-1 text-xs text-muted">{lvl.span - lvl.into} XP to level {lvl.level + 1}</p>
              </div>
              <div className="ml-auto hidden md:block">
                <Heatmap activity={activity} goalSeconds={goal} />
              </div>
            </section>

            <section className="mt-10" aria-labelledby="courses-title">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 id="courses-title" className="font-display text-2xl font-semibold tracking-tight">
                  Your courses
                </h2>
              </div>
              <div className="mt-4">
                <ImportBox />
              </div>
              <ul className="mt-4 divide-y divide-line">
                {list.map((c) => (
                  <CourseRow
                    key={c.id}
                    course={c}
                    onRemove={() => {
                      if (confirm(`Remove “${c.title}”? Its progress and notes will be deleted.`)) removeCourse(c.id)
                    }}
                  />
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

function ContinueBlock({ course }: { course: Course }) {
  const progress = useStore((s) => s.progress)
  const durations = useStore((s) => s.durations)
  const sum = summarize({ progress, durations, courses: {} }, course)
  const lesson = course.lessons.find((l) => l.id === course.lastLessonId) ?? sum.nextLesson ?? course.lessons[0]
  const index = course.lessons.indexOf(lesson)
  const pos = progress[progressKey(course.id, lesson.videoId)]?.position ?? lesson.start
  const left = Math.max(0, sum.length - sum.watchedSeconds)

  return (
    <section aria-label="Continue where you left off" className="mt-10 grid items-center gap-6 sm:mt-14 sm:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <p className="text-sm text-muted">Pick up where you left off</p>
        <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-[-0.015em] sm:text-[2.6rem]">{course.title}</h1>
        <p className="mt-2 text-[15px]">
          <span className="num text-muted">Lesson {index + 1}.</span> {lesson.title}
        </p>
        <div className="mt-5">
          <Thread course={course} currentId={lesson.id} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="primary" size="lg" icon="play" onClick={() => navigate(coursePath(course.id))}>
            Resume at {clock(pos)}
          </Button>
          <span className="num text-sm text-muted">
            {Math.round(sum.ratio * 100)}% done{sum.unknown === 0 && left > 0 ? `, ${duration(left)} left` : ''}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(coursePath(course.id))}
        className="group relative hidden aspect-video overflow-hidden rounded-xl bg-sunken sm:block"
        aria-label={`Resume ${course.title}`}
      >
        <img src={thumbnail(lesson.videoId, 'hq')} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute inset-0 grid place-items-center bg-black/10">
          <span className="grid size-14 place-items-center rounded-full bg-white/90 text-[#1b2230] shadow-lg">
            <Icon name="play" size={24} />
          </span>
        </span>
      </button>
    </section>
  )
}

function CourseRow({ course, onRemove }: { course: Course; onRemove(): void }) {
  const progress = useStore((s) => s.progress)
  const durations = useStore((s) => s.durations)
  const sum = summarize({ progress, durations, courses: {} }, course)
  const next = sum.nextLesson ?? course.lessons[0]
  const left = Math.max(0, sum.length - sum.watchedSeconds)

  return (
    <li className="group flex items-center gap-4 py-4">
      <a href={coursePath(course.id)} className="relative hidden aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-sunken sm:block">
        {next && <img src={thumbnail(next.videoId)} alt="" loading="lazy" className="size-full object-cover" />}
        {course.completedAt && (
          <span className="absolute inset-0 grid place-items-center bg-focus/80 text-white">
            <Icon name="check" size={28} />
          </span>
        )}
      </a>
      <div className="min-w-0 flex-1">
        <a href={coursePath(course.id)} className="rounded-sm">
          <h3 className="truncate font-display text-[17px] font-semibold tracking-tight group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">
            {course.title}
          </h3>
        </a>
        <p className="num mt-0.5 truncate text-[13px] text-muted">
          {course.author && <span>{course.author}, </span>}
          {sum.done} of {plural(sum.total, 'lesson')}
          {course.completedAt ? ', finished' : sum.unknown === 0 && left > 0 ? `, ${duration(left)} left` : ''}
        </p>
        <div className="mt-2.5 max-w-xl">
          <Thread course={course} compact />
        </div>
      </div>
      <span className="num hidden w-12 text-right font-display text-xl font-semibold sm:block">{Math.round(sum.ratio * 100)}%</span>
      <IconButton icon="trash" label={`Remove ${course.title}`} onClick={onRemove} className="opacity-60 hover:text-danger group-hover:opacity-100" />
    </li>
  )
}

/** A quiet illustration of the course thread for the empty state. */
function EmptyThread() {
  const parts = [
    { w: 9, fill: 1 },
    { w: 14, fill: 1 },
    { w: 7, fill: 1 },
    { w: 12, fill: 0.55 },
    { w: 10, fill: 0 },
    { w: 16, fill: 0 },
    { w: 8, fill: 0 },
    { w: 13, fill: 0 },
    { w: 11, fill: 0 },
  ]
  return (
    <div className="mt-20 max-w-3xl" aria-hidden="true">
      <div className="flex items-center gap-[3px]">
        {parts.map((p, i) => (
          <span key={i} className="relative h-2 overflow-hidden rounded-full bg-thread" style={{ flexGrow: p.w, flexBasis: 0 }}>
            <span className="absolute inset-y-0 left-0 bg-focus" style={{ width: `${p.fill * 100}%` }} />
          </span>
        ))}
      </div>
      <div className="mt-4 grid gap-6 text-sm text-muted sm:grid-cols-3">
        <p>
          <span className="font-medium text-ink">Sessions with breaks.</span> 25 minutes of focus, then a short break with a one-line recall
          prompt.
        </p>
        <p>
          <span className="font-medium text-ink">Real progress.</span> The thread fills only where you actually watched, not where you skipped to.
        </p>
        <p>
          <span className="font-medium text-ink">A daily limit.</span> It tells you when to stop for the day, so you come back tomorrow.
        </p>
      </div>
    </div>
  )
}
