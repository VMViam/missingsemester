#!/usr/bin/env node
/**
 * sync-books.mjs — build src/data/books.json from your own list.
 *
 * You keep a plain list of the books you own (data/books.inbox.json, or a CSV
 * converted to it). This script fills in the boring metadata — year, publisher,
 * page count, cover — from Open Library and Google Books, and never touches the
 * fields that are *yours*: status, rating, dates, notes, quotes.
 *
 *   node scripts/sync-books.mjs            # enrich and write
 *   node scripts/sync-books.mjs --dry-run  # show what would change
 *   node scripts/sync-books.mjs --no-lookup # metadata pass only, no network
 *
 * Inbox format (only title is required):
 *   [{ "title": "Sapiens", "author": "Yuval Noah Harari", "status": "read" }]
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INBOX = join(ROOT, "data", "books.inbox.json");
const OUT = join(ROOT, "src", "data", "books.json");

const DRY_RUN = process.argv.includes("--dry-run");
const NO_LOOKUP = process.argv.includes("--no-lookup");

/** Fields that describe the *physical* book — safe to refresh from a catalogue. */
const LOOKUP_FIELDS = ["year", "publisher", "pages", "coverUrl"];

/** Fields that are *yours* — never overwritten by a lookup. */
const YOUR_FIELDS = ["status", "rating", "dateAdded", "dateRead", "notes", "quote", "category", "spineColor", "spineWidth"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "missingsemester.in/1.0 (personal library)" },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt === 2) return null;
      await sleep(700 * (attempt + 1));
    }
  }
  return null;
}

/** Open Library first: no key, generous, good for older and non-English titles. */
async function lookupOpenLibrary(title, author) {
  const q = author ? `${title} ${author}` : title;
  const url = `https://openlibrary.org/search.json?limit=1&fields=title,author_name,first_publish_year,publisher,number_of_pages_median,cover_i,edition_key&title=${encodeURIComponent(title)}${author ? `&author=${encodeURIComponent(author)}` : ""}`;
  const data = await fetchJson(url);
  const doc = data?.docs?.[0];
  if (!doc) return null;
  return {
    year: doc.first_publish_year ?? undefined,
    publisher: doc.publisher?.[0] ?? undefined,
    pages: doc.number_of_pages_median ?? undefined,
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : undefined,
  };
}

/** Google Books second: better covers, better page counts for modern titles. */
async function lookupGoogleBooks(title, author) {
  const q = encodeURIComponent(`intitle:${title}${author ? ` inauthor:${author}` : ""}`);
  const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`);
  const info = data?.items?.[0]?.volumeInfo;
  if (!info) return null;
  const thumb = info.imageLinks?.thumbnail?.replace("http://", "https://").replace("&edge=curl", "");
  return {
    year: info.publishedDate ? Number(String(info.publishedDate).slice(0, 4)) : undefined,
    publisher: info.publisher ?? undefined,
    pages: info.pageCount ?? undefined,
    coverUrl: thumb ?? undefined,
  };
}

async function enrich(book) {
  if (NO_LOOKUP) return { book, changed: false };
  const missing = LOOKUP_FIELDS.filter((f) => !book[f]);
  if (missing.length === 0) return { book, changed: false };

  const ol = await lookupOpenLibrary(book.title, book.author);
  let patch = {};
  if (ol) {
    for (const f of LOOKUP_FIELDS) if (!book[f] && ol[f]) patch[f] = ol[f];
  }
  if (LOOKUP_FIELDS.some((f) => !book[f] && !patch[f])) {
    const gb = await lookupGoogleBooks(book.title, book.author);
    if (gb) {
      for (const f of LOOKUP_FIELDS) if (!book[f] && !patch[f] && gb[f]) patch[f] = gb[f];
    }
  }
  return { book: { ...book, ...patch }, changed: Object.keys(patch).length > 0 };
}

function mergeInbox(existing, inbox) {
  const byKey = new Map();
  for (const b of existing) byKey.set(`${b.id}::${b.title}`.toLowerCase(), b);
  const out = [];
  let added = 0;
  let updated = 0;

  for (const raw of inbox) {
    const id = raw.id || `${slugify(raw.author ?? "unknown")}-${slugify(raw.title)}`;
    const key = `${id}::${raw.title}`.toLowerCase();
    const prior = byKey.get(key);
    const base = prior ?? {
      id,
      title: raw.title,
      author: raw.author ?? "Unknown",
      status: raw.status ?? "to-read",
      category: raw.category ?? "misc",
    };
    // Your fields win; only fill the gaps.
    const merged = { ...base };
    for (const f of YOUR_FIELDS) {
      if (raw[f] !== undefined) merged[f] = raw[f];
    }
    for (const f of LOOKUP_FIELDS) {
      if (raw[f] !== undefined && merged[f] === undefined) merged[f] = raw[f];
    }
    if (!prior) added++;
    else updated++;
    out.push(merged);
  }
  return { out, added, updated };
}

async function main() {
  if (!existsSync(INBOX)) {
    console.log(`No inbox at ${INBOX}`);
    console.log("Create it with a list of books, e.g.:");
    console.log('  [{ "title": "Sapiens", "author": "Yuval Noah Harari", "status": "read" }]');
    return;
  }

  const inbox = JSON.parse(await readFile(INBOX, "utf8"));
  const existing = existsSync(OUT) ? JSON.parse(await readFile(OUT, "utf8")) : [];

  const { out, added, updated } = mergeInbox(existing, inbox);
  console.log(`Inbox: ${inbox.length} books (${added} new, ${updated} known)`);

  const enriched = [];
  let changedCount = 0;
  for (const book of out) {
    const { book: next, changed } = await enrich(book);
    if (changed) changedCount++;
    enriched.push(next);
    await sleep(250);
  }

  enriched.sort((a, b) => {
    const rank = { reading: 0, "to-read": 1, read: 2 };
    const ra = rank[a.status] ?? 3;
    const rb = rank[b.status] ?? 3;
    if (ra !== rb) return ra - rb;
    return String(a.author).localeCompare(String(b.author));
  });

  console.log(`Enriched ${changedCount} book(s) with catalogue data.`);
  if (DRY_RUN) {
    console.log("Dry run — nothing written. Preview:");
    console.log(JSON.stringify(enriched.slice(0, 3), null, 2));
    return;
  }

  await writeFile(OUT, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
  console.log(`Wrote ${enriched.length} books to src/data/books.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
