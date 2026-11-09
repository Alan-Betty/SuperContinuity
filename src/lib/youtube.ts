import type { Lesson } from '../types'
import { clock } from './format'

export interface ParsedUrl {
  videoId?: string
  playlistId?: string
  start?: number
}

const ID_RE = /^[A-Za-z0-9_-]{11}$/

/** Parse "1h2m3s", "90", "1:30" style timestamps to seconds. */
export function parseTimestamp(raw: string): number | undefined {
  const v = raw.trim()
  if (/^\d+$/.test(v)) return Number(v)
  const hms = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (hms && (hms[1] || hms[2] || hms[3])) {
    return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0)
  }
  const colon = v.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/)
  if (colon) return Number(colon[1] ?? 0) * 3600 + Number(colon[2]) * 60 + Number(colon[3])
  return undefined
}

export function parseYouTubeUrl(input: string): ParsedUrl | null {
  const raw = input.trim()
  if (!raw) return null
  if (ID_RE.test(raw)) return { videoId: raw }
  if (/^(PL|UU|LL|FL|OL|RD)[A-Za-z0-9_-]{10,}$/.test(raw)) return { playlistId: raw }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  const out: ParsedUrl = {}

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    if (ID_RE.test(id)) out.videoId = id
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v')
    if (v && ID_RE.test(v)) out.videoId = v
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/)
    if (m) out.videoId = m[1]
  } else {
    return null
  }

  const list = url.searchParams.get('list')
  if (list && /^[A-Za-z0-9_-]{10,}$/.test(list)) out.playlistId = list
  const t = url.searchParams.get('t') ?? url.searchParams.get('start')
  if (t) {
    const sec = parseTimestamp(t)
    if (sec !== undefined) out.start = sec
  }
  return out.videoId || out.playlistId ? out : null
}

export function thumbnail(videoId: string, quality: 'mq' | 'hq' = 'mq'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}default.jpg`
}

export function watchUrl(videoId: string, t?: number): string {
  return `https://www.youtube.com/watch?v=${videoId}${t ? `&t=${Math.floor(t)}s` : ''}`
}

export interface Chapter {
  start: number
  title: string
}

/**
 * Parse chapter lines as found in YouTube descriptions:
 *   "0:00 Intro", "(12:30) Arrays", "1:02:03 - Graphs", "Intro 0:00"
 */
export function parseChapters(text: string): Chapter[] {
  const out: Chapter[] = []
  const TS = String.raw`\(?\[?((?:\d+:)?\d{1,2}:\d{2})\]?\)?`
  const lead = new RegExp(String.raw`^\s*(?:[-*•▶]\s*)?${TS}\s*[-–—:|.)]?\s*(.+?)\s*$`)
  const trail = new RegExp(String.raw`^\s*(.+?)\s*[-–—:|]?\s*${TS}\s*$`)
  for (const line of text.split(/\r?\n/)) {
    let m = line.match(lead)
    let ts: string | undefined
    let title: string | undefined
    if (m) {
      ts = m[1]
      title = m[2]
    } else if ((m = line.match(trail))) {
      title = m[1]
      ts = m[2]
    }
    if (!ts || !title) continue
    const start = parseTimestamp(ts)
    if (start === undefined) continue
    out.push({ start, title: title.replace(/^[-–—:|.\s]+/, '').trim() })
  }
  out.sort((a, b) => a.start - b.start)
  // Drop duplicate starts; need at least 2 chapters starting near zero to be meaningful.
  const dedup = out.filter((c, i) => i === 0 || c.start > out[i - 1].start)
  return dedup.length >= 2 ? dedup : []
}

export function chaptersToLessons(videoId: string, chapters: Chapter[], duration = 0): Lesson[] {
  return chapters.map((c, i) => ({
    id: `${videoId}@${c.start}`,
    videoId,
    title: c.title,
    start: c.start,
    end: i + 1 < chapters.length ? chapters[i + 1].start : duration,
  }))
}

export const AUTO_SPLIT_THRESHOLD = 45 * 60
export const AUTO_SPLIT_PART = 20 * 60

/** Split a long, chapter-less video into ~20 min parts so sessions have natural stops. */
export function autoSplit(videoId: string, title: string, duration: number): Lesson[] {
  if (duration < AUTO_SPLIT_THRESHOLD) {
    return [{ id: videoId, videoId, title, start: 0, end: duration }]
  }
  const parts = Math.round(duration / AUTO_SPLIT_PART)
  const size = duration / parts
  return Array.from({ length: parts }, (_, i) => {
    const start = Math.round(i * size)
    const end = i === parts - 1 ? duration : Math.round((i + 1) * size)
    return {
      id: `${videoId}@${start}`,
      videoId,
      title: `Part ${i + 1} (${clock(start)} to ${clock(end)})`,
      start,
      end,
    }
  })
}

/** ISO 8601 duration (Data API) -> seconds. "PT1H2M3S" -> 3723 */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!m) return 0
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
}
