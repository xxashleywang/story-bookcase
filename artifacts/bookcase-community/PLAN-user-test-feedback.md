# Port user-test fixes into the real app: Implementation Plan

**Overall Progress:** `0%`

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

- [ ] 🟥 **Step 0: Branch**
  - [ ] 🟥 Branch off `main` (e.g. `cursor/port-user-test-fixes-216c`)

- [ ] 🟥 **Step 1: Build-step helper + tests**
  - [ ] 🟥 `src/lib/build-steps.ts`: `normalizeProgress(prog)` (leading run only), `buildSteps(prog)` returning `{ done, total, pct, next }` with the base counted, `advance(prog)`, `stepBack(prog)`
  - [ ] 🟥 `tests/build-steps.test.mjs`: Tall starts at 1/12, Standard 1/10, gaps trimmed, can't skip, back un-does the last shelf, 100% when all shelves are done

- [ ] 🟥 **Step 2: Randomize rules clarity**
  - [ ] 🟥 Swap `SlidersHorizontal` for lucide `Settings` and add a visible "Rules" label; keep the count badge
  - [ ] 🟥 Popover: title "Randomize rules", hint "Tap X to stop shelves facing that way."
  - [ ] 🟥 Direction buttons: corner X (allowed) / + (removed), "On" / "Off" sub-label, keep `aria-pressed` and the existing notes

- [ ] 🟥 **Step 3: Reset to default**
  - [ ] 🟥 Pull the fresh-visit values out of `initialScene()` into one `DEFAULT_SCENE` used both there and by reset
  - [ ] 🟥 `resetToDefault()`: scene, randomize rules, `rolled`, selection, editor closed, view to Front (`animateTo`), progress cleared, remove `LAST_SCENE_KEY`
  - [ ] 🟥 Button top-right on the stage (Style it tab), lucide `RotateCcw`, disabled when already default

- [ ] 🟥 **Step 4: Right-side rail with numbered circles**
  - [ ] 🟥 `BuildRail` in `App.tsx`: track, fill, one circle per shelf with its number inside, all the same size; states: plain, selected (Style it), done / next with "Shelf N faces …" label (Build it)
  - [ ] 🟥 Position from the stage size with a `ResizeObserver`; hidden in Top view
  - [ ] 🟥 "Numbers" toggle in `.views`; when off, Style it hides the rail and Build it shows plain circles
  - [ ] 🟥 Clicking a circle on Style it calls the same select path as clicking the 3D shelf

- [ ] 🟥 **Step 5: Build it stepper + progress**
  - [ ] 🟥 Replace the "Bottom to top" list and `toggleShelf` with one step card: plan glyph, "Shelf N", "Faces X · H″ up" (with a proper separator), Back / "Done, next"
  - [ ] 🟥 Purpose line once at the top of the pane; no duplicate subtitle
  - [ ] 🟥 Meter, tab `<small>`, and stage stamp read from `buildSteps()`; completion card when all shelves are done
  - [ ] 🟥 Keep Start over, Print sheet and Share your bookcase

- [ ] 🟥 **Step 6: Verify**
  - [ ] 🟥 `pnpm run typecheck` and `pnpm test` in `artifacts/bookcase-community`
  - [ ] 🟥 In the browser (`mise run serve`): rules X / + works and rolls respect it; Reset restores everything and survives a reload; Build it can't skip, Back works, starts at 1/12 and 1/10; rail numbers line up in Front / Angled / Side on both sizes, done circles stay the same size, toggle hides numbers

## Session size
Seven tasks, all centred on `App.tsx`, so this is at the upper limit for one session. If you want to split it:

| Phase | Steps | Notes |
|---|---|---|
| A | 1, 5 | Build it stepper and progress (helper and tests first) |
| B | 2, 3 | Randomize rules and Reset; touches only the Style it pane and stage corner |
| C | 4 | Rail; after A, since the Build it rail reads `buildSteps()` |

A and B can run in parallel on separate branches. C goes last.
