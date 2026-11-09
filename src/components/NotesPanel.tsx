import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { clock } from '../lib/format'
import type { Course } from '../types'
import { notesToMarkdown } from '../lib/notes'
import { Icon } from './Icon'
import { Button, IconButton } from './ui'
import { toast } from './toast'

interface Props {
  course: Course
  lessonId: string
  timeAt(): number
  onSeek(lessonId: string, t: number): void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}

export function NotesPanel({ course, lessonId, timeAt, onSeek, inputRef }: Props) {
  const allNotes = useStore((s) => s.notes)
  const addNote = useStore((s) => s.addNote)
  const removeNote = useStore((s) => s.removeNote)
  const [text, setText] = useState('')
  const [onlyLesson, setOnlyLesson] = useState(false)
  const stamp = useRef<number | null>(null)
  const [stampShown, setStampShown] = useState<number | null>(null)

  const order = useMemo(() => new Map(course.lessons.map((l, i) => [l.id, i])), [course.lessons])
  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.courseId === course.id && (!onlyLesson || n.lessonId === lessonId))
        .sort((a, b) => (order.get(a.lessonId) ?? 0) - (order.get(b.lessonId) ?? 0) || a.t - b.t),
    [allNotes, course.id, onlyLesson, lessonId, order],
  )

  const captureStamp = () => {
    if (stamp.current === null) {
      stamp.current = timeAt()
      setStampShown(stamp.current)
    }
  }

  const save = () => {
    const v = text.trim()
    if (!v) return
    addNote({ courseId: course.id, lessonId, t: stamp.current ?? timeAt(), text: v, kind: 'note' })
    setText('')
    stamp.current = null
    setStampShown(null)
  }

  const exportMd = async () => {
    const md = notesToMarkdown(course, allNotes.filter((n) => n.courseId === course.id))
    try {
      await navigator.clipboard.writeText(md)
      toast('Notes copied as Markdown')
    } catch {
      const blob = new Blob([md], { type: 'text/markdown' })
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${course.title}.md` })
      a.click()
      URL.revokeObjectURL(a.href)
    }
  }

  const titleOf = (id: string) => course.lessons.find((l) => l.id === id)?.title ?? ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-1">
        <textarea
          ref={inputRef}
          rows={2}
          value={text}
          onFocus={captureStamp}
          onChange={(e) => {
            captureStamp()
            setText(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              ;(e.target as HTMLTextAreaElement).blur()
              if (!text) {
                stamp.current = null
                setStampShown(null)
              }
            }
          }}
          placeholder="Write a note. Enter saves it at the current moment."
          className="w-full resize-none rounded-lg border border-line bg-ground px-3 py-2 text-sm placeholder:text-muted/70 focus:border-focus focus:outline-none"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="num">{stampShown !== null ? `At ${clock(stampShown)}` : ''}</span>
          <div className="flex items-center gap-1">
            <label className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 hover:text-ink">
              <input type="checkbox" checked={onlyLesson} onChange={(e) => setOnlyLesson(e.target.checked)} className="accent-[var(--focus)]" />
              This lesson
            </label>
            <Button size="sm" variant="ghost" icon="download" onClick={exportMd} disabled={!notes.length}>
              Export
            </Button>
          </div>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted">
          No notes yet. Press <span className="font-medium text-ink">N</span> while watching to jot something at that moment, or{' '}
          <span className="font-medium text-ink">B</span> to bookmark it.
        </p>
      ) : (
        <ul className="scroll-quiet mt-3 flex-1 space-y-1 overflow-y-auto">
          {notes.map((n, i) => {
            const header = !onlyLesson && n.lessonId !== notes[i - 1]?.lessonId ? titleOf(n.lessonId) : ''
            return (
              <li key={n.id}>
                {header && <p className="mt-3 truncate px-2 pb-1 text-xs font-medium text-muted first:mt-0">{header}</p>}
                <div className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken">
                  <button
                    type="button"
                    onClick={() => onSeek(n.lessonId, n.t)}
                    className="num mt-px shrink-0 rounded-md bg-focus-soft px-1.5 py-0.5 text-xs font-semibold text-focus hover:bg-focus hover:text-white"
                    aria-label={`Jump to ${clock(n.t)}`}
                  >
                    {clock(n.t)}
                  </button>
                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm">
                    {n.kind === 'bookmark' && <Icon name="bookmark" size={13} className="mr-1 inline -translate-y-px text-muted" />}
                    {n.kind === 'recall' && <span className="mr-1.5 text-xs font-medium text-rest">Recall</span>}
                    {n.text}
                  </p>
                  <IconButton
                    icon="trash"
                    label="Delete note"
                    onClick={() => removeNote(n.id)}
                    className="size-7! opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
