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
| `src/core/Collision.js` | `resolveCircle(x, z, r, colliders, doors, {minY})` (circle vs AABBs plus door OBBs; returns `[x, z]`), `rayBoxes2D()`. Used by the player, Mr. Hush's push-out, and grab placement. |
| `src/core/Settings.js` | Settings defaults (incl. `keybinds`), `QUALITY`, `VOLUME_SCALE` (slider 100% = original mix, e.g. music ×0.8), localStorage (`settings.v2`). `rev` is a migration counter handled in `loadSettings` (rev 1 turned `showFps` on for old saves). |
| `src/render/SoundField.js` | 25 cm grid over the house. Walls and doors are rasterised in. `compute(x,z,mode,maxDist)` = 16-neighbour Dijkstra **geodesic distance field** (mode 0 = visual, closed doors block; mode 1 = hearing, closed doors add cost). It is cached per start cell, mode and door state. **Perf-critical** (runs for every sound). It uses float64 distances plus a done-flag so each cell expands once (float32 made it ~70 ms). It stops at `maxDist` (callers pass the sound radius + 0.5), so a full-house field takes about 2 ms and a footstep far less. `MrHush.hear()` skips it when the straight-line distance already exceeds his reach. `wallsBetween()` for audio occlusion. |
| `src/render/Pulses.js` | `PulseSystem`: up to `MAX_PULSES=24` active pulses. Each pulse's distance field is written into a half-float DataTexture (rows per slot). `PULSE` colour ids: PLAYER (ice), HUSH (red), WORLD (amber), LIGHT. `createSharedUniforms()`. |
| `src/render/RevealMaterial.js` | All shaders. `revealMaterial({color, pattern, map, cutout, tint, emissive})` (GLSL3 RawShaderMaterial writing 3 MRT targets). `PAT` procedural patterns (floorboard, wallpaper, tile, fur, blood…). Also `cloneReveal`, `setHighlight`, `dustMaterial`, `glowMaterial`, `glassMaterial` (additive, see-through). |
| `src/render/Pipeline.js` | Post: G-buffer (3 HalfFloat MRT) → edge composite (outlines and amber highlight) → FXAA → UnrealBloom → final grade (ACES, grain, CA, fear vignette, `uTunnel` out-of-breath tunnel vision, red flash, fade, **monitor night-vision mode**). `pipeline.fx` = final uniforms. |
| `src/world/House.js` | Builds the whole house: `wallX/wallZ` (walls with door, window and arch openings, trim, sound-grid walls, **player wall colliders** tagged `wall:true, noNav:true`; window openings are solid), rooms (floors and ceilings plus footstep surface zones), windows, doors, `furnish()` (all prop placement), exterior, decals, dust. Exposes `doors`, `doorJune` etc., `colliders`, `zones`, `creaky`, `hideSpots`, `hushChair` (his seat in Mom's stretched armchair), `rocker` (June's rocking chair group, Thimble's seat), `tvScreen`, `clockPos`, `holdoutSeat`, `surfaceAt()`, `roomAt()`. |
| `src/world/Builder.js` | Geometry builder with transform stack (`at(x,y,z,rotY,fn)`), primitives (`box/boxC/rbox/cyl/sphere/lathe/tube/plane`), `collider()`, and `build()` merges per material. `buildGroup(fn)` for movable objects. |
| `src/world/props.js` | Procedural furniture functions `(b, M, ...)` in local space (front = +Z). `nightstand({noTopDrawer})` and `counter({skipDrawers:[i]})` leave out drawer fronts that Chapter1 animates. `armchair(b, M, mat, {sx, sz})` stretches width and depth (heights stay): Mom's chair is 1.6 × 1.45 so he fits in it. |
| `src/world/Door.js` | Hinged door: angle and target, OBB collider, `setTarget(open, speed)`, `isClosed`, `locked`, `hushOnly`, `fixedSign`. |
| `src/world/Materials.js` | Material library `M.*` (wallpapers, floors, wood, blood decals, drawings, `windowGlass`…). |
| `src/world/Textures.js` | Canvas textures: June's drawings, height chart, blood, writing, photos, clock face, poster, TV static. |
| `src/entities/Player.js` | FPS controller. Modes: `walk`, `hide`, `seated`, `grabbed`, `locked`. `MOVE` (speed, stride, noise per crouch/walk/sprint), `SURF_MUL` (noise per floor surface). Head bob, stamina, `lookLimits`, `forcedLook`, `onStep` callback. `startGlide(dur)` eases the camera from its current pose to the next one (used when entering or leaving a hiding spot). |
| `src/entities/HushModel.js` | Procedural Mr. Hush mesh rig plus `animateHush()` pose blending. Channels: `walk, speed, listen, hunch, sit, grab, jaw, stagger, look, reach, turn, sniff, stir, squeeze`. `squeeze` (doorways) scales the torso x by 1 − 0.32·sq (the neck counter-scales so the head keeps its shape) and tucks the arms in front. Seated, the hips drop only 0.14 so he rests on the cushion. Secondary motion uses damped `spring()`s kept in `m.anim`: torso, neck and arms lag and overshoot. The heavy gait has a footfall dip at each multiple of π in `phase`, torso counter-twist, a run blend above 1.8 m/s, and a lean into turns. Idle adds breathing and random head twitches. Stunned clutches the head; `stir` lifts the sleeping head. Uses red `tint`. |
| `src/entities/Thimble.js` | **Thimble**, the porcelain doll in June's rocking chair: the second holdout enemy. The model is a child of `house.rocker`. His shadow is a cut-out plane on the north wall (`SHADOW_X`) that grows with agitation. `begin(faceX, faceZ)` turns the chair to face the seat; `reset()` restores everything (called from `Chapter1.start`). `update(dt, riseRate)` raises agitation, or lowers it by `CALM_RATE` while the music box plays (`sing()`, `SONG_SECONDS`); it plays the heartbeat thud plus a red pulse that lights the shadow and rocks the chair harder. It returns true at agitation 1. `bump(v)` is used for noise; `lunge(k)` is the kill. |
| `src/entities/MrHush.js` | **Monster AI** (see §5). |
| `src/ai/Nav.js` | `NavGrid` A* on the same grid. **Sized for Mr. Hush** (belly ~1.25 m wide, ~1 m deep). Walls are blocked out to `WALL_CLEAR` (0.55 m from wall-cell centres, so paths stay ~0.6 m from the face), but only one cell within `DOOR_ZONE` (1.2 m) of a doorway. Furniture taller than `LOW_FURNITURE` (1.05 m) gets `inflate` 0.5; lower furniture gets `LOW_INFLATE` 0.36 (only his legs need room). Doorway cells stay open. `find()` runs A*, then LOS string-pulling, then `centerDoorways()`: a path crossing a doorway goes through `[centre − 0.6·n, centre, centre + 0.6·n]`, square to the wall. `doors` (centre and normal per doorway, from the grid's door cells), `nearestFree()`, `setDoorBlocked()`. If you move furniture or waypoints, re-run the connectivity check (`find` between all `WAYPOINTS`, hide-spot `out` points and holdout nodes; 0 fails expected). |
| `src/audio/dsp.js` | Offline DSP helpers (noise, biquad, modal resonators, stick-slip creaks…). |
| `src/audio/SoundBank.js` | `buildBank(ctx)`: synthesises **all** SFX buffers by name (`step_wood`, `door_slam`, `jumpscare`, `rain`, `chime`, `tine`…). About 0.8 s at boot. |
| `src/audio/Audio.js` | `AudioEngine`: buses (sfx/music/amb/voice/ui), reverb, `play(name, opts)`, `loop(name, opts)`, occlusion, `musicBox()` lullaby, heartbeat and breath, chase music, `LULLABY` melody. `HushVoice`: his positional hummed lullaby (`start/cut/setLevel/setPos`). |
| `src/game/Chapter1.js` | **Chapter script.** Creates all interactables (lore, doors, drawers, monitor, TV, hide spots, squeaky toys, throwables, holdout shutters), checkpoints `start(cp)`, story events (`takeKey`, `unlockJune`, `useMonitor`, `takeBatteries`), hints, ambient emitters (clock, drip, rocking chair, TV pulses, lightning, groans). |
| `src/game/Holdout.js` | FNAF-style 3:00 to 6:00 AM sequence (see §6). |
| `src/game/Interactions.js` | Look-at raycast interactables, prompts, tap/hold, door tap-fast vs hold-slow, highlight. `ownMaterials(obj)`. **Evidence reveal:** `highlight:true` items are dark until a new non-ambient pulse sweeps over them (`pulses.sweptOver` returns the pulse id). They then glow 0.85 for `REVEAL_HOLD` (4.5 s) and fade over `REVEAL_FADE` (2.5 s). Aiming at an unrevealed item gives only 0.3. |
| `src/game/Throwables.js` | Pick up, viewmodel, throw physics, impact noise, glass shards (become a loud floor zone). A throw needs `armed`: the mouse press must start during play, so the release of a menu click (Resume, re-capture) never throws. |
| `src/game/Lore.js` | **All story text**: `DOCS`, `TAPES` (subtitle lines `[who, text, seconds]`), `LORE_ORDER`, `OBJECTIVES`, `CHECKPOINTS`, `ITEMS` (carried-item names and icons for the HUD inventory). |
| `src/ui/UI.js` | All DOM UI built from template strings: boot, menu, prologue, pause, settings, evidence, document viewer, death, end, HUD (prompt, objective (always shown; `.fresh` = large for 7 s, then it settles small), hint, message, subtitles, noise meter, breath, struggle, holdout `#doorfight`, `#inventory`, clock, tape cassette), baby-monitor overlay, card, fade, `#fps` counter, `#resume-veil` ("Click to continue"). Callbacks go to `game.menuAction/pauseAction/deathAction/endAction`. |
| `src/styles/main.css` | CSS tokens (colours, font stacks). `ui.css`: all UI styling. |
| `docs/` | `CHAPTER_1_PLAN.md` (design), `LORE.md` (whole story; update with lore changes), `TECHNICAL.md` (plain-language how-it-works; update with system changes), this file. |

---

## 2. Game states (`game.state`)

`boot` → (click: `bootClick` builds audio) → `menu` → `prologue` → `play` ⇄ `cutscene` → `holdout` → (dawn) `play` → `end`. Also `dead`.
Overlays (flags, not states): `paused`, `docOpen`, `sheet` (`'settings'`/`'evidence'`).
Simulation runs in `update()` only when not paused, not reading a doc, and state ∈ {play, holdout, cutscene, dead, menu}. Tapes and subtitles advance even while paused.

The menu is a live scene: `setupMenuWorld()` runs `chapter.start('start')`, and the camera is in `updateMenuCamera()` (the foyer looking at Mr. Hush in his chair).

## 3. The core rule: sound = sight = hearing

```js
game.sound({ x, y, z, radius, strength, color: PULSE.X, source: 'player'|'object'|'hush'|'world',
             kind, speed, linger, hold, tail, euclid, visual, soft })
```
- Emits a visual pulse (unless `visual:false`), raises the HUD noise meter for `player`, and fires the `'sound'` event, which calls `MrHush.hear()`.
- `euclid:true` ignores walls (used for cues behind closed doors and windows in the holdout).
- `source:'world'` and `'hush'` are never heard by him. `object` is a decoy (thrown items, TV).
- Footstep radius = `MOVE[state].noise * SURF_MUL[surface]` (Game.onFootstep). Creaky boards echo after a delay.

## 4. Rendering contract
- Every visible world mesh uses `revealMaterial`. It outputs to 3 targets: colour, view normal plus depth, and reveal colour plus highlight. Additive effects (dust, glass, glow) must write **zero** to targets 1 and 2.
- Brightness comes only from pulses, `uPlayer` near-field (faint), `uAmbient` (monitor IR, dawn), and `uFlash` (lightning). These are set via `game.shared.*`.
- Highlight an interactable: `setHighlight(mat, 0..1)`. Interactions handles this for items with `highlight:true`.
- **Pulse uniforms:** `A = (x, y, z, age*speed)` holds the *unclamped* front; the shader clamps it to `maxR*1.15`. `B = (strength, fade, maxR, code)`, where `code = colour + 4*(straight-line) + 8*round(speed)`. `uPulseCount` is the highest active slot + 1, and the shader loop breaks there. `emit` fills the lowest free slot, so the count stays small.
- **Pulse fade is two-stage.** Per point, `passed = (A.w - d) / speed` is the number of seconds since the wave went by. Then `fresh = 1 - smoothstep(0.55, 0.85, passed)`. The fill is `0.15 + peak * fresh` and the ring `0.36–0.42` (see below) in `gatherReveal`. So a surface stays fully bright for about 0.6 s, then drops quickly to a dim afterglow. `Pulses.update` holds that afterglow (`B.y` = 1) until `travel + linger*1.3`, then eases it out by `life = travel + linger*3.4` (`pow 0.55` keeps the faint tail visible). Knock: bright from 0.25 to 0.7 s, dim by 1 s, holds to about 3 s, gone by about 5 s.
- **Pulse options:** `hold` (seconds the dim afterglow stays) and `tail` (seconds to fade) override the linger-based defaults. `reveals` (false for `source:'world'`) controls whether the pulse can reveal evidence. Each pulse gets an increasing `id`.
- **Player pulses peak lower:** palette 0 uses a fresh boost of 0.19 and ring 0.36; other palettes use 0.25 and 0.42.
- **Soft knee** (`GLOW_KNEE` 0.33, `GLOW_OVER` 0.22 in `gatherReveal`): the summed pulse light above the knee is compressed, so overlapping sounds (sprint + knock + door) can't blow out to white. Measured: one knock averages 78 of 255 on screen; sprint + knock + door 128 (it was 201 with a third of the screen near-white). The dim afterglow (≤ 0.15) is never affected.
- **Near glow:** a faint 3 m glow around the player (`uPlayer.w = NEAR_GLOW` 0.07 in `Game.js`, falloff in `gatherReveal`). Off in the menu.
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
- **Grab and escape**: you can always struggle free unless you're grabbed again within `RECATCH_WINDOW` (45 s, `Game.js`) of the last escape (`game.lastEscape`). After an escape he is `stunned` for 2 s (stumbles back ~0.7 m; `stagger` eases in and out). A dim `world` pulse (radius 7.5, hold 5.5 s, tail 2.5 s) lingers where you broke free, so you can see to run.
- **Grab view**: `Game.placeForGrab()` always puts him exactly `GRAB_DIST` (1.15 m) from the player, on the side he came from or the nearest free direction in 30° steps. The spot must be clear (`resolveCircle` r 0.42) with no wall between you. Never closer: a head nearly overhead made the forced-look yaw flip, which was the old camera glitch. The grab also clears `player.glide` and velocity. `Game.faceHush()` re-aims `forcedLook` at his muzzle every struggle frame, and the grab pose tilts his chin down (`neck.rotation.x += grab*0.3`). This is shared by the holdout catch.
- **Body collision** (`MrHush.pushOut`, every frame unless sitting or dormant): his centre is pushed out of tall colliders (`BODY_R` 0.46) and low ones (`LEGS_R` 0.3), both minus a bit while squeezing. This is a safety net for stumbles, corners and teleports; the nav margins are larger, so it never fights path following. Near a doorway (`nav.doors`) `pose.squeeze` → 1 and `followPath` slows 30%. `Game.pushFromHush()` keeps the player 0.75 m from him and then resolves the player against walls, so he can't shove you into one.
- Measured (3 simulated min of hunting and investigating): centre ≥ 0.54 m from walls outside doorways and ≥ 0.68 m from tall furniture.
- Knock cooldown 0.85 s (`Game.knock`). The death sting is `jumpscare` at gain 0.6 with a 2.6 kHz low-pass; the grab scare stays full strength.
- Speeds and strides: `SPEED`/`STRIDE` consts at top. Waypoints: `WAYPOINTS`.
- Events emitted: `hushState`, `hushHunt`, `hushGrab`, `hushCheck`, `hushCalm`.

## 6. Holdout (`Holdout.js`)
- Node graph `NODES`/`EDGES` (LIVING, FOYER, KITCHEN, HALL_*, DOOR, BACKDOOR, YARD, WINDOW). The window route goes out the back door (`hushOnly` door).
- `PARAMS` per hour: move `interval`, `aggr`ession, door warning `delay`, door fight `push` (gap per second) and `need` (pushes), window `react` time, and Thimble's `rise` per second. `HOUR_SEC = 80`.
- Modes: `idle/move/linger/atDoor/doorFight/banging/atWindow/breach/caughtWait/retreat/thimble/dead/leaving/gone`. Seated look limits are `yawMin -1.42` (door side) to `yawMax 2.15` (window, then Thimble).
- **Door** (closed by default, `hushOnly`): `atDoor` gives a warning (sniffs, scratching, handle) for `delay`. Then `startDoorFight()` drops the monitor, turns the camera to the door, and `updateDoorFight()` takes over input. One random key of `FIGHT_KEYS` (forward, left, back, right = WASD) pops up at a time: the right key pushes the gap back `PUSH_BACK` and adds progress; a wrong key opens it `WRONG_KEY`. Progress ≥ 1 → `winDoorFight()` (slam, then `banging`: 3–5 bangs, then `retreat`). Gap ≥ 1 → `breach`. UI: `ui.doorFight(on, {key, keyAt, gap, prog, wrong})` (`#doorfight`). Bot-tuned: winning needs about 2, 2.5 and 3 correct presses per second at 3, 4 and 5 AM.
- **Window**: `arriveWindow()` (a faint tap at YARD is the only earlier warning) gives `react` seconds (2.5, 2.1, 1.75) to start holding the mouse while looking at it. He then tries the shutters for `WINDOW_HOLD` (2.4 s); letting go → `breach`. He hits the shutters and `repelled(false)` → `retreat`.
- **Thimble**: agitation rises every frame; at 1 → `thimbleKill()` (camera to the doll, he lunges, jumpscare) → `game.die(true, 'thimble')`. **L with the monitor down** → `singToThimble()`: the music box calms him, but it is Mr. Hush's song, so `drawn` (16 s) sends Mr. Hush to June's room (nearest of DOOR or WINDOW) with short idle timers and faster moves. **L with the monitor up** is still the lure to the viewed room.
- Monitor: `CAMS` (3 feed cameras), battery (−0.5/s raised, −15 per lullaby), static near him. Game.render swaps to the feed camera with IR ambient.
- **No second chances in the holdout:** caught → `game.holdoutCaught()` → an unwinnable 1.2 s grab → `die(true)`. Dawn waits for a death already under way; `beginDawn` ends a door fight and Thimble.
- Bot check (full night): a player pushing 3.2/s and singing at 65% survives with about 4–7 door attacks, 1–4 window visits and 5 winds. At 2.6/s they die at the 4 or 5 AM door.
- Dawn → he leaves → player walks → monitor gives the final tape → `chapterComplete()`.

## 7. Adding content (recipes)
- **New document:** add it to `DOCS` (style: `card|form|letter|diane|drawing|clipping|note`) and `LORE_ORDER` in `Lore.js`. Place it in `Chapter1.build()` with `doc('id', add(mesh, x,y,z,rot))`.
- **New tape:** add it to `TAPES` and `LORE_ORDER`, then place it with `tape('id', ...)`.
- **New interactable:** `game.interactions.add({ id, obj, prompt: () => [key, text, alt], use, hold?, enabled?, highlight?, lowPriority? })`. `obj` may be an invisible hotspot mesh (not in the scene; call `updateMatrixWorld`). Large triggers (hiding spots) use `lowPriority: true` so items lying on or near them win the raycast. The wall-occlusion check stops 0.35 m short of the hit, so wall-mounted notes work up close.
- **Locked doors** react on the key press itself (tap or hold): `onLocked()` runs once and no slow-open hold starts. With the key, `Chapter1.unlockJune()` unlocks and nudges the door open to 0.3 rad via the game-time timeline (`this.at`). Use `this.at`, never `setTimeout`, for timed story beats so they stay in sync with simulation and pause.
- **Evidence audit:** every placed lore item must be reachable. Re-run a reachability check (teleport around the item, aim, `interactions.update`, compare `current`) after moving items or triggers. Missing items show their `place` as a hint in the Evidence screen. The TV commercial (`tv_ad`) comes from 'Change the channel' on the TV; `tape_ellis` comes after dawn.
- **Animated drawers** (`Chapter1.makeDrawers/updateDrawers`): a movable drawer group sits where the prop's front was left out. It slides out while its interaction is being held (`interactions.holdT`), back in if released early, and stays open once its `done()` flag is true. Checkpoint starts snap it into place.
- **HUD inventory:** `Chapter1.update` mirrors `this.inv` into `ui.inventory([{id,name,icon}])` (right edge, vertically centred; new items flash). Add an entry in `ITEMS` (Lore.js) and an SVG in `ICONS` (UI.js).
- **New prop:** write a function in `props.js` (local space, call `b.collider(...)`) and place it in `House.furnish()` via `at(x, z, rotY, fn)`. Rotation: 0 faces +Z (south), π faces north, ±π/2 east/west.
- **New sound:** add a recipe in `SoundBank.js` with `put('name', Float32Array)`, then call `audio.play('name', {pos, gain})`.
- **New checkpoint:** add a branch in `Chapter1.start(cp)` and a label in `CHECKPOINTS`. Call `game.checkpoint(cp)` at the story beat.
- **New chapter:** mirror `Chapter1` (build, start, update) and give it its own House-like world builder. `Game` currently instantiates `Chapter1` directly, so a chapter selector is needed.

Coordinates: X east, Z south, Y up. House is 17 × 14 m, ceiling 2.7 m, origin at the NW corner. Room bounds are in `House.build()` (`room(...)` calls) and the plan doc. Grid cells are 0.25 m. Keep wall centres and openings on 0.25 m multiples so the sound grid stays watertight.

## 8. Persistence
localStorage keys `sensitivity.settings.v2` and `sensitivity.save.v1` (`{cp, lore:[ids], completed}`). All access is wrapped in try/catch.

## 8b. Controls and settings UI
Settings sheet has tabs (General / Controls). General: left column Controls (incl. `creepMode` hold/toggle) and Sound; right column Display (brightness, quality, adaptive resolution, show FPS, grain) and Accessibility (`subtitles`, `subSize` normal/large, `reduceFlash`), then **Reset to defaults**. Reset calls `onChange('__reset')` → `Game.onSettingChange`, which restores `DEFAULTS` but keeps keybinds and re-renders the sheet. `reduceFlash` scales lightning (`uFlash`), the red flash and the CA spike, and sets `player.shakeMul` = 0.3. `UI.renderControls` lists `ACTIONS` grouped explore/holdout. Clicking a key sets `input.capture`, and a clashing key in the same group is swapped. Static key glyphs use `data-bind` / `data-keytext` attributes, refreshed by `UI.refreshKeys(input)` from `Game.applySettings()`. Prompts passing `'E'` are auto-relabelled to the interact key.

## 8c. Small but deliberate decisions
- **Pause and resume** (`Game.pause`): unpausing needs the mouse captured again. A click (Resume) captures immediately. **Esc on the pause menu** also unpauses, but browsers refuse capture on Esc, so `resumePending` holds the game frozen behind `#resume-veil` ("Click to continue") until a click captures (`onLockChange(true)` → `resetPause()`). Esc on the veil returns to the menu. The Esc that paused is ignored for 300 ms. A capture that lands while paused is released again. Always use `resetPause()` rather than `paused = false`.
- **Hidden tab** (`visibilitychange`): pauses play or holdout and suspends the AudioContext; it resumes when visible.
- **Pause screen controls list**: `Game.controlsRef()` uses the current bindings and switches to holdout keys in the holdout. **Evidence notice**: `Game.evidenceNotice()` shows "Evidence n of N · Tab to review".
- **Mr. Hush animation drivers** (`MrHush.js`): `sniff(gain)` plays the sound and sets `pose.sniff`. Hearing a sound sets `alert`, which snaps the head (`look` rate 3 + 12·alert). `pose.stir` follows `sleepNoise / 1.4` while dormant. `_sync` derives `pose.turn` from the heading change.
- **Creep defaults to C, not Ctrl**, because browsers can't block Ctrl+W (close tab). `Settings.loadSettings()` migrates old saves from `ControlLeft` to `KeyC`. There's no Ctrl alias.
- **Leave guard:** `Game` constructor adds a `beforeunload` handler that asks before closing the tab during play, holdout or cutscene (disabled with `?dev`).
- **Scrollbars:** themed globally at the end of `ui.css` (thin, faint, red on hover). Don't add per-panel browser-default scrollbars.
- **Volume:** sliders default to 100%. `VOLUME_SCALE` maps 100% to the original mix.

## 9. Testing (no GPU in the cloud sandbox)
- Run the dev server, then Playwright Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --autoplay-policy=no-user-gesture-required`.
- Open `http://localhost:5173/?dev&manual`. `window.__game` is always exposed (`main.js`). `dev` skips the pointer-lock requirement and allows unlocked looking; `manual` disables the rAF loop. Use `?manual` alone to test the real pointer-lock and pause flows.
- Drive it from `page.evaluate`: `g.bootClick()`, `g.beginPlay('start'|'awake'|'batteries'|'holdout')`, `g.simulate(sec)`, `g.player.teleport(x,z,yaw,pitch)`, `g.sound({...})`, then `g.renderFrame()` (returns a PNG data URL) or call `g.render(1/30)` before `page.screenshot()` to capture the UI too.
- Logic tests are fastest without rendering: simulate with a bot policy and log `hushState` events.
- Note: `camera.matrixWorld` only updates on render. Teleport, then simulate, then render.

## 9b. Performance notes
- Freezes while playing were the sound-field Dijkstra (see SoundField). Profile CPU in the sandbox by timing `g.update(1/30)` per frame and wrapping subsystem methods. Rendering times under SwiftShader are meaningless.
- `Game.prewarmGPU()` uploads all textures and compiles shaders at load, so first views don't hitch. Call it again if a chapter adds textured meshes later.
- GPU load: shaded pixels are capped at 2.4M (`Game.resize`) times `QUALITY[quality] * perf.dyn`. The reveal shader loops only up to `uPulseCount`, so cost grows with the number of overlapping pulses (longer `linger` means more of them).
- **Adaptive resolution** (`Game.trackPerf`, setting `autoRes`, default on). It is called every real frame from the rAF loop (not in manual mode) and measures 0.5 s windows. Two windows slower than 21 ms drop `perf.dyn` by 0.1 (minimum 0.5, 2 s cooldown). About 20 s of smooth frames (< 17.8 ms) step it back up. Only active in play, holdout or cutscene. `applyScale()` applies quality × dyn. Bloom is skipped at Low quality or when dyn is at most 0.55. `Pipeline.fxaaOn` exists but stays on (Low without FXAA looked too jagged).
- **FPS counter**: setting `showFps` (default on). `UI.fps(text)` updates the `#fps` element (top-right corner, turns red under 45). It shows the adaptive scale when that is below 100%.

## 10. Known gaps / ideas
- No voice acting (tapes use subtitles and hiss). No microphone input. Chapter 2 (St. Agnes, flooded hospital) is not started.
- Real-GPU performance and the audio mix have not been verified by a human yet.
- **Desktop .exe (planned, not started):** the recommended route is Electron plus electron-builder loading `dist/index.html` (Vite `base: './'` already supports this). Disable menu accelerators there so Ctrl+W is safe, then build with `electron-builder --win` (nsis or portable). Tauri is the lighter alternative.
- `Game.js` is large. If it grows further, split it into `GameFlow` (menus and states) and `PlaySystems` (hiding, struggle, fear).
