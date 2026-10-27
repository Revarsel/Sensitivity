# Sensitivity: Code Architecture

> **For AI sessions: use this file instead of reading the codebase.** Open a source file only when you need to change it, and only the relevant part. Update this file when structure changes.

Stack: Three.js r186, Vite 8, plain ES modules, WebGL2, Web Audio. Entry: `index.html` → `src/main.js` (loads fonts, waits for `document.fonts`, creates `Game`, exposes `window.__game`).

---

## 1. Directory map

| Path | Responsibility |
|---|---|
| `src/core/Game.js` | **Central controller.** State machine, main loop, wiring of all systems, menus and pause flow, `sound()`, tapes and docs, hiding, grab and struggle, death, holdout start, fear, FX, render (incl. monitor feed). Largest file. |
| `src/core/Input.js` | Keyboard and mouse with pointer lock. **Use actions, not raw codes:** `act/actHit/actUp(action)`, `is(action, code)`, `label(action)`. Raw `down/hit/up(code)`, mouse helpers, `capture` (rebinding). |
| `src/core/Keybinds.js` | `ACTIONS` list (id, name, group, default key), `defaultBinds()`, fixed `ALIASES` (arrows etc.), `keyLabel(code)`. Add new rebindable actions here. |
| `src/core/Collision.js` | `resolveCircle()` (player circle vs AABBs plus door OBBs), `rayBoxes2D()`. |
| `src/core/Settings.js` | Settings defaults (incl. `keybinds`), `QUALITY`, `VOLUME_SCALE` (slider 100% = original mix, e.g. music ×0.8), localStorage (`settings.v2`). |
| `src/render/SoundField.js` | 25 cm grid over the house. Walls and doors are rasterised in. `compute(x,z,mode,maxDist)` = 16-neighbour Dijkstra **geodesic distance field** (mode 0 = visual, closed doors block; mode 1 = hearing, closed doors add cost). It is cached per start cell, mode and door state. **Perf-critical** (runs for every sound). It uses float64 distances plus a done-flag so each cell expands once (float32 made it ~70 ms). It stops at `maxDist` (callers pass the sound radius + 0.5), so a full-house field takes about 2 ms and a footstep far less. `MrHush.hear()` skips it when the straight-line distance already exceeds his reach. `wallsBetween()` for audio occlusion. |
| `src/render/Pulses.js` | `PulseSystem`: up to `MAX_PULSES=24` active pulses. Each pulse's distance field is written into a half-float DataTexture (rows per slot). `PULSE` colour ids: PLAYER (ice), HUSH (red), WORLD (amber), LIGHT. `createSharedUniforms()`. |
| `src/render/RevealMaterial.js` | All shaders. `revealMaterial({color, pattern, map, cutout, tint, emissive})` (GLSL3 RawShaderMaterial writing 3 MRT targets). `PAT` procedural patterns (floorboard, wallpaper, tile, fur, blood…). Also `cloneReveal`, `setHighlight`, `dustMaterial`, `glowMaterial`, `glassMaterial` (additive, see-through). |
| `src/render/Pipeline.js` | Post: G-buffer (3 HalfFloat MRT) → edge composite (outlines and amber highlight) → FXAA → UnrealBloom → final grade (ACES, grain, CA, fear vignette, `uTunnel` out-of-breath tunnel vision, red flash, fade, **monitor night-vision mode**). `pipeline.fx` = final uniforms. |
| `src/world/House.js` | Builds the whole house: `wallX/wallZ` (walls with door, window and arch openings, trim, sound-grid walls, **player wall colliders** tagged `wall:true, noNav:true`; window openings are solid), rooms (floors and ceilings plus footstep surface zones), windows, doors, `furnish()` (all prop placement), exterior, decals, dust. Exposes `doors`, `doorJune` etc., `colliders`, `zones`, `creaky`, `hideSpots`, `hushChair`, `tvScreen`, `clockPos`, `holdoutSeat`, `surfaceAt()`, `roomAt()`. |
| `src/world/Builder.js` | Geometry builder with transform stack (`at(x,y,z,rotY,fn)`), primitives (`box/boxC/rbox/cyl/sphere/lathe/tube/plane`), `collider()`, and `build()` merges per material. `buildGroup(fn)` for movable objects. |
| `src/world/props.js` | Procedural furniture functions `(b, M, ...)` in local space (front = +Z). |
| `src/world/Door.js` | Hinged door: angle and target, OBB collider, `setTarget(open, speed)`, `isClosed`, `locked`, `hushOnly`, `fixedSign`. |
| `src/world/Materials.js` | Material library `M.*` (wallpapers, floors, wood, blood decals, drawings, `windowGlass`…). |
| `src/world/Textures.js` | Canvas textures: June's drawings, height chart, blood, writing, photos, clock face, poster, TV static. |
| `src/entities/Player.js` | FPS controller. Modes: `walk`, `hide`, `seated`, `grabbed`, `locked`. `MOVE` (speed, stride, noise per crouch/walk/sprint), `SURF_MUL` (noise per floor surface). Head bob, stamina, `lookLimits`, `forcedLook`, `onStep` callback. |
| `src/entities/HushModel.js` | Procedural Mr. Hush mesh rig plus `animateHush()` pose blending (`walk, listen, hunch, sit, grab, jaw, stagger, reach, look`). Uses red `tint`. |
| `src/entities/MrHush.js` | **Monster AI** (see §5). |
| `src/ai/Nav.js` | `NavGrid` A* on the same grid (walls and furniture inflated, doorways kept open). `find()`, `setDoorBlocked()`, LOS string-pulling. |
| `src/audio/dsp.js` | Offline DSP helpers (noise, biquad, modal resonators, stick-slip creaks…). |
| `src/audio/SoundBank.js` | `buildBank(ctx)`: synthesises **all** SFX buffers by name (`step_wood`, `door_slam`, `jumpscare`, `rain`, `chime`, `tine`…). About 0.8 s at boot. |
| `src/audio/Audio.js` | `AudioEngine`: buses (sfx/music/amb/voice/ui), reverb, `play(name, opts)`, `loop(name, opts)`, occlusion, `musicBox()` lullaby, heartbeat and breath, chase music, `LULLABY` melody. `HushVoice`: his positional hummed lullaby (`start/cut/setLevel/setPos`). |
| `src/game/Chapter1.js` | **Chapter script.** Creates all interactables (lore, doors, drawers, monitor, TV, hide spots, squeaky toys, throwables, holdout shutters), checkpoints `start(cp)`, story events (`takeKey`, `unlockJune`, `useMonitor`, `takeBatteries`), hints, ambient emitters (clock, drip, rocking chair, TV pulses, lightning, groans). |
| `src/game/Holdout.js` | FNAF-style 3:00 to 6:00 AM sequence (see §6). |
| `src/game/Interactions.js` | Look-at raycast interactables, prompts, tap/hold, door tap-fast vs hold-slow, highlight. `ownMaterials(obj)`. |
| `src/game/Throwables.js` | Pick up, viewmodel, throw physics, impact noise, glass shards (become a loud floor zone). |
| `src/game/Lore.js` | **All story text**: `DOCS`, `TAPES` (subtitle lines `[who, text, seconds]`), `LORE_ORDER`, `OBJECTIVES`, `CHECKPOINTS`. |
| `src/ui/UI.js` | All DOM UI built from template strings: boot, menu, prologue, pause, settings, evidence, document viewer, death, end, HUD (prompt, objective (always shown; `.fresh` = large for 7 s, then it settles small), hint, message, subtitles, noise meter, breath, struggle, clock, tape cassette), baby-monitor overlay, card, fade. Callbacks go to `game.menuAction/pauseAction/deathAction/endAction`. |
| `src/styles/main.css` | CSS tokens (colours, font stacks). `ui.css`: all UI styling. |
| `docs/` | `CHAPTER_1_PLAN.md` (design), this file. |

---

## 2. Game states (`game.state`)

`boot` → (click: `bootClick` builds audio) → `menu` → `prologue` → `play` ⇄ `cutscene` → `holdout` → (dawn) `play` → `end`. Also `dead`.
Overlays (flags, not states): `paused`, `docOpen`, `sheet` (`'settings'`/`'evidence'`).
Simulation runs in `update()` only when not paused, not reading a doc, and state ∈ {play, holdout, cutscene, dead, menu}. Tapes and subtitles advance even while paused.

The menu is a live scene: `setupMenuWorld()` runs `chapter.start('start')`, and the camera is in `updateMenuCamera()` (the foyer looking at Mr. Hush in his chair).

## 3. The core rule: sound = sight = hearing

```js
game.sound({ x, y, z, radius, strength, color: PULSE.X, source: 'player'|'object'|'hush'|'world',
             kind, speed, linger, euclid, visual })
```
- Emits a visual pulse (unless `visual:false`), raises the HUD noise meter for `player`, and fires the `'sound'` event, which calls `MrHush.hear()`.
- `euclid:true` ignores walls (used for cues behind closed doors and windows in the holdout).
- `source:'world'` and `'hush'` are never heard by him. `object` is a decoy (thrown items, TV).
- Footstep radius = `MOVE[state].noise * SURF_MUL[surface]` (Game.onFootstep). Creaky boards echo after a delay.

## 4. Rendering contract
- Every visible world mesh uses `revealMaterial`. It outputs to 3 targets: colour, view normal plus depth, and reveal colour plus highlight. Additive effects (dust, glass, glow) must write **zero** to targets 1 and 2.
- Brightness comes only from pulses, `uPlayer` near-field (faint), `uAmbient` (monitor IR, dawn), and `uFlash` (lightning). These are set via `game.shared.*`.
- Highlight an interactable: `setHighlight(mat, 0..1)`. Interactions handles this for items with `highlight:true`.
- **Pulse fade is two-stage.** A spatial flash sits just behind the front: `fresh = exp(-(front - d) / 2.2)`. The fill is `0.11 + 0.45 * fresh` and the ring is `0.45` in `gatherReveal`. So a surface flashes as the wave passes, then drops to a dim afterglow. `Pulses.update` holds that afterglow (`B.y` = 1) until `travel + linger*0.9`, then eases it out by `life = travel + linger*2.8`. The `pow 0.55` keeps the faint tail above the edge threshold. For a knock this gives a flash at about 0.25 s, dim to about 2.9 s, and gone by about 4 s.
- Tuning knobs: the fill and ring constants above; `uEdgeGain` and bloom in Pipeline.

## 5. Mr. Hush AI (`MrHush.js`)
States: `dormant` (in chair) → `wander` (hums; picks waypoints biased to disturbances and player's room) → `investigate` → `search` (sniff, look around) → `check` (opens hiding spots; weighted by `hideMemory` and `heardEnter`) → `hunt` (3.3 m/s; repaths) → `grab` → `stunned`. Also `holdout` (driven by Holdout.brain) and `scripted` (tests and cutscenes).
- Hearing: geodesic distance (mode 1) vs `radius * hearMul`. Intensity > 0.42 from the player triggers a hunt, otherwise investigate.
- Contact: hunting with distance < 1 m grabs. Otherwise a 0.75 s sniff, then lunge (lets the player flee).
- **Asleep in the chair (`dormant`)**: wakes early if a single noise reaches intensity > 0.45, or accumulated `sleepNoise` > 1.4 (decays). Guarded by `wakeable` (false after dawn). Otherwise the key pickup wakes him (scripted in `Chapter1.takeKey`, skipped if already awake). Standing up from the chair blocks other behaviour until `pose.sit` reaches 0.
- **Always a threat (anti-cheese)**, tuned with bot simulations (a careful evasive bot survives 3 min about 50% of the time):
  - `menace` (0..1) rises while he's more than 8 m from the player (+1/45 s) and falls when close. `pickWander` drifts toward the player's room with probability 0.3 + 0.5 × menace. At menace > 0.85 he walks (humming, wander pace) to a point 2.5 to 4.5 m from the player.
  - `smellT`: 2.5 s within 2.3 m of him (not hidden) makes him investigate your position.
  - Breathing: within 4.5 m of an awake Hush the player emits a soft `breath` sound every 1.6 s unless holding breath. Space works anywhere except sprinting. Capacity is about 6.5 s in the open and 10 s while hidden. While hidden the breath radius is ×0.6 (muffled). Logic is in `Game.updatePlayActions`.
  - Running out of air: `Game.updateFX` smooths `this.oxy`, which ramps up as held breath drops below 0.45, into `fx.uTunnel` (the view closes in, desaturates and dims). The gasp on release is loud for him (radius 4.5) but visually faint (strength 0.22). A full-strength pulse at the player's face whites out the screen.
  - Sounds flagged `soft: true` (creep steps, breath, slow doors) need intensity > 0.75 to start a hunt; normal sounds need > 0.42.
- **Tracking (`canTrack`)**: while hunting (or searching, within 4.5 m) he follows the player's live position if they're within 7 m, moving at walk speed or faster, not crouched, and at most one wall away. Freeze, creep or hide to break the trail.
- Hiding check catches you if you weren't holding your breath (or 50% if he heard you enter).
- **Giving up (`giveUp()` / `leaving()`)**: an empty check, or a search with nothing left to check, sets `leaveUntil = time + 15`. While leaving, `pickWander` only picks waypoints more than 7 m from the player, and `hear()` ignores soft sounds from a hidden player. Hiding and holding your breath therefore really makes him go away.
- **Grab and escape**: you can always struggle free unless you're grabbed again within `RECATCH_WINDOW` (10 s, `Game.js`) of the last escape (`game.lastEscape`). After an escape he is `stunned` for 4 s.
- Speeds and strides: `SPEED`/`STRIDE` consts at top. Waypoints: `WAYPOINTS`.
- Events emitted: `hushState`, `hushHunt`, `hushGrab`, `hushCheck`, `hushCalm`.

## 6. Holdout (`Holdout.js`)
- Node graph `NODES`/`EDGES` (LIVING, FOYER, KITCHEN, HALL_*, DOOR, BACKDOOR, YARD, WINDOW). The window route goes out the back door (`hushOnly` door).
- `PARAMS` per hour: move interval, aggression, attack delay. `HOUR_SEC = 80`.
- Modes: `idle/move/linger/atDoor/atWindow/breach/retreat/leaving/gone`. The player holds the mouse while looking within 0.55 rad of `doorYaw`/`windowYaw`.
- Monitor: `CAMS` (3 feed cameras), battery (−0.5/s raised, −15 per lullaby), static near him. Game.render swaps to the feed camera with IR ambient.
- Caught → `game.holdoutCaught()` → struggle. One escape per night; the second catch is death and restarts the holdout.
- Dawn → he leaves → player walks → monitor gives the final tape → `chapterComplete()`.

## 7. Adding content (recipes)
- **New document:** add it to `DOCS` (style: `card|form|letter|diane|drawing|clipping|note`) and `LORE_ORDER` in `Lore.js`. Place it in `Chapter1.build()` with `doc('id', add(mesh, x,y,z,rot))`.
- **New tape:** add it to `TAPES` and `LORE_ORDER`, then place it with `tape('id', ...)`.
- **New interactable:** `game.interactions.add({ id, obj, prompt: () => [key, text, alt], use, hold?, enabled?, highlight?, lowPriority? })`. `obj` may be an invisible hotspot mesh (not in the scene; call `updateMatrixWorld`). Large triggers (hiding spots) use `lowPriority: true` so items lying on or near them win the raycast. The wall-occlusion check stops 0.35 m short of the hit, so wall-mounted notes work up close.
- **Locked doors** react on the key press itself (tap or hold): `onLocked()` runs once and no slow-open hold starts. With the key, `Chapter1.unlockJune()` unlocks and nudges the door open to 0.3 rad via the game-time timeline (`this.at`). Use `this.at`, never `setTimeout`, for timed story beats so they stay in sync with simulation and pause.
- **Evidence audit:** every placed lore item must be reachable. Re-run a reachability check (teleport around the item, aim, `interactions.update`, compare `current`) after moving items or triggers. Missing items show their `place` as a hint in the Evidence screen. The TV commercial (`tv_ad`) comes from 'Change the channel' on the TV; `tape_ellis` comes after dawn.
- **New prop:** write a function in `props.js` (local space, call `b.collider(...)`) and place it in `House.furnish()` via `at(x, z, rotY, fn)`. Rotation: 0 faces +Z (south), π faces north, ±π/2 east/west.
- **New sound:** add a recipe in `SoundBank.js` with `put('name', Float32Array)`, then call `audio.play('name', {pos, gain})`.
- **New checkpoint:** add a branch in `Chapter1.start(cp)` and a label in `CHECKPOINTS`. Call `game.checkpoint(cp)` at the story beat.
- **New chapter:** mirror `Chapter1` (build, start, update) and give it its own House-like world builder. `Game` currently instantiates `Chapter1` directly, so a chapter selector is needed.

Coordinates: X east, Z south, Y up. House is 17 × 14 m, ceiling 2.7 m, origin at the NW corner. Room bounds are in `House.build()` (`room(...)` calls) and the plan doc. Grid cells are 0.25 m. Keep wall centres and openings on 0.25 m multiples so the sound grid stays watertight.

## 8. Persistence
localStorage keys `sensitivity.settings.v2` and `sensitivity.save.v1` (`{cp, lore:[ids], completed}`). All access is wrapped in try/catch.

## 8b. Controls and settings UI
Settings sheet has tabs (General / Controls). `UI.renderControls` lists `ACTIONS` grouped explore/holdout. Clicking a key sets `input.capture`, and a clashing key in the same group is swapped. Static key glyphs use `data-bind` / `data-keytext` attributes, refreshed by `UI.refreshKeys(input)` from `Game.applySettings()`. Prompts passing `'E'` are auto-relabelled to the interact key.

## 8c. Small but deliberate decisions
- **Creep defaults to C, not Ctrl**, because browsers can't block Ctrl+W (close tab). `Settings.loadSettings()` migrates old saves from `ControlLeft` to `KeyC`. There's no Ctrl alias.
- **Leave guard:** `Game` constructor adds a `beforeunload` handler that asks before closing the tab during play, holdout or cutscene (disabled with `?dev`).
- **Scrollbars:** themed globally at the end of `ui.css` (thin, faint, red on hover). Don't add per-panel browser-default scrollbars.
- **Volume:** sliders default to 100%. `VOLUME_SCALE` maps 100% to the original mix.

## 9. Testing (no GPU in the cloud sandbox)
- Run the dev server, then Playwright Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required`.
- Open `http://localhost:5173/?dev&manual`. `dev` exposes `window.__game` and skips the pointer-lock requirement. `manual` disables the rAF loop.
- Drive it from `page.evaluate`: `g.bootClick()`, `g.beginPlay('start'|'awake'|'batteries'|'holdout')`, `g.simulate(sec)`, `g.player.teleport(x,z,yaw,pitch)`, `g.sound({...})`, then `g.renderFrame()` (returns a PNG data URL) or call `g.render(1/30)` before `page.screenshot()` to capture the UI too.
- Logic tests are fastest without rendering: simulate with a bot policy and log `hushState` events.
- Note: `camera.matrixWorld` only updates on render. Teleport, then simulate, then render.

## 9b. Performance notes
- Freezes while playing were the sound-field Dijkstra (see SoundField). Profile CPU in the sandbox by timing `g.update(1/30)` per frame and wrapping subsystem methods. Rendering times under SwiftShader are meaningless.
- `Game.prewarmGPU()` uploads all textures and compiles shaders at load, so first views don't hitch. Call it again if a chapter adds textured meshes later.
- GPU load: shaded pixels are capped at 2.4M (`Game.resize`) times the `QUALITY` scale. The reveal shader loops over active pulses, so cost grows with longer pulse `linger`.

## 10. Known gaps / ideas
- No voice acting (tapes use subtitles and hiss). No microphone input. Chapter 2 (St. Agnes, flooded hospital) is not started.
- Real-GPU performance and the audio mix have not been verified by a human yet.
- **Desktop .exe (planned, not started):** the recommended route is Electron plus electron-builder loading `dist/index.html` (Vite `base: './'` already supports this). Disable menu accelerators there so Ctrl+W is safe, then build with `electron-builder --win` (nsis or portable). Tauri is the lighter alternative.
- `Game.js` is large. If it grows further, split it into `GameFlow` (menus and states) and `PlaySystems` (hiding, struggle, fear).
