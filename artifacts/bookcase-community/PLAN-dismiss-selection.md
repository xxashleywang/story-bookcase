# Dismiss shelf selection and Randomize rules — Implementation Plan

**Overall Progress:** `100%`

## TLDR
Two small Playroom dismissals, plus a quieter Build it tab, in the real configurator (`artifacts/bookcase-community`). The Build it tab label becomes just "Build it". A selected shelf clears when the user clicks blank space. The Randomize rules popover closes the same way, without a second click on Rules.

## Scope
**In scope:**
- `src/App.tsx` in the React configurator: the Build it tab label, shelf selection, and the Rules popover
- This plan file

**Out of scope:**
- Build-step math (`src/lib/build-steps.ts`), the progress meter ("1 of 12 steps"), and the stage stamp percent
- Prototype and reference copies (`prototypes/v3/g-playroom.html`, `reference/g-playroom.html`, `reference/story-v2.js`)
- Gallery, profile, publish, and share flows
- New features beyond a one-line Escape close for the rules popover

**Do not touch:**
- `buildSteps()`, `advanceBuildProgress()`, and their tests
- Shelf direction changes, rail progress, and the 3D renderer
- Escape on the shelf editor: it still only closes the editor and leaves `selected` as it is

## Critical Decisions
- **Edit the React app, not the prototype.** The live UI is `artifacts/bookcase-community`: ImagineMode wordmark, Style it / Build it tabs, Shelf direction, and the Rules button. The prototype still shows a fraction via `#tabprog` and is reference only.
- **The tab loses only its fraction.** Delete the `<small>{steps.doneSteps}/{steps.totalSteps}</small>` from the Build it button. The meter, stamp, and base-counted step math stay, so a tall bookcase still starts at 1 of 12 in the meter.
- **Blank space clears a shelf. Real controls do not.** A primary click whose pointerdown target is not a shelf face (`[data-i]`), rail tick, shelf selector (including the portaled menu), shelf editor, rules popover, or another real control sets `selected` to `-1` and `editorOpen` to false. That matches choosing "None". Direction buttons, previous/next, the dropdown, and a different shelf do not clear the selection.
- **Hit-test the pointerdown target, and ignore drags.** The 3D view calls `setPointerCapture`, so the later click is retargeted to the model host. Using the pointerdown element keeps a shelf click as a shelf click. Movement over 4px (the same slop the model uses before it treats a gesture as a select) does not dismiss, so orbiting the bookcase keeps the selection.
- **Rules close on an outside click, except the Rules button.** If `rulesOpen` and the pointerdown target is outside `.rules-pop` and outside the Rules button, set `rulesOpen` to false. Refs on both nodes stop one click from closing via the outside handler and toggling the button back open. Clicks inside the popover (direction toggles, no-neighbours) leave it open. Escape closes the popover and does not clear the shelf.

## Tasks

- [x] 🟩 **Step 0: Branch**
  - [x] 🟩 `cursor/build-tab-dismiss-af5f` from current `origin/main`

- [x] 🟩 **Step 1: Build it tab label**
  - [x] 🟩 Removed the fraction `<small>` from the Build it button only

- [x] 🟩 **Step 2: Blank-space shelf deselect**
  - [x] 🟩 Pointer gesture on blank space sets `selected` to `-1` and `editorOpen` to false
  - [x] 🟩 Shelf faces, rail ticks, the selector, the editor, and other controls keep the selection

- [x] 🟩 **Step 3: Blank-space rules dismiss**
  - [x] 🟩 Outside click closes `.rules-pop` without fighting the Rules button toggle
  - [x] 🟩 Clicks inside the popover do not close it
  - [x] 🟩 Escape closes the popover

- [x] 🟩 **Step 4: Verify**
  - [x] 🟩 Tab text is exactly "Build it" before and after a build step; meter still shows the step count (1 of 12, then 2 of 12) and the stamp still shows a percent
  - [x] 🟩 Select a shelf, click blank stage or the panel heading, selection and editor go away; click the shelf again to reselect; Left does not deselect; a different shelf, a rail tick, and the dropdown still select; None clears
  - [x] 🟩 Rules: blank space closes; a direction toggle stays open and works; the Rules button still toggles, including while a shelf is selected; Escape closes rules
