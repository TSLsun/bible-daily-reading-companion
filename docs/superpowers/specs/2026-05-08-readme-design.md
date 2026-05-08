# README Update Design

**Date:** 2026-05-08
**Status:** Approved

## Goal

Replace the placeholder AI Studio README with a polished, accurate README that serves both personal reference and public showcase goals.

## Audience

Primary: the author and friends who use the live site.
Secondary: anyone landing on the GitHub repo cold (portfolio / social sharing).

## Language

English only.

## Structure

### 1. Header
- Title: `Bible Daily Reading Companion`
- Tagline: *A daily Bible reading tracker supporting Traditional Chinese and English Bible translations*
- Badges: live site shield link + GitHub release version badge

### 2. About
2–3 sentences covering:
- What it is: a no-backend single-page web app
- Who it's for: readers following a structured daily plan
- Key differentiator: verses fetched live from the FHL API, progress saved in localStorage (no account needed)

### 3. Features
Bullet list:
- 2026 daily reading schedule, auto-navigates to today's reading
- Multiple Traditional Chinese and English Bible translations via the FHL API
- Light / Sepia / Dark themes
- Progress tracking — mark readings complete, fully persisted in-browser (no account)
- Navigate previous and next readings within the plan

### 4. Tech Stack
- React 19 + TypeScript
- Vite
- Tailwind CSS (CDN)
- FHL Bible API (`bible.fhl.net`)
- Deployed via GitHub Actions to GitHub Pages

### 5. Getting Started
```
Prerequisites: Node.js

npm install       # Install dependencies
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Type-check + build to dist/
npm run preview   # Preview production build locally
```

### 6. Origin Note (bottom)
Small tasteful line:
> Originally scaffolded with [Google AI Studio](https://ai.studio/apps/drive/1kqR0DqtDYMaP9eTFZp1YTmNVuHRB9Vk7)

## Out of Scope
- Screenshot or banner image (to be added later if desired)
- Contributing guide
- Architecture overview
- License section
