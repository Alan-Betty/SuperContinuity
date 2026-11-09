# SuperContinuity

Local-first web app that turns a YouTube video or playlist into a paced, trackable course.
It exists to stop learners burning out: focus/break sessions, exact watched-range memory,
and quiet motivation (thread, streak, XP). See `PLAN.md` for scope and roadmap.

## Stack
- Vite + React 19 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`, tokens in `src/index.css`)
- Zustand (`persist` → localStorage key `supercontinuity:v1`)
- Vitest for pure logic in `src/lib`
- Fonts self-hosted via `@fontsource-variable` (Bricolage Grotesque display, Figtree UI)

## Commands
- `npm run dev` — dev server (http://localhost:5173)
- `npm run build` — typecheck + production build
- `npm test` — vitest (run once)
- `npm run lint` — oxlint

## Rules
- **No backend, no required API key.** Core flows must work with the YouTube IFrame API and
  oEmbed only. The Data API key in settings is an optional enhancement.
- **No bloat.** Don't add a dependency for something under ~50 lines. No UI kits, no router lib,
  no icon packs (inline SVG in `src/components/Icon.tsx`).
- Keep domain logic pure and in `src/lib/` with tests; components stay thin.
- Store changes: bump `version` + add a `migrate` step in `src/store/useStore.ts`; never break
  existing users' saved progress.
- Progress = merged watched ranges (`lib/segments.ts`), never just "max position". Lesson
  completes at `COMPLETE_RATIO` (0.9) coverage.
- Lesson ranges: a lesson is `{videoId, start, end}` — chapters/parts of one video share a videoId.

## Design system
- Tokens live as CSS variables in `src/index.css` (`--ground`, `--surface`, `--ink`, `--muted`,
  `--line`, `--focus`, `--rest`), with dark mode via `prefers-color-scheme` and `[data-theme]`.
- One memorable element: the **course thread** (`components/Thread.tsx`). Keep everything else quiet:
  no decorative gradients, no all-caps eyebrow labels, no card grids, no `→` on buttons.
- Teal `--focus` = studying; amber `--rest` = breaks. Don't use them for anything else.
- Copy: sentence case, plain verbs, buttons say what happens ("Start session", "Save note").
- Quality floor: keyboard focus visible, `prefers-reduced-motion` respected, works at 360px wide.

## Gotchas
- YouTube IFrame `getPlaylist()` is only populated after `cuePlaylist` and a short delay; the resolver
  polls (see `lib/ytApi.ts`).
- Durations are unknown until a video loads (no API key) — the player backfills `lesson.duration`.
- React StrictMode double-mounts: the player component must destroy its YT instance on unmount.
