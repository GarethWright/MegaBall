// Global Hall of Fame: talks to the Worker's /api/scores (D1) and drives the #board overlay.
// The desktop (Tauri) build and local dev servers use the public deployment's API.

const API = location.protocol.startsWith("http") && !["localhost", "127.0.0.1"].includes(location.hostname)
  ? "" : "https://megaballneo.com";
const TOP = 20;

export const platform = (() => {
  if (!window.__TAURI_INTERNALS__) return "web";
  const ua = navigator.userAgent;
  return /Windows/i.test(ua) ? "windows" : /Mac/i.test(ua) ? "mac" : "linux";
})();

async function request(method, body) {
  const res = await fetch(`${API}/api/scores`, {
    method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
export const fetchScores = () => request("GET").then((d) => d.scores);
export const submitScore = (name, score, round) => request("POST", { name, score, round, platform });

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => n.toLocaleString("en-US");
const ICON = { mac: "MAC", windows: "WIN", linux: "LNX", web: "WEB" };

export function createBoard() {
  const el = document.getElementById("board");
  const list = document.getElementById("board-list"), meta = document.getElementById("board-meta");
  const form = document.getElementById("entry"), input = document.getElementById("entry-name");
  const entryLabel = document.getElementById("entry-label"), note = document.getElementById("board-note");
  const cont = document.getElementById("board-continue");
  let state = "closed", onContinue = null, pending = null;
  let savedName = "";
  try { savedName = localStorage.getItem("megaball-neo-name") || ""; } catch {}

  const render = (scores, highlight = -1) => {
    if (!scores) { list.innerHTML = `<li class="empty">LEADERBOARD OFFLINE</li>`; return; }
    if (!scores.length) { list.innerHTML = `<li class="empty">NO SCORES YET — BE THE FIRST</li>`; return; }
    list.innerHTML = scores.map((s) => `<li class="${s.rank === highlight ? "me" : ""}">
      <span class="rk">${String(s.rank).padStart(2, "0")}</span><span class="nm">${esc(s.name)}</span>
      <span class="rd">R${String(s.round).padStart(2, "0")}</span><span class="pf">${ICON[s.platform] ?? "WEB"}</span>
      <span class="sc">${fmt(s.score)}</span></li>`).join("");
    list.querySelector(".me")?.scrollIntoView({ block: "nearest" });
  };
  const open = (s) => { state = s; el.classList.remove("hidden"); };
  const toList = () => { form.classList.add("hidden"); state = "list"; cont.classList.remove("hidden"); };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = input.value.toUpperCase().replace(/[^A-Z0-9 ._-]/g, "").trim().slice(0, 12);
    if (!name || !pending) { input.focus(); return; }
    form.classList.add("busy");
    try {
      const res = await submitScore(name, pending.score, pending.round);
      try { localStorage.setItem("megaball-neo-name", name); } catch {}
      savedName = name;
      note.textContent = `RANK #${res.rank} · ${fmt(pending.score)}`;
      render(res.scores, res.rank);
    } catch (err) {
      note.textContent = `COULD NOT SUBMIT (${String(err.message).toUpperCase()})`;
    }
    form.classList.remove("busy");
    input.blur();
    pending = null;
    toList();
  });
  cont.addEventListener("click", (e) => { e.stopPropagation(); close(); });
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.blur(); pending = null; toList(); } });

  function close() {
    if (state === "closed" || state === "entry") return;
    el.classList.add("hidden");
    state = "closed";
    const cb = onContinue; onContinue = null; cb?.();
  }

  return {
    get isOpen() { return state !== "closed"; },
    get isEntering() { return state === "entry"; },
    close,
    // browse the board (title screen)
    async show() {
      meta.textContent = "GLOBAL · TOP 20"; note.textContent = ""; form.classList.add("hidden");
      list.innerHTML = `<li class="empty">LOADING…</li>`;
      open("list"); cont.classList.remove("hidden");
      render(await fetchScores().catch(() => null));
    },
    // after a game: offer name entry if the score makes the top 20
    async gameOver(score, round, done) {
      onContinue = done;
      meta.textContent = "GLOBAL · TOP 20"; note.textContent = ""; form.classList.add("hidden"); cont.classList.add("hidden");
      list.innerHTML = `<li class="empty">CONTACTING LEADERBOARD…</li>`;
      open("list");
      const scores = await fetchScores().catch(() => null);
      render(scores);
      const qualifies = scores && score > 0 && (scores.length < TOP || score > scores[scores.length - 1].score);
      if (qualifies) {
        const rank = scores.filter((s) => s.score >= score).length + 1;
        pending = { score, round };
        entryLabel.textContent = `NEW HIGH SCORE · RANK #${rank} · ${fmt(score)}`;
        input.value = savedName;
        form.classList.remove("hidden");
        state = "entry";
        setTimeout(() => { input.focus(); input.select(); }, 50);
      } else {
        note.textContent = scores ? (score > 0 && scores.length ? `YOUR SCORE ${fmt(score)} · TOP 20 NEEDS ${fmt(scores[scores.length - 1].score + 1)}` : "") : "SCORES COULD NOT BE REACHED";
        toList();
      }
    },
  };
}
