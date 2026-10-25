# Fine-tune discoverability + Randomize pattern — Implementation Plan

**Overall Progress:** `65%`

## TLDR
Two changes to the Playroom configurator (`prototypes/v3/g-playroom.html`):

1. **Fine-tune is hard to find.** It sits at the bottom of the Style pane, so clicking a shelf changes nothing visible on the right. Clicking a shelf should scroll the pane to Fine-tune and highlight it. Arrow keys should also pick and rotate shelves, with the same highlight.
2. **Randomize.** Add a Randomize option next to the shelf pattern chips. It rolls a random pattern as a starting point, within rules the user sets first (for example "never face back").

The randomize UX is being chosen from 5 designs in `prototypes/v3/randomize-lab.html`.

## Scope
**In scope:**
- Shelf click → auto-scroll to Fine-tune + highlight pulse + persistent "active" ring while a shelf is selected
- Keyboard: arrow keys select and rotate shelves on the Style tab
- Randomize: a pure `randomDirs` helper + the chosen UI variant in Playroom
- Rules: allowed directions (at least one), optional "no two neighbours alike"; per-shelf locks only if variant D is chosen

**Out of scope:**
- Moving Fine-tune higher in the pane or redesigning the Style pane layout
- Saving rules across sessions, seeded or shareable rolls
- Port to other prototypes (a/b/c/d/e/f)
- Build tab behaviour

**Do not touch:**
- `PRESETS` order/ids in `story-core.js` (Get inspired looks reference them by id)
- URL hash encoding (`encodeUnit` / `decodeUnit`); a random roll is just another `dirs` string
- `story-v2.js` 3D renderer

## Critical Decisions
- **Randomize logic lives in `story-core.js` as a pure function** next to `PRESETS`, so it can be tested on its own and other prototypes could reuse it. The UI stays in `g-playroom.html`.
- **No tipping constraint needed.** Using the existing `balance()` model, the worst case (every shelf facing one way, each loaded to 7 lb) shifts the centre of mass about 2.8″ on Tall and 2.7″ on Standard. The base allows 7.9″. Any random roll is within limits, so this is not a rule the user has to think about.
- **At least one direction must stay allowed.** If only one is left, show a hint that every roll will be identical.
- **"No neighbours alike" only matters with 3+ directions.** With 2 allowed it collapses to a strict alternation (Front + Right becomes the existing Corner preset). The prototype shows this; the final UI may want to disable the switch in that case.
- **Every roll must differ from the current pattern.** The helper re-rolls up to 40 times to avoid repeats. Undo restores the pre-roll pattern.
- **Keyboard mapping (proposed, needs sign-off):** ↑ / ↓ move the selected shelf up/down (first press selects shelf 1). ← / → rotate the shelf through Front → Left → Back → Right using the existing `rotate()`. Keys are ignored while typing in an input, when the Get inspired drawer is open, or on the Build tab. Handled keys call `preventDefault` so the pane doesn't scroll.

## Open questions for Ashley
1. Which randomize variant (A–E) or which mix? See the lab.
2. Keep ←/→ as "rotate", or add letter keys (F/L/B/R) for absolute directions?
3. The screenshot you sent has a different header ("Plan it, paint the wall…", "Buy at Herman Miller", a $595 sticker) from `g-playroom.html` on disk ("Every shelf has a story", "Get inspired"). Which file is the live one?

## Tasks

- [x] 🟩 **Step 0: Branch**
  - [x] 🟩 Already on `feature/story-configurator-prototypes` (not main). Branch has no commits yet; everything under `prototypes/` is untracked.

- [x] 🟩 **Step 1: Randomize design lab**
  - [x] 🟩 `prototypes/v3/randomize-lab.html` with 5 switchable variants: A Quick dice, B Rules card, C Compass, D Lock & roll, E Say it
  - [x] 🟩 Shared rules engine: allowed directions, no-repeat, locks, undo/history

- [x] 🟩 **Step 2: Pick the variant** (Ashley): **A · Quick dice**. Icons only, no emoji (project rule `.cursor/rules/icons-not-emoji.mdc`).

- [ ] 🟥 **Step 3: Fine-tune auto-scroll + highlight**
  - [ ] 🟥 In `Story3D.mount(... onSelect)`: after `update()`, `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the Fine-tune block
  - [ ] 🟥 Add a one-shot `.flash` pulse (accent ring, about 1.2s) and a persistent `.active` outline while `sel >= 0`
  - [ ] 🟥 Update the hint: "or click a shelf" → "click a shelf or use ↑ ↓ ← →"

- [ ] 🟥 **Step 4: Keyboard control**
  - [ ] 🟥 Extend the existing `keydown` listener with the mapping above, plus the guards
  - [ ] 🟥 Reuse the same scroll + flash as Step 3

- [x] 🟩 **Step 5: Randomize logic**
  - [x] 🟩 Added `randomDirs(n, { allowed, noRepeat, current })` to `story-core.js` and exported it (no `locks`; only variant D needed them)
  - [x] 🟩 `patternName()` returns "Random roll" when the pattern matches no preset after a roll

- [x] 🟩 **Step 6: Randomize UI in Playroom**
  - [x] 🟩 Ported variant A (Randomize chip + rules popover with badge) into the Shelf pattern block, using SVG icons
  - [x] 🟩 Wired to `state.dirs` → `update()`. Variant A has no Undo button, so none was added.

- [ ] 🟥 **Step 7: Verify in browser**
  - [ ] 🟥 Click a shelf in 3D: pane scrolls, Fine-tune flashes
  - [ ] 🟥 Arrow keys select and rotate; no page scroll; ignored while typing in the color picker or with the drawer open
  - [x] 🟩 Block Back + no-neighbours, roll 20×: no Back shelves, no matching neighbours, 20 unique rolls, URL hash updates
