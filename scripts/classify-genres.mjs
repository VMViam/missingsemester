#!/usr/bin/env node
/**
 * classify-genres.mjs — give every book a shelf genre.
 *
 * A first pass, not a librarian. It scores the title and author against a
 * small vocabulary per genre, keeps a confident winner, and leaves the rest
 * as "misc" so a wrong guess is visible rather than hidden.
 *
 *   node scripts/classify-genres.mjs            # write genres
 *   node scripts/classify-genres.mjs --dry-run  # show the tally only
 *
 * Edit `data/genres.json` ({ "book-id": "genre" }) to override any book; this
 * script never touches those.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS = join(ROOT, "src", "data", "books.json");
const OVERRIDES = join(ROOT, "data", "genres.json");

const DRY = process.argv.includes("--dry-run");

const GENRES = {
  mind: [
    "mind", "brain", "psychology", "psychological", "cognitive", "thinking",
    "memory", "consciousness", "behavio", "emotion", "happiness", "attention",
    "habit", "trauma", "anxiety", "depression", "addiction", "personality",
    "intelligence", "reason", "judgment", "decision", "perception", "freud",
    "jung", "kahneman", "sapolsky", "damasio", "sacks", "pinker", "haidt",
  ],
  self: [
    "habit", "discipline", "productivity", "focus", "willpower", "essentialism",
    "ultralearning", "self", "potential", "success", "goal", "mindset",
    "improve", "better", "motivation", "purpose", "confidence", "charisma",
    "social", "dating", "seduction", "attraction", "relationship", "life",
    "happiness", "joy", "fear", "courage", "resilience", "growth", "change",
    "leader", "influence", "persuasion", "negotiat", "communicat", "presence",
    "minimalism", "simplicity", "time", "priorit", "energy", "flow",
  ],
  spirit: [
    "spiritual", "spirit", "soul", "zen", "buddh", "meditation", "yoga",
    "vedanta", "bhagavad", "prabhupada", "krishna", "tao", "dao", "mystic",
    "religion", "god", "prayer", "sacred", "monk", "monastery", "enlighten",
    "consciousness", "presence", "awareness", "compassion", "sufi", "rumi",
    "christian", "bible", "quran", "upanishad", "tantra", "karma", "dharma",
  ],
  science: [
    "physics", "quantum", "cosmos", "cosmic", "universe", "evolution",
    "biology", "gene", "genome", "species", "earth", "climate", "nature",
    "science", "chemistry", "astronomy", "relativity", "mathematics", "math",
    "number", "chaos", "feynman", "hawking", "sagan", "dawkins", "rovelli",
    "greene", "mukherjee", "kolbert", "carson", "kuhn", "hofstadter",
  ],
  history: [
    "history", "historical", "war", "empire", "revolution", "century",
    "ancient", "rome", "roman", "greece", "greek", "civilization",
    "holocaust", "nazi", "genocide", "politics", "political", "democracy",
    "nation", "india", "partition", "colonial", "churchill", "hitler",
    "stalin", "snyder", "browning", "gourevitch", "dallaire", "judt",
  ],
  philosophy: [
    "philosophy", "philosophical", "ethics", "ethical", "moral", "justice",
    "meaning", "existential", "stoic", "meditations", "aurelius", "seneca",
    "nietzsche", "kant", "plato", "aristotle", "socrates", "religion",
    "buddhism", "death", "free will", "sandel", "parfit", "singer",
  ],
  business: [
    "business", "startup", "money", "economics", "economic", "economy",
    "market", "finance", "financial", "invest", "leadership", "management",
    "strategy", "company", "founder", "entrepreneur", "amazon", "apple",
    "tesla", "musk", "jobs", "thiel", "graham", "drucker", "demarco",
    "sales", "selling", "marketing", "brand", "customer", "negotiation",
    "pitch", "revenue", "profit", "pricing", "challenger", "good to great",
  ],
  technology: [
    "code", "coding", "programming", "software", "computer", "internet",
    "artificial intelligence", " ai", "machine learning", "algorithm",
    "data", "silicon", "chip", "electron", "javascript", "python", "linux",
    "web", "digital", "technology", "engineering", "designing data",
    "mythical man", "pragmatic programmer", "peopleware", "kleppmann",
    "hamming", "raymond", "eghbal", "shirky", "mcluhan", "postman",
    "carr", "newport",
  ],
  health: [
    "health", "body", "fitness", "exercise", "diet", "nutrition", "medicine",
    "medical", "disease", "cancer", "longevity", "sleep", "workout",
    "strength", "running", "muscle", "gut", "immune", "doctor", "patient",
    "mortality", "aging", "gawande", "walker", "van der kolk",
  ],
  fiction: [
    "novel", "fiction", "murakami", "ishiguro", "tolstoy", "dostoevsky",
    "morrison", "calvino", "borges", "kafka", "orwell", "márquez", "marquez",
    "kehlmann", "dürrenmatt", "dickens", "austen", "woolf", "hemingway",
    "mccarthy", "powers", "clarke", "saunders", "vuong", "kundera", "pessoa",
  ],
  memoir: [
    "memoir", "autobiography", "biography", "diaries", "diary", "letters",
    "essays", "journal", "my life", "a life", "coming of age", "frankl",
    "levi", "sacks",
  ],
};

const EXCLUDE = /\b(a|an|the|of|and|for|in|on|to|with|from)\b/g;

function tokens(text) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(EXCLUDE, " ")} `;
}

function classify(book) {
  const title = tokens(book.title ?? "");
  const author = tokens(book.author ?? "");
  let best = { genre: "misc", score: 0 };
  const scores = {};

  for (const [genre, words] of Object.entries(GENRES)) {
    let score = 0;
    for (const word of words) {
      const w = word.toLowerCase();
      if (title.includes(` ${w}`)) score += 3;
      if (author.includes(` ${w}`)) score += 2;
    }
    scores[genre] = score;
    if (score > best.score) best = { genre, score };
  }

  // A single weak hit is not enough; keep the unsure ones as misc.
  return best.score >= 3 ? best.genre : "misc";
}

const books = JSON.parse(await readFile(BOOKS, "utf8"));
const overrides = existsSync(OVERRIDES) ? JSON.parse(await readFile(OVERRIDES, "utf8")) : {};

let changed = 0;
const tally = {};

for (const book of books) {
  const genre = overrides[book.id] ?? classify(book);
  if (genre !== book.genre) changed++;
  book.genre = genre;
  tally[genre] = (tally[genre] ?? 0) + 1;
}

const order = ["mind", "self", "spirit", "business", "science", "history", "philosophy", "technology", "health", "memoir", "fiction", "misc"];
console.log("Genres:");
for (const g of order) if (tally[g]) console.log(`  ${g.padEnd(11)} ${tally[g]}`);
console.log(`${changed} book(s) changed.`);

if (DRY) {
  console.log("Dry run — nothing written.");
} else {
  await writeFile(BOOKS, `${JSON.stringify(books, null, 2)}\n`, "utf8");
  console.log(`Wrote genres to ${BOOKS}`);
}
