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

const ROOM = { w: 9.6, d: 8.4, h: 4.4 };
const DOME_R = 5.1;
const WINDOW = { w: 2.7, h: 3.6, sill: 0.95 };
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

function wood(color: string, roughness = 0.82): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
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
    ctx.fillStyle = "#2a1608";
    ctx.fillRect(0, 0, 2048, 1024);

    const cols = 64;
    const rows = 18;
    const cw = 2048 / cols;
    const ch = 1024 / rows;

    const glass = [
      "#ffc45e", "#f0a63a", "#ffd98a", "#e08a34", "#ffb44f",
      "#d97b2f", "#ffe3a0", "#c96a2a", "#f6b95a", "#e89b3f",
    ];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = (r * 73 + c * 131) % 89;

        // Each pane is a little stained-glass gradient, brighter toward the
        // oculus so the dome seems lit from above.
        const ringBoost = 1 - r / rows;
        const g = ctx.createLinearGradient(0, r * ch, 0, (r + 1) * ch);
        const base = glass[seed % glass.length];
        g.addColorStop(0, base);
        g.addColorStop(1, `rgba(90, 40, 10, ${0.25 + (1 - ringBoost) * 0.35})`);
        ctx.globalAlpha = 0.72 + ringBoost * 0.28;
        ctx.fillStyle = g;
        ctx.fillRect(c * cw + 2, r * ch + 2, cw - 4, ch - 4);
        ctx.globalAlpha = 1;
      }
    }

    // Lead came.
    ctx.strokeStyle = "#140a04";
    ctx.lineWidth = 3;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, 1024);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ch);
      ctx.lineTo(2048, r * ch);
      ctx.stroke();
    }

    // The oculus: the bright centre at the pole (v = 0).
    const glow = ctx.createLinearGradient(0, 0, 0, 220);
    glow.addColorStop(0, "rgba(255,250,228,1)");
    glow.addColorStop(0.5, "rgba(255,226,160,0.65)");
    glow.addColorStop(1, "rgba(255,200,120,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 2048, 220);

    // A soft vignette toward the rim.
    const rim = ctx.createLinearGradient(0, 1024, 0, 760);
    rim.addColorStop(0, "rgba(12,6,3,0.9)");
    rim.addColorStop(1, "rgba(12,6,3,0)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 760, 2048, 264);
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

  const tex = canvasTexture(512, 96, (ctx) => {
    ctx.fillStyle = "#241a0e";
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = "#b58c26";
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = "#e8dcc0";
    ctx.font = "600 40px Archivo Narrow, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((GENRE_LABEL[genre] ?? genre).toUpperCase(), 256, 52);
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

function buildCabinet({ width, books, atlases, indexOf, pickables, minRows = 3 }: CabinetOptions): THREE.Group {
  const group = new THREE.Group();
  const depth = 0.34;

  const usable = width - 0.24;
  const bookWidth = (b: Book) => dimsFor(b).w + 0.004;
  const totalWidth = books.reduce((s, b) => s + bookWidth(b), 0);
  const maxShelves = Math.floor((CABINET_H - SHELF_FIRST - 0.5) / SHELF_GAP) + 1;
  const rows = Math.max(Math.min(minRows, maxShelves), Math.min(maxShelves, Math.ceil(totalWidth / usable)));

  // A cabinet is only as tall as the shelves it needs, so a small collection
  // reads as a low bookcase rather than a tall empty one.
  const height = Math.min(CABINET_H, SHELF_FIRST + (rows - 1) * SHELF_GAP + 0.62);
  const perRow = Math.ceil(books.length / rows);

  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.04),
    wood("#4a2e1c", 0.88),
  );
  backPanel.position.set(0, height / 2, 0);
  group.add(backPanel);

  const sideMat = wood("#5a3922", 0.8);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.09, height, depth), sideMat);
    side.position.set((sx * (width - 0.09)) / 2, height / 2, depth / 2);
    group.add(side);
  }

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth + 0.04), sideMat);
  plinth.position.set(0, 0.15, depth / 2);
  group.add(plinth);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.18, depth + 0.08), sideMat);
  cornice.position.set(0, height - 0.09, depth / 2);
  group.add(cornice);

  const shelfMat = wood("#67452b", 0.78);
  const geoByAtlas: THREE.BufferGeometry[][] = atlases.map(() => []);

  for (let row = 0; row < rows; row++) {
    const y = SHELF_FIRST + row * SHELF_GAP;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.16, 0.04, depth - 0.06), shelfMat);
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
        // A little brass label on the shelf lip, where a library would put one.
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.042), genreLabelMaterial(genre));
        plate.position.set(x + 0.11, y + 0.04, depth - 0.052);
        group.add(plate);
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
        new THREE.BoxGeometry(0.012, 0.19, 0.15),
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
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), wood("#5c3a25", 0.9));
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

  const toReadAtlas = createSpineAtlases(toRead);
  const readingAtlas = createSpineAtlases(reading);
  const readAtlas = createSpineAtlases(read);

  const pickables: Array<{ mesh: THREE.Mesh; book: Book }> = [];

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
    const bb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.05), wood("#2a1a10", 0.9));
    bb.position.set(x, 0.09, z);
    bb.rotation.y = ry;
    scene.add(bb);
  }

  // Window frame + the view outside.
  const frameMat = wood("#3d2414", 0.7);
  const frameDepth = 0.16;
  const addFrameBar = (w: number, h: number, x: number, y: number) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, frameDepth), frameMat);
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
    });
    const halfSide = sideW / 2;
    cabinet.position.set(sx * (winW / 2 + halfSide), 0, backZ + 0.17);
    scene.add(cabinet);
  };

  // Front wall, left of the window: what I'm reading now.
  // Front wall, right of the window: what I've finished.
  placeBack(reading, -1, readingAtlas);
  placeBack(read, 1, readAtlas);

  // Both side walls: everything waiting to be read.
  const sideCabinetW = 3.4;
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

  const halfToRead = Math.ceil(toRead.length / 2);
  placeSide(toRead.slice(0, halfToRead), -1, toReadAtlas, -1.2);
  placeSide(toRead.slice(halfToRead), 1, toReadAtlas, -1.2);

  /* --- table, lamp, chair ---------------------------------------------- */

  const tableMat = wood("#5a361f", 0.72);
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.06, 0.85), tableMat);
  top.position.y = 0.76;
  table.add(top);
  for (const [lx, lz] of [[-0.74, -0.38], [0.74, -0.38], [-0.74, 0.38], [0.74, 0.38]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.73, 0.07), tableMat);
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
      emissiveIntensity: 0.15,
    }),
  );
  shade.position.y = 0.46;
  lamp.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshBasicMaterial({ color: "#ffd9a0", toneMapped: false }),
  );
  bulb.position.y = 0.42;
  lamp.add(bulb);
  lamp.position.set(-0.44, 0.79, 0.3);
  scene.add(lamp);

  const lampLight = new THREE.PointLight("#ffb35c", 3.4, 5, 1.9);
  lampLight.position.set(-0.44, 1.2, 0.3);
  scene.add(lampLight);

  // Chair, in silhouette.
  const chairMat = wood("#2e1c12", 0.85);
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.44), chairMat);
  seat.position.y = 0.46;
  chair.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.05), chairMat);
  back.position.set(0, 0.73, 0.2);
  chair.add(back);
  for (const [cx, cz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.45, 0.045), chairMat);
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
    b.position.set(0.42, 0.8 + i * 0.03, 0.5);
    b.rotation.y = (i - 1) * 0.08;
    scene.add(b);
  }
  for (const side of [-1, 1]) {
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.012, 0.24),
      new THREE.MeshStandardMaterial({ color: "#eae4d6", roughness: 0.9 }),
    );
    page.position.set(-0.02 + side * 0.085, 0.8, 0.95);
    page.rotation.y = side * 0.22;
    page.rotation.z = side * 0.04;
    scene.add(page);
  }

  const mug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.04, 0.09, 20),
    new THREE.MeshStandardMaterial({ color: "#e8e0d0", roughness: 0.55 }),
  );
  mug.position.set(0.66, 0.86, 0.35);
  scene.add(mug);

  /* --- lighting --------------------------------------------------------- */

  scene.add(new THREE.HemisphereLight("#7a5f45", "#2a1a0e", 1.05));

  // Golden hour through the window.
  const sun = new THREE.DirectionalLight("#ffb26b", 2.7);
  sun.position.set(-1.5, 3.6, -8);
  sun.target.position.set(0, 1.2, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -2;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);

  const windowGlow = new THREE.RectAreaLight("#ffb877", 4, WINDOW.w, WINDOW.h);
  windowGlow.position.set(0, WINDOW.sill + WINDOW.h / 2, backZ - 0.5);
  windowGlow.lookAt(0, 1.6, 0);
  scene.add(windowGlow);

  const fill = new THREE.PointLight("#6f86c9", 0.55, 9, 2);
  fill.position.set(3.4, 3.2, 1.5);
  scene.add(fill);

  // Wall washers: the shelves need their own light or the books vanish.
  const washerL = new THREE.PointLight("#ffc27a", 5.5, 7, 1.9);
  washerL.position.set(-3.1, 3.15, -2.9);
  scene.add(washerL);
  const washerR = new THREE.PointLight("#ffc27a", 5.5, 7, 1.9);
  washerR.position.set(3.1, 3.15, -2.9);
  scene.add(washerR);
  const centre = new THREE.PointLight("#ffb877", 3.2, 8, 2);
  centre.position.set(0, 3.0, 1.2);
  scene.add(centre);

  // The dome itself warms the room from above.
  const domeLight = new THREE.PointLight("#ff9a55", 4.5, 9, 2);
  domeLight.position.set(0, 3.9, 0);
  scene.add(domeLight);

  scene.add(new THREE.AmbientLight("#4a2f1c", 0.45));

  /* --- postprocessing --------------------------------------------------- */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.7, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* --- interaction ------------------------------------------------------ */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  const pickMeshes = pickables.map((p) => p.mesh);
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
    const hit = raycaster.intersectObjects(pickMeshes, false)[0];
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
      rig.goalD = Math.max(rig.minD, Math.min(rig.maxD, rig.goalD + e.deltaY * 0.0045));
    }
  }

  function onClick(e: MouseEvent) {
    if (dragDistance > 5) return;

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
      const k = Math.min(1, dt * 6);
      rig.theta += (rig.goalTheta - rig.theta) * k;
      rig.d += (rig.goalD - rig.d) * k;
      const p = rigPose();
      camera.position.lerp(p.pos, Math.min(1, dt * 8));
      lookAt.lerp(p.look, Math.min(1, dt * 8));
      camera.lookAt(lookAt);
    }

    // Lamps breathe very slightly.
    lampLight.intensity = 3.4 + Math.sin(now * 0.0017) * 0.14;
    composer.render();
  }

  resize();
  window.addEventListener("resize", resize);
  frame();

  return {
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
