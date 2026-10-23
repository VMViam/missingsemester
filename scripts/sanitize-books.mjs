#!/usr/bin/env node
/**
 * sanitize-books.mjs — clean the library metadata once and keep it clean.
 *
 * Reader imports carry control characters, underscores used as spaces,
 * HTML entities, and author strings that are really a list of everyone who
 * ever touched the book. This normalises titles and authors for display.
 *
 *   node scripts/sanitize-books.mjs --dry-run
 *   node scripts/sanitize-books.mjs
 *
 * The sync script runs the same cleaning on every import; this is for the
 * books already on disk.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "src", "data", "books.json");
const DRY = process.argv.includes("--dry-run");

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function cleanText(value) {
  if (!value) return "";
  let text = String(value);
  text = decodeEntities(text);
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/[\u0000-\u001f\u007f\u00a0]/g, " ");
  text = text.replace(/[_]+/g, " ");
  text = text.replace(/\s*[|•·]+\s*/g, " — ");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, "");
  text = text.replace(/\s+([,;:.!?])/g, "$1");
  text = text.replace(/([,;:])(?=\S)/g, "$1 ");
  return text.trim();
}

export function cleanTitle(value) {
  let title = cleanText(value);

  // Publisher suffixes: "Life Comes from Life -- Prabhupada Books".
  title = title.replace(/\s+--\s+([^:]{2,40})$/, (m, tail) =>
    tail.trim().split(/\s+/).length <= 4 ? "" : m,
  );

  // "Near - Death" -> "Near-Death".
  title = title.replace(/\s+-\s+/g, "-");

  // "TheMatchlessGift" -> "The Matchless Gift".
  title = title.replace(/([a-zà-ÿ])([A-Z])/g, "$1 $2");

  // "Easy-Journy-to-Other-Planets" -> words, when hyphens are used as spaces.
  const hyphens = (title.match(/-/g) ?? []).length;
  if (hyphens >= 3 && !/\s/.test(title)) title = title.replace(/-/g, " ");

  // "Poor Charlie's Almanack_ The Wit..." -> "Poor Charlie's Almanack: The Wit..."
  title = title.replace(/\s+—\s+/g, ": ");
  title = title.replace(/\s{2,}/g, " ").trim();
  return title;
}

export function cleanAuthor(value) {
  let author = cleanText(value);
  if (!author) return "Unknown";

  // Drop academic/medical credentials.
  author = author
    .replace(/\b(Ph\.?D|Ed\.?D|M\.?D|M\.?Sc|MBA|M\.?A|B\.?Sc)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[,\s]+$/, "")
    .trim();

  // "Benjamin Graham, Jason Zweig, Warren E. Buffett" -> "Benjamin Graham".
  // One comma is usually "Surname, Forename", so leave that alone.
  const commas = (author.match(/,/g) ?? []).length;
  if (commas >= 2) author = author.split(",")[0].trim();

  return author || "Unknown";
}

/** What fits on a spine: a very long author becomes a surname. */
export function spineAuthor(author) {
  const clean = cleanAuthor(author);
  if (clean.length <= 24) return clean;
  const words = clean.split(" ").filter(Boolean);
  return words.slice(-2).join(" ");
}

const books = JSON.parse(await readFile(BOOKS, "utf8"));
let changed = 0;

for (const book of books) {
  const title = cleanTitle(book.title);
  const author = cleanAuthor(book.author);
  if (title !== book.title || author !== book.author) changed++;
  book.title = title;
  book.author = author;
}

console.log(`${changed} of ${books.length} book(s) cleaned.`);
if (DRY) {
  for (const b of books.slice(0, 8)) console.log(`  ${b.title} — ${b.author}`);
  console.log("Dry run — nothing written.");
} else {
  await writeFile(BOOKS, `${JSON.stringify(books, null, 2)}\n`, "utf8");
  console.log(`Wrote ${BOOKS}`);
}
