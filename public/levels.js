// Levels: 8 handcrafted rounds, then endless seeded procedural rounds.
// Map legend: . empty  1-8 rainbow  s silver (multi-hit)  g gold (indestructible)  x explosive  ? mystery (always drops)

export const COLS = 12;

export const LEVELS = [
  { name: "RAINBOW ROAD", map: ["............", "111111111111", "222222222222", "333333333333", "444444444444", "555555555555", "666666666666", "777777777777"] },
  { name: "THE PYRAMID", map: [".....88.....", "....7777....", "...666666...", "..55555555..", ".4444?44444.", "333333333333", "2222x22x2222", "ssss....ssss"] },
  { name: "SPACE INVADERS", map: ["..5......5..", "...5....5...", "..55555555..", ".55.5555.55.", "5555?55?5555", "5.55555555.5", "5.5......5.5", "...55..55...", "............", "gg..gggg..gg"] },
  { name: "THE FORTRESS", map: ["gggggggggggg", "g..........g", "g.33333333.g", "g.3?4444?3.g", "g.34x55x43.g", "g.3?4444?3.g", "g.33333333.g", "g..........g", "gggg....gggg"] },
  { name: "TWIN DIAMONDS", map: ["..2......6..", ".212....656.", "21x12..65x56", ".212....656.", "..2......6..", ".....ss.....", "....s??s....", ".....ss....."] },
  { name: "COPPER BARS", map: ["ssssssssssss", "888888888888", "............", "777777777777", "ssssssssssss", "666666666666", "............", "555555555555", "xx..xxxx..xx"] },
  { name: "CHECKMATE", map: ["1.2.3.4.5.6.", ".2.3.4.5.6.7", "3.4.5.?.7.8.", ".4.5.6.7.8.1", "5.6.7.8.1.2.", ".6.?.8.1.2.3", "g..g..g..g.."] },
  { name: "MEGA CORE", map: ["?ssssssssss?", "s8888888888s", "s8777777778s", "s87?6666?78s", "s8766xx6678s", "s87?6666?78s", "s8777777778s", "s8888888888s", "............", "....gggg...."] },
];

// mulberry32: tiny, fast, deterministic
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedFor = (round) => (Math.imul(round + 1, 2654435761) ^ 0x9e3779b9) >>> 0;

const ADJ = ["NEON", "CRIMSON", "HOLLOW", "SILENT", "SHATTERED", "ORBITAL", "ELECTRIC", "FROZEN", "PRISM", "SOLAR", "ECHO", "IRON", "VELVET", "QUANTUM", "BURNING", "DRIFTING", "COBALT", "PHANTOM", "GILDED", "BINARY"];
const NOUN = ["CATHEDRAL", "LATTICE", "SPIRAL", "HIVE", "CITADEL", "MAZE", "GARDEN", "REACTOR", "SIGNAL", "CASCADE", "TEMPLE", "ARRAY", "VORTEX", "GRID", "ATLAS", "BASTION", "NEBULA", "CIRCUIT", "MONOLITH", "HARBOUR"];

// --- pattern families: each returns a rows x COLS grid of "cell on?" booleans (colour is applied afterwards)
const PATTERNS = {
  noise(R, rows, d) {
    const p = 0.5 + 0.25 * d;
    return grid(rows, (r, c) => c < COLS / 2 && R() < p);
  },
  sprite(R, rows) {
    // an invader-like sprite: random left half, mirrored, framed by stripes
    const g = grid(rows, () => false), h = Math.min(rows - 2, 7), top = 1;
    for (let r = 0; r < h; r++) for (let c = 1; c < 6; c++) g[top + r][c] = R() < 0.55;
    g[0].fill(true); g[rows - 1].fill(R() < 0.5);
    return g;
  },
  rings(R, rows) {
    const cr = (rows - 1) / 2, cc = (COLS - 1) / 2, step = 1 + Math.floor(R() * 2), diamond = R() < 0.5;
    return grid(rows, (r, c) => {
      const dist = diamond ? Math.abs(r - cr) + Math.abs(c - cc) * 0.6 : Math.max(Math.abs(r - cr), Math.abs(c - cc) * 0.6);
      return Math.floor(dist) % (step + 1) !== step;
    });
  },
  waves(R, rows) {
    const f = 0.4 + R() * 0.6, ph = R() * 6, amp = 1 + R() * 2, band = 1 + Math.floor(R() * 2);
    return grid(rows, (r, c) => {
      const y = (rows - 1) / 2 + Math.sin(c * f + ph) * amp;
      return Math.abs(r - y) <= band || (r + c) % 5 === 0;
    });
  },
  fortress(R, rows) {
    const g = grid(rows, (r, c) => r === 0 || c === 0 || c === COLS - 1 || r === rows - 1 || (r > 1 && r < rows - 2 && c > 1 && c < COLS - 2 && R() < 0.8));
    // gates in the walls
    const gate = 2 + Math.floor(R() * 3);
    for (let c = 6 - gate; c < 6; c++) { g[rows - 1][c] = false; g[rows - 1][COLS - 1 - c] = false; }
    return g;
  },
  pillars(R, rows) {
    const w = 1 + Math.floor(R() * 2), gap = 1 + Math.floor(R() * 2), off = Math.floor(R() * 3);
    return grid(rows, (r, c) => ((c + off) % (w + gap)) < w && !(r % 4 === 3 && R() < 0.5));
  },
  diamonds(R, rows) {
    const size = 2 + Math.floor(R() * 2), cx = [2.5, 8.5], cy = (rows - 1) / 2;
    return grid(rows, (r, c) => cx.some((x) => Math.abs(c - x) + Math.abs(r - cy) * 0.8 <= size) || (r === 0 && c % 2 === 0));
  },
};
function grid(rows, fn) { return Array.from({ length: rows }, (_, r) => Array.from({ length: COLS }, (_, c) => fn(r, c))); }

// is every breakable brick reachable by the ball (from below, through anything that isn't gold)?
function unreachable(cells) {
  const rows = cells.length, seen = new Set(), q = [];
  const key = (r, c) => r * 100 + c;
  for (let c = 0; c < COLS; c++) { q.push([rows, c]); seen.add(key(rows, c)); }
  while (q.length) {
    const [r, c] = q.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < -1 || nr > rows || nc < 0 || nc >= COLS || seen.has(key(nr, nc))) continue;
      if (nr >= 0 && nr < rows && cells[nr][nc] === "g") continue;
      seen.add(key(nr, nc)); q.push([nr, nc]);
    }
  }
  const out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (cells[r][c] !== "." && cells[r][c] !== "g" && !seen.has(key(r, c))) out.push([r, c]);
  return out;
}

export function generateLevel(round) {
  const seed = seedFor(round), R = rng(seed);
  const depth = round - LEVELS.length;                 // 0 for the first generated round
  const d = Math.min(1, depth / 24);                   // difficulty 0..1
  const rows = 7 + Math.floor(d * 3) + Math.floor(R() * 2);
  const names = Object.keys(PATTERNS);
  const pattern = names[Math.floor(R() * names.length)];
  let on = PATTERNS[pattern](R, rows, d);
  // mirror left->right (most patterns are designed as a left half); occasionally keep asymmetry
  if (pattern === "noise" || pattern === "sprite" || R() < 0.7) on = on.map((row) => row.map((v, c) => (c < COLS / 2 ? v : row[COLS - 1 - c])));

  // colour scheme
  const scheme = Math.floor(R() * 4), base = Math.floor(R() * 8);
  const colour = (r, c) => {
    const k = scheme === 0 ? r : scheme === 1 ? Math.floor(Math.abs(c - 5.5)) : scheme === 2 ? Math.floor((r + Math.abs(c - 5.5)) / 1.5) : Math.floor(r / 2) * 2 + (c % 2);
    return String(((base + k) % 8) + 1);
  };
  const cells = on.map((row, r) => row.map((v, c) => (v ? colour(r, c) : ".")));

  // specials, placed symmetrically; density rises with difficulty
  const put = (r, c, ch) => { cells[r][c] = ch; cells[r][COLS - 1 - c] = ch; };
  const filled = [];
  cells.forEach((row, r) => row.forEach((ch, c) => { if (ch !== "." && c < COLS / 2) filled.push([r, c]); }));
  for (const [r, c] of filled) {
    const x = R();
    if (x < 0.04 + 0.16 * d) put(r, c, "s");
    else if (x < 0.06 + 0.22 * d && r < rows - 1) put(r, c, "g");
  }
  if (pattern === "fortress") cells.forEach((row, r) => row.forEach((ch, c) => {
    const wall = r === 0 || c === 0 || c === COLS - 1 || r === rows - 1;
    if (wall && ch !== ".") cells[r][c] = R() < 0.35 + 0.4 * d ? "g" : "s";
  }));
  const pick = () => filled[Math.floor(R() * filled.length)];
  for (let i = 0; i < 1 + Math.floor(R() * (2 + 3 * d)) && filled.length; i++) { const [r, c] = pick(); put(r, c, "x"); }
  for (let i = 0; i < 1 + Math.floor(R() * 2) && filled.length; i++) { const [r, c] = pick(); put(r, c, "?"); }

  // keep it fair: no all-gold rows, and no breakable brick sealed off by gold
  for (const row of cells) {
    const solid = row.filter((ch) => ch !== ".");
    if (solid.length && solid.every((ch) => ch === "g")) row.forEach((ch, c) => { if (ch === "g" && c % 2) row[c] = "s"; });
  }
  for (let guard = 0; guard < 200; guard++) {
    const sealed = unreachable(cells);
    if (!sealed.length) break;
    // open the gold nearest the first sealed brick, working downward toward the ball
    const [sr, sc] = sealed[0];
    let best = null;
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (cells[r][c] === "g") {
      const dist = Math.abs(r - sr) + Math.abs(c - sc) - (r > sr ? 0.5 : 0);
      if (!best || dist < best.dist) best = { r, c, dist };
    }
    if (!best) break;
    cells[best.r][best.c] = "s";
  }
  // enough to break
  let breakable = cells.flat().filter((ch) => ch !== "." && ch !== "g").length;
  for (let r = 0; r < rows && breakable < 24; r++) for (let c = 0; c < COLS && breakable < 24; c++) if (cells[r][c] === ".") { cells[r][c] = colour(r, c); breakable++; }

  const N = rng(seed ^ 0x5bd1e995); // names get their own stream so they don't correlate with the layout
  N(); N();
  return {
    name: `${ADJ[Math.floor(N() * ADJ.length)]} ${NOUN[Math.floor(N() * NOUN.length)]}`,
    map: cells.map((row) => row.join("")),
    procedural: true, pattern, seed,
  };
}

const cache = new Map();
export function levelFor(round) {
  if (round < LEVELS.length) return LEVELS[round];
  if (!cache.has(round)) cache.set(round, generateLevel(round));
  return cache.get(round);
}
