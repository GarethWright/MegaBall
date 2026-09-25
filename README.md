# Megaball Neo

A modern tribute to **Megaball** (Ed & Al Mackey, Amiga, 1991): a synthwave-style brick breaker whose animated parts are live **Rive** state machines generated with [rive-mcp](https://github.com/ODU33104/rive-mcp). No Rive editor was used.

## Run

```bash
python3 -m http.server 8080 -d public
```

Then open http://localhost:8080. You can also run `npm start`, which uses `http-server`.

**Controls:** move with the mouse, touch, or ← →. Launch the ball and fire lasers with Space or a click. P pauses, M mutes, and V switches views.

Play online: **https://megaball.puk.me.uk**

## Deploy

The site is a static-assets Cloudflare Worker (`wrangler.jsonc`) that serves `public/` on the custom domain `megaball.puk.me.uk`. To deploy:

```bash
npx wrangler@4.40.0 deploy
```

The version is pinned because the latest Wrangler needs Node 22 or later, and 4.40.0 works on Node 20. On Node 22 you can drop the pin.

## Views

The game plays exactly the same in both views. Switch between them with **V** or the VIEW tabs at the top of the screen.

- **HUD** (the default) is a mission-control interface around a realistic Earth that rotates slowly. It shows:
  - **Pilot Telemetry:** score, hi-score, round and lives, each with a progress bar, plus the active power-ups and a capsule index
  - **Event Ledger:** a live log of capsules, detonations, lost balls, speed increases and cleared rounds
  - **Ball Vector:** the ball's speed and position
  - **Sector Timeline:** bricks broken per second, plus the current round
  The HUD view also restyles the pieces in play:
  - **Ball:** a plasma core with a rotating targeting reticle. It shifts from cyan to orange as it nears the speed cap.
  - **Lasers:** cyan particle beams with a muzzle flare, plus a ping where they hit.
  - **Blocks:** glass instrument tiles with a bevel and a notched corner, a light sweep that crosses the wall, pulsing hazards and a scanning mystery block. They shatter into glass shards.
- **ARCADE** is the original synthwave look.

The Earth is a WebGL2 shader in `public/planet.js`. It uses NASA textures (Blue Marble for the surface, Black Marble for city lights, plus a cloud layer) and adds a sunlit terminator, ocean glint and an atmospheric limb. It turns once every 4 minutes.

## What's Rive and what's canvas

| Layer | Tech | Details |
|---|---|---|
| `backdrop.riv` | Rive | Synthwave sun (multi-contour clip mask), Amiga "copper bars", twinkling stars, a perspective grid that scrolls toward you |
| `title.riv` | Rive | Pop-cascade logo, a ball that hops from letter to letter and squashes each one, a rainbow brick strip, and an `intro → idle` state machine |
| `paddle.riv` | Rive | `PaddleSM` has 4 layers: **Size** (a 1D blend on a `size` number, used for expand and shrink), **FX** (`hit` trigger that squashes and flashes the paddle), **Laser** (a `laser` bool that raises the cannons) and **Magnet** (a `magnet` bool for catch mode) |
| `capsules.riv` | Rive | 9 artboards, one per power-up, each with a shine sweep and a rolling label band |
| `banner.riv` | Rive | `BannerSM` with `flash`, `enter` and `exit` triggers. The `headline` and `sub` text runs are rewritten at runtime |
| `hud.riv` | Rive | The HUD view's star field (`OrbitBack`), launch paths, orbit rings and launch-site ping (`OrbitFront`), the title (`TitleHUD`) with its M logo, the banner (`BannerHUD`), and the HUD bat (`PaddleHUD`), which has a gunmetal hull, angular pods, a cyan energy core and orange emitters, and uses the same state machine as the arcade bat |
| bricks, ball, particles, HUD | Canvas2D | Physics, collisions and levels live in `public/game.js` |

Everything is drawn with the low-level `@rive-app/canvas-advanced` runtime, with many artboard instances spread across three canvases.

The build strips Rive blend modes. The Canvas2D renderer rasterises them very slowly on large canvases: with them the game ran at under 1 fps, and without them at 120 fps.

## Power-ups

All 14 capsules from the original Megaball v3.0 are here, colour-coded as they were: blue is good, red is bad and yellow changes the bat.

| Capsule | Effect |
|---|---|
| **S** Slow Ball | Slows the ball down. |
| **N** Next Board | Warps you to the next round and pays the round bonus. |
| **L** Lasers | Fires twin lasers with Space or a click. |
| **G** Gravity Ball *(bad)* | The ball falls in arcs. |
| **C** Catch Ball | An energy field across the top of the bat catches the ball. In the HUD view this is an animated forcefield. |
| **Q** New Quicksand *(bad)* | The whole wall sinks toward you. Catching another one restarts the sink. |
| **D** Diet Pill *(yellow)* | Shrinks the bat. |
| **K** Kill (you) *(bad)* | You lose a life on the spot. |
| **P** Get a Life | Adds an extra life. |
| **E** Expand Paddle *(yellow)* | Widens the bat. |
| **B** Brickthrough | The ball smashes straight through bricks. |
| **Z** Zap Gold | Destroys every gold brick. This capsule only drops while gold bricks remain. |
| **T** Dynamite | The next brick the ball hits explodes. |
| **U** Magnetism *(bad)* | The bat repels the ball sideways as it comes down. |

Neo adds two extras: **M** Multiball and **F** Fast Ball *(bad)*. Mystery bricks only drop good capsules.

In the HUD view the capsules are glass chips with Material Symbols icons (via Iconify, imported by rive-mcp's `riv_asset_search`). In the ARCADE view they are lettered pills.

## Endless rounds

Rounds 1–8 are handcrafted. From round 9 onwards, every round is generated by `public/levels.js`, forever.

- **Seeded:** each round's layout comes from its number, so round 23 is always the same round 23. The seed is shown on the round banner, in the ledger and on the Sector Timeline.
- **Seven pattern families:** mirrored noise, invader sprites, concentric rings or diamonds, sine waves, fortresses with gates, pillars and twin diamonds. Each gets a rainbow colour scheme and a generated name, such as "SOLAR MAZE".
- **Difficulty ramps up** over the first 24 generated rounds: more rows, more silver and gold, more explosives. Every round also gets a couple of mystery bricks.
- **Always winnable:** a flood fill from below checks that every breakable brick can be reached. Gold that seals one off is turned into silver. The generator also never makes an all-gold row, and every round has at least 24 breakable bricks. These checks passed across 2,000 generated rounds.

Bricks come in these kinds: rainbow, silver (takes several hits), gold (indestructible), ✸ explosive (chain reaction), and ? mystery (always drops a capsule). There are 8 rounds, and they loop at a higher speed.

## Music

`public/music.js` is a small tracker engine built on WebAudio, in the style of the Amiga original. These are new compositions, not the original tunes:

- 4 channels panned hard left and right the way the Amiga's Paula chip does it
- 16th-note pattern rows
- chip arpeggios that change note on every tick
- a pulse-wave lead with delayed vibrato and echo
- the Amiga's ~3.3 kHz "LED" low-pass filter on the mix

In the **HUD** view the music is the recorded main theme, `public/music/maintheme.mp3`. It loops across the title and gameplay, and when you switch views it picks up where it left off. The **ARCADE** view uses two tracker songs instead: **Neon Horizon** plays on the title screen and **Brick Runner** plays in game. Browsers only allow audio after you interact with the page, so on the title screen press **M** to start the music. Starting a game also starts it.

## Rebuilding the Rive assets

```bash
npm i -g rive-mcp-server
npm install
npm run build:rive              # or: node tools/build-rive.mjs paddle banner
```

`tools/build-rive.mjs` connects to the `rive-mcp` server over MCP stdio. It follows the server's recommended workflow:

1. `riv_design_tokens`: builds the OKLCH palette and the rainbow hues for the bricks.
2. `riv_create`: generates each file from scene specs that use motion presets.
3. `riv_lint`: checks the output.

It writes the `.riv` files to `public/rive/`, the scene specs to `rive-src/*.scene.json`, and preview PNGs to `rive-src/previews/`.

## Credits

- Original Megaball © Ed & Al Mackey. This is an unofficial fan tribute.
- Earth textures: NASA Earth Observatory (Blue Marble, Black Marble and the cloud map), all public domain.
- Michroma and Rajdhani fonts (SIL OFL 1.1, see `rive-src/*-OFL.txt`).
- Audiowide font by Astigmatic (SIL OFL 1.1, see `rive-src/Audiowide-OFL.txt`). Inter font (SIL OFL 1.1).
- Rive runtime © Rive, Inc. (MIT). The `.riv` files were generated with rive-mcp (freeware).
