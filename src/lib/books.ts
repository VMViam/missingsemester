/**
 * Shelf geometry.
 *
 * The shelf must look identical on every build — no hydration flicker, no
 * random reshuffle between deploys. So all "randomness" is derived from a
 * hash of the book's id.
 */

export interface Book {
  id: string;
  title: string;
  author: string;
  status: "read" | "reading" | "to-read";
  category: string;
  genre?: string;
  rating?: number;
  dateAdded?: string;
  dateRead?: string;
  progress?: number;
  year?: number;
  publisher?: string;
  pages?: number;
  coverUrl?: string;
  spineColor?: string;
  spineWidth?: number;
  notes?: string;
  quote?: string;
}

/** djb2 — small, fast, good enough to scatter values. */
export function hash(text: string): number {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return h;
}

export interface Geometry {
  /** Spine width in px (thickness of the book). */
  w: number;
  /** Height in px. */
  h: number;
  /** Depth in px (how far the book reaches back). */
  d: number;
  /** Degrees of lean, 0 for most books. */
  lean: number;
  /** True for the one or two books that lean against a neighbour. */
  leans: boolean;
}

const MIN_W = 20;
const MAX_W = 46;
const MIN_H = 196;
const MAX_H = 268;
const MIN_D = 34;
const MAX_D = 62;

/**
 * Derive a book's physical presence from its id and metadata.
 * Page count drives thickness; the id drives height, depth and lean.
 */
export function geometryFor(book: Book): Geometry {
  const seed = hash(book.id);

  // Thickness: prefer the catalogue's page count, fall back to the id.
  const fromPages = book.pages ? Math.round(16 + book.pages / 26) : 0;
  const w = Math.max(
    MIN_W,
    Math.min(MAX_W, fromPages || MIN_W + (seed % (MAX_W - MIN_W))),
  );

  const h = MIN_H + ((seed >>> 3) % (MAX_H - MIN_H));
  // Depth is proportional to height: a 240mm book is ~140mm deep, and the
  // cover face is what you see when you pull a book out, so it has to be a
  // real cover — not a sliver.
  const d = Math.round(h * (0.5 + ((seed >>> 7) % 12) / 100));

  // Roughly one book in seven leans into its neighbour.
  const leans = (seed >>> 11) % 7 === 0;
  const lean = leans ? 5 + ((seed >>> 13) % 5) : 0;

  return { w, h, d, lean, leans };
}

/** A readable spine colour even when the book has none of its own. */
export function spineColorFor(book: Book): string {
  if (book.spineColor) return book.spineColor;
  const seed = hash(book.id);
  const palette = [
    "#2f4858",
    "#6b4526",
    "#3f4d3f",
    "#7a2e2e",
    "#4a4a52",
    "#2f4f4f",
    "#5a3b52",
    "#7a5c2e",
  ];
  return palette[seed % palette.length];
}

/** The gold foil colour, varied so the shelf doesn't look stamped. */
export function foilColorFor(book: Book): string {
  const seed = hash(book.id);
  return seed % 3 === 0 ? "#e8d9a8" : seed % 3 === 1 ? "#c9a227" : "#dfc05a";
}
