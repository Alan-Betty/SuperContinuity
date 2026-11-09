import { describe, expect, it } from 'vitest'
import { addRange, coverage, mergeRanges, rangesAsFractions } from './segments'
import { autoSplit, parseChapters, parseIsoDuration, parseTimestamp, parseYouTubeUrl } from './youtube'
import { clock, duration } from './format'
import { dayKey, level, streak, STREAK_MIN_SECONDS, xp } from './stats'

describe('segments', () => {
  it('merges overlapping and touching ranges', () => {
    expect(mergeRanges([[12, 20], [0, 5], [5.5, 9], [18, 30]])).toEqual([[0, 9], [12, 30]])
  })
  it('drops empty ranges', () => {
    expect(mergeRanges([[5, 5], [8, 3]])).toEqual([])
  })
  it('computes coverage within a lesson span', () => {
    const r = addRange([[0, 50]], [100, 150])
    expect(coverage(r, 0, 100)).toBe(0.5)
    expect(coverage(r, 100, 200)).toBe(0.5)
    expect(coverage(r, 0, 0)).toBe(0)
  })
  it('maps ranges to fractions', () => {
    expect(rangesAsFractions([[50, 150]], 100, 200)).toEqual([[0, 0.5]])
  })
})

describe('youtube urls', () => {
  it('parses watch, short, embed, shorts and playlist urls', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m5s')).toEqual({ videoId: 'dQw4w9WgXcQ', start: 65 })
    expect(parseYouTubeUrl('youtu.be/dQw4w9WgXcQ?t=42')).toEqual({ videoId: 'dQw4w9WgXcQ', start: 42 })
    expect(parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({ videoId: 'dQw4w9WgXcQ' })
    expect(parseYouTubeUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ videoId: 'dQw4w9WgXcQ' })
    expect(parseYouTubeUrl('https://www.youtube.com/playlist?list=PLWKjhJtqVAbnqBxcdjVGgT3uVR10bzTEB')).toEqual({
      playlistId: 'PLWKjhJtqVAbnqBxcdjVGgT3uVR10bzTEB',
    })
    expect(parseYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PLWKjhJtqVAbnqBxcdjVGgT3uVR10bzTEB')).toEqual({
      videoId: 'dQw4w9WgXcQ',
      playlistId: 'PLWKjhJtqVAbnqBxcdjVGgT3uVR10bzTEB',
    })
  })
  it('rejects non-youtube input', () => {
    expect(parseYouTubeUrl('https://vimeo.com/123')).toBeNull()
    expect(parseYouTubeUrl('hello world')).toBeNull()
    expect(parseYouTubeUrl('')).toBeNull()
  })
  it('parses timestamps', () => {
    expect(parseTimestamp('1:02:03')).toBe(3723)
    expect(parseTimestamp('2h')).toBe(7200)
    expect(parseTimestamp('nope')).toBeUndefined()
  })
  it('parses ISO durations', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    expect(parseIsoDuration('PT45S')).toBe(45)
  })
})

describe('chapters', () => {
  it('parses description-style chapters in several formats', () => {
    const text = `Course outline:
0:00 Intro
(4:10) Variables
12:30 - Loops
1:02:03 | Graphs
Not a chapter line`
    expect(parseChapters(text)).toEqual([
      { start: 0, title: 'Intro' },
      { start: 250, title: 'Variables' },
      { start: 750, title: 'Loops' },
      { start: 3723, title: 'Graphs' },
    ])
  })
  it('supports trailing timestamps', () => {
    expect(parseChapters('Intro 0:00\nSetup 3:00')).toEqual([
      { start: 0, title: 'Intro' },
      { start: 180, title: 'Setup' },
    ])
  })
  it('needs at least two chapters', () => {
    expect(parseChapters('0:00 Only one')).toEqual([])
  })
})

describe('autoSplit', () => {
  it('keeps short videos whole', () => {
    expect(autoSplit('abc', 'T', 600)).toHaveLength(1)
  })
  it('splits long videos into ~20 min parts that cover the whole video', () => {
    const parts = autoSplit('abc', 'T', 3 * 3600)
    expect(parts).toHaveLength(9)
    expect(parts[0].start).toBe(0)
    expect(parts.at(-1)!.end).toBe(3 * 3600)
    for (let i = 1; i < parts.length; i++) expect(parts[i].start).toBe(parts[i - 1].end)
  })
})

describe('format', () => {
  it('formats clocks and durations', () => {
    expect(clock(75)).toBe('1:15')
    expect(clock(3725)).toBe('1:02:05')
    expect(duration(5400)).toBe('1h 30m')
    expect(duration(20)).toBe('<1m')
  })
})

describe('stats', () => {
  it('counts a streak ending today or yesterday', () => {
    const today = new Date(2026, 10, 9)
    const a = {
      [dayKey(new Date(2026, 10, 8))]: STREAK_MIN_SECONDS,
      [dayKey(new Date(2026, 10, 7))]: STREAK_MIN_SECONDS + 5,
      [dayKey(new Date(2026, 10, 5))]: STREAK_MIN_SECONDS,
    }
    expect(streak(a, today)).toBe(2)
    expect(streak({ ...a, [dayKey(today)]: 9999 }, today)).toBe(3)
    expect(streak({}, today)).toBe(0)
  })
  it('computes xp and levels', () => {
    expect(xp({ focusedSeconds: 600, lessonsCompleted: 1, recallNotes: 2, coursesCompleted: 0 })).toBe(50)
    expect(level(0)).toEqual({ level: 1, into: 0, span: 50 })
    expect(level(50).level).toBe(2)
    expect(level(199).level).toBe(2)
    expect(level(200).level).toBe(3)
  })
})
