# CLAUDE.md: read this first

## Do NOT read the whole codebase

The codebase is about 10,300 lines of JS plus CSS. Reading all of it wastes the owner's credits.

1. Start with **`docs/ARCHITECTURE.md`**. It maps every file, system, key function and convention.
2. Use it to find the **one or two files** a task touches. Open only those, and only the relevant parts (use Grep or line ranges).
3. Read more widely only when it is truly required (for example, a bug whose cause can't be located from the docs).
4. **Keep `docs/ARCHITECTURE.md` up to date** when you add or move systems, files or conventions, so the next session can rely on it.

Other docs:
- `docs/CHAPTER_1_PLAN.md`: game design (story, house layout, mechanics, holdout, lore list).
- `docs/LORE.md`: the whole story, Chapter 1 (canon) to the planned finale. **Update it whenever lore is added or changed.**
- `docs/TECHNICAL.md`: plain-language guide to how the game works (graphics, sound, AI, collisions, stages, testing). **Living document: update it in the same change whenever a mechanic, system or tuned number it describes changes.**
- `docs/IMPROVEMENTS.md`: prioritised critique / backlog (top 10 first). Tick or remove items as they're done.
- `README.md`: player-facing overview, controls, how to run.

## Project in one paragraph

*Sensitivity* is a browser-based first-person stealth horror game (Three.js plus Vite, plain JS ES modules, no framework). The world is dark and revealed only by sound "pulses". Mr. Hush, a giant blind plush bear, hunts by sound. Chapter 1 ("The House") is complete: exploration, lore, checkpoints, and a FNAF-style holdout until dawn. Everything (geometry, textures, audio) is procedural. The only assets are npm fonts.

## Commands

```bash
npm install
npm run dev      # Vite dev server on :5173
npm run build    # must pass before committing
```

## Must-follow conventions (details in docs/ARCHITECTURE.md)

- Any noise goes through `game.sound({...})`. It makes the visual pulse **and** is what Mr. Hush hears. Set `source` correctly (`player`, `object`, `hush`, `world`).
- World meshes must use `revealMaterial()` (custom MRT shader), never standard Three.js materials, or they won't render.
- UI: no emoji, no glass or blur panels, no rounded app buttons. Use the CSS tokens and fonts in `src/styles/main.css`. Keep the dark analog-horror look.
- Input: never check raw key codes for gameplay. Use `input.act/actHit/actUp('action')`. New rebindable keys go in `ACTIONS` in `src/core/Keybinds.js`. Avoid Ctrl as a default (Ctrl+W closes the browser tab).
- Commit messages must not contain model names.

## Git workflow

Develop on the branch the session gives you and push only to that branch. **Never push to `main` unless the owner explicitly says so for that change** (then `git push origin <branch>:main`). `npm run build` must pass first.

## Testing without a GPU (cloud sandbox)

Headless Chromium renders at about 1 fps, so use **manual mode**: `?dev&manual`. Then, in the page, call `__game.simulate(seconds)` to advance logic and `__game.renderFrame()` to get a PNG data URL. See "Testing" in `docs/ARCHITECTURE.md`. Launch Playwright with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
