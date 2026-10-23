# AGENTS.md

Guidance for AI agents working in this repository.

## Project

**missingsemester.in** — the "one-room schoolhouse". A studio apartment that is
also a schoolroom, holding four subjects: reading, writing, building, lifting.
The writing lives in a second site, `letters.missingsemester.in` (separate repo).

Design decisions, rationale and open questions: `docs/2026-10-19-one-room-schoolhouse-brainstorm.md`.
Read it before making design changes.

## Stack

- **Astro** (static output, TypeScript strict)
- **No UI framework.** The room is CSS 3D (`preserve-3d`, perspective) and
  layered planes. Do not add React/Vue for the room — it is deliberately
  dependency-light so the site stays fast and degrades gracefully.
- **Content collections** with Zod schemas (`src/content.config.ts`) — every
  book and post is validated at build time. Agent-written content that is
  malformed must fail the build, not deploy.

## Commands

```bash
npm install
npm run dev          # dev server
npm run build        # static build to dist/
npm run preview      # serve the build
node scripts/sync-books.mjs --dry-run   # library enrichment preview
```

The dev server runs in background mode: `npx astro dev --background`, managed
with `astro dev stop|status|logs`.

## Structure

```
src/
  components/     room pieces: Shelf.astro, PlateTree.astro, Chalkboard.astro, Terminal.astro
  content/        markdown (posts, pages)
  data/           books.json — the library
  layouts/        Base.astro
  pages/          the room, /reading, /lifting, /building, /about
  styles/         tokens.css (the design system), global.css
scripts/          agent-run pipelines
data/             books.inbox.json — your plain book list (input to the pipeline)
```

## Design rules

1. **Four materials, four voices.** Reading is printed/oak, writing is typed/paper,
   building is monospace/glass, lifting is chalk/slate. Do not blur them.
2. **Objects, not words.** Communicate through materials and objects. No
   explanatory banners or labels in the UI.
3. **Every subject: one object to grab, one surface to read it on.**
4. **A persistent top nav.** A thin sticky bar carries the four subjects on
   every page. The room is still the front door; the nav is the sign above it.
   Every subject still needs a real route.
5. **The room is a front door, not the only door.** Semantic HTML for all
   content must exist underneath, and pages must work without JavaScript.
6. **Tokens only.** No hard-coded colours or sizes in components — use
   `src/styles/tokens.css`.

## Content rules

- Posts live in the other repo (`missingsemester-blog`).
- Books: `src/data/books.json`, validated by the schema. Fields that are the
  owner's (status, rating, dates, notes, quote) are never overwritten by the
  enrichment script. Catalogue fields (year, publisher, pages, coverUrl) are.
- New books: add to `data/books.inbox.json`, run `scripts/sync-books.mjs`.

## Do not commit

- `dist/`, `node_modules/`, `.astro/`
