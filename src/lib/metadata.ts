import type { Course, Lesson } from '../types'
import { resolvePlaylistIds } from './ytApi'
import { autoSplit, chaptersToLessons, parseChapters, parseIsoDuration, parseYouTubeUrl } from './youtube'

interface OEmbed {
  title: string
  author_name?: string
}

export async function oembed(url: string): Promise<OEmbed | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`)
    if (!r.ok) return null
    return (await r.json()) as OEmbed
  } catch {
    return null
  }
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx])
      }
    }),
  )
  return out
}

interface ApiVideo {
  id: string
  title: string
  description: string
  duration: number
}

async function apiVideos(ids: string[], key: string): Promise<Map<string, ApiVideo>> {
  const map = new Map<string, ApiVideo>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(',')}&key=${encodeURIComponent(key)}`,
    )
    if (!r.ok) throw new Error('The YouTube API key was rejected. Check it in Settings, or clear it to import without one.')
    const j = (await r.json()) as {
      items: { id: string; snippet: { title: string; description: string }; contentDetails: { duration: string } }[]
    }
    for (const it of j.items) {
      map.set(it.id, {
        id: it.id,
        title: it.snippet.title,
        description: it.snippet.description,
        duration: parseIsoDuration(it.contentDetails.duration),
      })
    }
  }
  return map
}

export interface ImportOptions {
  /** Chapter text pasted by the user (single video only). */
  chapters?: string
  /** Optional YouTube Data API key: adds durations and auto-chapters from descriptions. */
  apiKey?: string
  onStatus?: (msg: string) => void
}

export type NewCourse = Omit<Course, 'id' | 'createdAt'>

export async function buildCourse(input: string, opts: ImportOptions = {}): Promise<NewCourse> {
  const parsed = parseYouTubeUrl(input)
  if (!parsed) throw new Error('That doesn’t look like a YouTube link. Paste a video or playlist URL.')
  const key = opts.apiKey?.trim()
  const status = opts.onStatus ?? (() => {})

  // Playlist takes priority: a watch?v=…&list=… link usually means "the course".
  if (parsed.playlistId) {
    status('Reading the playlist')
    const playlistUrl = `https://www.youtube.com/playlist?list=${parsed.playlistId}`
    const [meta, ids] = await Promise.all([oembed(playlistUrl), resolvePlaylistIds(parsed.playlistId)])
    const unique = [...new Set(ids)]
    status(`Fetching ${unique.length} lesson titles`)

    let lessons: Lesson[]
    if (key) {
      const vids = await apiVideos(unique, key)
      lessons = unique.map((id, i) => {
        const v = vids.get(id)
        return { id, videoId: id, title: v?.title ?? `Lesson ${i + 1}`, start: 0, end: v?.duration ?? 0 }
      })
    } else {
      const titles = await pool(unique, 6, (id) => oembed(`https://www.youtube.com/watch?v=${id}`))
      lessons = unique.map((id, i) => ({ id, videoId: id, title: titles[i]?.title ?? `Lesson ${i + 1}`, start: 0, end: 0 }))
    }
    return {
      title: meta?.title ?? 'Untitled playlist',
      author: meta?.author_name,
      sourceUrl: playlistUrl,
      kind: 'playlist',
      lessons,
    }
  }

  const videoId = parsed.videoId!
  status('Reading the video')
  const url = `https://www.youtube.com/watch?v=${videoId}`
  const meta = await oembed(url)
  if (!meta) throw new Error('YouTube couldn’t find that video. It may be private, deleted or age-restricted.')

  let duration = 0
  let description = ''
  if (key) {
    const v = (await apiVideos([videoId], key)).get(videoId)
    duration = v?.duration ?? 0
    description = v?.description ?? ''
  }

  const pasted = parseChapters(opts.chapters ?? '')
  const chapters = pasted.length ? pasted : parseChapters(description)
  let lessons: Lesson[]
  if (chapters.length) lessons = chaptersToLessons(videoId, chapters, duration)
  else if (duration) lessons = autoSplit(videoId, meta.title, duration)
  // Unknown duration: one lesson; the player splits it into parts once the duration is known.
  else lessons = [{ id: videoId, videoId, title: meta.title, start: 0, end: 0 }]

  return { title: meta.title, author: meta.author_name, sourceUrl: url, kind: 'video', lessons }
}
