import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

/**
 * The library.
 *
 * A real library of real books: read, reading, to-read. Physical states map
 * onto reading states — a book on the shelf (read), a book out on loan with a
 * due-date slip (reading), a hold request in the drawer (to-read).
 */
const books = defineCollection({
  loader: file("src/data/books.json"),
  schema: z.object({
    /** Stable id — used for links and as the shelf key. */
    id: z.string(),
    title: z.string(),
    author: z.string(),

    /** Where the book is in the collection. */
    status: z.enum(["read", "reading", "to-read"]),
    /** Shelf / section within the library, e.g. "psychology", "history". */
    category: z.string().default("misc"),
    /** Shelf genre, assigned by scripts/classify-genres.mjs. */
    genre: z.string().optional(),

    rating: z.number().min(0).max(5).optional(),
    dateAdded: z.string().optional(),
    dateRead: z.string().optional(),
    /** Percent read, for books currently out. */
    progress: z.number().min(0).max(100).optional(),

    year: z.number().int().optional(),
    publisher: z.string().optional(),
    pages: z.number().int().optional(),

    /** Cover image URL (Open Library / Google Books). */
    coverUrl: z.string().optional(),
    /** Spine colour for the CSS 3D shelf — a hex value. */
    spineColor: z.string().optional(),
    /** Physical spine width, in mm — drives the 3D shelf proportions. */
    spineWidth: z.number().optional(),

    /** Your own words: why it mattered, what it changed. */
    notes: z.string().optional(),
    /** A line worth keeping. */
    quote: z.string().optional(),
  }),
});

/** Writing. Lives in the other building: letters.missingsemester.in */
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

/** Static pages of the room: about, reading notes, influences. */
const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(0),
  }),
});

export const collections = { books, posts, pages };
