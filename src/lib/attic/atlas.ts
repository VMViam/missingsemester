import * as THREE from "three";
import type { Book } from "../books";
import { hash } from "../books";

/**
 * Books on a shelf are merged geometry, so their spines have to share a
 * texture. This draws every spine once into an atlas — the trick that keeps
 * hundreds of books to a handful of draw calls.
 *
 * One atlas holds 192 spines at 64×320. Bigger libraries get more atlases.
 */

const STRIP_W = 64;
const STRIP_H = 320;
const COLS = 16;
const PER_ATLAS = 192; // 16 cols × 12 rows, 3840px tall

export interface SpineAtlas {
  texture: THREE.Texture;
  uv(book: Book): { u0: number; v0: number; u1: number; v1: number };
  white: { u0: number; v0: number; u1: number; v1: number };
}

const CLOTH = [
  ["#3d5e74", "#c9dcea"],
  ["#7d5430", "#e8cfa8"],
  ["#4d624e", "#c3d8bc"],
  ["#8f3a38", "#eac0b8"],
  ["#5a5a66", "#d2d2dc"],
  ["#3d6262", "#bcdfd8"],
  ["#6d4a63", "#dcbcd0"],
  ["#8f6d39", "#ecd6a6"],
  ["#354452", "#bdcbdc"],
  ["#6e4838", "#e0c2aa"],
  ["#4d3c57", "#cfbcdc"],
  ["#5c4a2c", "#e2cfa0"],
];

export function colourFor(book: Book): { cloth: string; foil: string } {
  // A colour sampled from the real cover beats a hash.
  if (book.spineColor) {
    return { cloth: book.spineColor, foil: book.foilColor ?? "#d9bd72" };
  }
  const seed = hash(book.id);
  const pair = CLOTH[seed % CLOTH.length];
  return { cloth: pair[0], foil: pair[1] };
}

function drawSpine(ctx: CanvasRenderingContext2D, book: Book, x: number, y: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  x = 0;
  y = 0;

  const { cloth, foil } = colourFor(book);
  ctx.fillStyle = cloth;
  ctx.fillRect(x, y, STRIP_W, STRIP_H);

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let px = x + 1; px < x + STRIP_W; px += 3) ctx.fillRect(px, y, 1, STRIP_H);

  const shade = ctx.createLinearGradient(x, 0, x + STRIP_W, 0);
  shade.addColorStop(0, "rgba(255,255,255,0.22)");
  shade.addColorStop(0.3, "rgba(255,255,255,0.02)");
  shade.addColorStop(0.8, "rgba(0,0,0,0.2)");
  shade.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, STRIP_W, STRIP_H);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(x, y + STRIP_H * 0.11, STRIP_W, 3);
  ctx.fillRect(x, y + STRIP_H * 0.8, STRIP_W, 3);

  ctx.save();
  ctx.translate(x + STRIP_W / 2, y + STRIP_H * 0.17);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = foil;
  ctx.globalAlpha = 0.8;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 1.5;
  ctx.shadowOffsetY = 1;

  const maxW = STRIP_H * 0.62;
  let size = 12;
  do {
    ctx.font = `600 ${size}px Archivo, Helvetica, sans-serif`;
    if (ctx.measureText(book.title.toUpperCase()).width <= maxW) break;
    size -= 0.5;
  } while (size > 6);

  ctx.fillText(book.title.toUpperCase(), 0, 0, maxW);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = "500 6.5px Archivo Narrow, Helvetica, sans-serif";
  ctx.fillStyle = `${foil}99`;
  ctx.fillText(book.author.toUpperCase(), maxW * 1.1, 0, STRIP_H * 0.2);
  ctx.restore();

  if (book.year) {
    ctx.save();
    ctx.translate(x + STRIP_W * 0.78, y + STRIP_H * 0.92);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = `${foil}aa`;
    ctx.font = "500 5px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(String(book.year), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function buildAtlas(books: Book[], scale = 1): SpineAtlas {
  const stripW = STRIP_W * scale;
  const stripH = STRIP_H * scale;
  const rows = Math.max(1, Math.ceil((books.length + 1) / COLS));
  const canvas = document.createElement("canvas");
  canvas.width = COLS * stripW;
  canvas.height = rows * stripH;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0d0906";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const placements = new Map<string, { x: number; y: number }>();

  books.forEach((book, i) => {
    const x = (i % COLS) * stripW;
    const y = Math.floor(i / COLS) * stripH;
    placements.set(book.id, { x, y });
    drawSpine(ctx, book, x, y, scale);
  });

  const whiteIndex = books.length;
  const wx = (whiteIndex % COLS) * stripW;
  const wy = Math.floor(whiteIndex / COLS) * stripH;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(wx, wy, stripW, stripH);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;

  const uvFor = (x: number, y: number, w: number, h: number) => ({
    u0: x / canvas.width,
    v0: 1 - (y + h) / canvas.height,
    u1: (x + w) / canvas.width,
    v1: 1 - y / canvas.height,
  });

  return {
    texture,
    uv(book) {
      const p = placements.get(book.id);
      if (!p) return uvFor(wx, wy, stripW, stripH);
      return uvFor(p.x, p.y, stripW, stripH);
    },
    white: uvFor(wx, wy, stripW, stripH),
  };
}

/**
 * Split a group into atlases and remember which atlas holds which book.
 * Books are chunked in order, so the first shelf loads the first atlas.
 */
export function createSpineAtlases(books: Book[], scale = 1) {
  // A 2x atlas holds 96 spines at 128×640; the front shelves use it so they
  // stay readable when you walk right up to them.
  const perAtlas = scale >= 2 ? 96 : PER_ATLAS;
  const atlases: SpineAtlas[] = [];
  const indexOf = new Map<string, number>();

  for (let start = 0; start < books.length; start += perAtlas) {
    const chunk = books.slice(start, start + perAtlas);
    const atlasIndex = atlases.length;
    atlases.push(buildAtlas(chunk, scale));
    chunk.forEach((b) => indexOf.set(b.id, atlasIndex));
  }

  return { atlases, indexOf };
}
