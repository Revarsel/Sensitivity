# Sensitivity — Chapter 1: The House

> *"Everything is listening."*

## 1. Overview

| | |
|---|---|
| **Genre** | First-person stealth horror |
| **Core idea** | You are blind in the dark. Every sound you make sends out a ripple that briefly reveals the world. A creature hunts by sound. |
| **Chapter length** | 25–40 minutes |
| **Chapter structure** | Exploration and stealth, then a holdout until dawn |
| **Main threat** | Mr. Hush |
| **Chapter theme** | *The House Remembers*: what you disturb stays disturbed, and Mr. Hush notices. |

## 2. Story setup

**October 2011.** Fifteen years ago, six-year-old **June Marsh** disappeared from her bedroom. So did her
Hushaby, a plush bedtime companion made by **Cradle & Co.**, sold as *"the toy that's sensitive to your child."*

Her older sibling **Ellis** is now an adult. Their mother **Diane** lived alone in the house until she died last
winter. The house has stood empty since.

One night a cassette arrives with no return address. On it is June's voice:
*"Ellis? It's too loud in here. Come find me. Come home."*

Ellis goes back to the house. Mr. Hush is sitting in Mom's armchair, facing a television full of static. He is
far larger than any toy should be.

### What the player learns in Chapter 1
- Hushabies listened, recorded, and **grew**. The marketing called it an "adaptive comfort frame".
- Diane spent fifteen years trying to make the house quiet: carpets, stuffing in the walls, and worse.
- Dr. Halloway, a Cradle & Co. engineer, secretly tried to warn Diane. He says it *"was never about June."*
- Teaser: a "Quiet Night" pilot programme at **St. Agnes Children's Hospital** (Chapter 2).

## 3. The house layout

Single storey. 17 m × 14 m. Ceilings 2.7 m. Coordinates: X runs east, Z runs south.

```
 z=0  +--------------+----------+-------------------+
      |  DIANE'S     | BATHROOM |   JUNE'S ROOM     |
      |  BEDROOM     |  (tile)  |   (carpet)        |#  window (holdout)
      |  (carpet)    |          |                   |
 z=5  +-----D--------+----D-----+---D---------------+
      | CLOCK        H A L L W A Y  (creaky wood)   [linen closet]
 z=7  +----D---------+---arch---+-------D-----------+
      |  LIVING      |  FOYER   |  KITCHEN /        |
      |  ROOM        |  (wood)  |  DINING  (tile)   D basement (locked)
      |  (carpet)   arch       arch                 |
      |  TV, armchair|          |                   D back door
 z=14 +--------------+---FRONT--+-------------------+
      x=0          x=6.5      x=10                x=17
```

### Rooms and what they're for

| Room | Floor | Noise | Purpose | Key props |
|---|---|---|---|---|
| **Foyer** | Wood | Medium | Start. Front door slams and locks behind you. | Mail pile, coat rack, side table |
| **Living room** | Carpet | Quiet | First sight of Mr. Hush, asleep in the armchair. | CRT TV (static), armchair, sofa, fireplace, bookshelf |
| **Hallway** | Wood, creaky boards | Loud | The spine of the house. Hardest to cross. | Grandfather clock (ticks = landmark), runner rug, linen closet (hiding spot) |
| **Kitchen / dining** | Tile | Loud | Batteries are here. Bottles to throw. | Dripping faucet (landmark), humming fridge, dining table, basement door |
| **Diane's bedroom** | Carpet | Quiet | June's room key is here. | Bed (hide under it), wardrobe (hiding spot), nightstand, dresser |
| **Bathroom** | Tile | Loud | Gore and lore. Diane's breakdown. | Stained tub full of stuffing, mirror, cabinet |
| **June's room** | Carpet | Quiet | Goal and holdout arena. | Small bed, toy chest, rocking chair, drawings, baby monitor receiver |

## 4. Core mechanics (introduced in Chapter 1)

### 4.1 Sound is sight
- The world is black. Every sound emits a **ripple** that travels through the house, around corners and through doorways, and briefly outlines whatever it touches.
- **Player ripples** are cold white. **Mr. Hush's ripples** are deep red. **World sounds** (clock, faucet, TV) are dim amber.
- Lightning occasionally lights the whole house for a moment.

### 4.2 Movement noise
| Action | Ripple size | Speed | Notes |
|---|---|---|---|
| Crouch-walk | Tiny | Slow | Nearly silent, nearly blind |
| Walk | Small | Normal | |
| Sprint | Large | Fast | Drains stamina. Heavy breathing when tired is also noise. |
| Knock (Q) | Medium | — | A deliberate "look around" sound |
| Standing still | None | — | Silent and blind |

Surfaces scale noise: **carpet** is quiet, **wood** is normal, **tile** is loud, **broken glass** is very loud.

### 4.3 Hazards that make noise
- **Creaky boards** in the hallway creak *a beat after* you step on them. Crouch to soften them.
- **Squeaky toys** on the floor squeak loudly if stepped on unless crouching.
- **Doors**: hold the interact key to open slowly and quietly, or tap it to swing the door open loudly.

### 4.4 Throwables
- Bottles and toy blocks can be picked up and thrown.
- A thrown object makes a ripple **where it lands**: a light and a decoy in one.
- Glass bottles shatter (very loud) and leave **shards that stay on the floor**, so that spot becomes loud to walk on.

### 4.5 Memory (The House Remembers)
- Thrown objects, broken glass and doors you opened **stay that way**.
- Mr. Hush investigates recent disturbances while he wanders.
- Mr. Hush remembers which **hiding spots** you use and checks those first.

### 4.6 Fear and heartbeat
- Fear rises when Mr. Hush is near. Your heartbeat becomes audible to you, and at high fear **to him** if he's close.
- Standing still and staying hidden lowers fear.
- **Hold breath** (while hiding) silences you, but only for a few seconds.

### 4.7 Hiding spots
- Diane's wardrobe, under Diane's bed, and the hallway linen closet.
- Entering a hiding spot while he's close makes noise. If he heard it, he'll check.

### 4.8 Getting caught: a chase you can escape
1. **Hunt:** his humming stops, chase music starts, he moves fast toward the last sound he heard.
2. **Break the trail:** go quiet, reach carpet, throw a decoy, or hide. He searches the last place he heard you, then checks hiding spots.
3. **Grabbed:** a struggle (mash the keys) lets you break free **once**. He staggers and you run.
4. **Grabbed again:** death. Restart from the last checkpoint.

## 5. Mr. Hush

| | |
|---|---|
| **Look** | A 2.3 m sagging plush bear. Button eyes sewn shut with black thread. A sewn-shut mouth that tears open. A split belly seam leaking stuffing and something wet. Arms too long. |
| **Senses** | Blind. Hears everything. Feels you if you bump into him. |
| **Audio tell** | He **hums a lullaby** while wandering. **When the humming stops, he heard you.** |
| **States** | Dormant → Wander → Investigate (head tilts, listening) → Hunt → Search → Check hiding spots |
| **Speeds** | Wander 1.1 m/s · Investigate 1.7 m/s · Hunt 3.4 m/s (player sprint is 4.3 m/s) |

## 6. Chapter flow

| # | Beat | Objective | Teaches |
|---|---|---|---|
| 0 | **Prologue**: text on black, then June's tape | — | Tone |
| 1 | Enter the foyer. Door slams and locks. | *Find June's room* | Ripples, footsteps, knocking |
| 2 | Living room: Mr. Hush asleep in the armchair, lit by TV static | — | Dread. TV is a noise source |
| 3 | June's door is locked. Diane's note is taped to it. | *Find the key to June's room* | Lore |
| 4 | Diane's room: key in the nightstand. **Picking it up wakes him.** Lightning shows the empty armchair. Humming begins. | *Get to June's room* | Checkpoint. Stealth starts |
| 5 | June's room: the baby monitor receiver has no batteries. | *Find batteries in the kitchen* | Crossing the house while hunted |
| 6 | Kitchen: batteries in the drawer. Bottles to throw. | *Return to June's room* | Checkpoint. Distractions |
| 7 | Switch on the monitor. June's voice: *"He's coming up the hall."* Door slams. Clock strikes three. | **Holdout begins** | — |

## 7. Holdout: "June's Bedroom", 3:00 AM to 6:00 AM

The player sits on the floor of June's room. They can look around but can't walk.

| Tool | What it does | Catch |
|---|---|---|
| **Baby monitor** (Space, keys 1–3) | Night-vision feeds of the **Hallway**, **Living room** and **Kitchen** | Drains battery while raised. You can't watch the door or window. |
| **Talk-back lullaby** (L on the monitor) | Plays a lullaby through that room's monitor and lures him there | Large battery cost. Doesn't work if he's already at a threshold. |
| **Bedroom door** (look + hold mouse) | Hold it shut when he's outside | You can't use the monitor while holding |
| **Window shutters** (look + hold mouse) | Hold them shut when he's outside the window | Same |

- Mr. Hush moves between rooms on a node graph and gets more aggressive each hour.
- He reaches the **window** by leaving through the kitchen back door (visible on the kitchen feed), then is unseen in the yard.
- **Cues:** humming direction, heavy breathing and scratching at the door, tapping and *June's voice* at the window.
- If he gets in: the struggle. Escape once by scrambling under the bed. The second time, restart the holdout.
- **Dawn (6:00):** the clock chimes six, grey light fills the room, and for the first time the player sees June's room clearly. Halloway's last tape is hidden in the monitor's battery compartment.

## 8. Lore (Chapter 1)

| ID | Item | Location |
|---|---|---|
| T0 | June's tape | Prologue |
| T1 | Cradle & Co. "Parent Orientation" (Dr. Halloway, cheerful) | Living room, by the TV |
| T2 | "For Diane" (Halloway, private, frightened) | Bathroom |
| T3 | "For Ellis" (Halloway) | Holdout reward, in the monitor |
| D1 | Hushaby welcome card | Living room coffee table |
| D2 | Missing persons report, June Marsh, 1996 | Foyer side table |
| D3 | Cradle & Co. voluntary return notice | Foyer mail pile |
| D4–D6 | Diane's journal (3 entries) | Kitchen table, bathroom, Diane's bed |
| D7 | June's drawing: "MR HUSH IS BIGGER NOW" | June's room |
| D8 | June's drawing: "he listens to ellis" | Kitchen fridge |
| D9 | Clipping: St. Agnes "Quiet Night" pilot | Diane's dresser |
| D10 | Note on the basement door | Kitchen |
| D11 | Note on June's door | Hallway |
| TV | Hushaby TV commercial (1995) | Living room TV |

## 9. Presentation

- **Visual style:** black world revealed by glowing outlines. A screen-space edge pass over a sound-reveal shader, plus bloom, film grain and chromatic aberration that intensifies with fear.
- **Palette:** void `#050608`, bone `#d8d1c2`, ice ripple `#cfe1ff`, oxblood `#8e1b16`, danger red `#ff2a1f`, amber `#ffb35c`.
- **Typography:** *IM Fell English* (titles, story text), *IBM Plex Mono* (HUD labels, time), *Special Elite* (typed documents), *Reenie Beanie* (June's handwriting), *Homemade Apple* (Diane's handwriting), *VT323* (baby monitor display).
- **UI rule:** no emoji, no glass panels, no rounded "app" buttons. Typographic menus, hairline rules, paper documents, a cassette player.
- **Audio:** fully procedural Web Audio. Positional humming, footsteps per surface, heartbeat, rain, thunder, clock, faucet, music-box lullaby, chase stingers. Headphones recommended.

## 10. Build order

1. Rendering: sound-field reveal shader, edges, bloom, post-processing
2. The house: geometry, props, colliders, sound grid
3. Player: movement, footsteps, crouch and sprint, interaction
4. Audio engine: procedural sounds and positional audio
5. UI: boot and warning screen, main menu, settings, pause, HUD, documents, tape player
6. Mr. Hush: model, animation, navigation, hearing, AI states, grab and struggle
7. Chapter script: objectives, triggers, lore, checkpoints and saving
8. Holdout: monitor feeds, door and window, node AI, hours, dawn, chapter end
9. Polish pass: screenshot review, tuning, performance

## 11. Later (not in the first build)
- Microphone input (opt-in)
- Hidden "Hushaby Bedtime Adventure" pixel minigame cartridge
- Recorded voice acting for the tapes
