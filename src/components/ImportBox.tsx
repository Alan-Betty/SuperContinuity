import { useState } from 'react'
import { buildCourse } from '../lib/metadata'
import { parseChapters, parseYouTubeUrl } from '../lib/youtube'
import { useStore } from '../store/useStore'
import { coursePath, navigate } from '../lib/router'
import { Button } from './ui'

export function ImportBox({ large = false }: { large?: boolean }) {
  const addCourse = useStore((s) => s.addCourse)
  const apiKey = useStore((s) => s.settings.apiKey)
  const [url, setUrl] = useState('')
  const [chapters, setChapters] = useState('')
  const [showChapters, setShowChapters] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const parsed = parseYouTubeUrl(url)
  const isSingleVideo = parsed && !parsed.playlistId
  const chapterCount = parseChapters(chapters).length

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!parsed) {
      setError('Paste a YouTube video or playlist link, like youtube.com/playlist?list=…')
      return
    }
    setBusy(true)
    try {
      const c = await buildCourse(url, { chapters: isSingleVideo ? chapters : '', apiKey, onStatus: setStatus })
      const id = addCourse(c)
      navigate(coursePath(id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      setStatus('')
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <label htmlFor="course-url" className="sr-only">
        YouTube video or playlist link
      </label>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-surface p-1.5 transition-colors focus-within:border-focus ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        <input
          id="course-url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError('')
          }}
          placeholder="Paste a YouTube playlist or video link"
          autoComplete="off"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent px-3 placeholder:text-muted/70 focus:outline-none ${large ? 'h-12 text-[17px]' : 'h-10 text-[15px]'}`}
        />
        <Button type="submit" variant="primary" size={large ? 'lg' : 'md'} disabled={busy || !url.trim()}>
          {busy ? 'Adding…' : 'Add course'}
        </Button>
      </div>

      <div className="mt-2 min-h-5 text-sm" aria-live="polite">
        {error ? (
          <p className="text-danger">{error}</p>
        ) : busy ? (
          <p className="text-muted">{status}…</p>
        ) : isSingleVideo ? (
          <button type="button" className="text-muted underline decoration-line underline-offset-4 hover:text-ink" onClick={() => setShowChapters((v) => !v)}>
            {showChapters ? 'Hide chapters' : 'Long video? Paste its chapter timestamps to split it into lessons'}
          </button>
        ) : null}
      </div>

      {isSingleVideo && showChapters && (
        <div className="mt-2">
          <textarea
            value={chapters}
            onChange={(e) => setChapters(e.target.value)}
            rows={5}
            placeholder={'0:00 Introduction\n4:12 Setting up\n18:40 Variables and types'}
            className="num w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/60 focus:border-focus focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">
            Copy them from the video description.{' '}
            {chapterCount > 0
              ? `${chapterCount} chapters found.`
              : 'Without chapters, videos over 45 minutes are split into 20 minute parts.'}
          </p>
        </div>
      )}
    </form>
  )
}
