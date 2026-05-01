# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page React + TypeScript app (Vite) for daily Bible reading, targeted at Traditional Chinese users. The 2026 reading plan is hardcoded in `constants.tsx`. There is no backend — Bible verses are fetched live from the [FHL API](https://bible.fhl.net). All user state is persisted in `localStorage`.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server
npm run build     # Type-check + build to dist/
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

There is no test suite. The pre-commit hook runs `lint-staged` (ESLint with autofix on staged `.ts`/`.tsx` files).

## Architecture

The codebase is intentionally minimal — nearly all UI and business logic lives in a single file:

| File | Role |
|---|---|
| `App.tsx` | Entire application: state, all React components, Bible fetch logic, schedule parsing |
| `constants.tsx` | `BIBLE_BOOKS` (Chinese→API code map), `BIBLE_ALIASES` (shorthand), `FALLBACK_VERSIONS` (translation list), `DEFAULT_DAILY_SCHEDULE` (full 2026 plan) |
| `types.ts` | All TypeScript interfaces (`AppSettings`, `BibleData`, `ScheduleItem`, etc.) |
| `index.tsx` | React root mount |
| `index.html` | Loads Tailwind CSS via CDN, Google Fonts, and an importmap for ESM dev |
| `vite.config.ts` | Sets `base` to `/bible-daily-reading-companion`, injects `__APP_VERSION__` global |

## Key Concepts

### Schedule Item ID Format
Completed-reading tracking uses a three-generation ID format. The current format (v3) is:
```
YYYY-MM-DD:BookCode[Chapter][:<startVerse>-<endVerse>]
# e.g.  2026-01-01:Mt1   or   2026-04-29:Ps119:1-16
```
On startup, `App.tsx` migrates legacy v1 (bare IDs like `Mt1`) and v2 (`MM-DD:Mt1`) records stored in `localStorage` to the v3 format. The `PLAN_YEAR` constant (currently `2026`, set at `App.tsx:197`) controls which year the calendar defaults to.

### Bible API
Verses are fetched from `https://bible.fhl.net/json/qsb.php?qstr=<BookCode><Chapter>&version=<ver>&strong=0&gb=0`. The response is **Big5-encoded**, so it must be decoded with `new TextDecoder("big5")` before `JSON.parse`.

Verse text from the API may contain inline HTML tags (`<h2>`, `<h3>`, `<subheading>`, `<u>`, `<br>`, and CSS classes `.red`/`.explain`). The `VerseText` component in `App.tsx` handles rendering all of these.

### Book Name Lookup
`BIBLE_BOOKS` maps full Traditional Chinese book names to API codes. `BIBLE_ALIASES` maps shorthand (e.g., `太` → `馬太福音`). **Multi-character aliases must be ordered before single-character ones** in `BIBLE_ALIASES` to prevent false prefix matches — the `findBookCode` function uses `startsWith` iteration order.

### Schedule Modes
- **`static`**: Free-form newline-separated text in `settings.scheduleText`. No date association.
- **`daily`**: JSON object keyed by `YYYY-MM-DD` dates stored in `settings.dailyScheduleJson`. `DEFAULT_DAILY_SCHEDULE` in `constants.tsx` is the shipped default.

Multiple books on one line use the Chinese enumeration comma `、` (e.g., `俄 1、拿 1-2`).

### State & Persistence
All settings are stored under the `bible_settings` key in `localStorage`. The `saveSettings` / `updateSetting` helpers in `App.tsx` keep React state and localStorage in sync.

### Theming
Three themes: `light`, `sepia`, `dark`. Each component that varies by theme uses an inline lookup object keyed by `Theme` (e.g., `containerBg[theme]`). Tailwind is loaded via CDN — there is no Vite Tailwind plugin, so JIT/purging does not apply.

### Deployment
GitHub Actions (`deploy.yml`) builds and deploys to GitHub Pages on release publish. The build injects `VITE_COMMIT_SHA` (from `github.sha`) into the version string displayed in the footer.
