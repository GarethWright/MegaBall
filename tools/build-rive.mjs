// Builds every Rive asset for Megaball Neo by driving the rive-mcp server over MCP (stdio).
//   npm i -g rive-mcp-server && npm run build:rive
// Flow per the rive-design-guidelines skill: riv_design_tokens -> riv_create (presets) -> riv_lint -> riv_critique.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "rive");
const PREVIEW = join(ROOT, "rive-src", "previews");
mkdirSync(OUT, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

const FONT_DISPLAY = join(ROOT, "rive-src", "Audiowide-Regular.ttf");
const FONT_UI = join(ROOT, "rive-src", "inter.ttf");
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.:-'&/+,%×·←→";
const ANY_TEXT = UPPER + "abcdefghijklmnopqrstuvwxyz";

const client = new Client({ name: "megaball-build", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.env.RIVE_MCP_BIN ?? "rive-mcp", args: [], cwd: ROOT, stderr: "ignore" }));

async function call(name, args, tag = name) {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 600000 });
  const texts = [];
  let i = 0;
  for (const c of res.content ?? []) {
    if (c.type === "text") texts.push(c.text);
    else if (c.type === "image") writeFileSync(join(PREVIEW, `${tag}-${i++}.png`), Buffer.from(c.data, "base64"));
  }
  if (res.isError) throw new Error(`${name} failed: ${texts.join("\n")}`);
  return texts.join("\n");
}
const tokens = async (seed, mood = "playful") => JSON.parse(await call("riv_design_tokens", { seed, mood, scheme: "dark" }));

// ---------------------------------------------------------------- tokens
const T = await tokens("#8a5cff", "tech");
const P = T.palette;
const WARM = await tokens("#ff7a45", "warm");
// Megaball's rainbow brick rows, each hue harmonised through the token generator
const HUES = ["#ff4d6d", "#ff8a3d", "#ffc93d", "#5ce07a", "#2ed3c6", "#3d9bff", "#8a5cff", "#e05cff"];
const RAINBOW = [];
for (const h of HUES) {
  const t = await tokens(h);
  RAINBOW.push({ seed: h, light: t.gradients.primary[0], dark: t.gradients.primary[1], base: t.palette.primary, soft: t.palette.primarySoft });
}
writeFileSync(join(OUT, "tokens.json"), JSON.stringify({ palette: P, gradients: T.gradients, warm: WARM.gradients, rainbow: RAINBOW }, null, 2));

const W = 1200, H = 800;
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const vGrad = (h, stops) => ({ gradient: { type: "linear", start: { x: 0, y: -h / 2 }, end: { x: 0, y: h / 2 }, stops } });
const hGrad = (w, stops) => ({ gradient: { type: "linear", start: { x: -w / 2, y: 0 }, end: { x: w / 2, y: 0 }, stops } });
const alpha = (hex, a) => "#" + Math.round(a * 255).toString(16).padStart(2, "0") + hex.slice(1);

// ---------------------------------------------------------------- 1. backdrop
function backdropScene() {
  const HZ = 500, FPS = 60, CYCLE = 150; // 2.5s grid cycle
  const r = rng(11);
  const shapes = [
    { id: "sky", type: "rect", x: W / 2, y: H / 2, width: W, height: H, z: 0,
      fill: vGrad(H, [
        { color: P.bgDeep, position: 0 }, { color: P.bg, position: 0.35 },
        { color: P.primarySoft, position: HZ / H - 0.002 }, { color: P.bgDeep, position: HZ / H },
        { color: P.bg, position: 1 }]) },
  ];
  const stars = [];
  for (let i = 0; i < 46; i++) {
    const s = 1.5 + r() * 2.6;
    stars.push({ id: `star${i}`, type: "ellipse", x: r() * W, y: r() * (HZ - 90), width: s, height: s, z: 1,
      opacity: 0.5, fill: { color: i % 4 === 0 ? P.accent : P.text } });
  }
  shapes.push(...stars);
  // Amiga copper bars: screen-blended gradient strips drifting at different speeds (parallax)
  const copper = [P.primary, P.accent, WARM.gradients.primary[0], P.primaryStrong].map((c, i) => ({
    id: `copper${i}`, type: "rect", x: W / 2, y: 120 + i * 70, width: W, height: 26, z: 2, blendMode: "screen", opacity: 0.28,
    fill: vGrad(26, [{ color: alpha(c, 0), position: 0 }, { color: c, position: 0.5 }, { color: alpha(c, 0), position: 1 }]),
  }));
  shapes.push(...copper);
  // synthwave sun, sliced by a multi-contour clip mask
  const SUN = { x: W / 2, y: HZ - 96, r: 150 };
  const bands = [{ closed: true, points: [{ x: -170, y: -170 }, { x: 170, y: -170 }, { x: 170, y: 10 }, { x: -170, y: 10 }] }];
  for (let i = 0, y = 10; i < 7; i++) {
    const gap = 3 + i * 1.6, h = 16 - i * 1.2;
    y += gap;
    bands.push({ closed: true, points: [{ x: -170, y }, { x: 170, y }, { x: 170, y: y + h }, { x: -170, y: y + h }] });
    y += h;
  }
  shapes.push(
    { id: "sunGlow", type: "ellipse", x: SUN.x, y: SUN.y, width: 620, height: 620, z: 3, blendMode: "screen", opacity: 0.55,
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 310, y: 0 },
        stops: [{ color: alpha(WARM.gradients.primary[1], 0.6), position: 0 }, { color: alpha(P.primaryStrong, 0.2), position: 0.45 }, { color: alpha(P.bg, 0), position: 1 }] } } },
    { id: "sunMask", type: "polygon", x: SUN.x, y: SUN.y, subpaths: bands, fill: { color: "#ffffff" }, z: 4, opacity: 0 },
    { id: "sun", type: "ellipse", x: SUN.x, y: SUN.y, width: SUN.r * 2, height: SUN.r * 2, z: 5, clipBy: "sunMask",
      fill: vGrad(SUN.r * 2, [{ color: WARM.gradients.primary[0], position: 0.05 }, { color: WARM.gradients.primary[1], position: 0.55 }, { color: P.primaryStrong, position: 1 }]) },
  );
  // mountains
  const ridge = (id, seed, amp, base, color, z) => {
    const rr = rng(seed), pts = [{ x: -40, y: HZ + 2 }];
    for (let x = -40; x <= W + 40; x += 60) pts.push({ x, y: base - rr() * amp });
    pts.push({ x: W + 40, y: HZ + 2 });
    return { id, type: "polygon", x: 0, y: 0, points: pts, closed: true, z, fill: vGrad(0, [{ color, position: 0 }, { color, position: 1 }]) };
  };
  shapes.push(
    { ...ridge("ridgeFar", 5, 70, HZ - 10, P.primarySoft, 6), fill: vGrad(160, [{ color: P.primarySoft }, { color: P.bg }]), opacity: 0.55 },
    { ...ridge("ridgeNear", 9, 40, HZ, P.bgDeep, 7), fill: { color: P.bgDeep } },
  );
  // floor plane hides the lower half of the sun below the horizon
  shapes.push({ id: "floor", type: "rect", x: W / 2, y: (HZ + H) / 2 + 1, width: W, height: H - HZ, z: 7,
    fill: vGrad(H - HZ, [{ color: P.bgDeep, position: 0 }, { color: P.bg, position: 1 }]) });
  // perspective floor: fanned verticals + horizontals that scroll toward the viewer
  const VP = { x: W / 2, y: HZ - 60 };
  for (let i = -14; i <= 14; i++) {
    const bx = W / 2 + i * 120;
    const t = (HZ - VP.y) / (H - VP.y);
    shapes.push({ id: `gv${i + 14}`, type: "polygon", x: 0, y: 0, closed: false, z: 8, opacity: 0.55,
      points: [{ x: VP.x + (bx - VP.x) * t, y: HZ }, { x: bx, y: H }],
      stroke: { color: P.primary, thickness: 1.5 } });
  }
  const floorTracks = [];
  const NL = 9;
  for (let i = 0; i < NL; i++) {
    const id = `gh${i}`;
    shapes.push({ id, type: "rect", x: W / 2, y: HZ, width: W, height: 1.5, z: 8, fill: { color: P.primary }, opacity: 0.6 });
    // perspective progression: y = HZ + (H-HZ) * u^2.2, sampled densely so the loop is seamless
    const kfY = [], kfO = [];
    const phase = i / NL, SAMPLES = 24;
    const pos = (u) => HZ + (H - HZ + 4) * Math.pow(u, 2.2);
    let wrapAt = Math.round((1 - phase) * CYCLE);
    for (let k = 0; k <= SAMPLES; k++) {
      const f = Math.round((k / SAMPLES) * CYCLE);
      if (f === wrapAt && f !== 0 && f !== CYCLE) continue;
      const u = (phase + f / CYCLE) % 1;
      kfY.push({ frame: f, value: pos(u), easing: "linear" });
      kfO.push({ frame: f, value: Math.min(0.75, u * 2.2), easing: "linear" });
    }
    if (wrapAt > 0 && wrapAt < CYCLE) {
      // jump from the bottom edge back to the horizon in a single frame
      kfY.push({ frame: wrapAt - 1, value: pos((phase + (wrapAt - 1) / CYCLE) % 1), easing: "linear" }, { frame: wrapAt, value: HZ, easing: "hold" });
      kfO.push({ frame: wrapAt, value: 0, easing: "hold" });
    }
    const dedupe = (arr) => [...new Map(arr.sort((a, b) => a.frame - b.frame).map((k) => [k.frame, k])).values()];
    floorTracks.push({ target: id, property: "y", keyframes: dedupe(kfY) }, { target: id, property: "opacity", keyframes: dedupe(kfO) });
  }
  // horizon glow line
  shapes.push({ id: "horizon", type: "rect", x: W / 2, y: HZ, width: W, height: 3, z: 9, blendMode: "screen",
    fill: hGrad(W, [{ color: alpha(P.accent, 0), position: 0 }, { color: P.accent, position: 0.5 }, { color: alpha(P.accent, 0), position: 1 }]) });

  const twinkle = stars.map((s, i) => {
    const per = 90 + Math.floor(r() * 150), off = Math.floor(r() * per);
    const lo = 0.15 + r() * 0.2, hi = 0.6 + r() * 0.4;
    return { target: s.id, property: "opacity", keyframes: [
      { frame: 0, value: lo }, { frame: Math.min(CYCLE * 2 - 1, off % (CYCLE * 2)), value: lo, easing: "ease-in-out" },
      { frame: Math.min(CYCLE * 2, (off % (CYCLE * 2)) + 30), value: hi, easing: "ease-in-out" }, { frame: CYCLE * 2, value: lo, easing: "ease-in-out" }]
        .filter((k, j, a) => j === 0 || k.frame > a[j - 1].frame) };
  });
  const copperTracks = copper.map((c, i) => {
    const amp = 40 + i * 18, y0 = c.y;
    const q = [0, 75, 150, 225, 300];
    const dir = i % 2 ? -1 : 1;
    return { target: c.id, property: "y", keyframes: [
      { frame: q[0], value: y0 }, { frame: q[1], value: y0 + amp * dir, easing: "ease-in-out" },
      { frame: q[2], value: y0, easing: "ease-in-out" }, { frame: q[3], value: y0 - amp * dir, easing: "ease-in-out" },
      { frame: q[4], value: y0, easing: "ease-in-out" }] };
  });
  // floor lines have a 2.5s cycle; duplicate over 5s so every loop lines up
  const floor5 = floorTracks.map((t) => ({ ...t, keyframes: [...t.keyframes, ...t.keyframes.filter((k) => k.frame > 0).map((k) => ({ ...k, frame: k.frame + CYCLE }))] }));
  return {
    artboard: { name: "Backdrop", width: W, height: H },
    shapes,
    animations: [{ name: "idle", fps: FPS, duration: CYCLE * 2, loop: "loop",
      presets: [{ preset: "breathing", target: "sunGlow", cycleSeconds: 5, intensity: 1.2 }],
      tracks: [...floor5, ...twinkle, ...copperTracks] }],
    stateMachine: { name: "BackdropSM", states: [{ name: "idle", animation: "idle" }], transitions: [{ from: "entry", to: "idle" }] },
  };
}

// ---------------------------------------------------------------- 2. title
const ADV = { M: 1971, E: 1547, G: 1686, A: 1709, B: 1657, L: 1508 };
function titleScene() {
  const WORD = "MEGABALL", SIZE = 136, UPM = 2048, LY = 250;
  const widths = [...WORD].map((c) => (ADV[c] / UPM) * SIZE);
  const total = widths.reduce((a, b) => a + b, 0);
  const groups = [], texts = [], shapes = [];
  let x = (W - total) / 2;
  const letterIds = [], centers = [];
  [...WORD].forEach((c, i) => {
    const w = widths[i], cx = x + w / 2, gid = `L${i}`;
    // pivot at the letter's baseline so squash reads as landing weight
    groups.push({ id: gid, x: cx, y: LY + SIZE * 0.5 });
    const color = i < 4 ? P.primary : P.accent;
    const shade = i < 4 ? P.primarySoft : P.accentSoft;
    texts.push(
      { id: `${gid}s`, parent: gid, x: -w / 2 - 2, y: -SIZE * 1.02 + 9, width: w + 4, height: SIZE * 1.3, align: "center", z: 2100 + i,
        runs: [{ text: c, fontSize: SIZE, color: shade, font: "display" }] },
      { id: `${gid}t`, parent: gid, x: -w / 2 - 2, y: -SIZE * 1.02, width: w + 4, height: SIZE * 1.3, align: "center", z: 2200 + i,
        runs: [{ text: c, fontSize: SIZE, color, font: "display" }] },
    );
    letterIds.push(gid);
    centers.push(cx);
    x += w;
  });
  const glowStops = (c) => [{ color: alpha(c, 0.55), position: 0 }, { color: alpha(c, 0), position: 1 }];
  shapes.push(
    { id: "glowL", type: "ellipse", x: W / 2 - 200, y: LY, width: 640, height: 300, z: 1, blendMode: "screen", opacity: 0.8,
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 320, y: 0 }, stops: glowStops(P.primaryStrong) } } },
    { id: "glowR", type: "ellipse", x: W / 2 + 200, y: LY, width: 640, height: 300, z: 1, blendMode: "screen", opacity: 0.8,
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 320, y: 0 }, stops: glowStops(P.accentSoft) } } },
    { id: "rule", type: "polygon", x: 0, y: 0, closed: false, z: 5, points: [{ x: (W - total) / 2, y: LY + SIZE * 0.62 }, { x: (W + total) / 2, y: LY + SIZE * 0.62 }],
      stroke: { color: P.accent, thickness: 3, cap: "round", trim: { start: 0, end: 0 } } },
  );
  // rainbow brick strip
  const bricks = [];
  const BW = 54, BH = 20, GAP = 6, N = 14, bx0 = W / 2 - (N * BW + (N - 1) * GAP) / 2 + BW / 2;
  for (let i = 0; i < N; i++) {
    const c = RAINBOW[i % RAINBOW.length];
    const id = `brick${i}`;
    groups.push({ id, x: bx0 + i * (BW + GAP), y: 470 });
    shapes.push(
      { id: `${id}f`, parent: id, type: "rect", x: 0, y: 0, width: BW, height: BH, cornerRadius: 5, z: 20 + i, fill: vGrad(BH, [{ color: c.light }, { color: c.dark }]) },
      { id: `${id}h`, parent: id, type: "rect", x: 0, y: -BH / 2 + 4, width: BW - 10, height: 3, cornerRadius: 2, z: 40 + i, opacity: 0.45, fill: { color: P.text } },
    );
    bricks.push(id);
  }
  // the ball that hops across the letters
  groups.push({ id: "ballG", x: centers[0], y: LY - SIZE * 0.55 });
  shapes.push(
    { id: "ballGlow", parent: "ballG", type: "ellipse", x: 0, y: 0, width: 70, height: 70, z: 2900, blendMode: "screen",
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 35, y: 0 }, stops: [{ color: alpha(P.accent, 0.8), position: 0 }, { color: alpha(P.accent, 0), position: 1 }] } } },
    { id: "ball", parent: "ballG", type: "ellipse", x: 0, y: 0, width: 26, height: 26, z: 2901,
      fill: { gradient: { type: "radial", start: { x: -5, y: -6 }, end: { x: 14, y: 8 }, stops: [{ color: P.text, position: 0 }, { color: P.accent, position: 0.55 }, { color: P.accentSoft, position: 1 }] } } },
  );
  texts.push(
    { id: "tagline", x: 0, y: 520, width: W, height: 40, align: "center", z: 2400,
      runs: [{ text: "A MODERN TRIBUTE TO THE AMIGA CLASSIC", fontSize: 20, color: P.textMuted, font: "ui" }] },
    { id: "press", x: 0, y: 600, width: W, height: 50, align: "center", z: 2401,
      runs: [{ text: "PRESS SPACE OR CLICK TO PLAY", fontSize: 30, color: P.text, font: "display" }] },
    { id: "controls", x: 0, y: 680, width: W, height: 40, align: "center", z: 2402,
      runs: [{ text: "MOUSE / ← →  MOVE   ·   SPACE / CLICK  LAUNCH & FIRE   ·   P  PAUSE   ·   M  MUTE", fontSize: 15, color: P.textMuted, font: "ui" }] },
  );

  // idle: the ball hops letter to letter (arc = ease-out up, ease-in down), each landing squashes the letter
  const HOP = 24, top = LY - SIZE * 0.55, apex = top - 70;
  const bx = [{ frame: 0, value: centers[0] }], by = [{ frame: 0, value: top }], letterTracks = [];
  const order = [...centers.keys(), ...[...centers.keys()].reverse().slice(1, -1)];
  order.forEach((li, k) => {
    if (k === 0) return;
    const f0 = (k - 1) * HOP, f1 = k * HOP;
    bx.push({ frame: f1, value: centers[li], easing: "smooth" });
    by.push({ frame: f0 + HOP / 2, value: apex, easing: "ease-out" }, { frame: f1, value: top, easing: "ease-in" });
  });
  const cycle = order.length * HOP;
  bx.push({ frame: cycle, value: centers[0], easing: "smooth" });
  by.push({ frame: cycle - HOP / 2, value: apex, easing: "ease-out" }, { frame: cycle, value: top, easing: "ease-in" });
  const landings = new Map();
  order.forEach((li, k) => { if (k > 0) (landings.get(li) ?? landings.set(li, []).get(li)).push(k * HOP); });
  (landings.get(0) ?? landings.set(0, []).get(0)).push(cycle);
  for (const [li, frames] of landings) {
    const sy = [{ frame: 0, value: 1 }], sx = [{ frame: 0, value: 1 }];
    for (const f of frames.sort((a, b) => a - b)) {
      const a = Math.max(1, f - 1);
      if (a > sy[sy.length - 1].frame) { sy.push({ frame: a, value: 1 }); sx.push({ frame: a, value: 1 }); }
      if (f + 5 <= cycle) { sy.push({ frame: f + 4, value: 0.86, easing: "ease-out" }); sx.push({ frame: f + 4, value: 1.08, easing: "ease-out" }); }
      if (f + 16 <= cycle) { sy.push({ frame: f + 16, value: 1, easing: "ease-out-back" }); sx.push({ frame: f + 16, value: 1, easing: "ease-out-back" }); }
    }
    if (sy[sy.length - 1].frame < cycle) { sy.push({ frame: cycle, value: 1 }); sx.push({ frame: cycle, value: 1 }); }
    letterTracks.push({ target: `L${li}`, property: "scaleY", keyframes: sy }, { target: `L${li}`, property: "scaleX", keyframes: sx });
  }
  const ballSquash = [];
  for (let k = 1; k <= order.length; k++) {
    const f = k * HOP;
    ballSquash.push({ frame: f - 3, value: 1 }, { frame: f, value: 0.7, easing: "ease-in" }, { frame: Math.min(cycle, f + 5), value: 1, easing: "ease-out" });
  }
  const dedupe = (arr) => [...new Map(arr.sort((a, b) => a.frame - b.frame).map((k) => [k.frame, k])).values()];
  return {
    artboard: { name: "Title", width: W, height: H },
    groups, shapes, texts,
    animations: [
      { name: "intro", fps: 60, duration: 110, loop: "oneShot",
        presets: [
          { preset: "pop-cascade", targets: letterIds, at: 0, stagger: 4 },
          { preset: "fade-in", targets: ["glowL", "glowR"], at: 10, stagger: 6 },
          { preset: "stagger-in", targets: bricks, at: 36, stagger: 2 },
          { preset: "rise-in", target: "tagline", at: 56 },
          { preset: "rise-in", target: "press", at: 66 },
          { preset: "fade-in", target: "controls", at: 76 },
          { preset: "drop-in", target: "ballG", at: 50 },
        ],
        tracks: [{ target: "rule", property: "trimEnd", keyframes: [{ frame: 30, value: 0 }, { frame: 70, value: 1, easing: "emphasized-decel" }, { frame: 110, value: 1 }] }] },
      { name: "idle", fps: 60, duration: cycle, loop: "loop",
        presets: [
          { preset: "glow-pulse", target: "press", cycleSeconds: cycle / 60 / 4 },
          { preset: "breathing", target: "glowL", cycleSeconds: cycle / 60 / 2 },
          { preset: "breathing", target: "glowR", cycleSeconds: cycle / 60 / 3 },
        ],
        tracks: [
          { target: "ballG", property: "x", keyframes: dedupe(bx) },
          { target: "ballG", property: "y", keyframes: dedupe(by) },
          { target: "ball", property: "scaleY", keyframes: dedupe(ballSquash) },
          { target: "rule", property: "trimEnd", keyframes: [{ frame: 0, value: 1 }, { frame: cycle, value: 1 }] },
          ...letterTracks,
        ] },
    ],
    stateMachine: { name: "TitleSM", inputs: [],
      states: [{ name: "intro", animation: "intro" }, { name: "idle", animation: "idle" }],
      transitions: [{ from: "entry", to: "intro" }, { from: "intro", to: "idle", exitTimeMs: 1830 }] },
  };
}

// ---------------------------------------------------------------- 3. paddle
function paddleScene() {
  const PW = 320, PH = 96, CY = 52, BASE = 100, CAP = 24;
  const groups = [
    { id: "paddle", x: PW / 2, y: CY },
    { id: "bar", parent: "paddle", x: 0, y: 0 },
    { id: "capL", parent: "paddle", x: -BASE / 2, y: 0 },
    { id: "capR", parent: "paddle", x: BASE / 2, y: 0 },
    { id: "gunL", parent: "capL", x: 0, y: -4 },
    { id: "gunR", parent: "capR", x: 0, y: -4 },
  ];
  const cap = (side) => [
    { id: `gun${side}b`, parent: `gun${side}`, type: "rect", x: 0, y: -8, width: 7, height: 16, cornerRadius: 2, z: 5,
      fill: vGrad(16, [{ color: WARM.gradients.primary[0] }, { color: WARM.gradients.primary[1] }]) },
    { id: `gun${side}t`, parent: `gun${side}`, type: "ellipse", x: 0, y: -16, width: 9, height: 9, z: 6, blendMode: "screen",
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, stops: [{ color: P.text }, { color: alpha(WARM.gradients.primary[0], 0) }] } } },
    { id: `cap${side}f`, parent: `cap${side}`, type: "rect", x: 0, y: 0, width: CAP, height: 24, cornerRadius: 9, z: 20,
      fill: { gradient: { type: "linear", start: { x: -12, y: -12 }, end: { x: 12, y: 12 }, stops: [{ color: T.gradients.accent[0] }, { color: T.gradients.accent[1] }] } } },
    { id: `cap${side}h`, parent: `cap${side}`, type: "ellipse", x: -3, y: -6, width: 10, height: 5, z: 21, opacity: 0.7, fill: { color: P.text } },
    { id: `cap${side}r`, parent: `cap${side}`, type: "rect", x: 0, y: 0, width: CAP, height: 24, cornerRadius: 9, z: 22,
      stroke: { color: alpha(P.text, 0.35), thickness: 1.5 } },
  ];
  const shapes = [
    { id: "glow", parent: "paddle", type: "ellipse", x: 0, y: 2, width: 300, height: 56, z: 1, blendMode: "screen", opacity: 0.6,
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 150, y: 0 }, stops: [{ color: alpha(P.primaryStrong, 0.75), position: 0 }, { color: alpha(P.primaryStrong, 0), position: 1 }] } } },
    { id: "magnet", parent: "paddle", type: "rect", x: 0, y: -10, width: 300, height: 10, cornerRadius: 5, z: 2, blendMode: "screen", opacity: 0,
      fill: vGrad(10, [{ color: alpha(P.accent, 0) }, { color: P.accent }]) },
    ...cap("L"), ...cap("R"),
    { id: "barF", parent: "bar", type: "rect", x: 0, y: 0, width: BASE, height: 18, cornerRadius: 4, z: 10,
      fill: vGrad(18, [{ color: T.gradients.primary[0], position: 0 }, { color: P.primaryStrong, position: 0.55 }, { color: T.gradients.primary[1], position: 1 }]) },
    { id: "barH", parent: "bar", type: "rect", x: 0, y: -5, width: BASE, height: 3, z: 11, opacity: 0.5, fill: { color: P.text } },
    { id: "energy", parent: "bar", type: "polygon", x: 0, y: 3, closed: false, z: 12, blendMode: "screen",
      points: [{ x: -BASE / 2, y: 0 }, { x: BASE / 2, y: 0 }],
      stroke: { color: P.accent, thickness: 2, cap: "round", trim: { start: 0, end: 0.3, offset: 0 } } },
    { id: "flash", parent: "paddle", type: "rect", x: 0, y: 0, width: 300, height: 26, cornerRadius: 12, z: 30, blendMode: "screen", opacity: 0,
      fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 150, y: 0 }, stops: [{ color: P.text }, { color: alpha(P.accent, 0) }] } } },
  ];
  // size poses for the blend state (inner bar width 60..280)
  const pose = (inner) => [
    { target: "bar", property: "scaleX", keyframes: [{ frame: 0, value: inner / BASE }] },
    { target: "capL", property: "x", keyframes: [{ frame: 0, value: -inner / 2 }] },
    { target: "capR", property: "x", keyframes: [{ frame: 0, value: inner / 2 }] },
    { target: "glow", property: "scaleX", keyframes: [{ frame: 0, value: (inner + 60) / 300 }] },
    { target: "magnet", property: "scaleX", keyframes: [{ frame: 0, value: (inner + 20) / 300 }] },
    { target: "flash", property: "scaleX", keyframes: [{ frame: 0, value: (inner + 30) / 300 }] },
  ];
  const guns = (on) => ["gunL", "gunR"].flatMap((g) => [
    { target: g, property: "opacity", keyframes: on ? [{ frame: 0, value: 0 }, { frame: 8, value: 1, easing: "ease-out" }] : [{ frame: 0, value: 1 }, { frame: 8, value: 0, easing: "ease-in" }] },
    { target: g, property: "y", keyframes: on ? [{ frame: 0, value: 4 }, { frame: 16, value: -8, easing: "ease-out-back" }] : [{ frame: 0, value: -8 }, { frame: 10, value: 4, easing: "emphasized-accel" }] },
  ]);
  return {
    artboard: { name: "Paddle", width: PW, height: PH },
    groups, shapes,
    animations: [
      { name: "sizeMin", fps: 60, duration: 1, loop: "oneShot", tracks: pose(60) },
      { name: "sizeMax", fps: 60, duration: 1, loop: "oneShot", tracks: pose(280) },
      { name: "idle", fps: 60, duration: 150, loop: "loop",
        presets: [{ preset: "glow-pulse", target: "glow", cycleSeconds: 2.5 }],
        tracks: [{ target: "energy", property: "trimOffset", keyframes: [{ frame: 0, value: 0 }, { frame: 75, value: 1, easing: "ease-in-out" }, { frame: 150, value: 2, easing: "ease-in-out" }] }] },
      { name: "hit", fps: 60, duration: 24, loop: "oneShot",
        tracks: [
          { target: "paddle", property: "scaleY", keyframes: [{ frame: 0, value: 1 }, { frame: 4, value: 0.7, easing: "ease-out" }, { frame: 12, value: 1.1, easing: "ease-out" }, { frame: 24, value: 1, easing: "ease-in-out" }] },
          { target: "paddle", property: "scaleX", keyframes: [{ frame: 0, value: 1 }, { frame: 4, value: 1.06, easing: "ease-out" }, { frame: 12, value: 0.98, easing: "ease-out" }, { frame: 24, value: 1, easing: "ease-in-out" }] },
          { target: "flash", property: "opacity", keyframes: [{ frame: 0, value: 0 }, { frame: 2, value: 0.9, easing: "ease-out" }, { frame: 20, value: 0, easing: "ease-in" }] },
        ] },
      { name: "gunsHidden", fps: 60, duration: 1, loop: "oneShot", tracks: ["gunL", "gunR"].flatMap((g) => [
        { target: g, property: "opacity", keyframes: [{ frame: 0, value: 0 }] }, { target: g, property: "y", keyframes: [{ frame: 0, value: 4 }] }]) },
      { name: "gunsOn", fps: 60, duration: 16, loop: "oneShot", tracks: guns(true) },
      { name: "gunsOff", fps: 60, duration: 10, loop: "oneShot", tracks: guns(false) },
      { name: "magnetOn", fps: 60, duration: 60, loop: "loop",
        tracks: [{ target: "magnet", property: "opacity", keyframes: [{ frame: 0, value: 0.35 }, { frame: 30, value: 0.95, easing: "ease-in-out" }, { frame: 60, value: 0.35, easing: "ease-in-out" }] }] },
      { name: "magnetOff", fps: 60, duration: 8, loop: "oneShot",
        tracks: [{ target: "magnet", property: "opacity", keyframes: [{ frame: 0, value: 0.35 }, { frame: 8, value: 0, easing: "ease-in" }] }] },
    ],
    stateMachine: {
      name: "PaddleSM",
      inputs: [{ name: "size", type: "number", initial: 20 }, { name: "hit", type: "trigger" }, { name: "laser", type: "bool" }, { name: "magnet", type: "bool" }],
      layers: [
        { name: "Size", states: [{ name: "sized", blend1d: { input: "size", animations: [{ animation: "sizeMin", value: 0 }, { animation: "sizeMax", value: 100 }] } }],
          transitions: [{ from: "entry", to: "sized" }] },
        { name: "FX", states: [{ name: "idle", animation: "idle" }, { name: "hit", animation: "hit" }],
          transitions: [{ from: "entry", to: "idle" }, { from: "any", to: "hit", condition: { input: "hit" } }, { from: "hit", to: "idle", exitTimeMs: 400 }] },
        { name: "Laser", states: [{ name: "off", animation: "gunsHidden" }, { name: "on", animation: "gunsOn" }, { name: "retract", animation: "gunsOff" }],
          transitions: [{ from: "entry", to: "off" }, { from: "off", to: "on", condition: { input: "laser", value: true } },
            { from: "on", to: "retract", condition: { input: "laser", value: false } }, { from: "retract", to: "on", condition: { input: "laser", value: true } },
            { from: "retract", to: "off", exitTimeMs: 170 }] },
        { name: "Magnet", states: [{ name: "off", animation: "magnetOff" }, { name: "on", animation: "magnetOn" }],
          transitions: [{ from: "entry", to: "off" }, { from: "off", to: "on", condition: { input: "magnet", value: true } }, { from: "on", to: "off", condition: { input: "magnet", value: false } }] },
      ],
    },
  };
}

// ---------------------------------------------------------------- 4. power-up capsules (one artboard per kind)
const KINDS = [
  { k: "E", seed: "#5ce07a", good: true },  // Expand
  { k: "S", seed: "#3d9bff", good: true },  // Slow
  { k: "C", seed: "#2ed3c6", good: true },  // Catch
  { k: "L", seed: "#ff4d6d", good: true },  // Laser
  { k: "M", seed: "#8a5cff", good: true },  // Multiball
  { k: "B", seed: "#ff8a3d", good: true },  // Mega (break-through) ball
  { k: "P", seed: "#ffc93d", good: true },  // +1 Player
  { k: "X", seed: "#7a7f8f", good: false }, // Shrink
  { k: "F", seed: "#c2334d", good: false }, // Fast
];
async function capsuleScene() {
  const CW = 80, CH = 40, PW = 60, PHh = 24;
  const artboards = [];
  for (const kind of KINDS) {
    const t = await tokens(kind.seed, kind.good ? "playful" : "calm");
    const g = t.gradients.primary;
    const id = (s) => `${kind.k}_${s}`;
    const shapes = [
      { id: id("halo"), parent: id("cap"), type: "ellipse", x: 0, y: 0, width: 84, height: 44, z: 1, blendMode: "screen",
        fill: { gradient: { type: "radial", start: { x: 0, y: 0 }, end: { x: 42, y: 0 }, stops: [{ color: alpha(g[0], 0.7), position: 0 }, { color: alpha(g[0], 0), position: 1 }] } } },
      { id: id("body"), parent: id("cap"), type: "rect", x: 0, y: 0, width: PW, height: PHh, cornerRadius: 12, z: 2,
        fill: vGrad(PHh, [{ color: g[0], position: 0 }, { color: t.palette.primary, position: 0.5 }, { color: g[1], position: 1 }]) },
      { id: id("band"), parent: id("cap"), type: "rect", x: 0, y: 0, width: 26, height: PHh, z: 3, opacity: 0.9, clipBy: id("body"),
        fill: vGrad(PHh, [{ color: t.palette.bgDeep }, { color: t.palette.surface }]) },
      { id: id("shine"), parent: id("cap"), type: "rect", x: -40, y: 0, width: 10, height: 40, rotation: 20, z: 5, opacity: 0.55, blendMode: "screen", clipBy: id("body"),
        fill: { color: t.palette.text } },
      { id: id("hl"), parent: id("cap"), type: "rect", x: 0, y: -7, width: PW - 14, height: 3, cornerRadius: 2, z: 6, opacity: 0.45, fill: { color: t.palette.text } },
      { id: id("rim"), parent: id("cap"), type: "rect", x: 0, y: 0, width: PW, height: PHh, cornerRadius: 12, z: 7,
        stroke: { color: kind.good ? alpha(t.palette.text, 0.5) : alpha(WARM.palette.accent, 0.9), thickness: kind.good ? 1.5 : 2 } },
    ];
    artboards.push({
      name: `Cap${kind.k}`, width: CW, height: CH,
      groups: [{ id: id("cap"), x: CW / 2, y: CH / 2 }],
      shapes,
      texts: [{ id: id("letter"), parent: id("cap"), x: -13, y: -12, width: 26, height: 26, align: "center", z: 2100,
        runs: [{ text: kind.k, fontSize: 17, color: kind.good ? t.palette.text : WARM.palette.accent, font: "display" }] }],
      animations: [{ name: "idle", fps: 60, duration: 96, loop: "loop",
        presets: [{ preset: "glow-pulse", target: id("halo"), cycleSeconds: 0.8 }],
        tracks: [
          { target: id("shine"), property: "x", keyframes: [{ frame: 0, value: -42 }, { frame: 56, value: -42, easing: "hold" }, { frame: 80, value: 42, easing: "smooth" }, { frame: 96, value: 42 }] },
          // the "rolling" read: the dark label band squashes as if the drum turns
          { target: id("band"), property: "scaleX", keyframes: [{ frame: 0, value: 1 }, { frame: 24, value: 0.55, easing: "ease-in-out" }, { frame: 48, value: 1, easing: "ease-in-out" }, { frame: 72, value: 0.55, easing: "ease-in-out" }, { frame: 96, value: 1, easing: "ease-in-out" }] },
          { target: id("cap"), property: "rotation", keyframes: [{ frame: 0, value: -4 }, { frame: 48, value: 4, easing: "ease-in-out" }, { frame: 96, value: -4, easing: "ease-in-out" }] },
        ] }],
      stateMachine: { name: "CapSM", states: [{ name: "idle", animation: "idle" }], transitions: [{ from: "entry", to: "idle" }] },
    });
  }
  return { artboards };
}

// ---------------------------------------------------------------- 5. banner (runtime-editable headline)
function bannerScene() {
  const shapes = [
    { id: "band", parent: "banner", type: "rect", x: 0, y: 0, width: W, height: 150, z: 1,
      fill: hGrad(W, [{ color: alpha(P.bgDeep, 0), position: 0 }, { color: alpha(P.surface, 0.92), position: 0.25 }, { color: alpha(P.surface, 0.92), position: 0.75 }, { color: alpha(P.bgDeep, 0), position: 1 }]) },
    { id: "lineT", parent: "banner", type: "polygon", x: 0, y: -75, closed: false, z: 2, points: [{ x: -480, y: 0 }, { x: 480, y: 0 }],
      stroke: { color: P.accent, thickness: 2, cap: "round", trim: { start: 0, end: 0 } } },
    { id: "lineB", parent: "banner", type: "polygon", x: 0, y: 75, closed: false, z: 2, points: [{ x: 480, y: 0 }, { x: -480, y: 0 }],
      stroke: { color: P.primary, thickness: 2, cap: "round", trim: { start: 0, end: 0 } } },
  ];
  const texts = [
    { id: "headline", parent: "headG", x: -600, y: -42, width: W, height: 80, align: "center", z: 2100,
      runs: [{ name: "headline", text: "GET READY", fontSize: 60, color: P.text, font: "display" }] },
    { id: "sub", parent: "subG", x: -600, y: -14, width: W, height: 34, align: "center", z: 2101,
      runs: [{ name: "sub", text: "ROUND 1", fontSize: 20, color: P.accent, font: "ui" }] },
  ];
  const groups = [{ id: "banner", x: W / 2, y: H / 2 }, { id: "headG", parent: "banner", x: 0, y: -8 }, { id: "subG", parent: "banner", x: 0, y: 44 }];
  const enterTracks = (o = 0) => [
    { target: "band", property: "scaleY", keyframes: [{ frame: o, value: 0 }, { frame: o + 22, value: 1, easing: "ease-out-back" }] },
    { target: "band", property: "opacity", keyframes: [{ frame: o, value: 0 }, { frame: o + 10, value: 1, easing: "ease-out" }] },
    { target: "lineT", property: "trimEnd", keyframes: [{ frame: o + 6, value: 0 }, { frame: o + 34, value: 1, easing: "emphasized-decel" }] },
    { target: "lineB", property: "trimEnd", keyframes: [{ frame: o + 10, value: 0 }, { frame: o + 38, value: 1, easing: "emphasized-decel" }] },
  ];
  const exitTracks = (o) => [
    { target: "band", property: "scaleY", keyframes: [{ frame: o, value: 1 }, { frame: o + 18, value: 0, easing: "emphasized-accel" }] },
    { target: "band", property: "opacity", keyframes: [{ frame: o + 8, value: 1 }, { frame: o + 18, value: 0, easing: "ease-in" }] },
    { target: "lineT", property: "trimStart", keyframes: [{ frame: o, value: 0 }, { frame: o + 16, value: 1, easing: "emphasized-accel" }] },
    { target: "lineB", property: "trimStart", keyframes: [{ frame: o, value: 0 }, { frame: o + 16, value: 1, easing: "emphasized-accel" }] },
    { target: "headG", property: "opacity", keyframes: [{ frame: o, value: 1 }, { frame: o + 14, value: 0, easing: "emphasized-accel" }] },
    { target: "headG", property: "scaleX", keyframes: [{ frame: o, value: 1 }, { frame: o + 14, value: 1.25, easing: "emphasized-accel" }] },
    { target: "headG", property: "scaleY", keyframes: [{ frame: o, value: 1 }, { frame: o + 14, value: 1.25, easing: "emphasized-accel" }] },
    { target: "subG", property: "opacity", keyframes: [{ frame: o, value: 1 }, { frame: o + 10, value: 0, easing: "ease-in" }] },
  ];
  const merge = (...lists) => {
    const m = new Map();
    for (const t of lists.flat()) {
      const key = t.target + "|" + t.property;
      const prev = m.get(key);
      m.set(key, prev ? { ...prev, keyframes: [...prev.keyframes, ...t.keyframes].sort((a, b) => a.frame - b.frame) } : { ...t, keyframes: [...t.keyframes] });
    }
    return [...m.values()];
  };
  const hiddenTracks = ["band", "headG", "subG"].map((t) => ({ target: t, property: "opacity", keyframes: [{ frame: 0, value: 0 }] }))
    .concat(["lineT", "lineB"].map((t) => ({ target: t, property: "trimEnd", keyframes: [{ frame: 0, value: 0 }] })));
  const resetStart = ["lineT", "lineB"].map((t) => ({ target: t, property: "trimStart", keyframes: [{ frame: 0, value: 0 }] }));
  const headIn = [
    { target: "headG", property: "opacity", keyframes: [{ frame: 0, value: 0 }, { frame: 8, value: 0, easing: "hold" }, { frame: 22, value: 1, easing: "ease-out" }] },
    { target: "headG", property: "scaleX", keyframes: [{ frame: 0, value: 0.6 }, { frame: 8, value: 0.6, easing: "hold" }, { frame: 40, value: 1, easing: "elastic-out" }] },
    { target: "headG", property: "scaleY", keyframes: [{ frame: 0, value: 0.6 }, { frame: 8, value: 0.6, easing: "hold" }, { frame: 40, value: 1, easing: "elastic-out" }] },
    { target: "subG", property: "opacity", keyframes: [{ frame: 0, value: 0 }, { frame: 18, value: 0, easing: "hold" }, { frame: 34, value: 1, easing: "ease-out" }] },
    { target: "subG", property: "y", keyframes: [{ frame: 0, value: 64 }, { frame: 18, value: 64, easing: "hold" }, { frame: 40, value: 44, easing: "emphasized-decel" }] },
  ];
  const HOLD_END = 130;
  return {
    artboard: { name: "Banner", width: W, height: H },
    groups, shapes, texts,
    animations: [
      { name: "hidden", fps: 60, duration: 1, loop: "oneShot", tracks: [...hiddenTracks, ...resetStart] },
      { name: "enter", fps: 60, duration: 44, loop: "oneShot", tracks: [...enterTracks(0), ...headIn, ...resetStart] },
      { name: "exit", fps: 60, duration: 20, loop: "oneShot", tracks: exitTracks(0) },
      { name: "flash", fps: 60, duration: HOLD_END + 20, loop: "oneShot", tracks: merge(enterTracks(0), headIn, exitTracks(HOLD_END), resetStart) },
    ],
    stateMachine: {
      name: "BannerSM",
      inputs: [{ name: "flash", type: "trigger" }, { name: "enter", type: "trigger" }, { name: "exit", type: "trigger" }],
      states: [{ name: "hidden", animation: "hidden" }, { name: "flash", animation: "flash" }, { name: "shown", animation: "enter" }, { name: "leaving", animation: "exit" }],
      transitions: [
        { from: "entry", to: "hidden" },
        { from: "any", to: "flash", condition: { input: "flash" } },
        { from: "any", to: "shown", condition: { input: "enter" } },
        { from: "any", to: "leaving", condition: { input: "exit" } },
        { from: "flash", to: "hidden", exitTimeMs: Math.round(((HOLD_END + 20) / 60) * 1000) },
        { from: "leaving", to: "hidden", exitTimeMs: 340 },
      ],
    },
  };
}

// ---------------------------------------------------------------- build
const fonts = (subsetDisplay, subsetUi) => [
  { id: "display", path: FONT_DISPLAY, ...(subsetDisplay ? { subset: subsetDisplay } : {}) },
  { id: "ui", path: FONT_UI, ...(subsetUi ? { subset: subsetUi } : {}) },
];
const jobs = [
  { file: "backdrop.riv", scene: backdropScene(), previewTime: 1.2 },
  { file: "title.riv", scene: { ...titleScene(), fonts: fonts() }, previewTime: 2.4 },
  { file: "paddle.riv", scene: paddleScene(), previewTime: 0.5 },
  { file: "capsules.riv", scene: { ...(await capsuleScene()), fonts: fonts().slice(0, 1) }, previewTime: 1.2 },
  { file: "banner.riv", scene: { ...bannerScene(), fonts: fonts(UPPER, ANY_TEXT) }, previewTime: 0.5 },
];
const only = process.argv.slice(2);
for (const j of jobs) {
  if (only.length && !only.some((o) => j.file.startsWith(o))) continue;
  const outPath = join(OUT, j.file);
  writeFileSync(join(ROOT, "rive-src", j.file.replace(".riv", ".scene.json")), JSON.stringify(j.scene, null, 1));
  const tag = j.file.replace(".riv", "");
  console.log(`\n=== ${j.file}`);
  console.log((await call("riv_create", { outPath, scene: j.scene, previewTime: j.previewTime }, `${tag}-create`)).slice(0, 1200));
  console.log((await call("riv_lint", { path: outPath }, `${tag}-lint`)).slice(0, 2500));
}
await client.close();
