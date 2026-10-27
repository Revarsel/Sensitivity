# Sensitivity

*Everything is listening.*

A first-person stealth horror game, played in the dark. You can't see. Every sound you make sends out a ripple that briefly outlines the world around you, and something in the house hunts by sound.

**Chapter One: The House** is playable: exploration, stealth, lore, and a survive-until-dawn holdout in the style of Five Nights at Freddy's.

## Running it

```bash
npm install
npm run dev        # open the printed localhost URL
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Use a desktop browser with WebGL2 (Chrome, Edge, Firefox or Safari 16+). Headphones are strongly recommended, because the audio is positional and much of the game is heard rather than seen.

## Controls

| Key | Action |
|---|---|
| W A S D | Move |
| Shift | Run (loud, drains stamina) |
| C | Creep (quiet). Hold, or set it to toggle in Settings. Not Ctrl: Ctrl+W would close the tab |
| Mouse | Look |
| Q | Knock: make a sound on purpose to see |
| E | Interact. On doors: **tap** to open fast and loud, **hold** to open slowly and quietly |
| Left mouse | Throw a held bottle or block. Hold to throw harder |
| Space | Hold your breath. When he's close he can hear you breathing |
| Tab | Evidence (documents and tapes you've found) |
| A / D, mashed | Break free when grabbed |
| Esc | Pause, and Esc again to resume. Enter retries after a death |

All keys can be rebound in **Settings → Controls**.

**Holdout (3:00 AM to 6:00 AM):** Space raises the baby monitor. 1, 2 and 3 switch rooms. L plays a lullaby through that room's speaker to lure him there. Look at the door or window and **hold the mouse button** to hold it shut.

## The story so far

Fifteen years ago, six-year-old June Marsh vanished from her bedroom, along with her *Hushaby*, a plush bedtime companion made by Cradle & Co., "the toy that's sensitive to your child." Her older sibling Ellis has come home after a cassette arrived in the mail with June's voice on it. Mr. Hush, her bear, is waiting in Mom's armchair. He is much bigger now.

The full design for Chapter 1 is in [`docs/CHAPTER_1_PLAN.md`](docs/CHAPTER_1_PLAN.md).

## How it works

- **Sound is sight.** Every sound becomes a pulse. A 16-neighbour Dijkstra flood over a 25 cm grid of the house gives each pulse a *geodesic* distance field, so ripples flow through doorways and around corners instead of through walls. The fields are packed into a half-float texture that every surface shader samples.
- **Rendering.** A multi-render-target G-buffer (colour, normal and depth, reveal colour) feeds a screen-space edge pass that draws the glowing outlines. Then come FXAA, bloom, and a final grade with grain, chromatic aberration, a fear vignette that pulses with your heartbeat, and a night-vision mode for the baby monitor.
- **Everything is procedural.** The house, furniture, Mr. Hush, textures (drawings, blood, writing) and **all audio** (footsteps per surface, creaks, doors, the hummed lullaby, rain, thunder, heartbeat, the music box) are generated in code. There are no asset files besides fonts.
- **Mr. Hush** is blind. He hears through the same sound grid (closed doors muffle). He wanders, investigates, hunts, searches, and checks hiding spots, weighted by which ones you've used before and whether he heard you get in. He investigates disturbances you leave behind, like thrown objects, broken glass and open doors.

## Project layout

```
src/
  core/       Game loop and states, input, collision, settings and saves
  render/     Sound field, pulses, reveal materials, post-processing pipeline
  world/      House layout, props, doors, materials, canvas textures
  entities/   Player controller, Mr. Hush (model, animation, AI)
  ai/         A* navigation grid
  audio/      Offline DSP, the synthesised sound bank, the audio engine
  game/       Chapter 1 script, interactions, throwables, holdout, lore
  ui/         All menus, HUD, documents, tape player, baby monitor overlay
  styles/     CSS
docs/         Design documents
```
