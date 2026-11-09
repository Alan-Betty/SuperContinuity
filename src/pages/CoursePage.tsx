import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Player, type PlayerHandle } from '../components/Player'
import { Thread } from '../components/Thread'
import { LessonList } from '../components/LessonList'
import { NotesPanel } from '../components/NotesPanel'
import { BreakOverlay, CapScreen, SessionPill } from '../components/Session'
import { Icon } from '../components/Icon'
import { Button, IconButton, Kbd } from '../components/ui'
import { toast } from '../components/toast'
import { isLessonDone, summarize, useStore } from '../store/useStore'
import { overCap, useSession } from '../store/session'
import { averageDaily, etaDays } from '../lib/stats'
import { clock, plural } from '../lib/format'
import { watchUrl } from '../lib/youtube'
import { navigate } from '../lib/router'
import type { Course } from '../types'

/** The focus timer keeps running this long after a pause (note-taking), then holds. */
const HOLD_AFTER_MS = 90_000

export function CoursePage({ courseId }: { courseId: string }) {
  const course = useStore((s) => s.courses[courseId])
  if (!course) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">This course isn’t in your library</h1>
        <p className="mt-2 text-muted">It may have been removed, or the link came from another browser.</p>
        <Button variant="primary" className="mt-6" onClick={() => navigate('#/')}>
          Go to library
        </Button>
      </main>
    )
  }
  return <CourseView course={course} />
}

function CourseView({ course }: { course: Course }) {
  const progress = useStore((s) => s.progress)
  const durations = useStore((s) => s.durations)
  const activity = useStore((s) => s.activity)
  const settings = useStore((s) => s.settings)
  const openLesson = useStore((s) => s.openLesson)
  const addNote = useStore((s) => s.addNote)
  const toggleManualDone = useStore((s) => s.toggleManualDone)
  const recordWatch = useStore((s) => s.recordWatch)
  const phase = useSession((s) => s.phase)

  const s = { progress, durations, courses: {} }
  const summary = summarize(s, course)

  const currentId =
    course.lessons.find((l) => l.id === course.lastLessonId)?.id ?? summary.nextLesson?.id ?? course.lessons[0]?.id
  const index = course.lessons.findIndex((l) => l.id === currentId)
  const lesson = course.lessons[index]

  const handle = useRef<PlayerHandle | null>(null)
  const noteInput = useRef<HTMLTextAreaElement | null>(null)
  const [autoplay, setAutoplay] = useState(false)
  const [tab, setTab] = useState<'lessons' | 'notes'>('lessons')
  const [playing, setPlaying] = useState(false)
  const [holding, setHolding] = useState(false)
  const [capOpen, setCapOpen] = useState(false)
  const [celebrateId, setCelebrateId] = useState<string>()
  const [helpOpen, setHelpOpen] = useState(false)
  const lastPlayingAt = useRef(0)

  // Mark the course as opened (for "Continue" on the library).
  useEffect(() => {
    if (currentId) openLesson(course.id, currentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.id])

  const select = useCallback(
    (id: string, play?: boolean) => {
      if (play !== undefined) setAutoplay(play)
      else setAutoplay(handle.current?.playing() ?? false)
      openLesson(course.id, id)
    },
    [course.id, openLesson],
  )

  /* ---------- celebrate newly finished lessons ---------- */
  const doneIds = course.lessons.filter((l) => isLessonDone(s, course, l)).map((l) => l.id)
  const doneKey = doneIds.join('|')
  const prevDone = useRef<Set<string> | null>(null)
  useEffect(() => {
    const now = new Set(doneIds)
    const prev = prevDone.current
    prevDone.current = now
    if (!prev) return
    const fresh = doneIds.find((id) => !prev.has(id))
    if (!fresh) return
    setCelebrateId(fresh)
    if (now.size === course.lessons.length) toast(`Course finished. All ${course.lessons.length} lessons. +150 XP`, 'focus')
    else toast('Lesson finished. +20 XP', 'focus')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneKey])

  /* ---------- sessions ---------- */
  const startSession = useCallback(() => {
    if (overCap()) {
      setCapOpen(true)
      return
    }
    useSession.getState().start()
    handle.current?.play()
  }, [])

  const onPlayingChange = useCallback((isPlaying: boolean) => {
    setPlaying(isPlaying)
    if (!isPlaying) {
      lastPlayingAt.current = Date.now()
      return
    }
    if (overCap()) {
      handle.current?.pause()
      setCapOpen(true)
      return
    }
    const ph = useSession.getState().phase
    if (ph === 'idle' || ph === 'ready') useSession.getState().start()
    else if (ph === 'break') handle.current?.pause()
  }, [])

  // Pause the video when a break begins.
  useEffect(() => {
    if (phase === 'break') handle.current?.pause()
  }, [phase])

  // Session clock. Focus time holds when the video has been paused for a while.
  useEffect(() => {
    const iv = window.setInterval(() => {
      const ss = useSession.getState()
      if (ss.phase === 'focus') {
        const isPlaying = handle.current?.playing() ?? false
        if (isPlaying) lastPlayingAt.current = Date.now()
        const hold = !isPlaying && Date.now() - lastPlayingAt.current > HOLD_AFTER_MS
        setHolding(hold)
        if (!hold) ss.tick(1)
        if (isPlaying && overCap()) {
          handle.current?.pause()
          setCapOpen(true)
        }
      } else if (ss.phase === 'break') {
        ss.tick(1)
      }
    }, 1000)
    return () => window.clearInterval(iv)
  }, [])

  /* ---------- lesson flow ---------- */
  const onLessonEnd = useCallback(() => {
    const next = course.lessons[index + 1]
    if (!next) {
      toast('That was the last lesson.')
      return
    }
    if (settings.autoAdvance && useSession.getState().phase !== 'break') select(next.id, true)
    else {
      handle.current?.pause()
      select(next.id, false)
    }
  }, [course.lessons, index, settings.autoAdvance, select])

  const seekTo = useCallback(
    (lessonId: string, t: number) => {
      const l = course.lessons.find((x) => x.id === lessonId)
      if (!l) return
      if (lessonId === currentId) {
        handle.current?.seek(t)
        return
      }
      recordWatch(course.id, l.videoId, null, t, 0)
      select(lessonId)
      if (l.videoId === lesson?.videoId) handle.current?.seek(t)
    },
    [course.id, course.lessons, currentId, lesson?.videoId, recordWatch, select],
  )

  const bookmark = useCallback(() => {
    if (!lesson) return
    const t = handle.current?.time() ?? 0
    addNote({ courseId: course.id, lessonId: lesson.id, t, text: 'Bookmark', kind: 'bookmark' })
    toast(`Bookmarked ${clock(t)}`)
  }, [addNote, course.id, lesson])

  const changeRate = useCallback((delta: number) => {
    const h = handle.current
    if (!h) return
    const r = Math.min(2, Math.max(0.25, Math.round((h.rate() + delta) * 4) / 4))
    h.setRate(r)
    toast(`Speed ${r}×`)
  }, [])

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.querySelector('[role="dialog"]') && e.key !== 'Escape') return
      const h = handle.current
      const k = e.key
      if (k === ' ' || k === 'k') {
        if (el.tagName === 'BUTTON' && k === ' ') return
        e.preventDefault()
        h?.toggle()
      } else if (k === 'j') h?.seek(h.time() - 10)
      else if (k === 'l') h?.seek(h.time() + 10)
      else if (k === 'ArrowLeft') h?.seek(h.time() - 5)
      else if (k === 'ArrowRight') h?.seek(h.time() + 5)
      else if (k === 'n') {
        e.preventDefault()
        setTab('notes')
        requestAnimationFrame(() => noteInput.current?.focus())
      } else if (k === 'b') bookmark()
      else if (k === '[') changeRate(-0.25)
      else if (k === ']') changeRate(0.25)
      else if (k === 'm' && lesson) toggleManualDone(course.id, lesson.id)
      else if (k === 'N' && course.lessons[index + 1]) select(course.lessons[index + 1].id)
      else if (k === 'P' && course.lessons[index - 1]) select(course.lessons[index - 1].id)
      else if (k === '?') setHelpOpen((v) => !v)
      else if (k === 'Escape') setHelpOpen(false)
      else return
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bookmark, changeRate, course.id, course.lessons, index, lesson, select, toggleManualDone])

  /* ---------- derived copy ---------- */
  // Trust the measured pace only once it is meaningful; until then assume the daily goal.
  const measured = averageDaily(activity)
  const pace = measured >= 600 ? measured : settings.dailyGoalMinutes * 60
  const remaining = Math.max(0, summary.length - summary.watchedSeconds)
  const eta = useMemo(() => {
    if (summary.done === summary.total) return 'Finished'
    if (summary.unknown > 0 || !remaining) return null
    const d = etaDays(remaining, pace)
    return d <= 1 ? 'About a day left at your pace' : `About ${d} days left at your pace`
  }, [summary.done, summary.total, summary.unknown, remaining, pace])

  if (!lesson) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-muted">This course has no lessons.</p>
      </main>
    )
  }

  const lessonDone = isLessonDone(s, course, lesson)
  const showBreak = phase === 'break' || phase === 'ready'

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:px-6">
          <IconButton icon="back" label="Back to library" onClick={() => navigate('#/')} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold leading-tight tracking-tight sm:text-xl">{course.title}</h1>
            <p className="truncate text-xs text-muted sm:text-[13px]">
              <span className="num">
                {summary.done} of {plural(summary.total, 'lesson')}
              </span>
              <span className="mx-2 text-line">|</span>
              <span className="num">{Math.round(summary.ratio * 100)}%</span>
              {eta && (
                <>
                  <span className="mx-2 text-line">|</span>
                  {eta}
                </>
              )}
            </p>
          </div>
          <SessionPill holding={holding} onStart={startSession} />
        </div>
        <div className="mx-auto max-w-[1440px] px-4 pb-1 sm:px-6">
          <Thread course={course} currentId={lesson.id} onSelect={(id) => select(id)} celebrateId={celebrateId} />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Player" className="min-w-0">
          <Player
            course={course}
            lesson={lesson}
            autoplay={autoplay}
            handleRef={handle}
            onLessonEnd={onLessonEnd}
            onPlayingChange={onPlayingChange}
          />

          <div className="mt-4 flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 basis-72">
              <p className="num text-[13px] text-muted">
                Lesson {index + 1} of {course.lessons.length}
                {lesson.start > 0 && <span className="ml-2">starts at {clock(lesson.start)}</span>}
              </p>
              <h2 className="mt-0.5 font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">{lesson.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <IconButton icon="back" label="Previous lesson (Shift+P)" disabled={index === 0} onClick={() => select(course.lessons[index - 1].id)} className="disabled:opacity-30" />
              <IconButton icon="back" label="Next lesson (Shift+N)" disabled={index === course.lessons.length - 1} onClick={() => select(course.lessons[index + 1].id)} className="rotate-180 disabled:opacity-30" />
              <span className="mx-1 h-5 w-px bg-line" />
              <div className="flex items-center rounded-lg border border-line bg-surface">
                <button type="button" className="h-8 w-7 text-muted hover:text-ink" onClick={() => changeRate(-0.25)} aria-label="Slower ([)">
                  −
                </button>
                <span className="num w-10 text-center text-sm">{course.playbackRate ?? settings.defaultRate}×</span>
                <button type="button" className="h-8 w-7 text-muted hover:text-ink" onClick={() => changeRate(0.25)} aria-label="Faster (])">
                  +
                </button>
              </div>
              <IconButton icon="bookmark" label="Bookmark this moment (B)" onClick={bookmark} />
              <IconButton
                icon="note"
                label="Write a note (N)"
                onClick={() => {
                  setTab('notes')
                  requestAnimationFrame(() => noteInput.current?.focus())
                }}
              />
              <IconButton
                icon="check"
                label={lessonDone ? 'Mark as not finished (M)' : 'Mark as finished (M)'}
                active={lessonDone}
                onClick={() => toggleManualDone(course.id, lesson.id)}
              />
              <a
                href={watchUrl(lesson.videoId, handle.current?.time() ?? lesson.start)}
                target="_blank"
                rel="noreferrer"
                aria-label="Open on YouTube"
                title="Open on YouTube"
                className="inline-grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              >
                <Icon name="external" />
              </a>
              <IconButton icon="keyboard" label="Keyboard shortcuts (?)" onClick={() => setHelpOpen(true)} />
            </div>
          </div>

          {!playing && phase === 'idle' && (
            <p className="mt-4 text-sm text-muted">
              Press play and a {settings.focusMinutes} minute session starts on its own. You’ll get a {settings.breakMinutes} minute break
              after it.
            </p>
          )}
        </section>

        <aside className="flex min-h-[420px] flex-col rounded-xl border border-line bg-surface p-2 lg:sticky lg:top-[7.5rem] lg:h-[calc(100dvh-9rem)]">
          <div className="flex gap-1 p-1" role="tablist">
            {(['lessons', 'notes'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  tab === t ? 'bg-sunken text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-1 flex min-h-0 flex-1 flex-col">
            {tab === 'lessons' ? (
              <LessonList course={course} currentId={lesson.id} onSelect={(id) => select(id)} />
            ) : (
              <NotesPanel course={course} lessonId={lesson.id} timeAt={() => handle.current?.time() ?? 0} onSeek={seekTo} inputRef={noteInput} />
            )}
          </div>
        </aside>
      </main>

      {showBreak && (
        <BreakOverlay
          timeAt={() => handle.current?.time() ?? 0}
          onResume={() => handle.current?.play()}
          onRecall={(text, t) => addNote({ courseId: course.id, lessonId: lesson.id, t, text, kind: 'recall' })}
        />
      )}
      {capOpen && !showBreak && <CapGate onClose={() => setCapOpen(false)} />}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </div>
  )
}

function CapGate({ onClose }: { onClose(): void }) {
  // Close once the learner overrides the cap.
  const override = useSession((s) => s.capOverride)
  useEffect(() => {
    if (override) onClose()
  }, [override, onClose])
  return <CapScreen onLeave={() => navigate('#/')} />
}

const SHORTCUTS: [string, string][] = [
  ['Space or K', 'Play or pause'],
  ['J / L', 'Back or forward 10 seconds'],
  ['← / →', 'Back or forward 5 seconds'],
  ['[ / ]', 'Slower or faster'],
  ['N', 'Write a note'],
  ['B', 'Bookmark this moment'],
  ['M', 'Mark lesson finished'],
  ['Shift+N / Shift+P', 'Next or previous lesson'],
  ['?', 'Show these shortcuts'],
]

function ShortcutHelp({ onClose }: { onClose(): void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ground/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="w-full max-w-sm animate-rise rounded-2xl border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Keyboard shortcuts</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        <dl className="mt-4 space-y-2.5 text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4">
              <dt className="text-muted">{v}</dt>
              <dd className="flex gap-1">
                <Kbd>{k}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted">Shortcuts work when the page has focus, not the video frame. Click outside the video first.</p>
      </div>
    </div>
  )
}
