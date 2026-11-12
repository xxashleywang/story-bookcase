# Feature Implementation Plan

**Overall Progress:** `95%`

## TLDR
Implement Option B behavior in the real configurator: keep shelf editing on-stage with a persistent, clickable controls card; remove the right-panel Shelf direction section; and update stage instruction copy to include "select a shelf".

## Scope
**In scope:** replacing the shelf keyboard hint with a clickable control card, removing panel Shelf direction controls, preserving paired hint placement, and updating subtitle copy.  
**Out of scope:** changing build tab logic, changing randomize logic, or editing prototype-only files.  
**Do not touch:** `reference/story-core.js`, `reference/story-v2.js`, and unrelated gallery/profile/account flows.

## Critical Decisions
- Keep placement logic in `placeShelfHint` unchanged so shelf pair slots remain identical (1+2, 3+4, ...).
- Replace auto-hide-after-3 behavior with explicit close-only behavior using an X button.
- Remove right-panel Shelf direction controls entirely to avoid duplicate editing surfaces.

## Tasks

- [x] 🟩 **Step 0: Confirm implementation targets**
  - [x] 🟩 Verified real app files and helpers: `src/App.tsx`, `src/components/shelf-key-hint.tsx`, `src/index.css`, `src/lib/shelf-hint-placement.ts`, `src/lib/shelf-keyboard.ts`.

- [ ] 🟥 **Step 1: Replace stage hint with interactive controls card**
  - [x] 🟩 Update card layout to keyboard-style control grid: first row `Up`, second row `Left Down Right`.
  - [x] 🟩 Keep close X in top-right and add explicit move/turn instruction copy.

- [x] 🟩 **Step 2: Wire interactions in configurator**
  - [x] 🟩 Map Up/Down to shelf selection movement.
  - [x] 🟩 Map Left/Right to shelf direction rotation.
  - [x] 🟩 Remove auto-hide-on-third-use behavior.

- [x] 🟩 **Step 3: Remove right-panel Shelf direction section**
  - [x] 🟩 Remove Shelf direction block from style panel.
  - [x] 🟩 Clean up now-unused imports/state/refs.

- [x] 🟩 **Step 4: Update scene subtitle copy**
  - [x] 🟩 Replace subtitle under "Design your bookcase" with copy containing "select a shelf".

- [x] 🟩 **Step 5: Styling + placement parity checks**
  - [x] 🟩 Update CSS for interactive stage card controls.
  - [x] 🟩 Preserve pair-based placement behavior and stage anchoring.

- [ ] 🟨 **Step 6: Validate + ship**
  - [ ] 🟨 Run typecheck/tests relevant to this package.
    - `pnpm test` passes.
    - `pnpm typecheck` is currently blocked by pre-existing workspace issues unrelated to this change:
      - missing built declarations for `lib/api-client-react`
      - existing implicit-any error in `src/components/account-ui.tsx`
  - [ ] 🟥 Commit, push, and update PR.
