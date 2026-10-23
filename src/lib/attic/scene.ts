/**
 * The attic, in three dimensions.
 *
 * A single pitched room modelled from the reference photograph: plaster and
 * timber, an arched window over a cushioned seat, built-in bookcases either
 * side, a leather chair and a round table on a herringbone floor.
 *
 * Books are merged geometry with a shared spine atlas; the room is primitives
 * and canvas textures, so everything loads as one small scene.
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
import booksJson from "../../data/books.json";

export interface AtticOptions {
  onFocus?(book: Book): void;
  onClose?(): void;
  onHover?(book: Book | null, clientX: number, clientY: number): void;
}

interface Dims {
  w: number;
  h: number;
  d: number;
}

/* ---------------------------------------------------------------- room kit */

const ROOM = { w: 8, d: 7.5, wallH: 2.6, ridgeH: 4.9 };
const WIN = { w: 2.4, sill: 0.85, spring: 2.0, arch: 1.2 };
const SHELF = { w: 2.05, h: 2.95, d: 0.34, rows: 6 };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

let grainTex: THREE.Texture | null = null;

function grain(): THREE.Texture {
  if (grainTex) return grainTex;
  const size = 512;
  const rand = rng(11);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#cdbfae";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 260; i++) {
    const x0 = rand() * size;
    ctx.strokeStyle = `rgba(58, 33, 16, ${0.03 + rand() * 0.09})`;
    ctx.lineWidth = 0.6 + rand() * 1.5;
    const phase = rand() * Math.PI * 2;
    const wobble = 2 + rand() * 4;
    ctx.beginPath();
    for (let y = 0; y <= size; y += 8) {
      const x = x0 + Math.sin((y / size) * Math.PI * 3 + phase) * wobble;
      if (y === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  for (let k = 0; k < 3; k++) {
    const cx = rand() * size;
    const cy = rand() * size;
    for (let r = 2; r < 24; r += 3) {
      ctx.strokeStyle = `rgba(48, 26, 12, ${0.1 - r * 0.003})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.45, rand() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.8, 1.8);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  grainTex = tex;
  return tex;
}

function wood(color: string, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({ color, map: grain(), roughness, metalness: 0.02 });
}

function plaster(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
}

function rounded(w: number, h: number, d: number, r = 0.01) {
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 3));
}

function herringbone(): THREE.Texture {
  return canvasTexture(512, 512, (ctx) => {
    const rand = rng(23);
    ctx.fillStyle = "#7a4c29";
    ctx.fillRect(0, 0, 512, 512);
    const unit = 48;

    for (let y = -unit; y < 512 + unit * 2; y += unit) {
      for (let x = -unit; x < 512 + unit * 2; x += unit * 2) {
        const flip = (Math.floor(y / unit) % 2) === 0;
        ctx.save();
        ctx.translate(x + (flip ? 0 : unit), y);
        ctx.rotate(flip ? Math.PI / 4 : -Math.PI / 4);
        const shade = 0.76 + rand() * 0.3;
        ctx.fillStyle = `rgb(${Math.round(168 * shade)}, ${Math.round(112 * shade)}, ${Math.round(62 * shade)})`;
        ctx.fillRect(0, 0, unit * 1.35, unit * 0.46);
        ctx.strokeStyle = "rgba(63, 35, 14, 0.5)";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(0, 0, unit * 1.35, unit * 0.46);
        ctx.restore();
      }
    }
  });
}

function rugTexture(): THREE.Texture {
  return canvasTexture(1024, 768, (ctx) => {
    ctx.fillStyle = "#6f2d2a";
    ctx.fillRect(0, 0, 1024, 768);
    ctx.strokeStyle = "#d9c39a";
    ctx.lineWidth = 14;
    ctx.strokeRect(28, 28, 968, 712);
    ctx.lineWidth = 4;
    ctx.strokeRect(64, 64, 896, 640);

    // repeating diamonds
    for (let y = 120; y < 720; y += 120) {
      for (let x = 110; x < 980; x += 160) {
        ctx.fillStyle = "#2f3f55";
        ctx.beginPath();
        ctx.moveTo(x, y - 34);
        ctx.lineTo(x + 44, y);
        ctx.lineTo(x, y + 34);
        ctx.lineTo(x - 44, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#d9c39a";
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, 1024, 40);
  });
}

function windowView(): THREE.Texture {
  return canvasTexture(1024, 1024, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 1024);
    sky.addColorStop(0, "#f7faf2");
    sky.addColorStop(0.55, "#e6efe2");
    sky.addColorStop(1, "#c2d3bb");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 1024);

    const sun = ctx.createRadialGradient(700, 300, 20, 700, 300, 420);
    sun.addColorStop(0, "rgba(255, 250, 225, 1)");
    sun.addColorStop(0.4, "rgba(255, 244, 205, 0.6)");
    sun.addColorStop(1, "rgba(255, 240, 190, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 1024, 1024);

    // bare winter trees, soft
    const rand = rng(41);
    ctx.strokeStyle = "rgba(90, 78, 60, 0.35)";
    for (let i = 0; i < 26; i++) {
      const x = 40 + rand() * 944;
      const h = 260 + rand() * 420;
      ctx.lineWidth = 2 + rand() * 5;
      ctx.beginPath();
      ctx.moveTo(x, 1024);
      ctx.lineTo(x + (rand() - 0.5) * 40, 1024 - h);
      ctx.stroke();
      for (let b = 0; b < 5; b++) {
        ctx.lineWidth = 1 + rand() * 2;
        ctx.beginPath();
        const yy = 1024 - h * (0.4 + rand() * 0.55);
        ctx.moveTo(x, yy);
        ctx.lineTo(x + (rand() - 0.5) * 130, yy - 30 - rand() * 80);
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(180, 196, 170, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, 900);
    ctx.bezierCurveTo(300, 830, 700, 900, 1024, 840);
    ctx.lineTo(1024, 1024);
    ctx.lineTo(0, 1024);
    ctx.closePath();
    ctx.fill();
  });
}

/* ------------------------------------------------------------------ books */

function dimsFor(book: Book): Dims {
  const seed = hash(book.id);
  const pages = book.pages ?? 180 + (seed % 320);
  const w = Math.max(0.026, Math.min(0.058, 0.026 + pages / 9000));
  const h = 0.2 + ((seed >>> 3) % 60) / 1000;
  const d = h * (0.5 + ((seed >>> 7) % 10) / 100);
  return { w, h, d };
}

function bookGeometry(book: Book, atlas: SpineAtlas) {
  const dims = dimsFor(book);
  const geo = new THREE.BoxGeometry(dims.w, dims.h, dims.d);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  const spine = atlas.uv(book);
  const white = atlas.white;
  const cloth = new THREE.Color(colourFor(book).cloth);
  const colors = new Float32Array(24 * 3);
  const wc = new THREE.Color(1, 1, 1);

  for (let face = 0; face < 6; face++) {
    const isSpine = face === 4;
    const r = isSpine ? spine : white;
    for (let j = 0; j < 4; j++) {
      const i = face * 4 + j;
      uv.setXY(i, j % 2 === 0 ? r.u0 : r.u1, j < 2 ? r.v1 : r.v0);
      const c = isSpine ? wc : cloth;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  uv.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return { geo, dims };
}

const GENRE_LABEL: Record<string, string> = {
  self: "Self", mind: "Mind", spirit: "Spirit", business: "Business",
  science: "Science", history: "History", philosophy: "Philosophy",
  technology: "Technology", health: "Health", memoir: "Memoir",
  fiction: "Fiction", misc: "Miscellany",
};

const labelMats = new Map<string, THREE.MeshBasicMaterial>();

function labelMaterial(genre: string) {
  const hit = labelMats.get(genre);
  if (hit) return hit;
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
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  labelMats.set(genre, mat);
  return mat;
}

interface CaseOptions {
  width: number;
  height: number;
  rows: number;
  books: Book[];
  atlases: SpineAtlas[];
  indexOf: Map<string, number>;
  pickables: Array<{ mesh: THREE.Mesh; book: Book }>;
}

function buildCase({ width, height, rows, books, atlases, indexOf, pickables }: CaseOptions) {
  const group = new THREE.Group();
  const depth = SHELF.d;
  const dark = wood("#4a2f1b", 0.85);
  const light = wood("#6b472b", 0.78);

  const back = new THREE.Mesh(rounded(width, height, 0.04, 0.006), wood("#3a2415", 0.9));
  back.position.set(0, height / 2, 0);
  group.add(back);

  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(rounded(0.08, height, depth, 0.012), dark);
    side.position.set((sx * (width - 0.08)) / 2, height / 2, depth / 2);
    group.add(side);
  }

  const plinth = new THREE.Mesh(rounded(width, 0.26, depth + 0.04, 0.012), dark);
  plinth.position.set(0, 0.13, depth / 2);
  group.add(plinth);

  const crown = new THREE.Mesh(rounded(width + 0.08, 0.14, depth + 0.06, 0.014), dark);
  crown.position.set(0, height - 0.07, depth / 2);
  group.add(crown);

  const usable = width - 0.24;
  const first = 0.55;
  const gap = (height - first - 0.45) / (rows - 1);
  const perRow = Math.ceil(books.length / rows);
  const geoByAtlas: THREE.BufferGeometry[][] = atlases.map(() => []);
  const seen = new Set<string>();

  for (let row = 0; row < rows; row++) {
    const y = first + row * gap;
    const shelf = new THREE.Mesh(rounded(width - 0.14, 0.035, depth - 0.05, 0.008), light);
    shelf.position.set(0, y, depth / 2 - 0.015);
    group.add(shelf);

    let x = -usable / 2 + 0.01;
    let prev: string | null = null;
    const rowBooks = books.slice(row * perRow, (row + 1) * perRow);

    for (const book of rowBooks) {
      const ai = indexOf.get(book.id) ?? 0;
      const atlas = atlases[ai];
      if (!atlas) continue;

      const genre = book.genre ?? "misc";
      if (genre !== prev) {
        if (!seen.has(genre)) {
          const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.036), labelMaterial(genre));
          plate.position.set(x + 0.1, y + 0.04, depth - 0.005);
          group.add(plate);
          seen.add(genre);
        }
        prev = genre;
      }

      const { geo, dims } = bookGeometry(book, atlas);
      x += dims.w / 2;
      geo.translate(x, y + 0.018 + dims.h / 2, depth * 0.52);
      geoByAtlas[ai].push(geo);
      x += dims.w / 2 + 0.003;

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(dims.w * 1.7, dims.h, dims.d),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(x - dims.w / 2 - 0.002, y + 0.018 + dims.h / 2, depth * 0.52);
      hit.userData.book = book;
      group.add(hit);
      pickables.push({ mesh: hit, book });
    }

    if (x < usable / 2 - 0.08) {
      const end = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.18, 0.15),
        new THREE.MeshStandardMaterial({ color: "#8a7a5a", metalness: 0.6, roughness: 0.45 }),
      );
      end.position.set(x + 0.03, y + 0.1, depth * 0.52);
      group.add(end);
    }
  }

  geoByAtlas.forEach((geos, ai) => {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    if (merged) {
      group.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshStandardMaterial({
            map: atlases[ai].texture,
            vertexColors: true,
            roughness: 0.86,
            metalness: 0.01,
          }),
        ),
      );
    }
    geos.forEach((g) => g.dispose());
  });

  return group;
}

/* ------------------------------------------------------------------- main */

export function createAttic(canvas: HTMLCanvasElement, options: AtticOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2a1c12");
  scene.fog = new THREE.FogExp2(0x2a1c12, 0.012);

  const camera = new THREE.PerspectiveCamera(66, 1, 0.05, 60);

  /* --- books ---------------------------------------------------------- */

  const books = (booksJson as Book[]).filter((b) => b?.title);
  const toRead = books.filter((b) => b.status === "to-read");
  const reading = books.filter((b) => b.status === "reading");
  const read = books.filter((b) => b.status === "read");

  const genreOrder = ["self","mind","spirit","business","science","history","philosophy","technology","health","memoir","fiction","misc"];
  const rank = (b: Book) => {
    const i = genreOrder.indexOf(b.genre ?? "misc");
    return i === -1 ? genreOrder.length : i;
  };
  const sortBooks = (a: Book, b: Book) => rank(a) - rank(b) || a.author.localeCompare(b.author);
  toRead.sort(sortBooks);
  read.sort(sortBooks);

  const toReadAtlas = createSpineAtlases(toRead, 1);
  const readAtlas = createSpineAtlases(read, 2);

  const pickables: Array<{ mesh: THREE.Mesh; book: Book }> = [];

  /* --- shell ---------------------------------------------------------- */

  // Floor
  const floorTex = herringbone();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(3.1, 2.7);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM.w, ROOM.d),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.72, metalness: 0.02 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Rug
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 2.6),
    new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.45, 0.008, 0.15);
  rug.receiveShadow = true;
  scene.add(rug);

  // Side walls
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(rounded(0.12, ROOM.wallH, ROOM.d, 0.01), plaster("#efe7d7"));
    wall.position.set(sx * (ROOM.w / 2), ROOM.wallH / 2, 0);
    wall.receiveShadow = true;
    scene.add(wall);
  }

  // Gable wall with an arched opening
  const gable = new THREE.Shape();
  gable.moveTo(-ROOM.w / 2, 0);
  gable.lineTo(ROOM.w / 2, 0);
  gable.lineTo(ROOM.w / 2, ROOM.wallH);
  gable.lineTo(0, ROOM.ridgeH);
  gable.lineTo(-ROOM.w / 2, ROOM.wallH);
  gable.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-WIN.w / 2, WIN.sill);
  hole.lineTo(-WIN.w / 2, WIN.spring);
  hole.absarc(0, WIN.spring, WIN.arch, Math.PI, 0, true);
  hole.lineTo(WIN.w / 2, WIN.sill);
  hole.closePath();
  gable.holes.push(hole);

  const wall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false, curveSegments: 32 }),
    plaster("#f1eadb"),
  );
  wall.position.set(0, 0, -ROOM.d / 2);
  wall.receiveShadow = true;
  scene.add(wall);

  // Roof planes
  const slope = Math.atan2(ROOM.ridgeH - ROOM.wallH, ROOM.w / 2);
  const slopeLen = Math.hypot(ROOM.w / 2, ROOM.ridgeH - ROOM.wallH);
  for (const sx of [-1, 1]) {
    const roof = new THREE.Mesh(rounded(slopeLen, 0.1, ROOM.d, 0.01), plaster("#f6f0e2"));
    roof.position.set((sx * ROOM.w) / 4, (ROOM.ridgeH + ROOM.wallH) / 2 + 0.06, 0);
    roof.rotation.z = sx * -slope;
    roof.receiveShadow = true;
    scene.add(roof);
  }

  // Timber: rafters, ridge, collars, purlins
  const timber = wood("#5a3a22", 0.8);
  for (const sx of [-1, 1]) {
    for (const z of [-2.6, -0.4, 1.9]) {
      const rafter = new THREE.Mesh(rounded(slopeLen, 0.18, 0.16, 0.02), timber);
      rafter.position.set((sx * ROOM.w) / 4, (ROOM.ridgeH + ROOM.wallH) / 2 - 0.06, z);
      rafter.rotation.z = sx * -slope;
      rafter.castShadow = true;
      scene.add(rafter);
    }
  }
  const ridge = new THREE.Mesh(rounded(0.18, 0.2, ROOM.d, 0.02), timber);
  ridge.position.set(0, ROOM.ridgeH - 0.14, 0);
  scene.add(ridge);
  for (const z of [-2.8, 0.1, 2.6]) {
    const collar = new THREE.Mesh(rounded(ROOM.w - 1.2, 0.16, 0.14, 0.02), timber);
    collar.position.set(0, 3.25, z);
    collar.castShadow = true;
    scene.add(collar);
  }

  // Window: frame, mullions, view
  const frameMat = wood("#efe8d9", 0.6);

  const outer = new THREE.Shape();
  outer.moveTo(-WIN.w / 2 - 0.09, WIN.sill - 0.09);
  outer.lineTo(-WIN.w / 2 - 0.09, WIN.spring);
  outer.absarc(0, WIN.spring, WIN.arch + 0.09, Math.PI, 0, true);
  outer.lineTo(WIN.w / 2 + 0.09, WIN.sill - 0.09);
  outer.closePath();

  const inner = new THREE.Path();
  inner.moveTo(-WIN.w / 2, WIN.sill);
  inner.lineTo(-WIN.w / 2, WIN.spring);
  inner.absarc(0, WIN.spring, WIN.arch, Math.PI, 0, true);
  inner.lineTo(WIN.w / 2, WIN.sill);
  inner.closePath();
  outer.holes.push(inner);

  const windowFrame = new THREE.Mesh(
    new THREE.ExtrudeGeometry(outer, {
      depth: 0.1,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      bevelSegments: 2,
      curveSegments: 32,
    }),
    frameMat,
  );
  windowFrame.position.set(0, 0, -ROOM.d / 2 + 0.1);
  scene.add(windowFrame);

  const view = new THREE.Mesh(
    new THREE.PlaneGeometry(WIN.w + 0.3, WIN.arch + WIN.spring - WIN.sill + 0.3),
    new THREE.MeshBasicMaterial({ map: windowView(), color: "#d9d2c3" }),
  );
  view.position.set(0, WIN.sill + (WIN.arch + WIN.spring - WIN.sill) / 2, -ROOM.d / 2 - 0.07);
  scene.add(view);

  // Mullions
  const barMat = wood("#efe8d9", 0.55);
  const barV = new THREE.Mesh(rounded(0.045, 2.2, 0.05, 0.008), barMat);
  barV.position.set(0, 1.45, -ROOM.d / 2 + 0.2);
  scene.add(barV);
  for (const y of [1.45, 2.05]) {
    const barH = new THREE.Mesh(rounded(WIN.w, 0.045, 0.05, 0.008), barMat);
    barH.position.set(0, y, -ROOM.d / 2 + 0.2);
    scene.add(barH);
  }

  // Sill and window seat
  const sill = new THREE.Mesh(rounded(2.9, 0.09, 0.24, 0.02), wood("#e9e0cf", 0.7));
  sill.position.set(0, WIN.sill - 0.05, -ROOM.d / 2 + 0.24);
  scene.add(sill);

  const seatMat = wood("#6b472b", 0.75);
  const seatBase = new THREE.Mesh(rounded(2.8, 0.42, 0.56, 0.02), seatMat);
  seatBase.position.set(0, 0.24, -ROOM.d / 2 + 0.42);
  seatBase.castShadow = true;
  scene.add(seatBase);
  const seatTop = new THREE.Mesh(rounded(2.8, 0.12, 0.6, 0.03), wood("#8a5f3c", 0.7));
  seatTop.position.set(0, 0.51, -ROOM.d / 2 + 0.42);
  scene.add(seatTop);

  const cushionMat = new THREE.MeshStandardMaterial({ color: "#b9ab93", roughness: 1 });
  const cushionMat2 = new THREE.MeshStandardMaterial({ color: "#a89478", roughness: 1 });
  [["#d8cbb4", -0.85, 0.75], ["#c3ad8c", -0.18, 0.66], ["#e9e2d4", 0.5, 0.7]].forEach(
    ([color, x, w], i) => {
      const cushion = new THREE.Mesh(rounded(Number(w), 0.22, 0.46, 0.07), i === 1 ? cushionMat2 : cushionMat);
      cushion.position.set(Number(x), 0.69, -ROOM.d / 2 + 0.42);
      cushion.rotation.z = (i - 1) * 0.06;
      cushion.castShadow = true;
      scene.add(cushion);
    },
  );

  // Books lying on the seat (the ones being read)
  reading.slice(0, 3).forEach((book, i) => {
    const dims = dimsFor(book);
    const b = new THREE.Mesh(
      rounded(Math.max(0.2, dims.h), 0.045, 0.15, 0.006),
      wood(colourFor(book).cloth, 0.85),
    );
    b.position.set(-0.45 + i * 0.3, 0.57 + i * 0.01, -ROOM.d / 2 + 0.35);
    b.rotation.y = (i - 1) * 0.2;
    scene.add(b);
  });

  // Bookcases flanking the window
  const caseW = SHELF.w;
  const half = Math.ceil(toRead.length / 2);
  const left = buildCase({
    width: caseW,
    height: SHELF.h,
    rows: SHELF.rows,
    books: toRead.slice(0, half),
    atlases: toReadAtlas.atlases,
    indexOf: toReadAtlas.indexOf,
    pickables,
  });
  left.position.set(-(WIN.w / 2 + caseW / 2 + 0.06), 0, -ROOM.d / 2 + SHELF.d / 2 + 0.02);
  scene.add(left);

  const right = buildCase({
    width: caseW,
    height: SHELF.h,
    rows: SHELF.rows,
    books: toRead.slice(half),
    atlases: toReadAtlas.atlases,
    indexOf: toReadAtlas.indexOf,
    pickables,
  });
  right.position.set(WIN.w / 2 + caseW / 2 + 0.06, 0, -ROOM.d / 2 + SHELF.d / 2 + 0.02);
  scene.add(right);

  // A small case on the right wall for the finished books
  const readCase = buildCase({
    width: 1.5,
    height: 2.6,
    rows: 4,
    books: read,
    atlases: readAtlas.atlases,
    indexOf: readAtlas.indexOf,
    pickables,
  });
  readCase.position.set(ROOM.w / 2 - 0.2, 0, -1.2);
  readCase.rotation.y = -Math.PI / 2;
  scene.add(readCase);

  // Leather armchair
  const leather = new THREE.MeshStandardMaterial({ color: "#6f4024", roughness: 0.62, metalness: 0.05 });
  const chair = new THREE.Group();
  const back = new THREE.Mesh(rounded(0.78, 0.86, 0.2, 0.06), leather);
  back.position.set(0, 0.9, -0.26);
  back.castShadow = true;
  chair.add(back);
  const cushion = new THREE.Mesh(rounded(0.74, 0.22, 0.68, 0.06), leather);
  cushion.position.set(0, 0.5, 0);
  cushion.castShadow = true;
  chair.add(cushion);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(rounded(0.16, 0.34, 0.7, 0.06), leather);
    arm.position.set(sx * 0.42, 0.62, 0);
    arm.castShadow = true;
    chair.add(arm);
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const leg = new THREE.Mesh(rounded(0.07, 0.3, 0.07, 0.01), wood("#4a2f1b", 0.7));
    leg.position.set(sx * 0.32, 0.15, sz * 0.28);
    chair.add(leg);
  }
  chair.position.set(2.15, 0, -0.35);
  chair.rotation.y = -Math.PI / 2 - 0.22;
  chair.scale.setScalar(0.92);
  scene.add(chair);

  // Round table with a few books
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 40), wood("#5a3a22", 0.6));
  top.position.y = 0.64;
  top.castShadow = true;
  table.add(top);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 16), wood("#4a2f1b", 0.7));
  stem.position.y = 0.33;
  table.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.06, 24), wood("#4a2f1b", 0.7));
  foot.position.y = 0.03;
  table.add(foot);
  for (let i = 0; i < 3; i++) {
    const book = new THREE.Mesh(
      rounded(0.3, 0.05, 0.22, 0.006),
      wood(["#6f2d2a", "#2f3f55", "#6b472b"][i], 0.8),
    );
    book.position.set(-0.12 + i * 0.04, 0.69 + i * 0.05, 0.02);
    book.rotation.y = (i - 1) * 0.16;
    table.add(book);
  }
  table.position.set(3.15, 0, 0.15);
  scene.add(table);

  /* --- lighting -------------------------------------------------------- */

  scene.add(new THREE.HemisphereLight("#eef2ee", "#40301f", 1.25));
  scene.add(new THREE.AmbientLight("#7a6250", 0.45));

  const sun = new THREE.DirectionalLight("#fff3d6", 2.6);
  sun.position.set(2.4, 4.6, -8);
  sun.target.position.set(-0.2, 1.1, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -1;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const windowGlow = new THREE.RectAreaLight("#fff4d8", 2.6, WIN.w, 2.6);
  windowGlow.position.set(0, 1.9, -ROOM.d / 2 + 0.1);
  windowGlow.lookAt(0, 1.4, 2);
  scene.add(windowGlow);

  const bounce = new THREE.PointLight("#ffd9a8", 1.6, 6, 2);
  bounce.position.set(0, 1.4, 1.4);
  scene.add(bounce);

  // A soft interior fill so the beams and plaster keep their colour.
  const fill = new THREE.PointLight("#ffe2b8", 1.1, 9, 2);
  fill.position.set(-1.2, 2.6, 2.2);
  scene.add(fill);

  /* --- atmosphere ------------------------------------------------------ */

  const dustCount = 220;
  const rand = rng(77);
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (rand() - 0.5) * 7;
    positions[i * 3 + 1] = 0.3 + rand() * 3.2;
    positions[i * 3 + 2] = -3 + rand() * 6;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      color: "#fff3d0",
      size: 0.008,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(dust);

  /* --- post ------------------------------------------------------------ */

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.7, 0.88));

  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uVignette: { value: 0.5 },
      uGrain: { value: 0.012 },
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
        c.rgb *= clamp(1.0 - dot(p, p) * uVignette * 1.4, 0.0, 1.0);
        c.rgb += (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  /* --- camera rig ------------------------------------------------------- */

  const rig = {
    yaw: 0,
    goalYaw: 0,
    dolly: 0,
    goalDolly: 0,
    minYaw: -0.52,
    maxYaw: 0.52,
    // 0 = standing back, 1 = at the window seat
    minDolly: 0,
    maxDolly: 1,
  };

  const base = new THREE.Vector3(0, 1.66, 3.05);
  const look = new THREE.Vector3(0, 1.86, -3.2);

  function pose(yaw = rig.yaw, dolly = rig.dolly) {
    const z = base.z - dolly * 2.1;
    const pos = new THREE.Vector3(Math.sin(yaw) * 0.5, base.y, z);
    const target = new THREE.Vector3(Math.sin(yaw) * 3.4, 1.86 + dolly * 0.1, -3.2);
    return { pos, target };
  }

  camera.position.copy(base);
  camera.lookAt(look);

  /* --- interaction ------------------------------------------------------ */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickMeshes = pickables.map((p) => p.mesh);
  let hovered: Book | null = null;
  let focused: Book | null = null;
  let flight: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number; dur: number } | null = null;
  const lookAt = look.clone();

  function flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur = 0.9) {
    flight = {
      fromPos: camera.position.clone(),
      toPos: pos.clone(),
      fromT: lookAt.clone(),
      toT: target.clone(),
      t: 0,
      dur,
    };
  }

  let dragging = false;
  let dragX = 0;
  let dragYaw = 0;
  let dragDistance = 0;

  function onDown(e: PointerEvent) {
    dragging = true;
    dragDistance = 0;
    dragX = e.clientX;
    dragYaw = rig.goalYaw;
    canvas.setPointerCapture(e.pointerId);
  }

  function onUp(e: PointerEvent) {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (dragging) {
      const dx = e.clientX - dragX;
      dragDistance += Math.abs(dx);
      rig.goalYaw = Math.max(rig.minYaw, Math.min(rig.maxYaw, dragYaw - dx * 0.0028));
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

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      rig.goalYaw = Math.max(rig.minYaw, Math.min(rig.maxYaw, rig.goalYaw + e.deltaX * 0.003));
    } else {
      rig.goalDolly = Math.max(rig.minDolly, Math.min(rig.maxDolly, rig.goalDolly + e.deltaY * 0.0012));
    }
  }

  function onClick(e: MouseEvent) {
    if (dragDistance > 5) return;

    if (focused) {
      focused = null;
      options.onClose?.();
      const p = pose(rig.goalYaw, rig.goalDolly);
      flyTo(p.pos, p.target);
      return;
    }
    if (!hovered) return;

    const entry = pickables.find((p) => p.book.id === hovered!.id);
    if (!entry) return;
    const world = new THREE.Vector3();
    entry.mesh.getWorldPosition(world);
    const pos = world.clone().add(new THREE.Vector3(0, 0.05, 0.9));
    pos.y = Math.max(1.35, Math.min(2.35, world.y));
    focused = hovered;
    options.onFocus?.(hovered);
    flyTo(pos, world, 0.95);
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);
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
      lookAt.lerpVectors(flight.fromT, flight.toT, e);
      camera.lookAt(lookAt);
      if (k >= 1) flight = null;
    } else if (!focused) {
      const k = Math.min(1, dt * 10);
      rig.yaw += (rig.goalYaw - rig.yaw) * k;
      rig.dolly += (rig.goalDolly - rig.dolly) * k;
      const p = pose();
      camera.position.lerp(p.pos, Math.min(1, dt * 12));
      lookAt.lerp(p.target, Math.min(1, dt * 12));
      camera.lookAt(lookAt);
    }

    dust.rotation.y = now * 0.000008;
    dust.position.y = Math.sin(now * 0.00006) * 0.04;
    grade.uniforms.uTime.value = (now * 0.001) % 100;
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
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onClick);
      composer.dispose();
      renderer.dispose();
    },
  };
}
