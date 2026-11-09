export type Range = [number, number]

export interface Lesson {
  id: string
  videoId: string
  title: string
  /** Start offset inside the video, seconds. */
  start: number
  /** End offset inside the video, seconds. 0 = until the video ends (duration unknown). */
  end: number
}

export interface Course {
  id: string
  title: string
  author?: string
  sourceUrl: string
  kind: 'playlist' | 'video'
  createdAt: number
  lessons: Lesson[]
  lastLessonId?: string
  lastOpenedAt?: number
  playbackRate?: number
  completedAt?: number
  /** Lessons the learner marked done by hand. */
  manualDone?: string[]
}

/** Stored per course + video. */
export interface LessonProgress {
  /** Absolute position in the video, seconds. */
  position: number
  /** Merged watched ranges, absolute video seconds. */
  watched: Range[]
  updatedAt: number
}

export type NoteKind = 'note' | 'recall' | 'bookmark'

export interface Note {
  id: string
  courseId: string
  lessonId: string
  /** Absolute video seconds. */
  t: number
  text: string
  kind: NoteKind
  createdAt: number
}

export interface Settings {
  focusMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  sessionsBeforeLongBreak: number
  dailyGoalMinutes: number
  dailyCapMinutes: number
  recallPrompts: boolean
  defaultRate: number
  autoAdvance: boolean
  apiKey: string
  theme: 'system' | 'light' | 'dark'
}

/** Seconds of focused watching per day, keyed YYYY-MM-DD (local time). */
export type Activity = Record<string, number>
