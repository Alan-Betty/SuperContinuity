import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Activity, Course, Lesson, LessonProgress, Note, NoteKind, Range, Settings } from '../types'
import { addRange, COMPLETE_RATIO, coverage, coveredSeconds } from '../lib/segments'
import { autoSplit } from '../lib/youtube'
import { dayKey } from '../lib/stats'
import type { NewCourse } from '../lib/metadata'

export const DEFAULT_SETTINGS: Settings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  dailyGoalMinutes: 45,
  dailyCapMinutes: 120,
  recallPrompts: true,
  defaultRate: 1,
  autoAdvance: true,
  apiKey: '',
  theme: 'system',
}

/** Progress is stored per video (watched ranges are absolute), so chapters of one video share it. */
export const progressKey = (courseId: string, videoId: string) => `${courseId}:${videoId}`

interface State {
  courses: Record<string, Course>
  progress: Record<string, LessonProgress>
  durations: Record<string, number>
  notes: Note[]
  activity: Activity
  settings: Settings

  addCourse(c: NewCourse): string
  removeCourse(id: string): void
  updateCourse(id: string, patch: Partial<Course>): void
  openLesson(courseId: string, lessonId: string): void
  toggleManualDone(courseId: string, lessonId: string): void
  recordWatch(courseId: string, videoId: string, range: Range | null, position: number, focusedSeconds: number): void
  setDuration(courseId: string, videoId: string, duration: number): void
  addNote(n: { courseId: string; lessonId: string; t: number; text: string; kind: NoteKind }): void
  updateNote(id: string, text: string): void
  removeNote(id: string): void
  updateSettings(patch: Partial<Settings>): void
  importData(json: string): void
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      courses: {},
      progress: {},
      durations: {},
      notes: [],
      activity: {},
      settings: DEFAULT_SETTINGS,

      addCourse(c) {
        const existing = Object.values(get().courses).find((x) => x.sourceUrl === c.sourceUrl)
        if (existing) return existing.id
        const id = uid()
        set((s) => ({ courses: { ...s.courses, [id]: { ...c, id, createdAt: Date.now() } } }))
        return id
      },

      removeCourse(id) {
        set((s) => {
          const courses = { ...s.courses }
          delete courses[id]
          const progress = Object.fromEntries(Object.entries(s.progress).filter(([k]) => !k.startsWith(id + ':')))
          return { courses, progress, notes: s.notes.filter((n) => n.courseId !== id) }
        })
      },

      updateCourse(id, patch) {
        set((s) => (s.courses[id] ? { courses: { ...s.courses, [id]: { ...s.courses[id], ...patch } } } : s))
      },

      openLesson(courseId, lessonId) {
        get().updateCourse(courseId, { lastLessonId: lessonId, lastOpenedAt: Date.now() })
      },

      toggleManualDone(courseId, lessonId) {
        const c = get().courses[courseId]
        if (!c) return
        const done = new Set(c.manualDone ?? [])
        if (done.has(lessonId)) done.delete(lessonId)
        else done.add(lessonId)
        get().updateCourse(courseId, { manualDone: [...done] })
        checkCourseComplete(courseId)
      },

      recordWatch(courseId, videoId, range, position, focusedSeconds) {
        const key = progressKey(courseId, videoId)
        set((s) => {
          const prev = s.progress[key] ?? { position: 0, watched: [], updatedAt: 0 }
          const watched = range ? addRange(prev.watched, range) : prev.watched
          const today = dayKey()
          return {
            progress: { ...s.progress, [key]: { ...prev, watched, position, updatedAt: Date.now() } },
            activity: focusedSeconds > 0 ? { ...s.activity, [today]: (s.activity[today] ?? 0) + focusedSeconds } : s.activity,
          }
        })
        if (range) checkCourseComplete(courseId)
      },

      setDuration(courseId, videoId, duration) {
        if (!(duration > 0) || get().durations[videoId] === duration) return
        set((s) => ({ durations: { ...s.durations, [videoId]: duration } }))
        // A single chapter-less video imported without a key: split it into parts now that we know its length.
        const c = get().courses[courseId]
        if (c && c.kind === 'video' && c.lessons.length === 1 && c.lessons[0].end === 0 && c.lessons[0].videoId === videoId) {
          const lessons = autoSplit(videoId, c.lessons[0].title, duration)
          if (lessons.length > 1) get().updateCourse(courseId, { lessons, lastLessonId: lessons[0].id })
        }
      },

      addNote(n) {
        set((s) => ({ notes: [...s.notes, { ...n, id: uid(), createdAt: Date.now() }] }))
      },
      updateNote(id, text) {
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, text } : n)) }))
      },
      removeNote(id) {
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
      },

      updateSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }))
      },

      importData(json) {
        const data = JSON.parse(json) as Partial<State> & { app?: string }
        if (data.app !== 'supercontinuity' || typeof data.courses !== 'object') {
          throw new Error('This file isn’t a SuperContinuity backup.')
        }
        set({
          courses: data.courses ?? {},
          progress: data.progress ?? {},
          durations: data.durations ?? {},
          notes: data.notes ?? [],
          activity: data.activity ?? {},
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
        })
      },
    }),
    {
      name: 'supercontinuity:v1',
      version: 1,
      partialize: ({ courses, progress, durations, notes, activity, settings }) => ({
        courses,
        progress,
        durations,
        notes,
        activity,
        settings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
      },
    },
  ),
)

export function exportData(): string {
  const { courses, progress, durations, notes, activity, settings } = useStore.getState()
  return JSON.stringify(
    { app: 'supercontinuity', version: 1, exportedAt: new Date().toISOString(), courses, progress, durations, notes, activity, settings: { ...settings, apiKey: '' } },
    null,
    2,
  )
}

/* ---------- derived selectors (pure, take state) ---------- */

type S = Pick<State, 'progress' | 'durations' | 'courses'>

export function lessonEnd(s: Pick<State, 'durations'>, l: Lesson): number {
  return l.end || s.durations[l.videoId] || 0
}

export function lessonLength(s: Pick<State, 'durations'>, l: Lesson): number {
  return Math.max(0, lessonEnd(s, l) - l.start)
}

export function lessonWatched(s: S, courseId: string, l: Lesson): Range[] {
  return s.progress[progressKey(courseId, l.videoId)]?.watched ?? []
}

export function lessonCoverage(s: S, courseId: string, l: Lesson): number {
  const end = lessonEnd(s, l)
  return end ? coverage(lessonWatched(s, courseId, l), l.start, end) : 0
}

export function isLessonDone(s: S, course: Course, l: Lesson): boolean {
  return (course.manualDone ?? []).includes(l.id) || lessonCoverage(s, course.id, l) >= COMPLETE_RATIO
}

export interface CourseSummary {
  total: number
  done: number
  /** Seconds of known course length. */
  length: number
  watchedSeconds: number
  /** Lessons whose duration is still unknown. */
  unknown: number
  ratio: number
  nextLesson?: Lesson
}

export function summarize(s: S, course: Course): CourseSummary {
  let done = 0
  let length = 0
  let watchedSeconds = 0
  let unknown = 0
  let nextLesson: Lesson | undefined
  for (const l of course.lessons) {
    const d = isLessonDone(s, course, l)
    if (d) done++
    else if (!nextLesson) nextLesson = l
    const end = lessonEnd(s, l)
    if (!end) {
      unknown++
      continue
    }
    const len = end - l.start
    length += len
    watchedSeconds += d ? len : coveredSeconds(lessonWatched(s, course.id, l), l.start, end)
  }
  const total = course.lessons.length
  // Prefer time-based ratio when all durations are known; otherwise lesson count.
  const ratio = total === 0 ? 0 : unknown === 0 && length > 0 ? watchedSeconds / length : done / total
  return { total, done, length, watchedSeconds, unknown, ratio: Math.min(1, ratio), nextLesson }
}

function checkCourseComplete(courseId: string) {
  const s = useStore.getState()
  const c = s.courses[courseId]
  if (!c) return
  const sum = summarize(s, c)
  const complete = sum.total > 0 && sum.done === sum.total
  if (complete && !c.completedAt) s.updateCourse(courseId, { completedAt: Date.now() })
  else if (!complete && c.completedAt) s.updateCourse(courseId, { completedAt: undefined })
}
