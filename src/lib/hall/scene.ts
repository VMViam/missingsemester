/**
 * The Library Hall — prototype (milestone 1: one room, three walls).
 *
 * Stylized rebuild of the reference photograph: a single-storey, domed,
 * three-walled library at golden hour. Books are merged geometry with a
 * shared spine atlas; the room is primitives and canvas textures.
 */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import type { Book } from "../books";
import { hash } from "../books";
import { createSpineAtlases, colourFor, type SpineAtlas } from "./atlas";
import { demoBooks } from "./demo";
import booksJson from "../../data/books.json";

/* ------------------------------------------------------------------ types */

export interface HallOptions {
  onFocus?(book: Book): void;
  onClose?(): void;
  onHover?(book: Book | null, clientX: number, clientY: number): void;
}

interface Dims {
  w: number;
  h: number;
  d: number;
}

/* --------------------------------------------------------------- constants */

const ROOM = { w: 9.6, d: 8.4, h: 4.6 };
const DOME_R = 5.1;
const WINDOW = { w: 2.7, h: 3.35, sill: 0.95 };
const CABINET_H = 3.5;
const SHELF_GAP = 0.42;
const SHELF_FIRST = 0.62;

/* ------------------------------------------------------------------ utils */

function dimsFor(book: Book): Dims {
  const seed = hash(book.id);
  const pages = book.pages ?? 180 + (seed % 320);
  const w = Math.max(0.026, Math.min(0.058, 0.026 + pages / 9000));
  const h = 0.19 + ((seed >>> 3) % 70) / 1000;
  const d = h * (0.5 + ((seed >>> 7) % 12) / 100);
  return { w, h, d };
}

/** A small seeded PRNG, so the grain is identical on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let grain: THREE.Texture | null = null;

/** One tileable grain, tinted by each material's colour. */
function grainTexture(): THREE.Texture {
  if (grain) return grain;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const rand = rng(7);

  ctx.fillStyle = "#cdbfae";
  ctx.fillRect(0, 0, size, size);

  // Long wavy grain.
  for (let i = 0; i < 280; i++) {
    const x0 = rand() * size;
    const alpha = 0.03 + rand() * 0.1;
    ctx.strokeStyle = `rgba(58, 33, 16, ${alpha})`;
    ctx.lineWidth = 0.6 + rand() * 1.6;
    ctx.beginPath();
    const wobble = 2 + rand() * 4;
    const phase = rand() * Math.PI * 2;
    for (let y = 0; y <= size; y += 8) {
      const x = x0 + Math.sin((y / size) * Math.PI * 3 + phase) * wobble;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // A couple of knots.
  for (let k = 0; k < 3; k++) {
    const cx = rand() * size;
    const cy = rand() * size;
    for (let r = 2; r < 26; r += 3) {
      ctx.strokeStyle = `rgba(48, 26, 12, ${0.1 - r * 0.002})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.45, rand() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Fine pores.
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.8, 1.8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  grain = tex;
  return tex;
}

function wood(color: string, roughness = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    map: grainTexture(),
    roughness,
    metalness: 0.02,
  });
}

/** A box with eased edges — the difference between "cube" and "furniture". */
function rounded(w: number, h: number, d: number, r = 0.008): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 3));
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* -------------------------------------------------------------- the window */

/** Placeholder for the view. Replaced by a real photo on a cylinder later. */
function windowTexture(): THREE.Texture {
  return canvasTexture(1024, 1280, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 1280);
    sky.addColorStop(0, "#f6c479");
    sky.addColorStop(0.35, "#e79a5a");
    sky.addColorStop(0.62, "#b9623f");
    sky.addColorStop(1, "#5a2f27");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 1280);

    const sun = ctx.createRadialGradient(690, 690, 10, 690, 690, 420);
    sun.addColorStop(0, "rgba(255,238,190,0.95)");
    sun.addColorStop(0.35, "rgba(255,190,110,0.45)");
    sun.addColorStop(1, "rgba(255,160,80,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 1024, 1280);

    // Distant skyline in silhouette.
    let x = -40;
    let i = 0;
    while (x < 1064) {
      const w = 60 + ((i * 53) % 95);
      const hh = 180 + ((i * 97) % 330);
      ctx.fillStyle = i % 3 === 0 ? "#3d2320" : i % 3 === 1 ? "#4a2a24" : "#33201e";
      ctx.fillRect(x, 1280 - hh, w, hh);
      // a few lit windows
      ctx.fillStyle = "rgba(255,196,120,0.55)";
      for (let wy = 1280 - hh + 40; wy < 1250; wy += 46) {
        for (let wx = x + 12; wx < x + w - 14; wx += 26) {
          if (((wx + wy + i) % 5) === 0) ctx.fillRect(wx, wy, 7, 10);
        }
      }
      x += w + 6 + ((i * 17) % 22);
      i++;
    }

    // Foreground rooflines.
    ctx.fillStyle = "#241412";
    ctx.beginPath();
    ctx.moveTo(0, 1280);
    ctx.lineTo(0, 980);
    ctx.lineTo(190, 1010);
    ctx.lineTo(330, 940);
    ctx.lineTo(520, 1000);
    ctx.lineTo(760, 930);
    ctx.lineTo(1024, 1000);
    ctx.lineTo(1024, 1280);
    ctx.closePath();
    ctx.fill();
  });
}

/* ------------------------------------------------------------------- dome */

function domeTexture(): THREE.Texture {
  return canvasTexture(2048, 1024, (ctx) => {
    ctx.fillStyle = "#1c0f06";
    ctx.fillRect(0, 0, 2048, 1024);

    const spokes = 48;
    const rings = 14;
    const cw = 2048 / spokes;
    const ch = 1024 / rings;

    const glass = [
      "#ffc45e", "#f0a63a", "#ffd98a", "#e08a34", "#ffb44f",
      "#d97b2f", "#ffe3a0", "#c96a2a", "#f6b95a", "#e89b3f",
    ];

    for (let r = 0; r < rings; r++) {
      // The crown is the brightest; the glass darkens toward the rim.
      const ringLight = 1 - r / rings;
      for (let c = 0; c < spokes; c++) {
        const seed = (r * 97 + c * 53) % 89;
        const base = glass[seed % glass.length];
        const g = ctx.createLinearGradient(0, r * ch, 0, (r + 1) * ch);
        g.addColorStop(0, base);
        g.addColorStop(1, `rgba(70, 28, 8, ${0.15 + (1 - ringLight) * 0.5})`);
        ctx.globalAlpha = 0.7 + ringLight * 0.3;
        ctx.fillStyle = g;
        ctx.fillRect(c * cw + 1.5, r * ch + 1.5, cw - 3, ch - 3);
        ctx.globalAlpha = 1;
      }
    }

    // Lead came.
    ctx.strokeStyle = "#120904";
    ctx.lineWidth = 4;
    for (let c = 0; c <= spokes; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, 1024);
      ctx.stroke();
    }
    for (let r = 0; r <= rings; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ch);
      ctx.lineTo(2048, r * ch);
      ctx.stroke();
    }

    // The crown medallion: a starburst around the oculus.
    const crown = ctx.createRadialGradient(1024, 0, 8, 1024, 0, 320);
    crown.addColorStop(0, "rgba(255, 252, 236, 1)");
    crown.addColorStop(0.4, "rgba(255, 228, 168, 0.8)");
    crown.addColorStop(1, "rgba(255, 200, 120, 0)");
    ctx.fillStyle = crown;
    ctx.fillRect(0, 0, 2048, 320);

    // Fine rays from the centre.
    ctx.strokeStyle = "rgba(255, 240, 200, 0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 48; i++) {
      const x = (i / 48) * 2048;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (x - 1024) * 0.05, 190);
      ctx.stroke();
    }

    // Dark rim.
    const rim = ctx.createLinearGradient(0, 1024, 0, 780);
    rim.addColorStop(0, "rgba(10, 5, 2, 0.92)");
    rim.addColorStop(1, "rgba(10, 5, 2, 0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 780, 2048, 244);
  });
}

/* ---------------------------------------------------------------- books */

function bookGeometry(book: Book, atlas: SpineAtlas): { geo: THREE.BufferGeometry; dims: Dims } {
  const dims = dimsFor(book);
  const geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const spine = atlas.uv(book);
  const white = atlas.white;
  const cloth = new THREE.Color(colourFor(book).cloth);
  const colors = new Float32Array(24 * 3);
  const whiteC = new THREE.Color(1, 1, 1);

  for (let face = 0; face < 6; face++) {
    const isSpine = face === 4; // +z
    const r = isSpine ? spine : white;
    for (let j = 0; j < 4; j++) {
      const i = face * 4 + j;
      uv.setXY(i, j % 2 === 0 ? r.u0 : r.u1, j < 2 ? r.v1 : r.v0);
      const c = isSpine ? whiteC : cloth;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  uv.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return { geo, dims };
}

/* --------------------------------------------------------------- shelving */

const GENRE_ORDER = [
  "mind", "self", "spirit", "business", "science",
  "history", "philosophy", "technology", "health", "memoir", "fiction", "misc",
];

const GENRE_LABEL: Record<string, string> = {
  mind: "Mind",
  self: "Self",
  spirit: "Spirit",
  business: "Business",
  science: "Science",
  history: "History",
  philosophy: "Philosophy",
  technology: "Technology",
  health: "Health",
  memoir: "Memoir",
  fiction: "Fiction",
  misc: "Miscellany",
};

const labelMaterials = new Map<string, THREE.MeshBasicMaterial>();

function genreLabelMaterial(genre: string): THREE.MeshBasicMaterial {
  const cached = labelMaterials.get(genre);
  if (cached) return cached;

  const tex = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = "#2a1d0e";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#a9842a";
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = "#e8dcc0";
    ctx.font = "700 48px Archivo Narrow, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((GENRE_LABEL[genre] ?? genre).toUpperCase(), 256, 68);
  });

  const material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  labelMaterials.set(genre, material);
  return material;
}

interface CabinetOptions {
  width: number;
  books: Book[];
  atlases: SpineAtlas[];
  indexOf: Map<string, number>;
  pickables: Array<{ mesh: THREE.Mesh; book: Book }>;
  /** Keep the furniture looking right even when the shelf is half empty. */
  minRows?: number;
}

function buildCabinet({ width, books, atlases, indexOf, pickables, minRows = 4 }: CabinetOptions): THREE.Group {
  const group = new THREE.Group();
  const depth = 0.34;

  const usable = width - 0.24;
  const bookWidth = (b: Book) => dimsFor(b).w + 0.004;
  const totalWidth = books.reduce((s, b) => s + bookWidth(b), 0);
  const maxShelves = Math.floor((CABINET_H - SHELF_FIRST - 0.5) / SHELF_GAP) + 1;
  const rows = Math.max(Math.min(minRows, maxShelves), Math.min(maxShelves, Math.ceil(totalWidth / usable)));

  // Every cabinet is the same height: one continuous wall of shelving.
  const height = CABINET_H;
  const perRow = Math.ceil(books.length / rows);

  const backPanel = new THREE.Mesh(
    rounded(width, height, 0.04, 0.006),
    wood("#4a2e1c", 0.88),
  );
  backPanel.position.set(0, height / 2, 0);
  group.add(backPanel);

  const sideMat = wood("#5a3922", 0.8);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(rounded(0.09, height, depth, 0.01), sideMat);
    side.position.set((sx * (width - 0.09)) / 2, height / 2, depth / 2);
    group.add(side);
  }

  const plinth = new THREE.Mesh(rounded(width, 0.3, depth + 0.04, 0.012), sideMat);
  plinth.position.set(0, 0.15, depth / 2);
  group.add(plinth);

  const cornice = new THREE.Mesh(rounded(width + 0.1, 0.18, depth + 0.08, 0.016), sideMat);
  cornice.position.set(0, height - 0.09, depth / 2);
  group.add(cornice);

  const shelfMat = wood("#67452b", 0.78);
  const geoByAtlas: THREE.BufferGeometry[][] = atlases.map(() => []);
  const seenGenres = new Set<string>();

  for (let row = 0; row < rows; row++) {
    const y = SHELF_FIRST + row * SHELF_GAP;
    const shelf = new THREE.Mesh(rounded(width - 0.16, 0.04, depth - 0.06, 0.01), shelfMat);
    shelf.position.set(0, y, depth / 2 - 0.02);
    group.add(shelf);

    let x = -usable / 2 + 0.01;
    let prevGenre: string | null = null;
    const rowBooks = books.slice(row * perRow, (row + 1) * perRow);
    for (const book of rowBooks) {
      const ai = indexOf.get(book.id) ?? 0;
      const atlas = atlases[ai];
      if (!atlas) continue;

      const genre = book.genre ?? "misc";
      if (genre !== prevGenre) {
        // One small label where each genre starts in this cabinet, on the
        // shelf lip — the way a library marks a section.
        if (!seenGenres.has(genre)) {
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.036), genreLabelMaterial(genre));
          plate.position.set(x + 0.1, y + 0.038, depth - 0.052);
          group.add(plate);
          seenGenres.add(genre);
        }
        prevGenre = genre;
      }

      const { geo, dims } = bookGeometry(book, atlas);
      x += dims.w / 2;
      geo.translate(x, y + 0.02 + dims.h / 2, depth * 0.52);
      geoByAtlas[ai].push(geo);
      x += dims.w / 2 + 0.004;

      // Invisible hit box for picking.
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(dims.w * 1.6, dims.h, dims.d),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(x - dims.w / 2 - 0.002, y + 0.02 + dims.h / 2, depth * 0.52);
      hit.userData.book = book;
      group.add(hit);
      pickables.push({ mesh: hit, book });
    }

    // A brass bookend where the books stop, so a gap reads as intentional.
    if (x < usable / 2 - 0.08) {
      const end = new THREE.Mesh(
        rounded(0.012, 0.19, 0.15, 0.004),
        new THREE.MeshStandardMaterial({ color: "#8a7a5a", metalness: 0.65, roughness: 0.42 }),
      );
      end.position.set(x + 0.03, y + 0.115, depth * 0.52);
      group.add(end);
    }
  }

  geoByAtlas.forEach((geos, ai) => {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    if (merged) {
      const material = new THREE.MeshStandardMaterial({
        map: atlases[ai].texture,
        vertexColors: true,
        roughness: 0.86,
        metalness: 0.01,
      });
      group.add(new THREE.Mesh(merged, material));
    }
    geos.forEach((g) => g.dispose());
  });

  return group;
}

/* ------------------------------------------------------------------- room */

function addWall(scene: THREE.Scene, w: number, h: number, pos: [number, number, number], rotY = 0) {
  const wall = new THREE.Mesh(rounded(w, h, 0.12, 0.01), wood("#5c3a25", 0.9));
  wall.position.set(...pos);
  wall.rotation.y = rotY;
  scene.add(wall);
  return wall;
}

/* ------------------------------------------------------------------- main */

export function createHall(canvas: HTMLCanvasElement, options: HallOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#150d09");
  scene.fog = new THREE.FogExp2(0x160d08, 0.018);

  /*
   * Camera rig: a fixed-height camera orbiting the U of three walls.
   * `theta` pans around the room; `d` is the distance to the wall you face,
   * so zooming walks the camera in toward the spines.
   */
  const rig = {
    centre: new THREE.Vector3(0, 0, 0.1),
    wallR: 4.3,
    theta: -0.34,
    goalTheta: -0.34,
    d: 7.2,
    goalD: 7.2,
    minTheta: -1.38,
    maxTheta: 1.38,
    minD: 1.35,
    maxD: 7.4,
  };

  const camera = new THREE.PerspectiveCamera(64, 1, 0.05, 120);

  function rigPose(theta = rig.theta, d = rig.d) {
    const dir = new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
    const look = rig.centre.clone().addScaledVector(dir, rig.wallR);
    look.y = 2.08;
    const pos = rig.centre.clone().addScaledVector(dir, rig.wallR - d);
    pos.y = 1.72;
    return { look, pos };
  }

  {
    const p = rigPose();
    camera.position.copy(p.pos);
    camera.lookAt(p.look);
  }

  /* --- books ---------------------------------------------------------- */

  const real = (booksJson as Book[]).filter((b) => b && b.title);
  const demo = new URLSearchParams(location.search).has("demo");
  const books = demo || real.length < 20 ? demoBooks() : real;

  const toRead = books.filter((b) => b.status === "to-read");
  const reading = books.filter((b) => b.status === "reading");
  const read = books.filter((b) => b.status === "read");

  const genreRank = (b: Book) => {
    const i = GENRE_ORDER.indexOf(b.genre ?? "misc");
    return i === -1 ? GENRE_ORDER.length : i;
  };
  const sortBooks = (a: Book, b: Book) =>
    genreRank(a) - genreRank(b) || a.author.localeCompare(b.author);
  toRead.sort(sortBooks);
  reading.sort(sortBooks);
  read.sort(sortBooks);

  const toReadAtlas = createSpineAtlases(toRead, 1);
  // The front shelves are the ones you walk up to: give them sharper spines.
  const readingAtlas = createSpineAtlases(reading, 2);
  const readAtlas = createSpineAtlases(read, 2);

  const pickables: Array<{ mesh: THREE.Mesh; book: Book }> = [];
  const hitExtras: THREE.Mesh[] = [];

  /* --- architecture ---------------------------------------------------- */

  // Floor and rug
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w + 0.6, ROOM.d + 0.6), wood("#3d2617", 0.94));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const rugTex = canvasTexture(512, 400, (ctx) => {
    ctx.fillStyle = "#5a2320";
    ctx.fillRect(0, 0, 512, 400);
    ctx.strokeStyle = "#7b3a2c";
    ctx.lineWidth = 10;
    ctx.strokeRect(24, 24, 464, 352);
    ctx.strokeStyle = "#3f1a18";
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) ctx.strokeRect(40 + i * 8, 40 + i * 8, 432 - i * 16, 320 - i * 16);
  });
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 3.1),
    new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.006, 0.4);
  scene.add(rug);

  // Back wall, split around the window.
  const backZ = -ROOM.d / 2;
  const winW = WINDOW.w;
  const sideW = (ROOM.w - winW) / 2;
  addWall(scene, sideW, ROOM.h, [-winW / 2 - sideW / 2, ROOM.h / 2, backZ]);
  addWall(scene, sideW, ROOM.h, [winW / 2 + sideW / 2, ROOM.h / 2, backZ]);
  addWall(scene, winW, WINDOW.sill, [0, WINDOW.sill / 2, backZ]);
  addWall(scene, winW, ROOM.h - WINDOW.sill - WINDOW.h, [0, (ROOM.h + WINDOW.sill + WINDOW.h) / 2, backZ]);

  // Side walls.
  addWall(scene, ROOM.d, ROOM.h, [-ROOM.w / 2, ROOM.h / 2, 0], Math.PI / 2);
  addWall(scene, ROOM.d, ROOM.h, [ROOM.w / 2, ROOM.h / 2, 0], Math.PI / 2);

  // Baseboard.
  for (const [w, x, z, ry] of [
    [ROOM.w, 0, backZ, 0],
    [ROOM.d, -ROOM.w / 2, 0, Math.PI / 2],
    [ROOM.d, ROOM.w / 2, 0, Math.PI / 2],
  ] as const) {
    const bb = new THREE.Mesh(rounded(w, 0.18, 0.05, 0.008), wood("#2a1a10", 0.9));
    bb.position.set(x, 0.09, z);
    bb.rotation.y = ry;
    scene.add(bb);
  }

  /* --- the glowing band above the shelves (the room's signature) ------ */

  const clerestoryGlass = canvasTexture(256, 384, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 384);
    g.addColorStop(0, "#ffdf9a");
    g.addColorStop(0.45, "#f6a83a");
    g.addColorStop(0.8, "#c46a22");
    g.addColorStop(1, "#6b3312");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 384);

    // Lead lattice.
    ctx.strokeStyle = "#2a150a";
    ctx.lineWidth = 7;
    ctx.strokeRect(6, 6, 244, 372);
    for (const y of [96, 192, 288]) {
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(248, y);
      ctx.stroke();
    }
    for (const x of [85, 170]) {
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x, 376);
      ctx.stroke();
    }

    // Small bright heart in each pane.
    ctx.fillStyle = "rgba(255, 244, 200, 0.55)";
    for (const [x, y] of [[46, 52], [128, 144], [212, 240], [46, 330], [128, 330], [212, 52]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const clerestoryMat = new THREE.MeshBasicMaterial({ map: clerestoryGlass, toneMapped: true });
  const bandFrameMat = wood("#4a2c18", 0.8);

  function addBand(parent: THREE.Group, width: number) {
    const count = Math.max(3, Math.round(width / 0.62));
    const panelW = width / count;
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + panelW * (i + 0.5);
      const frame = new THREE.Mesh(rounded(panelW - 0.03, 0.66, 0.07, 0.01), bandFrameMat);
      frame.position.set(x, 0, 0);
      parent.add(frame);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.15, 0.54), clerestoryMat);
      pane.position.set(x, 0.005, 0.04);
      parent.add(pane);
    }
  }

  // Back wall, either side of the window.
  for (const sx of [-1, 1]) {
    const band = new THREE.Group();
    addBand(band, sideW - 0.16);
    band.position.set(sx * (winW / 2 + sideW / 2), 3.94, backZ + 0.04);
    scene.add(band);
  }

  // Side walls.
  for (const sx of [-1, 1]) {
    const band = new THREE.Group();
    addBand(band, ROOM.d - 0.5);
    band.position.set(sx * (ROOM.w / 2 - 0.04), 3.94, 0);
    band.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(band);
  }

  /* --- panelling: pilasters, cornice, base rails ---------------------- */

  const trimMat = wood("#3d2414", 0.75);

  // Pilasters: window jambs, corners, and between the side cabinets.
  const pilaster = (x: number, z: number, ry = 0) => {
    const p = new THREE.Mesh(rounded(0.16, ROOM.h - 0.15, 0.1, 0.02), trimMat);
    p.position.set(x, (ROOM.h - 0.15) / 2, z);
    p.rotation.y = ry;
    scene.add(p);
  };
  pilaster(-winW / 2 - 0.1, backZ + 0.06);
  pilaster(winW / 2 + 0.1, backZ + 0.06);
  pilaster(-ROOM.w / 2 + 0.09, backZ + 0.09);
  pilaster(ROOM.w / 2 - 0.09, backZ + 0.09);
  pilaster(-ROOM.w / 2 + 0.06, -1.3, Math.PI / 2);
  pilaster(ROOM.w / 2 - 0.06, -1.3, Math.PI / 2);
  pilaster(-ROOM.w / 2 + 0.06, ROOM.d / 2 - 0.2, Math.PI / 2);
  pilaster(ROOM.w / 2 - 0.06, ROOM.d / 2 - 0.2, Math.PI / 2);

  // Cornice along the three walls.
  const cornice = (w: number, x: number, z: number, ry = 0) => {
    const c = new THREE.Mesh(rounded(w, 0.14, 0.14, 0.02), trimMat);
    c.position.set(x, ROOM.h - 0.18, z);
    c.rotation.y = ry;
    scene.add(c);
    const gold = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.012, 0.02),
      new THREE.MeshStandardMaterial({ color: "#a9842a", metalness: 0.7, roughness: 0.4 }),
    );
    gold.position.set(x, ROOM.h - 0.26, z + (ry === 0 ? 0.08 : 0));
    gold.rotation.y = ry;
    scene.add(gold);
  };
  cornice(ROOM.w, 0, backZ + 0.08);
  cornice(ROOM.d, -ROOM.w / 2 + 0.08, 0, Math.PI / 2);
  cornice(ROOM.d, ROOM.w / 2 - 0.08, 0, Math.PI / 2);

  // Window frame + the view outside.
  const frameMat = wood("#3d2414", 0.7);
  const frameDepth = 0.16;
  const addFrameBar = (w: number, h: number, x: number, y: number) => {
    const bar = new THREE.Mesh(rounded(w, h, frameDepth, 0.012), frameMat);
    bar.position.set(x, y, backZ + 0.02);
    scene.add(bar);
  };
  addFrameBar(winW + 0.18, 0.1, 0, WINDOW.sill - 0.05);
  addFrameBar(winW + 0.18, 0.1, 0, WINDOW.sill + WINDOW.h + 0.05);
  addFrameBar(0.09, WINDOW.h, -winW / 2 - 0.045, WINDOW.sill + WINDOW.h / 2);
  addFrameBar(0.09, WINDOW.h, winW / 2 + 0.045, WINDOW.sill + WINDOW.h / 2);
  addFrameBar(0.06, WINDOW.h, 0, WINDOW.sill + WINDOW.h / 2);
  addFrameBar(winW, 0.06, 0, WINDOW.sill + WINDOW.h / 2);

  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(winW + 1.6, WINDOW.h + 1.4),
    new THREE.MeshBasicMaterial({ map: windowTexture(), toneMapped: false }),
  );
  outside.position.set(0, WINDOW.sill + WINDOW.h / 2, backZ - 1.2);
  scene.add(outside);

  // Dome.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME_R, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: domeTexture(), side: THREE.BackSide, toneMapped: true }),
  );
  dome.position.y = ROOM.h;
  scene.add(dome);

  // Bronze ribs over the glass, and a lit oculus at the crown.
  const ribMat = new THREE.MeshStandardMaterial({
    color: "#7a5a1c",
    roughness: 0.45,
    metalness: 0.7,
  });
  const ribGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 20; i++) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 18; k++) {
      const a = (k / 18) * (Math.PI / 2);
      pts.push(new THREE.Vector3(Math.cos(a) * DOME_R, Math.sin(a) * DOME_R, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 28, 0.028, 6, false);
    g.rotateY((i / 20) * Math.PI * 2);
    ribGeos.push(g);
  }
  for (const t of [0.35, 0.62, 0.85]) {
    const a = t * (Math.PI / 2);
    const ringGeo = new THREE.TorusGeometry(Math.cos(a) * DOME_R, 0.02, 5, 72);
    ringGeo.rotateX(Math.PI / 2);
    ringGeo.translate(0, Math.sin(a) * DOME_R, 0);
    ribGeos.push(ringGeo);
  }
  const ribs = new THREE.Mesh(mergeGeometries(ribGeos, false)!, ribMat);
  ribs.position.y = ROOM.h;
  scene.add(ribs);
  ribGeos.forEach((g) => g.dispose());

  const oculus = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 32),
    new THREE.MeshBasicMaterial({ color: "#ffe9b0", toneMapped: false }),
  );
  oculus.rotation.x = Math.PI / 2;
  oculus.position.y = ROOM.h + DOME_R - 0.08;
  scene.add(oculus);

  // Bronze rim where the dome meets the walls.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(ROOM.w / 2 - 0.32, 0.07, 12, 96),
    new THREE.MeshStandardMaterial({ color: "#8a6420", roughness: 0.4, metalness: 0.7 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = ROOM.h - 0.08;
  scene.add(rim);

  // Ceiling ring between the walls and the dome.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(ROOM.w / 2 - 0.4, ROOM.w / 2 + 0.05, 64),
    wood("#2c1a10", 0.95),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = ROOM.h - 0.02;
  scene.add(ring);

  /* --- cabinets -------------------------------------------------------- */

  const backCabinetW = (sideW - 0.24) / 2;
  const placeBack = (
    booksList: Book[],
    sx: 1 | -1,
    group: { atlases: SpineAtlas[]; indexOf: Map<string, number> },
  ) => {
    const cabinet = buildCabinet({
      width: backCabinetW,
      books: booksList,
      atlases: group.atlases,
      indexOf: group.indexOf,
      pickables,
      minRows: 4,
    });
    const halfSide = sideW / 2;
    cabinet.position.set(sx * (winW / 2 + halfSide), 0, backZ + 0.17);
    scene.add(cabinet);
  };

  // Front wall, left of the window: what I'm reading now.
  // Front wall, right of the window: what I've finished.
  placeBack(reading, -1, readingAtlas);
  placeBack(read, 1, readAtlas);

  // Both side walls: everything waiting to be read, two cabinets per wall.
  const sideCabinetW = 1.62;
  const placeSide = (
    booksList: Book[],
    sx: 1 | -1,
    group: { atlases: SpineAtlas[]; indexOf: Map<string, number> },
    z: number,
  ) => {
    const cabinet = buildCabinet({
      width: sideCabinetW,
      books: booksList,
      atlases: group.atlases,
      indexOf: group.indexOf,
      pickables,
      minRows: 4,
    });
    cabinet.position.set(sx * (ROOM.w / 2 - 0.17), 0, z);
    cabinet.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(cabinet);
  };

  const quarter = Math.ceil(toRead.length / 4);
  const chunks = [0, 1, 2, 3].map((i) => toRead.slice(i * quarter, (i + 1) * quarter));
  placeSide(chunks[0], -1, toReadAtlas, -2.25);
  placeSide(chunks[1], -1, toReadAtlas, -0.35);
  placeSide(chunks[2], 1, toReadAtlas, -2.25);
  placeSide(chunks[3], 1, toReadAtlas, -0.35);

  /* --- table, lamp, chair ---------------------------------------------- */

  const tableMat = wood("#5a361f", 0.72);
  const table = new THREE.Group();
  const top = new THREE.Mesh(rounded(1.55, 0.06, 0.85, 0.014), tableMat);
  top.position.y = 0.76;
  table.add(top);
  for (const [lx, lz] of [[-0.74, -0.38], [0.74, -0.38], [-0.74, 0.38], [0.74, 0.38]] as const) {
    const leg = new THREE.Mesh(rounded(0.07, 0.73, 0.07, 0.012), tableMat);
    leg.position.set(lx, 0.365, lz);
    table.add(leg);
  }
  table.position.set(0.55, 0, 0.35);
  scene.add(table);

  const lamp = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: "#b58c26", roughness: 0.35, metalness: 0.85 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.03, 24), brass);
  lamp.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 12), brass);
  stem.position.y = 0.22;
  lamp.add(stem);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.24, 0.14, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: "#2f5b3d",
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#5a7f45"),
      emissiveIntensity: 0.07,
    }),
  );
  shade.position.y = 0.46;
  lamp.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 16, 12),
    new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }),
  );
  bulb.position.y = 0.42;
  lamp.add(bulb);
  lamp.position.set(0.1, 0.79, 0.28);
  scene.add(lamp);

  const bulbMat = bulb.material as THREE.MeshBasicMaterial;
  const shadeMat = shade.material as THREE.MeshStandardMaterial;
  let lampOn = true;

  const lampLight = new THREE.PointLight("#ffb35c", 3.4, 5, 1.9);
  lampLight.position.set(0.1, 1.2, 0.28);
  scene.add(lampLight);

  // A switch on the base, and an invisible target so the lamp is clickable.
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.018, 12),
    new THREE.MeshStandardMaterial({ color: "#241610", roughness: 0.45, metalness: 0.5 }),
  );
  knob.position.set(0.085, 0.016, 0.05);
  lamp.add(knob);

  const lampHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.33, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  lampHit.position.set(lamp.position.x, lamp.position.y + 0.3, lamp.position.z);
  lampHit.userData.lamp = true;
  scene.add(lampHit);
  hitExtras.push(lampHit);

  // Chair, in silhouette.
  const chairMat = wood("#2e1c12", 0.85);
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(rounded(0.46, 0.06, 0.44, 0.012), chairMat);
  seat.position.y = 0.46;
  chair.add(seat);
  const back = new THREE.Mesh(rounded(0.46, 0.52, 0.05, 0.012), chairMat);
  back.position.set(0, 0.73, 0.2);
  chair.add(back);
  for (const [cx, cz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]] as const) {
    const leg = new THREE.Mesh(rounded(0.045, 0.45, 0.045, 0.008), chairMat);
    leg.position.set(cx, 0.225, cz);
    chair.add(leg);
  }
  chair.position.set(1.75, 0, 1.5);
  chair.rotation.y = Math.PI - 0.5;
  scene.add(chair);

  // A short stack of books and a mug on the table.
  const propColors = ["#7a2e2e", "#2f4858", "#3f4d3f"];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.028, 0.17),
      wood(propColors[i], 0.8),
    );
    b.position.set(0.86, 0.806 + i * 0.032, 0.42);
    b.rotation.y = (i - 1) * 0.08;
    scene.add(b);
  }
  for (const side of [-1, 1]) {
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.012, 0.24),
      new THREE.MeshStandardMaterial({ color: "#eae4d6", roughness: 0.9 }),
    );
    page.position.set(0.5 + side * 0.085, 0.8, 0.42);
    page.rotation.y = side * 0.22;
    page.rotation.z = side * 0.04;
    scene.add(page);
  }

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: "#e8e0d0", roughness: 0.55 }),
  );
  mug.position.set(1.02, 0.835, 0.22);
  scene.add(mug);

  /* --- props: the room has to look lived in ---------------------------- */

  // A ladder leaning on the left shelves.
  const ladder = new THREE.Group();
  const railMat = wood("#6b4a2e", 0.8);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(rounded(0.045, 2.3, 0.045, 0.01), railMat);
    rail.position.set(side * 0.2, 1.15, 0);
    ladder.add(rail);
  }
  for (let i = 0; i < 6; i++) {
    const rung = new THREE.Mesh(rounded(0.4, 0.028, 0.032, 0.008), railMat);
    rung.position.set(0, 0.28 + i * 0.36, 0);
    ladder.add(rung);
  }
  ladder.position.set(-4.32, 0, -2.1);
  ladder.rotation.y = Math.PI / 2;
  ladder.rotation.z = 0.17;
  scene.add(ladder);

  // A plant by the window.
  const plant = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.13, 0.28, 20),
    new THREE.MeshStandardMaterial({ color: "#8a4b32", roughness: 0.85 }),
  );
  pot.position.y = 0.14;
  plant.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: "#3f5a34", roughness: 0.75, side: THREE.DoubleSide });
  const leafRand = rng(31);
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMat);
    const a = leafRand() * Math.PI * 2;
    const r = 0.08 + leafRand() * 0.14;
    leaf.scale.set(0.5, 1.5, 0.12);
    leaf.position.set(Math.cos(a) * r, 0.36 + leafRand() * 0.4, Math.sin(a) * r);
    leaf.rotation.set(leafRand() * 0.7 - 0.2, a, leafRand() * 0.6 - 0.3);
    plant.add(leaf);
  }
  plant.position.set(1.95, 0, -3.65);
  scene.add(plant);

  // Books waiting to be shelved, stacked on the floor.
  const stackRand = rng(53);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(
      rounded(0.24, 0.035, 0.17, 0.006),
      wood(["#7a2e2e", "#2f4858", "#3f4d3f", "#5a3b52", "#7a5c2e"][i], 0.85),
    );
    b.position.set(3.55 + stackRand() * 0.05, 0.02 + i * 0.038, -1.6 + stackRand() * 0.04);
    b.rotation.y = (stackRand() - 0.5) * 0.3;
    scene.add(b);
  }

  // Loose papers on the table.
  const paperMat = new THREE.MeshStandardMaterial({ color: "#e9e2d2", roughness: 0.95 });
  for (let i = 0; i < 3; i++) {
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), paperMat);
    paper.rotation.x = -Math.PI / 2;
    paper.rotation.z = (i - 1) * 0.22;
    paper.position.set(1.16 + i * 0.012, 0.793 + i * 0.002, 0.52 + i * 0.01);
    scene.add(paper);
  }

  // Brass picture lights over the two front cabinets.
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.5, 12),
      brass,
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(sx * 3.05, 2.62, backZ + 0.34);
    scene.add(bar);
    const glow = new THREE.PointLight("#ffc07a", 1.6, 2.6, 2);
    glow.position.set(sx * 3.05, 2.5, backZ + 0.4);
    scene.add(glow);
  }

  // Two small sconces on the front wall.
  for (const sx of [-1, 1]) {
    const sconce = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = 0.11;
    sconce.add(arm);
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 0.09, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: "#c9a227",
        metalness: 0.6,
        roughness: 0.4,
        side: THREE.DoubleSide,
        emissive: new THREE.Color("#ffb35c"),
        emissiveIntensity: 0.35,
      }),
    );
    cup.position.set(0, 0.05, 0.22);
    sconce.add(cup);
    sconce.position.set(sx * 2.05, 2.55, backZ + 0.06);
    scene.add(sconce);
    const light = new THREE.PointLight("#ffb877", 0.9, 3.2, 2);
    light.position.set(sx * 2.05, 2.6, backZ + 0.3);
    scene.add(light);
  }

  /* --- lighting --------------------------------------------------------- */

  // Low ambient. The room is lit by its window and its lamps, not by fog.
  scene.add(new THREE.HemisphereLight("#7a5f45", "#1a0f08", 0.55));
  scene.add(new THREE.AmbientLight("#3a2414", 0.26));

  // Golden hour through the window — the key.
  const sun = new THREE.DirectionalLight("#ffb067", 3.1);
  sun.position.set(-1.2, 3.4, -8);
  sun.target.position.set(0.5, 1.0, 0.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -2;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const windowGlow = new THREE.RectAreaLight("#ffb877", 3, WINDOW.w, WINDOW.h);
  windowGlow.position.set(0, WINDOW.sill + WINDOW.h / 2, backZ - 0.5);
  windowGlow.lookAt(0, 1.6, 0);
  scene.add(windowGlow);

  // The table lamp is a practical: small, warm, and it casts.
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.bias = -0.0015;
  lampLight.shadow.camera.near = 0.1;
  lampLight.shadow.camera.far = 4.5;

  // Spot washers on the two front cabinets, so the spines read.
  const washerFor = (x: number, tx: number) => {
    const spot = new THREE.SpotLight("#ffc98a", 30, 9, 0.72, 0.9, 1.3);
    spot.position.set(x, 3.75, 1.5);
    spot.target.position.set(tx, 1.7, -4.15);
    scene.add(spot, spot.target);
  };
  washerFor(-1.5, -2.5);
  washerFor(1.5, 2.5);

  // A cool rim from the far side, barely there.
  const coolRim = new THREE.DirectionalLight("#7d92c9", 0.45);
  coolRim.position.set(5, 2.8, 3.5);
  scene.add(coolRim);

  // The dome warms everything from above.
  const domeLight = new THREE.PointLight("#ff9a55", 2.6, 8, 2);
  domeLight.position.set(0, 3.9, 0);
  scene.add(domeLight);

  // Dust in the light. Tiny, slow, barely visible until you sit still.
  const dustCount = 170;
  const dustPos = new Float32Array(dustCount * 3);
  const dustRand = rng(19);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (dustRand() - 0.5) * 8.4;
    dustPos[i * 3 + 1] = 0.3 + dustRand() * 3.6;
    dustPos[i * 3 + 2] = -4 + dustRand() * 7;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: "#ffd9a0",
      size: 0.009,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);

  /* --- postprocessing --------------------------------------------------- */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.72, 0.86);
  composer.addPass(bloom);

  // Vignette and a little grain: the photograph, not the render.
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uVignette: { value: 0.6 },
      uGrain: { value: 0.014 },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; uniform float uGrain; uniform float uTime;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 p = vUv - 0.5;
        float v = 1.0 - dot(p, p) * uVignette * 1.45;
        c.rgb *= clamp(v, 0.0, 1.0);
        float g = hash(vUv * 1024.0 + uTime) - 0.5;
        c.rgb += g * uGrain;
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  function toggleLamp() {
    lampOn = !lampOn;
    lampLight.intensity = lampOn ? 3.4 : 0;
    bulbMat.color.set(lampOn ? "#ffd9a0" : "#3a2a18");
    shadeMat.emissiveIntensity = lampOn ? 0.07 : 0;
    return lampOn;
  }

  /* --- interaction ------------------------------------------------------ */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const pickMeshes = pickables.map((p) => p.mesh);
  const raycastTargets = [...pickMeshes, ...hitExtras];
  let hovered: Book | null = null;
  let focused: Book | null = null;

  type Flight = {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
    dur: number;
    back?: boolean;
  };
  let flight: Flight | null = null;
  let lookAt = rigPose().look.clone();

  function flyTo(pos: THREE.Vector3, look: THREE.Vector3, dur = 0.9, back = false) {
    flight = {
      fromPos: camera.position.clone(),
      toPos: pos.clone(),
      fromTarget: lookAt.clone(),
      toTarget: look.clone(),
      t: 0,
      dur,
      back,
    };
  }

  function returnToRig() {
    const p = rigPose(rig.goalTheta, rig.goalD);
    flyTo(p.pos, p.look, 0.95, true);
  }

  // --- drag to pan -------------------------------------------------------
  let dragging = false;
  let dragStartX = 0;
  let dragStartTheta = 0;
  let dragDistance = 0;

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    dragDistance = 0;
    dragStartX = e.clientX;
    dragStartTheta = rig.goalTheta;
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerUp(e: PointerEvent) {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (dragging) {
      const dx = e.clientX - dragStartX;
      dragDistance += Math.abs(dx);
      rig.goalTheta = Math.max(
        rig.minTheta,
        Math.min(rig.maxTheta, dragStartTheta - dx * 0.0042),
      );
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(raycastTargets, false)[0];

    if (hit?.object.userData.lamp) {
      hovered = null;
      canvas.style.cursor = "pointer";
      options.onHover?.(null, e.clientX, e.clientY);
      return;
    }

    const book = (hit?.object.userData.book as Book) ?? null;
    if (book?.id !== hovered?.id) {
      hovered = book;
      canvas.style.cursor = book ? "pointer" : "grab";
      options.onHover?.(book, e.clientX, e.clientY);
    } else if (book) {
      options.onHover?.(book, e.clientX, e.clientY);
    }
  }

  // --- wheel to zoom -----------------------------------------------------
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      rig.goalTheta = Math.max(
        rig.minTheta,
        Math.min(rig.maxTheta, rig.goalTheta + e.deltaX * 0.004),
      );
    } else {
      rig.goalD = Math.max(rig.minD, Math.min(rig.maxD, rig.goalD + e.deltaY * 0.013));
    }
  }

  function onClick(e: MouseEvent) {
    if (dragDistance > 5) return;

    // The lamp is a switch.
    {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.intersectObjects(hitExtras, false)[0]?.object.userData.lamp) {
        toggleLamp();
        return;
      }
    }

    if (focused) {
      focused = null;
      options.onClose?.();
      returnToRig();
      return;
    }
    if (!hovered) return;

    const entry = pickables.find((p) => p.book.id === hovered!.id);
    if (!entry) return;

    const world = new THREE.Vector3();
    entry.mesh.getWorldPosition(world);

    // Which way does this cabinet face?
    let parent: THREE.Object3D | null = entry.mesh.parent;
    while (parent && parent.rotation.y === 0 && parent.parent) parent = parent.parent;
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
      (parent ?? scene).getWorldQuaternion(new THREE.Quaternion()),
    );

    const pos = world.clone().add(normal.clone().multiplyScalar(1.05));
    pos.y = Math.max(1.45, Math.min(2.45, world.y + 0.12));
    focused = hovered;
    options.onFocus?.(hovered);
    flyTo(pos, world, 0.95);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", () => options.onHover?.(null, 0, 0));
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("click", onClick);

  /* --- loop ------------------------------------------------------------- */

  let raf = 0;
  let disposed = false;
  let last = performance.now();

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(now = performance.now()) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (flight) {
      flight.t += dt;
      const k = Math.min(1, flight.t / flight.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
      lookAt.lerpVectors(flight.fromTarget, flight.toTarget, e);
      camera.lookAt(lookAt);
      if (k >= 1) {
        flight = null;
        if (focused) rig.goalTheta = rig.theta;
      }
    } else if (!focused) {
      const k = Math.min(1, dt * 11);
      rig.theta += (rig.goalTheta - rig.theta) * k;
      rig.d += (rig.goalD - rig.d) * k;
      const p = rigPose();
      camera.position.lerp(p.pos, Math.min(1, dt * 13));
      lookAt.lerp(p.look, Math.min(1, dt * 13));
      camera.lookAt(lookAt);
    }

    // Lamps breathe very slightly; dust drifts.
    lampLight.intensity = lampOn ? 3.4 + Math.sin(now * 0.0017) * 0.14 : 0;
    dust.rotation.y = now * 0.000012;
    dust.position.y = Math.sin(now * 0.00008) * 0.05;
    grade.uniforms.uTime.value = (now * 0.001) % 100;
    composer.render();
  }

  resize();
  window.addEventListener("resize", resize);
  frame();

  return {
    toggleLamp,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      composer.dispose();
      renderer.dispose();
    },
  };
}
