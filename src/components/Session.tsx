import { useEffect, useRef, useState } from 'react'
import { useSession } from '../store/session'
import { useStore } from '../store/useStore'
import { clock, duration } from '../lib/format'
import { dayKey } from '../lib/stats'
import { Button, IconButton, Ring } from './ui'
import { toast } from './toast'

export function SessionPill({ holding, onStart }: { holding: boolean; onStart(): void }) {
  const { phase, remaining, length, paused, completed, togglePause, stop } = useSession()
  const focusMin = useStore((s) => s.settings.focusMinutes)

  if (phase === 'idle' || phase === 'ready') {
    return (
      <div className="flex items-center gap-2">
        {completed > 0 && <span className="hidden text-sm text-muted sm:inline">{completed} today</span>}
        <Button variant="primary" icon="play" onClick={onStart}>
          {phase === 'ready' ? 'Start next session' : `Start ${focusMin} min session`}
        </Button>
      </div>
    )
  }

  const isBreak = phase === 'break'
  const status = isBreak ? 'Break' : paused ? 'Paused' : holding ? 'Holding' : 'Focus'
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border py-1 pl-1 pr-1.5 ${isBreak ? 'border-rest/40 bg-rest-soft' : 'border-line bg-surface'}`}
      role="timer"
      aria-label={`${status}, ${clock(remaining)} left`}
    >
      <Ring value={length ? 1 - remaining / length : 0} size={34} stroke={3.5} tone={isBreak ? 'rest' : 'focus'} />
      <div className="min-w-[4.5rem] leading-tight">
        <div className="num text-[17px] font-semibold">{clock(remaining)}</div>
        <div className="text-xs text-muted" title={holding ? 'The timer holds while the video is paused' : undefined}>
          {status}
        </div>
      </div>
      {!isBreak && <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume timer' : 'Pause timer'} onClick={togglePause} />}
      <IconButton icon="stop" label="End session" onClick={stop} />
    </div>
  )
}

const CUES = [
  'Stand up and roll your shoulders back five times.',
  'Look at something far away for 20 seconds. Your eyes will thank you.',
  'Drink a glass of water.',
  'Walk to another room and back.',
  'Breathe in for four counts, out for six. Repeat five times.',
  'Stretch your wrists and fingers, slowly.',
  'Step away from the screen. Don’t check your phone.',
]

export function BreakOverlay({ timeAt, onResume, onRecall }: { timeAt(): number; onResume(): void; onRecall(text: string, t: number): void }) {
  const { phase, remaining, completed, longBreak, skipBreak, stop } = useSession()
  const recallOn = useStore((s) => s.settings.recallPrompts)
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const t = useRef(timeAt())
  const [cue] = useState(() => CUES[Math.floor(Math.random() * CUES.length)])
  const resumeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (phase === 'ready') resumeRef.current?.focus()
  }, [phase])

  const save = () => {
    if (!text.trim()) return
    onRecall(text.trim(), t.current)
    setSaved(true)
    toast('Saved to notes. +10 XP', 'focus')
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-ground/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="break-title">
      <div className="w-full max-w-lg animate-rise rounded-2xl border border-line bg-surface p-6 shadow-xl sm:p-8">
        {phase === 'break' ? (
          <>
            <p className="text-sm text-muted">
              {longBreak ? `Long break. That’s ${completed} sessions today.` : `Session ${completed} done.`}
            </p>
            <h2 id="break-title" className="num mt-1 text-6xl font-semibold tracking-tight text-rest sm:text-7xl">
              {clock(remaining)}
            </h2>
            <p className="mt-3 text-[15px]">{cue}</p>
          </>
        ) : (
          <>
            <h2 id="break-title" className="font-display text-3xl font-semibold tracking-tight">
              Break’s over
            </h2>
            <p className="mt-2 text-muted">Pick up exactly where you stopped.</p>
          </>
        )}

        {recallOn && (
          <div className="mt-6 border-t border-line pt-5">
            {saved ? (
              <p className="text-sm text-focus">Saved. Writing it down is what makes it stick.</p>
            ) : (
              <>
                <label htmlFor="recall" className="text-sm font-medium">
                  In one sentence, what did you just learn?
                </label>
                <textarea
                  id="recall"
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      save()
                    }
                  }}
                  placeholder="Recalling it from memory beats rewatching."
                  className="mt-2 w-full resize-none rounded-lg border border-line bg-ground px-3 py-2 text-[15px] placeholder:text-muted/70 focus:border-focus focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" onClick={save} disabled={!text.trim()}>
                    Save to notes
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {phase === 'break' ? (
            <Button variant="ghost" onClick={() => { skipBreak(); onResume() }}>
              Skip break
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={stop}>
                Done for now
              </Button>
              <Button ref={resumeRef} variant="primary" icon="play" onClick={() => { skipBreak(); onResume() }}>
                Start next session
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function CapScreen({ onLeave }: { onLeave(): void }) {
  const capMin = useStore((s) => s.settings.dailyCapMinutes)
  const today = useStore((s) => s.activity[dayKey()] ?? 0)
  const overrideCap = useSession((s) => s.overrideCap)
  const stop = useSession((s) => s.stop)
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ground/85 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="cap-title">
      <div className="w-full max-w-md animate-rise rounded-2xl border border-line bg-surface p-7 shadow-xl">
        <h2 id="cap-title" className="font-display text-3xl font-semibold tracking-tight">
          That’s {duration(today)} today
        </h2>
        <p className="mt-3 text-muted">
          You’ve hit your {duration(capMin * 60)} daily limit. Your brain consolidates what you learned while you rest and sleep, so
          stopping here is part of the course. Your place is saved.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => overrideCap()}>
            Keep going today
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              stop()
              onLeave()
            }}
          >
            Stop for today
          </Button>
        </div>
      </div>
    </div>
  )
}
