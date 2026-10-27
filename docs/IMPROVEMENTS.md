# Sensitivity: Critique and Improvement List

A critical pass over Chapter 1. I went through the game in order (boot, menu, prologue, the house, documents, evidence, being hunted and grabbed, hiding, June's room, the holdout's monitor, door, window and Thimble, dawn, end and death), capturing 1280×720 frames at each step and checking suspicious spots with measurements. Each item says what's wrong, why it matters, and a suggested fix.

**Effort:** S = under an hour · M = a few hours · L = a day or more.
**Status:** tick items off (or delete them) as they're done.

---

## Top 10 (biggest gain for players)

| # | Issue | Area | Effort |
|---|---|---|---|
| 1 | Mr. Hush's head clips through every door top and the ceiling | Visual bug | S–M |
| 2 | The bottom of the screen is overcrowded: prompt, hints, breath bar and subtitles stack and overlap | Clarity | M |
| 3 | Deaths don't say *why* you died | Clarity / fairness | M |
| 4 | Nothing teaches that evidence lights up when a sound reaches it | Clarity | S |
| 5 | You can wake him in the first minute, before the game has taught stealth | Onboarding | S |
| 6 | One key (L) does two opposite things in the holdout | Clarity | S |
| 7 | The first window attack is very punishing for a first-timer | Difficulty | S |
| 8 | Dawn is an anticlimax: the room barely brightens | Payoff | M |
| 9 | The main menu's background is pure black | First impression | S |
| 10 | No difficulty setting | Accessibility | M |

---

## 1. Bugs and rough edges

1. **Mr. Hush clips through door tops and the ceiling.** Measured: his top is 2.72 m while walking (the ceiling is 2.70 m) and 2.43 m while squeezing through a doorway, but doorways are only 2.10 m tall. His head and shoulders pass through the wall above every door.
   *Fix:* when squeezing, bend him over: drop the hips, add knee and hip bend, and tip the torso forward until his top is ≤ 2.05 m. Lower his standing height slightly, or slump his posture, so the ears stay under the ceiling. (S–M)
2. **Long documents get cut off** at smaller window heights: the end of the police report (the red "taller than the door" stamp, the punchline) is clipped at 720p.
   *Fix:* scale the paper to fit the viewport height, or make it scroll with a visible "more below" cue. (S)
3. **Close-up knocks still bloom heavily.** Knocking on a surface right in front of you fills the frame with white glow, even after the new limiter.
   *Fix:* lower bloom strength a little (0.6 → ~0.48), or scale the knock's brightness by how close the surface is. (S)
4. **Opening text overlaps.** The "The House" chapter card and the first hint ("Every sound you make shows you the world.") sit on top of each other mid-screen.
   *Fix:* delay the first hint until the card has faded (≥ 6.2 s), or move hints to their own lane (see #2). (S)
5. **Duplicate holdout instructions.** At 3:00 the prompt "Space: Raise the baby monitor" sits right above a hint that says the same, and both overlap the fading "Until dawn" card.
   *Fix:* suppress the generic monitor prompt while the hint is showing; delay the hint until the card is gone. (S)

## 2. Clarity and "what am I supposed to do?"

6. **HUD lanes.** The bottom-centre area carries the interaction prompt, tutorial hints, the breath bar (whose own label repeats the hint "Hold your breath. This close, he can hear you breathing"), the struggle panel and subtitles. They collide constantly.
   *Fix:* give each a fixed lane:
   - prompt just under the crosshair;
   - tutorial hints at top-centre or bottom-left;
   - breath bar beside the noise meter;
   - subtitles at the bottom.

   Drop the duplicate breath text. (M)
7. **Deaths need a reason.** "He heard you." is flavour, not feedback. Examples of what it could say:
   - "He heard you running."
   - "You breathed while he checked the wardrobe."
   - "You were caught again within 45 seconds."
   - "The door gave way."
   - "Nobody sang to Thimble."

   *Fix:* record the cause when the grab or death happens and show it as a small line under the title. (M)
8. **Evidence discovery isn't taught.** Items stay dark until a sound reaches them, but nothing says so, so new players can walk past most of the 17 items.
   *Fix:* the first time an item lights up, add a one-time hint ("Something answers the sound: evidence") and a soft chime. Optionally make lore items give off a faint sound (paper rustle) when your pulse reaches them. (S)
9. **No direction toward objectives.** "Find June's room" in a pitch-black house gives no lead.
   *Fix:* light signposting:
   - June's name in wooden letters on her door, or her drawings taped along the hall;
   - Ellis whispering a hint if no progress is made for ~90 s ("Her room was at the end of the hall").

   The note on her door helps, once you're there. (S–M)
10. **L means two things in the holdout:** with the monitor up it lures him *away*; with it down it plays the music box that draws him *in*.
    *Fix:* give the music box its own key (e.g. M, rebindable), and show both on the pause controls list. (S)
11. **The door-fight bars are hard to read:** the danger gap bar is a 3 px line under the key.
    *Fix:* a thicker bar, or show the door's opening as an arc or meter around the key; flash red as it nears breaking. (S)
12. **Thimble's state is hard to judge when you're looking elsewhere.** The heartbeat thud is the only cue.
    *Fix:* keep the thud, but also let his red pulses reach the edge of your view (a faint red flicker at the screen edge on his side). Make the shadow catch the nightlight too, not only his own beats. (S–M)
13. **Hiding doesn't feel like hiding.** Inside the wardrobe the slats only frame part of the view.
    *Fix:* a slat mask over the whole view, muffled audio (a low-pass on the master bus while hidden), your own breathing louder, and a tighter vignette. (M)
14. **Waking him on the first minute.** A knock in the living room, or near his chair, can wake him before the player has picked up the key or learned to sneak, which is a likely early death and a frustrated first impression.
    *Fix:* before the key, raise his wake threshold. When he stirs (his head lifts), show a one-time hint ("Too loud. He's stirring."). (S)

## 3. Gameplay and pacing

15. **No difficulty setting.** Friends who aren't horror veterans will hit walls (the 5 AM door needs ~3 correct presses a second; the window gives 1.75 s).
    *Fix:* Story / Normal / Hard. These would scale his hearing radius, holdout timings (react time, door push, Thimble's rise), the re-catch window, and breath capacity. (M)
16. **Window difficulty spike.** A faint tap is the only warning and the first visit already gives just 2.5 s.
    *Fix:* make the *first* window visit each night slower (4 s), with a clearer tell (wet hand smear, a louder first tap, June's voice starting before he arrives). (S)
17. **A holdout death costs the whole night.** Dying at 5:50 restarts at 3:00 (about 4 minutes).
    *Fix:* add a 4:00 or 5:00 checkpoint on Story and Normal, or let the player keep the hour. (S)
18. **Only three hiding spots** (wardrobe, linen closet, under June's bed) for a whole house.
    *Fix:* add 2–4 more (Diane's closet, under the dining table, behind the sofa, the bathtub with the curtain). Give each its own risk (noisy to enter, short breath). (M)
19. **His behaviour gets predictable after a few deaths.**
    *Fix:* add variety:
    - "Fake calm": he keeps humming but walks toward the last noise.
    - "Listening stops": he freezes mid-room and listens for a few seconds.
    - "Doubling back" to the last disturbance after giving up.

    These keep tension without being unfair. (M)
20. **Knock is free light.** With a 0.85 s cooldown it's the go-to flashlight.
    *Fix:* this is fine as a core verb. To keep tension, make repeated knocks in the same spot more attention-grabbing ("he learns the knocking"), or let the house answer with a delayed knock-back that scares. (S–M)
21. **The struggle is the same every time** (mash A/D).
    *Fix:* vary it: alternate keys, a timing ring, or "look away" moments. Also vary the jumpscare (different growls, his head tilting, the jaw tearing wider). (M)
22. **Inventory is only two items.** Fine for Chapter 1. Consider small optional pickups (matches with one flare of light, a toy that squeaks as a decoy) to deepen choices. (M)

## 4. Visuals and atmosphere

23. **Empty main menu.** The menu is meant to be a live scene of Mr. Hush in his chair, but his chair is only revealed when you hover menu items, so most of the time the right side is black.
    *Fix:* every few seconds, a faint ripple from the clock or a drip, or his own slow breathing, briefly outlines him. Distant lightning flashes help too. (S)
24. **Dawn should be a release.** At 6:00 the room stays mostly dark outlines.
    *Fix:* a proper sunrise: ramp a soft grey-blue ambient to show the room fully shaded over ~10 s, light dust in the window, then let the birdsong (which exists) carry the moment. (M)
25. **Thimble needs more detail.** He reads as a small, simple doll. Add a painted face (blush, painted lashes, one cracked eye), a cap, hands with too many fingers, and occasional slow head turns toward you even at low agitation. (M)
26. **Mr. Hush's grab could show more gore**, matching the tone you chose (FNAF plus some gore): wet stuffing from the torn mouth, the needles closing in, a smear on the lens. (M)
27. **Breaking glass and bottles** could leave a lingering amber glint on the floor (it's already a loud floor zone), so players can see their own trap later. (S)
28. **UI text is tiny at high resolutions.** The mono labels are 10–10.5 px.
    *Fix:* a UI scale setting (90–150%), or scale with viewport height. (S)

## 5. Audio

29. **The mix hasn't been checked by human ears.** Everything is procedural and positioned with HRTF (good for headphones), but the relative loudness of footsteps, the humming, jumpscares and ambience needs a listening pass. Watch especially for very loud spikes. (M)
30. **Tapes have no voices.** Subtitles over hiss work, but a filtered, wordless "voice texture" (formant-shaped noise following the subtitle rhythm) would sell them without recording anyone. Real voice acting would be better still (already on the "later" list). (M)
31. **Evidence and story stingers.** A soft chime when an item lights up, a distinct sting when you collect a tape, a low swell when an objective changes. These help clarity too (#8). (S)
32. **Hiding needs its own soundscape:** muffled world, louder heartbeat and breath (see #13). (S)
33. **"Reduce sudden loud sounds" option.** A compressor or limiter on the jumpscare and death sting for players who need it, next to *Reduce flashing*. (S)
34. **Room tone.** Rooms sound alike. Give each a quiet bed:
    - the kitchen fridge's dead hum (the power is out, so maybe nothing, which is a choice);
    - the bathroom drip and pipe groans;
    - the foyer's rain on the door;
    - June's room music-box ticks. (M)

## 6. Performance

35. **Unverified on real GPUs.** Adaptive resolution and the FPS counter exist; test on a low-end laptop (integrated graphics) and a mid-range desktop and note the numbers here. (S to test)
36. **Integrated GPUs** will feel the 3 half-float render targets plus bloom.
    *Fix:* a "Very low" preset (half-resolution G-buffer, no bloom, max 12 pulses, simpler patterns). (M)
37. **The sound-field cache keeps 600 fields** (~17 MB).
    *Fix:* 200 would do; most hits are recent. (S)
38. **Small garbage per sound:** each field computation allocates arrays.
    *Fix:* pool them to avoid GC hitches on long sessions. (S)

## 7. Story and theme fit

39. **Ellis's gender is inconsistent.** The in-game texts call Ellis "he" (Diane's journal, Halloway's tapes), while the README and posts say "sibling". Pick one and use it everywhere (`docs/LORE.md` follows the game: he). (S)
40. **Halloway is only a voice.** Seed him visually: a Cradle business card, his name on the orientation tape label, a photo of him at the St. Agnes ribbon-cutting in the clipping. (S)
41. **The music-box lullaby question** is a great hook (Diane says she made the song up; the toys play it). Pay it off with a Chapter 1 hint, e.g. a music box with Diane's handwriting on the score. (S)
42. **The basement door** is a note on a wall. Make it a real locked door with sounds behind it (wet dragging, distant children) to set up Chapter 2. (S–M)

---

## What already works (keep it)

- **The core idea lands.** Sound-as-light reads clearly, and the red pulses for him and ice-white for you are instantly understood.
- **The grab view** (his stitched face filling the screen) and the **door fight** (his arm through the gap) are strong set pieces.
- **The baby monitor** is excellent: clean night-vision look, readable labels, and on-theme.
- **The opening** (warning card, prologue tape, the slam that reveals him in his chair) is a great first minute.
- **The documents** look and read well; the evidence screen's "not yet found · location" hints are just right.
- **Thimble's shadow, and "sing to him, but he'll hear"**, is a strong FNAF-style trade-off.
