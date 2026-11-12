# Keyboard hint placement: Implementation Plan

**Overall Progress:** `100%`

## TLDR
Keyboard-tip placement uses fixed 2-shelf buckets so positions stay predictable: shelves 1&2 share one right-side slot, 3&4 share the next, 5&6 the next, and so on, matching the red-box guide.

## Scope
**In scope:** `src/App.tsx`, `src/lib/shelf-hint-placement.ts`, `tests/shelf-hint-placement.test.mjs`, this plan file.

**Out of scope:**
- Keyboard-tip content/controls redesign
- Shelf geometry and model rendering
- Build flow, randomize rules, and unrelated UI

**Do not touch:**
- `reference/story-v2.js` / `reference/story-core.js`
- Gallery/profile/auth routes
- Arrow-key action semantics

## Critical Decisions
- **Bucket by shelf pairs (`[1,2]`, `[3,4]`, `[5,6]`, ...).** A leftover odd shelf (9 or 11) gets its own slot.
- **Right-side only.** No left-side switching at the current panel width.
- **Anchor each pair to the lower shelf in that pair.** Keeps 1&2 at the floor/wall slot from the red-box guide.

## Tasks

- [x] 🟩 **Step 0: Lock acceptance criteria**
  - [x] 🟩 Pair mapping: 1&2, 3&4, 5&6, and so on
  - [x] 🟩 Red-box guide is the canonical right-column layout
  - [x] 🟩 Keep right-side placement

- [x] 🟩 **Step 1: Define pair-to-slot mapping**
  - [x] 🟩 `shelfHintPairIndex` / `shelfHintPairStart` bucket 0-based selected shelves
  - [x] 🟩 Vertical slot from the lower shelf in the pair, plus a small floor-line offset

- [x] 🟩 **Step 2: Apply mapping in placement helper**
  - [x] 🟩 Replaced per-shelf `targetTop` with pair-slot targeting
  - [x] 🟩 Kept right-side X, optional left fallback, and stage bounds clamping

- [x] 🟩 **Step 3: Preserve no-collision guardrails**
  - [x] 🟩 Pair slots still reject plank overlap when a valid right slot exists
  - [x] 🟩 In-bounds and no-overlap tests passed

- [x] 🟩 **Step 4: Add/update tests**
  - [x] 🟩 Same pair resolves to the same Y/left slot
  - [x] 🟩 `node --test artifacts/bookcase-community/tests/shelf-hint-placement.test.mjs` passed (8/8)

- [x] 🟩 **Step 5: Finalize**
  - [x] 🟩 Commit and push on `cursor/fix-controls-tip-placement-8099`
