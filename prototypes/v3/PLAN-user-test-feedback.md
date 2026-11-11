# User-test feedback (Randomize, Reset, Build it, Shelf numbers): Implementation Plan

**Overall Progress:** `92%`

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
- **Base is counted as pre-built in Playroom.** Shelf progress still uses the shared `Story3D` storage. UI math adds one completed step (base + post), so the build meter starts at 1/12 or 1/10 without changing shared storage shape.
- **Shelf numbers are a DOM overlay beside the bookcase, not 3D text.** Reuse the rail positioning math from `renderRail()` (it already projects shelf heights to screen y). On by default, toggled by a "Numbers" pill in the bottom-left view controls, and hidden in Top view, where the vertical positions don't line up.

## Resolved with Ashley
1. **Shelf numbers should show on both tabs.** Implemented for Style it and Build it (same stage overlay).
2. **Reset placement should be up top.** Implemented in the top header as `Reset to default`.
3. **Base should count as already built.** Implemented as progress starting from 1/12 (Tall) or 1/10 (Standard).

## Tasks

- [x] 🟩 **Step 0: Branch**
  - [x] 🟩 Branched off `main` as `cursor/user-test-feedback-plan-216c`

- [x] 🟩 **Step 1: Randomize rules clarity** (`renderPats`, `.al` / `.split` CSS, `ICON`)
  - [x] 🟩 Added a stroke `gear` icon to `ICON`, replaced the old rules icon, and added a visible "Rules" label
  - [x] 🟩 Renamed the popover to "Randomize rules" and added the "Tap X..." hint line
  - [x] 🟩 Direction tiles now use corner X (allowed) / + (removed), with dimmed off state and no strike-through
  - [x] 🟩 Kept the existing "keep at least one" and "only one left" notes

- [x] 🟩 **Step 2: Reset to default**
  - [x] 🟩 Pulled boot defaults into one `DEFAULTS` object used for both init and reset
  - [x] 🟩 Added `resetToDefault()` restoring state, wall, floor, randomize rules, selection, view, and clearing hash
  - [x] 🟩 Added top soft button with stroke reset icon; button disables when already at default

- [x] 🟩 **Step 3: Build it, step by step** (build pane, `renderBuild`, guide actions)
  - [x] 🟩 Added explanatory guide text clarifying what Build it is for
  - [x] 🟩 Replaced the full list with one current-step card and Back / "Done, next" controls
  - [x] 🟩 Enforced strict order via normalized sequential progress (no skipping ahead)
  - [x] 🟩 Stage highlight, rail, and toast now follow the guided current step
  - [x] 🟩 Kept Start over and Print sheet

- [x] 🟩 **Step 4: Progress counts the base**
  - [x] 🟩 Total now uses shelves + 1; meter, tab label (`#tabprog`), and badge start at 1/12 (Tall) or 1/10 (Standard)

- [x] 🟩 **Step 5: Shelf numbers on the stage**
  - [x] 🟩 Added `renderNumbers()` chips using the same y-projection math as the rail
  - [x] 🟩 Added a "Numbers" toggle pill in `.hud`, on by default, hidden in Top view
  - [x] 🟩 Number chips select shelves on the Style tab

- [ ] 🟨 **Step 6: Verify in browser**
  - [ ] 🟨 Randomize: remove Back with the X, roll 10 times, no Back shelves; gear + label visible without opening anything
  - [ ] 🟨 Reset: change all six settings, reset, everything back to default and the URL hash cleared
  - [ ] 🟨 Build: can't advance past the current step; Back works; starts at 1/12 (Tall) and 1/10 (Standard); confetti at 12/12
  - [ ] 🟨 Numbers line up with shelves in the 3/4, Front and Side views, on both sizes; toggle hides them

## Split (this plan is too big for one session)
Six tasks, and all of them edit the same file, so running every task as its own agent at once would cause merge conflicts. Suggested split:

| Phase | Workstream | Steps | Can run in parallel? |
|---|---|---|---|
| A | Randomize + Reset | 1, 2 | Yes, with B. Touches only the Style pane, `renderPats`, and boot code |
| B | Build it stepper + progress | 3, 4 | Yes, with A. Touches only the build pane, `renderBuild`, and the list handler |
| C | Shelf numbers | 5 | After A merges (both edit the `.hud` / stage area and `update()`) |

Each phase gets its own branch and PR, and ends with its part of Step 6.
