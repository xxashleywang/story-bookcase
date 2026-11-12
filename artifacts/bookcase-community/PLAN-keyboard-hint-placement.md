# Keyboard hint placement fix: Implementation Plan

**Overall Progress:** `95%`

## TLDR
Keep the keyboard-controls hint visible and readable without covering shelves. The hint now uses a constraints-first placement helper: try the right side first, then fall back only when right placement would clip or collide. Also narrow the hint so it naturally fits more often.

## Scope
**In scope:** `src/App.tsx`, `src/index.css`, one new helper in `src/lib/`, one new test in `tests/`.

**Out of scope:**
- Build progress flow and Build tab behavior
- Gallery/profile/auth routes
- Shelf geometry and rendering internals in `reference/story-v2.js`

**Do not touch:**
- URL hash persistence and scene serialization
- Randomize rules behavior
- Model keyboard controls semantics (arrow key actions)

## Critical Decisions
- **Right-first candidate order.** Placement always attempts right side first, and only switches when right is invalid (cut off or collision).
- **Collision checks include every shelf plank.** Any overlap with any plank is treated as invalid.
- **Narrower panel before complex movement.** Reduce width and tighten internals so valid placements are easier to find.
- **One pure helper for placement.** Keep sizing/collision policy centralized and testable.

## Tasks

- [x] 🟩 **Step 0: Lock criteria**
  - [x] 🟩 No overlap with any shelf plank
  - [x] 🟩 Default to right-first fallback logic
  - [x] 🟩 Make panel narrower

- [x] 🟩 **Step 1: Narrow panel footprint**
  - [x] 🟩 Reduced stage hint width from `min(330px,44vw)` to `min(290px,38vw)`
  - [x] 🟩 Tightened hint padding, gap, keycap sizes, and close button size

- [x] 🟩 **Step 2: Add placement helper**
  - [x] 🟩 Added `src/lib/shelf-hint-placement.ts` with candidate generation and constraints checks
  - [x] 🟩 Implemented right-first side ordering with bounded fallbacks

- [x] 🟩 **Step 3: Enforce collisions + bounds**
  - [x] 🟩 Reject candidates that overlap any shelf plank
  - [x] 🟩 Keep hint fully within stage edges
  - [x] 🟩 Include selected shelf badge as additional collision blocker

- [x] 🟩 **Step 4: Integrate helper**
  - [x] 🟩 Wired helper into `Configurator` shelf hint style variables
  - [x] 🟩 Preserved smooth top/left transitions

- [x] 🟩 **Step 5: Add focused tests**
  - [x] 🟩 Added `tests/shelf-hint-placement.test.mjs` for right-preference, fallback, bounds, and no-plank-overlap cases

- [ ] 🟨 **Step 6: Verify in environment**
  - [x] 🟩 `node --test artifacts/bookcase-community/tests/shelf-hint-placement.test.mjs` passed (4/4)
  - [x] 🟩 `node --test artifacts/bookcase-community/tests/shelf-keyboard.test.mjs artifacts/bookcase-community/tests/shelf-hint-placement.test.mjs` passed (11/11)
  - [ ] 🟨 Typecheck/build execution remains blocked in this VM due missing `node_modules` / `tsc`
  - [ ] 🟨 Manual visual pass with latest screenshots and local run pending
