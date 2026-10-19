---
date: 2026-10-19
topic: one-room-schoolhouse
---

# The One-Room Schoolhouse

## What we're building

Two sites that together are one room.

- **missingsemester.in** — the room. The landing page where the whole thing is
  designed. A studio apartment that is also a one-room schoolhouse: four
  subjects, each with an object that carries its content.
- **blog.missingsemester.in** — the writing. Posts read as typed sheets of paper.

Four subjects, four objects, four materials, four voices:

| Subject | Object | Read on | Material | Voice |
|---|---|---|---|---|
| Reading | the shelf | a book, pulled out | oak, cloth, gold foil | printed, formal |
| Writing | the desk | a typed sheet | cream stock, ink | composed, careful |
| Building | the terminal | a prompt, mid-build | dark glass, phosphor | exact, machine |
| Lifting | the plate tree | the chalkboard | iron, slate, chalk | aphoristic, scrawled |

## Why this approach

- **A studio apartment, not a school corridor.** A one-room schoolhouse was
  literally a single-room building where one teacher taught every age at once —
  functionally a studio apartment. The domestic bits (bed, lamp, rug, mug, plant)
  keep it from being a museum; the school bits (desk, shelf, blackboard, mat,
  timetable) make it legible. The tension between the two is the charm.
- **Objects, not words.** The room says "school" through slate, oak, iron and
  institutional green — not through signage. Two rules: no banners, and the
  apartment must stay visible.
- **One object to grab, one surface to read it on.** Every subject follows the
  same mechanic: pull a thing, read on another thing. Shelf → book → page.
  Desk → sheet → page. Plate tree → plate → chalkboard.
- **2.5D, not WebGL.** The room is layered planes with a perspective camera;
  the zoom is a CSS transform; the shelf is genuinely 3D via CSS `preserve-3d`.
  Felix's site took a studio months — this is the same *feeling* at a fraction
  of the cost, and it degrades to a plain readable site.
- **The library is data, not decoration.** Real books, real states. The shelf
  shows spines; a covers grid handles browsing; the three states map onto a
  real library's three states (on the shelf / on loan / on hold).

## Key decisions

- **Platform: Astro.** Static, free, agent-friendly. Content collections with
  Zod schemas mean agent-written content fails the build loudly instead of
  deploying broken.
- **Two repos, two domains.** `missingsemester` (the room) and
  `missingsemester-blog` (the writing), sharing design tokens.
- **Agent workflow.** Posts and library entries are files in git. An agent
  writes them, builds, verifies, commits. `scripts/sync-books.mjs` enriches a
  plain book list with catalogue data (Open Library, then Google Books) without
  ever overwriting your own fields.
- **The chalkboard carries lifting.** Scrawled, aphoristic, personal — the only
  surface that looks *said* rather than *made*. The plate tree is the index:
  each plate is a post, the title cast in the centre where the weight normally
  goes, the year on the rim, colour/size coding the sub-topic.
- **Navigation is the room.** No nav bar. A timetable strip along the bottom
  (Period 01 Reading · 02 Writing · 03 Building · 04 Lifting), keys 1–4, Esc
  backs out. Every subject still has a real, linkable route.

## Open questions

- Room art: generated illustration vs. photos of the user's own desk/shelf/rack.
- What the "building" subject shows: projects, a live git log, or both.
- What goes on the chalkboard: training principles, a program, or PRs.

## Next steps

1. CSS 3D shelf (the signature object) — real books, pull-to-open
2. Desk: typed pages for posts
3. Terminal: mono surface, live git log
4. Chalkboard + plate tree
5. The room: base plate, perspective, zoom transitions, timetable strip
6. Fallbacks and accessibility
7. `missingsemester-blog` repo for the writing
