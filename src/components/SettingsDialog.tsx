import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS, exportData, useStore } from '../store/useStore'
import type { Settings } from '../types'
import { Button, IconButton } from './ui'
import { toast } from './toast'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function NumberField({ value, onChange, min, max, suffix }: { value: number; onChange(v: number): void; min: number; max: number; suffix: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        className="num h-9 w-16 rounded-lg border border-line bg-ground px-2 text-right text-sm focus:border-focus focus:outline-none"
      />
      <span className="w-8 text-xs text-muted">{suffix}</span>
    </span>
  )
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.updateSettings)
  const importData = useStore((s) => s.importData)
  const [keyDraft, setKeyDraft] = useState(settings.apiKey)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      setKeyDraft(useStore.getState().settings.apiKey)
      d.showModal()
    } else if (!open && d.open) d.close()
  }, [open])

  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update({ [k]: v } as Partial<Settings>)

  const download = () => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `supercontinuity-backup-${new Date().toISOString().slice(0, 10)}.json`,
    })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const upload = (file: File) => {
    file.text().then((txt) => {
      try {
        if (!confirm('Restoring replaces everything in this browser with the backup. Continue?')) return
        importData(txt)
        toast('Backup restored')
      } catch (e) {
        toast((e as Error).message)
      }
    })
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ground/70 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Settings</h2>
          <IconButton icon="close" label="Close settings" onClick={onClose} />
        </div>

        <h3 className="mt-5 text-sm font-semibold text-focus">Sessions</h3>
        <div className="divide-y divide-line">
          <Row label="Focus length">
            <NumberField value={settings.focusMinutes} onChange={set('focusMinutes')} min={5} max={120} suffix="min" />
          </Row>
          <Row label="Short break">
            <NumberField value={settings.breakMinutes} onChange={set('breakMinutes')} min={1} max={30} suffix="min" />
          </Row>
          <Row label="Long break" hint={`After every ${settings.sessionsBeforeLongBreak} sessions`}>
            <NumberField value={settings.longBreakMinutes} onChange={set('longBreakMinutes')} min={5} max={60} suffix="min" />
          </Row>
          <Row label="Sessions before a long break">
            <NumberField value={settings.sessionsBeforeLongBreak} onChange={set('sessionsBeforeLongBreak')} min={2} max={8} suffix="" />
          </Row>
          <Row label="Recall prompt on breaks" hint="Write one line about what you learned">
            <input type="checkbox" checked={settings.recallPrompts} onChange={(e) => update({ recallPrompts: e.target.checked })} className="size-4 accent-[var(--focus)]" />
          </Row>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-focus">Daily pace</h3>
        <div className="divide-y divide-line">
          <Row label="Daily goal" hint="Fills the ring on your library">
            <NumberField value={settings.dailyGoalMinutes} onChange={set('dailyGoalMinutes')} min={5} max={480} suffix="min" />
          </Row>
          <Row label="Daily limit" hint="Suggests stopping after this much. 0 turns it off.">
            <NumberField value={settings.dailyCapMinutes} onChange={set('dailyCapMinutes')} min={0} max={720} suffix="min" />
          </Row>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-focus">Playback</h3>
        <div className="divide-y divide-line">
          <Row label="Default speed">
            <select
              value={settings.defaultRate}
              onChange={(e) => update({ defaultRate: Number(e.target.value) })}
              className="h-9 rounded-lg border border-line bg-ground px-2 text-sm"
            >
              {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </Row>
          <Row label="Play the next lesson automatically">
            <input type="checkbox" checked={settings.autoAdvance} onChange={(e) => update({ autoAdvance: e.target.checked })} className="size-4 accent-[var(--focus)]" />
          </Row>
          <Row label="Theme">
            <select
              value={settings.theme}
              onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}
              className="h-9 rounded-lg border border-line bg-ground px-2 text-sm"
            >
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Row>
        </div>

        <h3 className="mt-5 text-sm font-semibold text-focus">YouTube Data API key</h3>
        <p className="mt-1 text-xs text-muted">
          Optional. With a key, imports include every lesson’s length and read chapters from video descriptions automatically. It stays in this browser.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="AIza…"
            autoComplete="off"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ground px-3 text-sm focus:border-focus focus:outline-none"
          />
          <Button
            size="sm"
            className="h-9"
            disabled={keyDraft === settings.apiKey}
            onClick={() => {
              update({ apiKey: keyDraft.trim() })
              toast(keyDraft.trim() ? 'Key saved' : 'Key removed')
            }}
          >
            Save key
          </Button>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-focus">Your data</h3>
        <p className="mt-1 text-xs text-muted">Everything is stored in this browser only. Download a backup to move it or keep it safe.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon="download" onClick={download}>
            Download backup
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium hover:border-muted/60">
            Restore backup
            <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <Button size="sm" variant="ghost" onClick={() => update({ ...DEFAULT_SETTINGS, apiKey: settings.apiKey })}>
            Reset settings
          </Button>
        </div>
      </div>
    </dialog>
  )
}
