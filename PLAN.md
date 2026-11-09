# SuperContinuity — Plan

## Problem
Finishing a YouTube course is hard. Long playlists and 10-hour single videos are boring
to push through, people binge then burn out, and YouTube forgets where you were inside
a course (it only remembers single videos, loosely).

## Product in one line
Paste a YouTube video or playlist URL; get a focused course player that paces you in
sessions, remembers exactly what you watched, and makes steady progress feel rewarding.

## Principles
- **Local-first.** No account, no backend. State lives in `localStorage`; export/import JSON.
- **No bloat.** Every feature must serve "finish the course without burning out".
- **No API key required.** YouTube IFrame API + oEmbed cover the core. An optional
  YouTube Data API key unlocks durations and auto-chapters.
- **Calm, professional UI.** One memorable element (the course thread); everything
  else stays quiet.

## Core features (v1 — implemented in this pass)
1. **Import** a video or playlist URL.
   - Playlist → lesson list via hidden IFrame player `getPlaylist()`, titles via oEmbed.
   - Single long video → lessons from pasted chapter timestamps, or auto-split into
     ~20 min parts when it is longer than 45 min.
2. **Timeline memory.** Resume position per lesson, plus the *actual watched ranges*
   (merged segments), so "progress" means content seen, not scrubbed past.
   A lesson completes at 90% coverage.
3. **Session system** (anti-burnout).
   - Focus/break intervals (default 25/5, long break every 4 sessions).
   - At the end of focus: video pauses, break screen with a one-line recall prompt
     ("What did you just learn?") saved as a timestamped note, plus a short stretch cue.
   - Daily goal (default 45 min) and daily soft cap (default 120 min) with a gentle
     "stop for today" screen that can be overridden.
4. **Course thread.** The whole course drawn as one line, split per lesson, filled only
   where you watched. Click to jump to any lesson.
5. **Notes & bookmarks** at timestamps, click to seek, export as Markdown.
6. **Motivation without noise.** XP (minutes + completions + recall notes), level,
   day streak, daily goal ring, 16-week activity heatmap, finish ETA at your pace.
7. **Keyboard-first.** Space, J/L (±10s), N (note), B (bookmark), `[` `]` (speed), M (mark done), Shift+N/P (next/prev), ? (help).
8. **Settings & backup.** Session lengths, goal/cap, default speed, optional API key,
   JSON export/import.

## Later (v2 candidates)
- Split very long *playlist* videos (and an over-long final chapter) into ~20 min parts too.
- Spaced-repetition review cards generated from recall notes.
- Data API: playlist durations up front, auto chapter detection from descriptions.
- PWA install + offline shell; optional sync (e.g. a user-supplied Gist).
- Weekly review screen ("this week you covered 3h 10m across 14 lessons").
- Transcript-based quick quizzes (needs a transcript source; out of scope for local-only).

## Architecture
```
src/
  types.ts                 domain types
  lib/youtube.ts           URL parsing, chapters parsing, auto-split, thumbnails
  lib/ytApi.ts             IFrame API loader, playlist resolver
  lib/metadata.ts          oEmbed + optional Data API
  lib/segments.ts          watched-range merge & coverage
  lib/stats.ts             XP, level, streak, ETA, day keys
  lib/format.ts            time formatting
  store/useStore.ts        zustand + persist (courses, progress, notes, activity, settings)
  store/session.ts         focus/break session state machine (not persisted)
  components/              Thread, Player, SessionBar, BreakOverlay, Notes, LessonList, ...
  pages/Library.tsx        import, continue, course rows, stats
  pages/CoursePage.tsx     player + lessons/notes + thread + session bar
```
Routing is a tiny hash router (`#/`, `#/course/:id`) — no router dependency.

## Milestones
- [x] M1 Scaffold, docs, design tokens
- [x] M2 Import (video, playlist, chapters, auto-split)
- [x] M3 Player with progress tracking + resume
- [x] M4 Session system + break/recall + daily cap
- [x] M5 Thread, notes, stats, heatmap, settings, backup
- [x] M6 First polish pass: e2e run in Chromium (import, tracking, break, cap, dark, mobile)
- [ ] M6b Full a11y audit, PWA shell
- [ ] M7 v2 features above
