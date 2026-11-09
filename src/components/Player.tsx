import { useEffect, useRef, useState, type RefObject } from 'react'
import { loadYouTubeApi, STATE, type YTPlayer } from '../lib/ytApi'
import { lessonEnd, progressKey, useStore } from '../store/useStore'
import type { Course, Lesson, Range } from '../types'

export interface PlayerHandle {
  time(): number
  seek(t: number): void
  play(): void
  pause(): void
  toggle(): void
  playing(): boolean
  rate(): number
  setRate(r: number): void
}

interface Props {
  course: Course
  lesson: Lesson
  autoplay: boolean
  handleRef: RefObject<PlayerHandle | null>
  onLessonEnd(): void
  onPlayingChange(playing: boolean): void
}

/** Where to resume a lesson: saved position if it falls inside the lesson and isn't at its very end. */
function resumeAt(courseId: string, lesson: Lesson): number {
  const s = useStore.getState()
  const pos = s.progress[progressKey(courseId, lesson.videoId)]?.position ?? 0
  const end = lessonEnd(s, lesson)
  const inside = pos >= lesson.start && (!end || pos < end - 10)
  return inside ? pos : lesson.start
}

export function Player({ course, lesson, autoplay, handleRef, onLessonEnd, onPlayingChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const readyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  // Latest props, readable from long-lived callbacks.
  const live = useRef({ course, lesson, autoplay, onLessonEnd, onPlayingChange })
  live.current = { course, lesson, autoplay, onLessonEnd, onPlayingChange }

  // Tracking state.
  const track = useRef({
    videoId: lesson.videoId,
    lastT: null as number | null,
    lastWall: 0,
    pending: [] as Range[],
    focus: 0,
    position: 0,
    ticks: 0,
    endedFor: '' as string,
  })

  const flush = () => {
    const tr = track.current
    const { course: c } = live.current
    if (!tr.pending.length && tr.focus < 0.5 && !tr.position) return
    const ranges = tr.pending.length ? tr.pending : [null]
    const store = useStore.getState()
    ranges.forEach((r, i) => store.recordWatch(c.id, tr.videoId, r, tr.position, i === 0 ? Math.round(tr.focus) : 0))
    tr.pending = []
    tr.focus = 0
  }

  // Create the YouTube player once.
  useEffect(() => {
    let cancelled = false
    const host = hostRef.current!
    const mount = document.createElement('div')
    host.appendChild(mount)

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        const { lesson: l, course: c } = live.current
        const start = resumeAt(c.id, l)
        track.current.videoId = l.videoId
        track.current.position = start
        playerRef.current = new YT.Player(mount, {
          videoId: l.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: Math.floor(start),
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            iv_load_policy: 3,
            autoplay: live.current.autoplay ? 1 : 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              readyRef.current = true
              const rate = live.current.course.playbackRate ?? useStore.getState().settings.defaultRate
              if (rate !== 1) e.target.setPlaybackRate(rate)
            },
            onStateChange: (e) => {
              const p = e.target
              const tr = track.current
              if (e.data === STATE.PLAYING) {
                live.current.onPlayingChange(true)
                tr.lastWall = performance.now()
                tr.lastT = p.getCurrentTime()
                useStore.getState().setDuration(live.current.course.id, tr.videoId, Math.round(p.getDuration()))
              } else if (e.data === STATE.PAUSED || e.data === STATE.ENDED) {
                // Capture the tail since the last tick.
                const t = p.getCurrentTime()
                if (tr.lastT !== null && t > tr.lastT && t - tr.lastT < 5) tr.pending.push([tr.lastT, t])
                tr.lastT = null
                tr.position = t
                flush()
                live.current.onPlayingChange(false)
                if (e.data === STATE.ENDED && tr.endedFor !== live.current.lesson.id) {
                  tr.endedFor = live.current.lesson.id
                  live.current.onLessonEnd()
                }
              } else if (e.data === STATE.CUED) {
                const d = Math.round(p.getDuration())
                if (d) useStore.getState().setDuration(live.current.course.id, tr.videoId, d)
              }
            },
            onPlaybackRateChange: (e) => {
              useStore.getState().updateCourse(live.current.course.id, { playbackRate: e.data })
            },
            onError: (e) => {
              const msg: Record<number, string> = {
                2: 'This video link is invalid.',
                5: 'This video can’t play in an embedded player.',
                100: 'This video was removed or made private.',
                101: 'The owner doesn’t allow this video to play outside YouTube. Open it on YouTube instead.',
                150: 'The owner doesn’t allow this video to play outside YouTube. Open it on YouTube instead.',
              }
              setError(msg[e.data] ?? 'The video failed to load.')
            },
          },
        })
      })
      .catch((err: Error) => setError(err.message))

    // Watch tracker: sample once a second.
    const iv = window.setInterval(() => {
      const p = playerRef.current
      if (!p || !readyRef.current) return
      const tr = track.current
      const now = performance.now()
      if (p.getPlayerState() !== STATE.PLAYING) {
        tr.lastWall = now
        return
      }
      const t = p.getCurrentTime()
      const wall = Math.min(5, (now - tr.lastWall) / 1000)
      if (tr.lastT !== null) {
        const dt = t - tr.lastT
        // Only count continuous playback; a seek shows up as an implausible jump.
        if (dt > 0 && dt <= wall * p.getPlaybackRate() + 1.5) tr.pending.push([tr.lastT, t])
      }
      tr.focus += wall
      tr.lastT = t
      tr.lastWall = now
      tr.position = t
      if (++tr.ticks % 4 === 0) flush()

      // Chapter / part lessons end before the video does.
      const l = live.current.lesson
      const end = lessonEnd(useStore.getState(), l)
      const dur = p.getDuration()
      if (end && end < dur - 1 && t >= end - 0.4 && tr.endedFor !== l.id) {
        tr.endedFor = l.id
        flush()
        live.current.onLessonEnd()
      }
    }, 1000)

    const onHide = () => flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)

    return () => {
      cancelled = true
      window.clearInterval(iv)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      flush()
      playerRef.current?.destroy()
      playerRef.current = null
      readyRef.current = false
      host.replaceChildren()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switch lessons without recreating the player.
  useEffect(() => {
    const p = playerRef.current
    if (!p || !readyRef.current) return
    const tr = track.current
    const start = resumeAt(course.id, lesson)
    const sameVideo = p.getVideoData()?.video_id === lesson.videoId
    tr.endedFor = ''
    setError(null)
    if (sameVideo) {
      const t = p.getCurrentTime()
      const end = lessonEnd(useStore.getState(), lesson)
      const inside = t >= lesson.start - 1 && (!end || t < end - 1)
      if (!inside) p.seekTo(start, true)
      if (autoplay) p.playVideo()
    } else {
      flush()
      tr.videoId = lesson.videoId
      tr.lastT = null
      tr.position = start
      if (autoplay) p.loadVideoById({ videoId: lesson.videoId, startSeconds: start })
      else p.cueVideoById({ videoId: lesson.videoId, startSeconds: start })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id])

  // Imperative handle for keyboard shortcuts, notes and sessions.
  useEffect(() => {
    handleRef.current = {
      time: () => (readyRef.current ? playerRef.current!.getCurrentTime() : track.current.position),
      seek: (t) => {
        const p = playerRef.current
        if (!p || !readyRef.current) return
        track.current.lastT = null
        p.seekTo(Math.max(0, t), true)
      },
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      toggle: () => {
        const p = playerRef.current
        if (!p || !readyRef.current) return
        if (p.getPlayerState() === STATE.PLAYING) p.pauseVideo()
        else p.playVideo()
      },
      playing: () => readyRef.current && playerRef.current?.getPlayerState() === STATE.PLAYING,
      rate: () => (readyRef.current ? playerRef.current!.getPlaybackRate() : 1),
      setRate: (r) => {
        const p = playerRef.current
        if (!p || !readyRef.current) return
        const rates = p.getAvailablePlaybackRates()
        const best = rates.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a), rates[0] ?? 1)
        p.setPlaybackRate(best)
      },
    }
    return () => {
      handleRef.current = null
    }
  }, [handleRef])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <div ref={hostRef} className="absolute inset-0 [&>iframe]:size-full [&>div]:size-full" />
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 p-6 text-center text-white">
          <div className="max-w-sm space-y-3">
            <p>{error}</p>
            <a
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
              href={`https://www.youtube.com/watch?v=${lesson.videoId}&t=${Math.floor(lesson.start)}s`}
              target="_blank"
              rel="noreferrer"
            >
              Open on YouTube
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
