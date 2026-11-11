# Restore keyboard-hint wall contrast (PR #7): Implementation Plan

**Overall Progress:** `100%`

## TLDR
Bring back the keyboard-controls tooltip contrast from [PR #7](https://github.com/xxashleywang/story-bookcase/pull/7) (commit `5cfd14d`). On light walls the card is dark brown (`--ink`) with cream text; on dark walls (Night) it is white with ink text. Stronger shadow, and the arrow keys plus close button follow the same card colors. The switch reuses the stage's existing `is-dark` class.

The token block was still on `main` after rebasing onto PR #9. Implementation raised selector specificity so key caps and close beat `Kbd` / `.icon-button`. White and Night screenshots match PR #7.

## Scope
**In scope:** The keyboard-controls hint on the Playroom stage — visual contrast only.

**Out of scope:**
- Footnote removal and view-switcher label from the rest of PR #7 (both still on `main`)
- Prototype (`prototypes/v3/g-playroom.html`)
- Hint copy, placement, dismiss persistence, or when the hint appears
- Other playroom work (build rail, numbers toggle, CTAs)

**Do not touch:**
- `reference/story-core.js`, `reference/story-v2.js`
- `src/lib/shelf-keyboard.ts` and its tests
- Gallery, publish, share
- Unrelated CSS around `.views`, `.build-rail`, randomize, CTAs

## Critical Decisions
- **Reuse `is-dark`, do not add a second wall check.** `roomColor()` + `.stage.is-dark` is what PR #7 used. Night already flips it.
- **Tokens stay on `.shelf-key-hint`.** `--hint-bg`, `--hint-fg`, `--hint-sub`, `--hint-cap-bg`, `--hint-cap-fg`, `--hint-close-bg`. Light default = ink card / cream text; `.stage.is-dark` = white card / ink text. Stronger shadow in both themes.
- **Raise specificity only for keys and close.** `.shelf-key-hint .shelf-key-hint-cap` and `.shelf-key-hint .icon-button.shelf-key-hint-close` so they beat shadcn `Kbd` (`bg-muted`) and `.icon-button` (`background:white`). Do not restyle `Kbd` or `.icon-button` globally.
- **Do not rewrite App.tsx.** `is-dark` is still applied at the stage.

## Tasks

- [x] 🟩 **Step 0: Create feature branch**
  - [x] 🟩 `cursor/restore-keyboard-hint-contrast-f635`, rebased onto `main` after PR #9

- [x] 🟩 **Step 1: Confirm the visual vs PR #7**
  - [x] 🟩 Style it, selected a shelf, cleared `twistory:shelf-key-hint-dismissed`
  - [x] 🟩 White wall: dark brown card, cream title/sub, cream-tinted keys and close, strong shadow
  - [x] 🟩 Night wall: white card, dark text, ink-tinted keys and close, strong shadow
  - [x] 🟩 Token block was still present; keys/close needed nested selectors to reliably win

- [x] 🟩 **Step 2: Restore contrast so it actually wins**
  - [x] 🟩 Kept the `5cfd14d` `.shelf-key-hint` / `.stage.is-dark .shelf-key-hint` token block in [`src/index.css`](src/index.css)
  - [x] 🟩 Nested `.shelf-key-hint .shelf-key-hint-cap` and `.shelf-key-hint .icon-button.shelf-key-hint-close`
  - [x] 🟩 Left [`src/components/shelf-key-hint.tsx`](src/components/shelf-key-hint.tsx) markup unchanged

- [x] 🟩 **Step 3: Verify**
  - [x] 🟩 Re-screenshot White and Night
  - [x] 🟩 `pnpm run typecheck` (after `pnpm run typecheck:libs`) and `pnpm test` (46 passing) in `artifacts/bookcase-community`

## Session size
Four tasks, CSS-only. Done in one session. No split.
