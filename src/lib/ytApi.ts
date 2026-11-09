/* Minimal typings + loader for the YouTube IFrame Player API. */

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  getAvailablePlaybackRates(): number[]
  loadVideoById(opts: { videoId: string; startSeconds?: number; endSeconds?: number }): void
  cueVideoById(opts: { videoId: string; startSeconds?: number; endSeconds?: number }): void
  cuePlaylist(opts: { listType: 'playlist'; list: string }): void
  getPlaylist(): string[] | null
  getVideoData(): { video_id: string; title: string; author: string }
  destroy(): void
}

export interface YTEvent {
  target: YTPlayer
  data: number
}

interface YTNamespace {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId?: string
      width?: number | string
      height?: number | string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: YTEvent) => void
        onStateChange?: (e: YTEvent) => void
        onPlaybackRateChange?: (e: YTEvent) => void
        onError?: (e: YTEvent) => void
      }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

export const STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const

let loading: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      loading = null
      reject(new Error('Could not load the YouTube player. Check your connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Resolve a playlist's video IDs without an API key: cue it in an off-screen player and
 * poll getPlaylist() until it is populated.
 */
export async function resolvePlaylistIds(playlistId: string, timeoutMs = 15000): Promise<string[]> {
  const YT = await loadYouTubeApi()
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:320px;height:180px;pointer-events:none'
  const mount = document.createElement('div')
  host.appendChild(mount)
  document.body.appendChild(host)

  try {
    return await new Promise<string[]>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('YouTube took too long to return this playlist. It may be private.')), timeoutMs)
      const player = new YT.Player(mount, {
        width: 320,
        height: 180,
        playerVars: { listType: 'playlist', list: playlistId, autoplay: 0 },
        events: {
          onReady: () => {
            const started = Date.now()
            const poll = () => {
              const ids = player.getPlaylist()
              if (ids && ids.length) {
                window.clearTimeout(timer)
                resolve(ids)
              } else if (Date.now() - started < timeoutMs) {
                window.setTimeout(poll, 250)
              }
            }
            poll()
          },
          onError: () => {
            window.clearTimeout(timer)
            reject(new Error('YouTube could not open this playlist. Check that it is public or unlisted.'))
          },
        },
      })
    })
  } finally {
    host.remove()
  }
}
