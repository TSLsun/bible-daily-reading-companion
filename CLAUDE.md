# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repo.

## Project Overview

Single-page React + TypeScript app (Vite) for daily Bible reading, targeted at Traditional Chinese users. 2026 reading plan hardcoded in `constants.tsx`. No backend — verses fetched live from [FHL API](https://bible.fhl.net). All user state persisted in `localStorage`.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server
npm run build     # Type-check + build to dist/
npm run lint      # Run ESLint
npm run test      # Run vitest test suite
npm run preview   # Preview production build locally
```

Pre-commit hook runs `lint-staged` (ESLint with autofix on staged `.ts`/`.tsx` files).

**After every implementation, always run:**
```bash
npm run lint      # must pass with 0 errors
npm run test      # all tests must pass
npm run build     # tsc + vite build must succeed
```

## Architecture

Intentionally minimal — nearly all UI and business logic in one file:

| File | Role |
|---|---|
| `App.tsx` | Entire app: state, all React components, Bible fetch logic, schedule parsing, design tokens |
| `constants.tsx` | `BIBLE_BOOKS` (Chinese→API code map), `BIBLE_ALIASES` (shorthand), `FALLBACK_VERSIONS` (translation list), `DEFAULT_DAILY_SCHEDULE` (full 2026 plan) |
| `types.ts` | All TypeScript interfaces (`AppSettings`, `BibleData`, `ScheduleItem`, etc.) |
| `index.tsx` | React root mount |
| `index.html` | Loads Tailwind CSS via CDN, Google Fonts (Noto Serif TC, Noto Sans TC, Inter), importmap for ESM dev |
| `vite.config.ts` | Sets `base` to `/bible-daily-reading-companion`, injects `__APP_VERSION__` global |
| `src/utils/` | Pure functions extracted from App.tsx: `bible-lookup.ts`, `migrations.ts`, `schedule-parser.ts`, each with co-located `.test.ts` (35 tests total, vitest) |

## Key Concepts

### Schedule Item ID Format
Completed-reading tracking uses three-generation ID format. Current format (v3):
```
YYYY-MM-DD:BookCode[Chapter][:<startVerse>-<endVerse>]
# e.g.  2026-01-01:Mt1   or   2026-04-29:Ps119:1-16
```
On startup, `App.tsx` migrates legacy v1 (bare IDs like `Mt1`) and v2 (`MM-DD:Mt1`) records from `localStorage` to v3. `PLAN_YEAR` constant (currently `2026`) controls calendar default year.

### Bible API
Verses fetched from `https://bible.fhl.net/json/qsb.php?qstr=<BookCode><Chapter>&version=<ver>&strong=0&gb=0`. Response is **Big5-encoded** — must decode with `new TextDecoder("big5")` before `JSON.parse`.

Verse text may contain inline HTML tags (`<h2>`, `<h3>`, `<subheading>`, `<u>`, `<br>`, CSS classes `.red`/`.explain`). `VerseText` component in `App.tsx` handles rendering.

### Book Name Lookup
`BIBLE_BOOKS` maps full Traditional Chinese book names to API codes. `BIBLE_ALIASES` maps shorthand (e.g., `太` → `馬太福音`). **Multi-character aliases must come before single-character ones** in `BIBLE_ALIASES` — prevents false prefix matches. `findBookCode` uses `startsWith` iteration order.

### Schedule Modes
- **`static`**: Free-form newline-separated text in `settings.scheduleText`. No date association.
- **`daily`**: JSON object keyed by `YYYY-MM-DD` in `settings.dailyScheduleJson`. `DEFAULT_DAILY_SCHEDULE` in `constants.tsx` is shipped default.

Multiple books on one line use Chinese enumeration comma `、` (e.g., `俄 1、拿 1-2`).

### State & Persistence
All settings stored under `bible_settings` key in `localStorage`. `saveSettings` / `updateSetting` helpers in `App.tsx` keep React state and localStorage in sync.

### Theming & Design Tokens
Three themes: `light`, `sepia`, `dark`. Design tokens at top of `App.tsx`:

- **`T`** — `Record<Theme, TK>`: color palette per theme (bg, surface, ink, inkSoft, muted, faint, line, lineStrong, pill, success)
- **`A`** — `AccentTone` (`{ base, soft, tint }`): derived per render via `getAccent(settings.accent, settings.theme)`
- **`F`** — font family strings: `F.serif` (Noto Serif TC), `F.sans` (Noto Sans TC), `F.label` (Inter)
- **`ACCENT_PRESETS`** — 5 named accent palettes (ink/pine/crimson/umber/violet), light+dark variants each
- **`FONT_STYLE_PRESETS`** — 4 named font styles (serif/serif-bold/sans/sans-bold) controlling verse font-family and font-weight

When touching UI: use `theme.{token}` for colors, `A.{base|soft|tint}` for accent, `F.{serif|sans|label}` for fonts. Tailwind loaded via CDN — no Vite Tailwind plugin, JIT/purging doesn't apply. Prefer inline styles with token system over Tailwind classes.

### Deployment
GitHub Actions (`deploy.yml`) builds and deploys to GitHub Pages on release publish. Build injects `VITE_COMMIT_SHA` (from `github.sha`) into footer version string.