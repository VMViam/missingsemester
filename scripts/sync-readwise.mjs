#!/usr/bin/env node
/**
 * sync-readwise.mjs — build the library from Readwise Reader.
 *
 * Reader is the source of truth for what you own and where you are with it.
 * This maps Reader's reading state onto the library's three physical states:
 *
 *   reading_progress >= 0.99  ->  "read"      (on the shelf)
 *   0 < progress < 0.99       ->  "reading"   (on loan, with a due-date slip)
 *   progress == 0             ->  "to-read"   (a hold request in the drawer)
 *
 * Metadata (year, publisher, pages, cover) comes straight from Reader's
 * `book_details`. Your own fields — rating, category, notes, quote, spine
 * colour — are preserved from the existing books.json and never overwritten.
 *
 *   READER_API_TOKEN=... node scripts/sync-readwise.mjs
 *   node scripts/sync-readwise.mjs --dry-run
 *
 * Get a token at https://readwise.io/access_token
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "books.json");
const API = "https://readwise.io/api/v3";

const DRY_RUN = process.argv.includes("--dry-run");
const TOKEN = process.env.READER_API_TOKEN;

/** Fields that belong to the owner. Preserved across every sync. */
const YOUR_FIELDS = ["rating", "category", "notes", "quote", "spineColor", "spineWidth", "status"];

/** The list endpoint is rate limited to 20 requests per minute. */
const RATE_LIMIT = 20;
const requestTimes = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wait until we are under the rate limit, then record the request. */
async function throttle() {
  const now = Date.now();
  requestTimes.push(now);
  while (requestTimes.length > RATE_LIMIT) {
    const oldest = requestTimes[0];
    const waitMs = 60_000 - (now - oldest);
    if (waitMs <= 0) break;
    await sleep(waitMs + 250);
    requestTimes.shift();
  }
}

/** A book's spine gets thicker with its page count. */
function spineWidthFor(pages) {
  if (!pages) return 24;
  return Math.max(16, Math.min(46, Math.round(16 + pages / 26)));
}

function statusFor(progress) {
  if (progress >= 0.99) return "read";
  if (progress > 0) return "reading";
  return "to-read";
}

async function fetchPage(category, cursor) {
  const url = new URL(`${API}/list/`);
  url.searchParams.set("category", category);
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("pageCursor", cursor);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await throttle();
      const res = await fetch(url, {
        headers: { Authorization: `Token ${TOKEN}` },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(800 * (attempt + 1));
    }
  }
}

async function fetchAllBooks() {
  const books = [];
  // Books live in Reader as epubs and pdfs. Everything else in the library
  // is an article, a highlight or a note — not a book.
  for (const category of ["epub", "pdf"]) {
    let cursor = null;
    try {
      do {
        const data = await fetchPage(category, cursor);
        books.push(...(data.results ?? []));
        cursor = data.nextPageCursor ?? null;
      } while (cursor);
    } catch (err) {
      console.warn(`  ! ${category} category unavailable: ${err.message}`);
    }
  }
  return books;
}

/**
 * Map a Reader document onto a library entry.
 *
 * Field names come from the Reader API docs (readwise.io/reader_api):
 *   image_url, published_date, last_opened_at, saved_at, reading_progress
 * with fallbacks to the older book_details block, which some library
 * imports still carry.
 */
function toLibraryEntry(book) {
  const details = book.book_details ?? {};
  const progress = Number(book.reading_progress ?? 0);
  const id = `rw-${book.id}`;

  const entry = {
    id,
    title: book.title ?? "Untitled",
    author: book.author ?? "Unknown",
    status: statusFor(progress),
    category: "misc",
  };

  if (progress > 0 && progress < 0.99) {
    entry.progress = Math.round(progress * 100);
  }

  const added = book.saved_at ?? book.created_at;
  if (added) entry.dateAdded = String(added).slice(0, 10);

  const read = book.last_opened_at ?? book.last_read_at;
  if (read && progress >= 0.99) entry.dateRead = String(read).slice(0, 10);

  const published = details.published_year ?? book.published_date;
  if (published) {
    const year = Number(String(published).slice(0, 4));
    if (!Number.isNaN(year)) entry.year = year;
  }

  if (details.publisher) entry.publisher = details.publisher;
  if (details.number_of_pages) entry.pages = details.number_of_pages;

  const cover = details.cover_url ?? book.image_url;
  if (cover) entry.coverUrl = cover;

  if (details.isbn) entry.isbn = String(details.isbn);
  if (details.asin) entry.asin = details.asin;
  if (details.number_of_pages) entry.spineWidth = spineWidthFor(details.number_of_pages);

  return entry;
}

async function main() {
  if (!TOKEN) {
    console.error("READER_API_TOKEN is not set.");
    console.error("Get one at https://readwise.io/access_token");
    process.exit(1);
  }

  console.log("Fetching books from Readwise Reader…");
  const books = await fetchAllBooks();
  console.log(`  ${books.length} books in Reader`);

  const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : [];
  const byId = new Map(existing.map((b) => [b.id, b]));

  const merged = books.map((raw) => {
    const fresh = toLibraryEntry(raw);
    const prior = byId.get(fresh.id);
    if (!prior) return fresh;
    const kept = {};
    for (const f of YOUR_FIELDS) {
      if (prior[f] !== undefined) kept[f] = prior[f];
    }
    return { ...fresh, ...kept, spineWidth: prior.spineWidth ?? fresh.spineWidth };
  });

  // Books that live in books.json but no longer in Reader stay in the library.
  const readerIds = new Set(merged.map((b) => b.id));
  const orphans = existing.filter((b) => !readerIds.has(b.id) && !b.id.startsWith("rw-"));
  const all = [...merged, ...orphans];

  const rank = { reading: 0, "to-read": 1, read: 2 };
  all.sort((a, b) => {
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return String(a.author).localeCompare(String(b.author));
  });

  const counts = all.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`  on loan ${counts.reading ?? 0} · on hold ${counts["to-read"] ?? 0} · on the shelf ${counts.read ?? 0}`);

  if (DRY_RUN) {
    console.log("Dry run — nothing written. First entries:");
    console.log(JSON.stringify(all.slice(0, 3), null, 2));
    return;
  }

  await writeFile(OUT, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  console.log(`Wrote ${all.length} books to src/data/books.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
