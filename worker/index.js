// Megaball Neo Worker: serves the game (static assets) and a small global leaderboard API on D1.
//   GET  /api/scores          -> { scores: [{ rank, name, score, round, platform, date }] } (top 20)
//   POST /api/scores {name, score, round, platform} -> { ok, rank, scores }
const TOP = 20;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...extra } });

async function top(env) {
  const { results } = await env.DB.prepare(
    "SELECT name, score, round, platform, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT ?",
  ).bind(TOP).all();
  return results.map((r, i) => ({ rank: i + 1, name: r.name, score: r.score, round: r.round, platform: r.platform, date: r.created_at }));
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function submit(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const name = String(body.name ?? "").toUpperCase().replace(/[^A-Z0-9 ._-]/g, "").trim().slice(0, 12);
  const score = Number(body.score), round = Number(body.round);
  const platform = ["web", "mac", "windows", "linux"].includes(body.platform) ? body.platform : "web";
  if (!name) return json({ error: "name required" }, 400);
  if (!Number.isInteger(score) || score <= 0 || score > 50_000_000) return json({ error: "bad score" }, 400);
  if (!Number.isInteger(round) || round < 1 || round > 10_000) return json({ error: "bad round" }, 400);
  // plausibility: bricks + capsules + round bonuses can't outrun this per-round ceiling
  if (score > 60_000 * round + 500 * round * (round + 1)) return json({ error: "implausible score" }, 400);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const ipHash = await sha256(`${ip}|${env.SALT ?? "megaball-neo"}`);
  const now = Date.now();
  const { recent } = await env.DB.prepare("SELECT COUNT(*) AS recent FROM scores WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, now - 10 * 60 * 1000).first();
  if (recent >= 6) return json({ error: "slow down" }, 429);

  await env.DB.prepare("INSERT INTO scores (name, score, round, platform, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(name, score, round, platform, ipHash, now).run();
  const { better } = await env.DB.prepare("SELECT COUNT(*) AS better FROM scores WHERE score > ?").bind(score).first();
  return json({ ok: true, rank: better + 1, scores: await top(env) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/scores") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      try {
        if (request.method === "GET") return json({ scores: await top(env) });
        if (request.method === "POST") return await submit(request, env);
        return json({ error: "method not allowed" }, 405);
      } catch (err) {
        return json({ error: "leaderboard unavailable" }, 503);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
