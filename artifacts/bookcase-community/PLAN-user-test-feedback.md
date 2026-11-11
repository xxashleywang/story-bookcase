# Port user-test fixes into the real app: Implementation Plan

**Overall Progress:** `90%`

## TLDR
Bring the five user-test fixes from the Playroom prototype (`prototypes/v3/g-playroom.html`, PR #8) into the real configurator (`artifacts/bookcase-community/src/App.tsx`). Include the review feedback on the prototype. The prototype is reference only and stays as it is.

1. Randomize rules: gear icon with a "Rules" label, and an X / + on each direction.
2. A "Reset to default" button near the top.
3. Build it becomes a one-step-at-a-time guide, in order, with tight copy.
4. Progress counts the base as already built, so it never shows 0%.
5. Shelf numbers live inside the circles of one rail to the right of the bookcase, with a toggle to hide them.

## Scope
**In scope:** `src/App.tsx` (the `Configurator` component), `src/index.css`, one new pure helper in `src/lib/` with a test in `tests/`.

**Out of scope:**
- Changing the prototype (`prototypes/v3/g-playroom.html`)
- Gallery, profile, publish and share flows
- New Randomize rules, undo history, saving rules across sessions
- Print sheet layout

**Do not touch:**
- `reference/story-v2.js` progress storage shape (`Story3D.getProgress` / `setProgress`)
- `reference/story-core.js` (`PRESETS`, `randomDirs`, `encodeUnit` / `decodeUnit`)
- URL hash format written by `hashFor()` (shared links must keep opening)
- `ShelfSelector`, `ShelfEditor`, keyboard shelf controls (`shelf-keyboard.ts`)

## Critical Decisions
- **One rail, on the right only.** Number each circle (1–11) inside the circle. No separate number column on the left. On Style it, the rail shows numbers, highlights the selected shelf, and clicking a circle selects that shelf. On Build it, the same rail shows progress.
- **Completed circles stay the same size as the others.** Only the colour changes. The prototype's oversized circle came from a class-name clash (the rail's `.pop` class picked up the Randomize popover's `.pop` styles). Use unique, prefixed class names (`build-rail-*`).
- **Rail positioning reuses the stage projection.** Same `fit: .66` / `floor: .86` the 3D mount already uses. Hide the rail in Top view, where shelf heights don't line up. The "Numbers" toggle sits in the existing `.views` group and is on by default.
- **Base counts as already built.** Steps = shelves + 1, and completed = built shelves + 1. Tall opens at 1/12 (8%), Standard at 1/10 (10%). The tab label, meter and stage stamp all use this.
- **Order is enforced.** The only actions are "Done, next" (completes the next shelf) and "Back" (un-does the last one). Saved progress with gaps is trimmed to its leading run on load.
- **No repeated copy on Build it.** The purpose is said once, in one line at the top of the pane: "Follow these steps as you assemble your bookcase." The step card says only the shelf and what to do: "Shelf 7", "Faces front · 47.5″ up". No subtitle that repeats "one shelf at a time". The meter caption only appears when finished.
- **Reset default = a fresh first visit:** Tall, `#E2B062`, the Pinwheel (`pairs`) preset, `#F6F4F0` wall, the first floor, Front view, all four directions allowed, no-neighbours off, nothing selected, build progress cleared. Reset also clears `twistory:last-scene` in localStorage; `hashFor()` then rewrites the hash with the defaults. No confirm dialog, and the button is disabled when nothing has changed.
- **Reset lives at the top of the stage, not in the site header.** `Header` is shared by every page (Gallery, profile), so a configurator-only button belongs to the `Configurator`. It goes top-right on the stage, on the Style it tab.
- **Build-step math goes in a pure helper** (`src/lib/build-steps.ts`), tested like `shelf-keyboard.ts`, so the 1/12 and in-order rules are covered by `pnpm test`.

## Tasks

- [x] 🟩 **Step 0: Branch**
  - [x] 🟩 Work completed on `cursor/user-test-feedback-plan-216c`

- [x] 🟩 **Step 1: Build-step helper + tests**
  - [x] 🟩 Added `src/lib/build-steps.ts` with normalization, step math, advance and rewind helpers
  - [x] 🟩 Added `tests/build-steps.test.mjs` covering 1/12 + 1/10 starts, gap trimming, no skipping, back, and 100% completion

- [x] 🟩 **Step 2: Randomize rules clarity**
  - [x] 🟩 Swapped the rules icon to lucide `Settings` and added a visible "Rules" label with badge
  - [x] 🟩 Updated popover heading/copy to "Randomize rules" + "Tap X to stop shelves facing that way."
  - [x] 🟩 Direction buttons now use corner X / + with On/Off labels while preserving `aria-pressed` and existing notes

- [x] 🟩 **Step 3: Reset to default**
  - [x] 🟩 Pulled defaults into shared `createDefaultScene()` logic used by `initialScene()` and reset
  - [x] 🟩 Implemented `resetToDefault()` for scene, rules, selection/editor, view, progress, and `LAST_SCENE_KEY` cleanup
  - [x] 🟩 Added top-right stage reset button with `RotateCcw`, disabled when already at defaults

- [x] 🟩 **Step 4: Right-side rail with numbered circles**
  - [x] 🟩 Added a right-side build rail in `App.tsx` with equal-size numbered circles and build/style states
  - [x] 🟩 Rail positioning now uses stage `ResizeObserver` geometry and hides in Top view
  - [x] 🟩 Added a "Numbers" toggle in `.views` that hides rail numbers while preserving build guidance
  - [x] 🟩 Style-tab rail circles are clickable and use the same shelf selection behavior as 3D shelf clicks

- [x] 🟩 **Step 5: Build it stepper + progress**
  - [x] 🟩 Replaced list toggling with a single-step card and Back / "Done, next" actions
  - [x] 🟩 Tightened copy so the assembly-purpose line appears once without duplicated phrasing
  - [x] 🟩 Meter, tab progress, and stage stamp now all read from `buildSteps()` (base counted from step 1)
  - [x] 🟩 Kept Start over, Print sheet, and Share actions in the Build tab

- [ ] 🟨 **Step 6: Verify**
  - [ ] 🟨 `pnpm run typecheck` is still blocked by existing workspace declaration/build issues (`TS6305` in `lib/api-client-react`) and unrelated pre-existing `account-ui.tsx` implicit-any errors; `pnpm test` passes including new build-step tests
  - [ ] 🟨 Browser click-through QA remains to run (rules toggles, reset persistence, 1/12 + 1/10 starts, rail alignment/toggle behavior)

## Session size
Seven tasks, all centred on `App.tsx`, so this is at the upper limit for one session. If you want to split it:

| Phase | Steps | Notes |
|---|---|---|
| A | 1, 5 | Build it stepper and progress (helper and tests first) |
| B | 2, 3 | Randomize rules and Reset; touches only the Style it pane and stage corner |
| C | 4 | Rail; after A, since the Build it rail reads `buildSteps()` |

A and B can run in parallel on separate branches. C goes last.
