# README Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder AI Studio README with a polished, accurate README covering the project's purpose, features, tech stack, and dev setup.

**Architecture:** Single file rewrite — `README.md` at the repo root. No code changes; no tests required. One task, one commit.

**Tech Stack:** Markdown, GitHub Flavored Markdown badges (shields.io)

---

### Task 1: Write the new README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with the following content**

Write the file at `README.md` with this exact content:

```markdown
# Bible Daily Reading Companion

> A daily Bible reading tracker supporting Traditional Chinese and English Bible translations

[![Live Site](https://img.shields.io/badge/Live%20Site-GitHub%20Pages-blue?style=flat-square)](https://tslsun.github.io/bible-daily-reading-companion/)
[![GitHub release](https://img.shields.io/github/v/release/TSLsun/bible-daily-reading-companion?style=flat-square)](https://github.com/TSLsun/bible-daily-reading-companion/releases)

## About

Bible Daily Reading Companion is a no-backend single-page web app for following a structured daily Bible reading plan. Verses are fetched live from the [FHL Bible API](https://bible.fhl.net), and all reading progress is saved in your browser's localStorage — no account or sign-up required.

## Features

- **2026 daily reading schedule** — auto-navigates to today's reading on load
- **Multiple translations** — Traditional Chinese and English Bible translations via the FHL API
- **Themes** — Light, Sepia, and Dark modes
- **Progress tracking** — mark readings complete, fully persisted in-browser with no account needed
- **Plan navigation** — move between previous and next readings within the plan

## Tech Stack

- [React 19](https://react.dev) + TypeScript
- [Vite](https://vite.dev)
- [Tailwind CSS](https://tailwindcss.com) (via CDN)
- [FHL Bible API](https://bible.fhl.net) (`bible.fhl.net`)
- Deployed via GitHub Actions to [GitHub Pages](https://pages.github.com)

## Getting Started

**Prerequisites:** Node.js

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (http://localhost:5173)
npm run build     # Type-check + build to dist/
npm run preview   # Preview production build locally
```

---

> Originally scaffolded with [Google AI Studio](https://ai.studio/apps/drive/1kqR0DqtDYMaP9eTFZp1YTmNVuHRB9Vk7)
```

- [ ] **Step 2: Verify the file looks correct**

Open `README.md` and confirm:
- Title and tagline are present
- Both badges render (live site + release version)
- All 6 sections are present: About, Features, Tech Stack, Getting Started, origin note
- No leftover AI Studio content (no "Gemini", no Drive link in the body)

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with accurate project description and setup guide"
```
