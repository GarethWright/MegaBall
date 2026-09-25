// Assembles the website (public/ + downloads/) into dist-site/ and deploys the Worker.
// Installers live outside public/ so the desktop app never embeds its own downloads.
import { cpSync, existsSync, rmSync, statSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist-site");
rmSync(OUT, { recursive: true, force: true });
const noDotfiles = (src) => !src.split(/[\\/]/).pop().startsWith(".");
cpSync(join(ROOT, "public"), OUT, { recursive: true, filter: noDotfiles });
const dl = join(ROOT, "downloads");
if (existsSync(dl)) {
  for (const f of readdirSync(dl)) {
    const size = statSync(join(dl, f)).size;
    if (size > 25 * 1024 * 1024) throw new Error(`${f} is ${(size / 1048576).toFixed(1)} MiB; Workers static assets max out at 25 MiB`);
  }
  cpSync(dl, join(OUT, "downloads"), { recursive: true, filter: noDotfiles });
}
console.log("site assembled:", readdirSync(OUT).join(" "));
execSync("npx --yes wrangler@4.40.0 deploy", { cwd: ROOT, stdio: "inherit" });
