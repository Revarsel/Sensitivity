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
| `src/render/SoundField.js` | 25 cm grid over the house. Walls and doors are rasterised in. `compute(x,z,mode)` = 16-neighbour Dijkstra **geodesic distance field** (mode 0 = visual, closed doors block; mode 1 = hearing, closed doors add cost). Cached. `wallsBetween()` for audio occlusion. |
| `src/render/Pulses.js` | `PulseSystem`: up to `MAX_PULSES=24` active pulses. Each pulse's distance field is written into a half-float DataTexture (rows per slot). `PULSE` colour ids: PLAYER (ice), HUSH (red), WORLD (amber), LIGHT. `createSharedUniforms()`. |
| `src/render/RevealMaterial.js` | All shaders. `revealMaterial({color, pattern, map, cutout, tint, emissive})` (GLSL3 RawShaderMaterial writing 3 MRT targets). `PAT` procedural patterns (floorboard, wallpaper, tile, fur, blood…). Also `cloneReveal`, `setHighlight`, `dustMaterial`, `glowMaterial`, `glassMaterial` (additive, see-through). |
| `src/render/Pipeline.js` | Post: G-buffer (3 HalfFloat MRT) → edge composite (outlines and amber highlight) → FXAA → UnrealBloom → final grade (ACES, grain, CA, fear vignette, red flash, fade, **monitor night-vision mode**). `pipeline.fx` = final uniforms. |
| `src/world/House.js` | Builds the whole house: `wallX/wallZ` (walls with door, window and arch openings, trim, sound-grid walls), rooms (floors and ceilings plus footstep surface zones), windows, doors, `furnish()` (all prop placement), exterior, decals, dust. Exposes `doors`, `doorJune` etc., `colliders`, `zones`, `creaky`, `hideSpots`, `hushChair`, `tvScreen`, `clockPos`, `holdoutSeat`, `surfaceAt()`, `roomAt()`. |
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
| `src/ui/UI.js` | All DOM UI built from template strings: boot, menu, prologue, pause, settings, evidence, document viewer, death, end, HUD (prompt, objective, hint, message, subtitles, noise meter, breath, struggle, clock, tape cassette), baby-monitor overlay, card, fade. Callbacks go to `game.menuAction/pauseAction/deathAction/endAction`. |
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
- Tuning knobs: fill strength `0.28` and ring `0.85` in `gatherReveal` (RevealMaterial); `uEdgeGain` and bloom in Pipeline.

## 5. Mr. Hush AI (`MrHush.js`)
States: `dormant` (in chair) → `wander` (hums; picks waypoints biased to disturbances and player's room) → `investigate` → `search` (sniff, look around) → `check` (opens hiding spots; weighted by `hideMemory` and `heardEnter`) → `hunt` (3.3 m/s; repaths) → `grab` → `stunned`. Also `holdout` (driven by Holdout.brain) and `scripted` (tests and cutscenes).
- Hearing: geodesic distance (mode 1) vs `radius * hearMul`. Intensity > 0.42 from the player triggers a hunt, otherwise investigate.
- Contact: hunting with distance < 1 m grabs. Otherwise a 0.75 s sniff, then lunge (lets the player flee).
- Hiding check catches you if you weren't holding your breath (or 50% if he heard you enter).
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
- **New interactable:** `game.interactions.add({ id, obj, prompt: () => [key, text, alt], use, hold?, enabled?, highlight? })`. `obj` may be an invisible hotspot mesh (not in the scene; call `updateMatrixWorld`).
- **New prop:** write a function in `props.js` (local space, call `b.collider(...)`) and place it in `House.furnish()` via `at(x, z, rotY, fn)`. Rotation: 0 faces +Z (south), π faces north, ±π/2 east/west.
- **New sound:** add a recipe in `SoundBank.js` with `put('name', Float32Array)`, then call `audio.play('name', {pos, gain})`.
- **New checkpoint:** add a branch in `Chapter1.start(cp)` and a label in `CHECKPOINTS`. Call `game.checkpoint(cp)` at the story beat.
- **New chapter:** mirror `Chapter1` (build, start, update) and give it its own House-like world builder. `Game` currently instantiates `Chapter1` directly, so a chapter selector is needed.

Coordinates: X east, Z south, Y up. House is 17 × 14 m, ceiling 2.7 m, origin at the NW corner. Room bounds are in `House.build()` (`room(...)` calls) and the plan doc. Grid cells are 0.25 m. Keep wall centres and openings on 0.25 m multiples so the sound grid stays watertight.

## 8. Persistence
localStorage keys `sensitivity.settings.v2` and `sensitivity.save.v1` (`{cp, lore:[ids], completed}`). All access is wrapped in try/catch.

## 8b. Controls and settings UI
Settings sheet has tabs (General / Controls). `UI.renderControls` lists `ACTIONS` grouped explore/holdout. Clicking a key sets `input.capture`, and a clashing key in the same group is swapped. Static key glyphs use `data-key` / `data-keytext` attributes, refreshed by `UI.refreshKeys(input)` from `Game.applySettings()`. Prompts passing `'E'` are auto-relabelled to the interact key.

## 9. Testing (no GPU in the cloud sandbox)
- Run the dev server, then Playwright Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required`.
- Open `http://localhost:5173/?dev&manual`. `dev` exposes `window.__game` and skips the pointer-lock requirement. `manual` disables the rAF loop.
- Drive it from `page.evaluate`: `g.bootClick()`, `g.beginPlay('start'|'awake'|'batteries'|'holdout')`, `g.simulate(sec)`, `g.player.teleport(x,z,yaw,pitch)`, `g.sound({...})`, then `g.renderFrame()` (returns a PNG data URL) or call `g.render(1/30)` before `page.screenshot()` to capture the UI too.
- Logic tests are fastest without rendering: simulate with a bot policy and log `hushState` events.
- Note: `camera.matrixWorld` only updates on render. Teleport, then simulate, then render.

## 10. Known gaps / ideas
- No voice acting (tapes use subtitles and hiss). No microphone input. Chapter 2 (St. Agnes, flooded hospital) is not started.
- Real-GPU performance and the audio mix have not been verified by a human yet.
- `Game.js` is large. If it grows further, split it into `GameFlow` (menus and states) and `PlaySystems` (hiding, struggle, fear).
