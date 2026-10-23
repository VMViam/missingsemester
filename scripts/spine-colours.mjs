#!/usr/bin/env node
/**
 * spine-colours.mjs — real spines come from real covers.
 *
 * There is no such thing as a public "spine photo" dataset. What bookshops
 * and the reference bookshelf app do is derive the spine from the cover:
 * take its dominant colour, darken it to book-cloth values, and set the
 * lettering in a contrasting foil. That is what this does, once per book,
 * and caches the result so syncs stay cheap.
 *
 *   node scripts/spine-colours.mjs
 *   node scripts/spine-colours.mjs --limit 20    # try a few first
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "src", "data", "books.json");
const CACHE = join(ROOT, "data", "spine-cache.json");

const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, "utf8")) : {};
const books = JSON.parse(await readFile(BOOKS, "utf8"));

function toHex({ r, g, b }) {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** RGB -> HSL / HSL -> RGB, for clamping to cloth values. */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255];
}

function clothFrom(rgb) {
  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  // Cloth is darker and a little richer than the cover's average.
  const cloth = hslToRgb(h, Math.min(0.55, Math.max(0.22, s * 1.15)), Math.min(0.34, Math.max(0.16, l * 0.55)));
  return {
    spineColor: toHex({ r: cloth[0], g: cloth[1], b: cloth[2] }),
    foilColor: l > 0.55 ? "#e8d9a8" : "#d9bd72",
  };
}

async function colourOf(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const stats = await sharp(buf).resize(64, 96, { fit: "inside" }).stats();
  return clothFrom(stats.dominant);
}

let done = 0;
let failed = 0;
let changed = 0;

async function work(book) {
  if (book.spineColor && cache[book.id]) return;
  if (!book.coverUrl) return;
  const cached = cache[book.id];
  if (cached) {
    book.spineColor = cached.spineColor;
    book.foilColor = cached.foilColor;
    return;
  }
  try {
    const colour = await colourOf(book.coverUrl);
    book.spineColor = colour.spineColor;
    book.foilColor = colour.foilColor;
    cache[book.id] = colour;
    changed++;
  } catch {
    failed++;
  } finally {
    done++;
    if (done % 25 === 0) console.log(`  ${done} covers…`);
  }
}

const queue = books.filter((b) => b.coverUrl).slice(0, LIMIT);
console.log(`Reading ${queue.length} covers…`);

const workers = Array.from({ length: 10 }, async () => {
  while (queue.length) {
    const book = queue.shift();
    if (book) await work(book);
  }
});
await Promise.all(workers);

console.log(`Coloured ${changed}, failed ${failed}.`);
await mkdir(dirname(CACHE), { recursive: true });
await writeFile(BOOKS, `${JSON.stringify(books, null, 2)}\n`, "utf8");
await writeFile(CACHE, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
console.log(`Wrote ${BOOKS} and ${CACHE}`);
