# User-test feedback (Randomize, Reset, Build it, Shelf numbers): Implementation Plan

**Overall Progress:** `0%`

## TLDR
Fixes for five problems found in the Playroom user test (`prototypes/v3/g-playroom.html`):

1. **Randomize rules were hard to find and confusing.** Swap the sliders icon for a gear, and redesign the "Shelves can face" grid so each direction shows an X you tap to remove it from the roll.
2. **There's no way back to the default design.** Add a "Reset to default" button.
3. **Build it was unclear, and shelves could be ticked off out of order.** Turn it into a one-step-at-a-time guide: an intro explaining what it's for, then a single card per step, in order.
4. **Progress started at 0%.** Count the base as step 1, so Tall goes 1/12 → 12/12 and Standard goes 1/10 → 10/10.
5. **Users had to count shelves from the bottom.** Show shelf numbers (1–11) next to the bookcase on the stage, with a toggle to hide them.

## Scope
**In scope:** the five items above, in `g-playroom.html` only.

**Out of scope:**
- Porting any of this to other prototypes (a–f, randomize-lab)
- Fine-tune auto-scroll and keyboard control (still open in `PLAN-finetune-and-randomize.md`, Steps 3–4)
- New Randomize rules beyond directions and "No two neighbours alike"
- Undo history, saved designs, accounts
- Print sheet layout

**Do not touch:**
- `Story3D.getProgress` / `setProgress` storage shape in `story-v2.js` (8 other prototypes read it)
- `PRESETS` ids/order and `randomDirs` in `story-core.js`
- URL hash encoding (`encodeUnit` / `decodeUnit`)

## Critical Decisions
- **Gear stays a separate button next to Randomize, with a text label.** The user missed the icon-only button, so a gear alone may not be enough: show the gear plus a short "Rules" label. The badge that counts active rules stays.
- **Direction tiles use an X / + corner button.** Allowed direction: plan glyph + label + small X in the corner. Removed direction: dimmed, X becomes a +, label reads "Off". This replaces the current diagonal strike-through. Popover title changes from "Shelves can face" to "Randomize rules", with a one-line hint: "Tap X to stop shelves facing that way."
- **"Default" means the first-load design:** Tall, Natural (`#E2B062`), the preset at `PRESETS[1]`, White wall, Pale oak floor, all four directions allowed, no-neighbours off, nothing selected, 3/4 camera view. Reset also clears the URL hash. No confirm dialog; the reset is quick to redo, and the button is only enabled when something has changed from the default.
- **Build it becomes a stepper; order is enforced.** You can only complete the current step. "Back" un-does the previous step. Ticking shelf 3 before shelves 1–2 is no longer possible.
- **Progress shows the current step, not completed steps.** Step 1 is "Base + post", so the bar opens at 1/12 (8%) on Tall, not 0%. The final step completing triggers the existing confetti and finale.
- **Base is tracked in Playroom only.** Shelf progress stays in the shared `Story3D` storage. A separate playroom-only `baseDone` flag, keyed on the same design code, records the base step. This keeps the other prototypes working.
- **Shelf numbers are a DOM overlay beside the bookcase, not 3D text.** Reuse the rail positioning math from `renderRail()` (it already projects shelf heights to screen y). On by default, toggled by a "Numbers" pill in the bottom-left view controls, and hidden in Top view, where the vertical positions don't line up.

## Open questions for Ashley
1. **"dialet page":** I read this as the bookcase view on the Style it tab. Should numbers also show on the Build it tab? (The build rail already labels the current shelf there.)
2. **Reset placement:** in the header next to Get inspired, or at the top of the Style it pane? The plan assumes the Style it pane, since that's where the changes are made.
3. **Progress at the start:** the plan treats 1/12 as "you're on step 1 of 12". If you meant the base should count as already done, so the user's first action is shelf 1, say so; it's a one-line change.

## Tasks

- [ ] 🟥 **Step 0: Branch**
  - [ ] 🟥 Branch off `main` per workstream (see Split below)

- [ ] 🟥 **Step 1: Randomize rules clarity** (`renderPats`, `.al` / `.split` CSS, `ICON`)
  - [ ] 🟥 Add a stroke `gear` icon to `ICON`; replace `sliders` on the rules button; add a "Rules" text label
  - [ ] 🟥 Rename the popover to "Randomize rules" and add the hint line
  - [ ] 🟥 Direction tiles: corner X (allowed) / + (removed), dimmed off state, remove the strike-through `::after`
  - [ ] 🟥 Keep the existing "keep at least one" and "only one left" notes

- [ ] 🟥 **Step 2: Reset to default**
  - [ ] 🟥 Pull the boot defaults (lines 316–321) into one `DEFAULTS` object, used both on load and on reset
  - [ ] 🟥 `resetDesign()`: restore state, wall (via `paintWall`), floor (via `setFloor`), randomize rules, `sel = -1`, camera to 3/4, clear the hash
  - [ ] 🟥 Soft button with a stroke "rotate back" icon; disabled while the design already matches the default

- [ ] 🟥 **Step 3: Build it, step by step** (build pane, `renderBuild`, `$('list').onclick`)
  - [ ] 🟥 Intro card at the top: what this tab is for ("Follow along as you assemble your real bookcase, one step at a time, in the order of your design") and a "Start building" button
  - [ ] 🟥 Replace the 11-row list with one step card: big step number, plan glyph, "Shelf 3 faces left · 12.4″ up", with Back / "Done, next" buttons
  - [ ] 🟥 Step 1 card is "Base + post"; add the playroom-only `baseDone` flag
  - [ ] 🟥 Stage highlight, the rail, and toast follow the current step (already driven by `next`)
  - [ ] 🟥 Keep Start over and Print sheet

- [ ] 🟥 **Step 4: Progress counts the base**
  - [ ] 🟥 Total = shelves + 1; meter, tab label (`#tabprog`) and stage badge show current step / total (1/12 at the start)

- [ ] 🟥 **Step 5: Shelf numbers on the stage**
  - [ ] 🟥 `renderNumbers()`: number chips at each shelf height, using the `renderRail` y-projection, refreshed on resize and on size change
  - [ ] 🟥 "Numbers" toggle pill in the `.hud` view controls; on by default; hidden in Top view
  - [ ] 🟥 Clicking a number selects that shelf (same as clicking it in 3D)

- [ ] 🟥 **Step 6: Verify in browser**
  - [ ] 🟥 Randomize: remove Back with the X, roll 10 times, no Back shelves; gear + label visible without opening anything
  - [ ] 🟥 Reset: change all six settings, reset, everything back to default and the URL hash cleared
  - [ ] 🟥 Build: can't advance past the current step; Back works; starts at 1/12 (Tall) and 1/10 (Standard); confetti at 12/12
  - [ ] 🟥 Numbers line up with shelves in the 3/4, Front and Side views, on both sizes; toggle hides them

## Split (this plan is too big for one session)
Six tasks, and all of them edit the same file, so running every task as its own agent at once would cause merge conflicts. Suggested split:

| Phase | Workstream | Steps | Can run in parallel? |
|---|---|---|---|
| A | Randomize + Reset | 1, 2 | Yes, with B. Touches only the Style pane, `renderPats`, and boot code |
| B | Build it stepper + progress | 3, 4 | Yes, with A. Touches only the build pane, `renderBuild`, and the list handler |
| C | Shelf numbers | 5 | After A merges (both edit the `.hud` / stage area and `update()`) |

Each phase gets its own branch and PR, and ends with its part of Step 6.
