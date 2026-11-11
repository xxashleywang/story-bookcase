# Restore keyboard-hint wall contrast (PR #7): Implementation Plan

**Overall Progress:** `0%`

## TLDR
Bring back the keyboard-controls tooltip contrast from [PR #7](https://github.com/xxashleywang/story-bookcase/pull/7) (commit `5cfd14d`). On light walls the card is dark brown (`--ink`) with cream text; on dark walls (Night) it is white with ink text. Stronger shadow, and the arrow keys plus close button follow the same card colors. The switch reuses the stage's existing `is-dark` class.

Git on current `main` still has that CSS in [`src/index.css`](src/index.css) (blame: `5cfd14d`) and still sets `is-dark` from `roomColor(scene.wall) < .45` in [`src/App.tsx`](src/App.tsx). Step 1 is to confirm whether the visual is actually gone (overrides / merge leftover) before rewriting anything. If screenshots already match PR #7, stop.

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

## Current state (checked on `main`)

Source of truth to restore: commit `5cfd14d` ("Make shelf keyboard hint contrast with the wall"), CSS-only.

Still present in [`src/index.css`](src/index.css):

```css
.shelf-key-hint { --hint-bg:var(--ink); --hint-fg:var(--cream); ... }
.stage.is-dark .shelf-key-hint { --hint-bg:#fff; --hint-fg:var(--ink); ... }
```

Still present in [`src/App.tsx`](src/App.tsx) line 543:

```tsx
className={`stage ${roomColor(scene.wall) < .45 ? 'is-dark' : ''}`}
```

Default wall is White `#F6F4F0` (light). Night is `#2F3346` (dark, luminance below `.45`).

Why it can still look dropped even with that CSS:

- Key caps are a shadcn `Kbd` with Tailwind `bg-muted text-muted-foreground`, which can fight `--hint-cap-bg` / `--hint-cap-fg`.
- Close uses `.icon-button`, which is `background:white; color:var(--ink)` — same specificity as `.shelf-key-hint-close`.
- Hint only renders on Style it, with a shelf selected, and if `twistory:shelf-key-hint-dismissed` is not `1`.
- `@media (hover:none)` hides the hint on touch.

No App.tsx change unless Step 1 shows `is-dark` is no longer applied.

## Critical Decisions
- **Reuse `is-dark`, do not add a second wall check.** `roomColor()` + `.stage.is-dark` is what PR #7 used. Night already flips it.
- **Tokens stay on `.shelf-key-hint`.** `--hint-bg`, `--hint-fg`, `--hint-sub`, `--hint-cap-bg`, `--hint-cap-fg`, `--hint-close-bg`. Light default = ink card / cream text; `.stage.is-dark` = white card / ink text. Stronger shadow in both themes.
- **If CSS is still there but keys/close stay muted or white, raise specificity only.** e.g. `.shelf-key-hint .shelf-key-hint-cap` and `.shelf-key-hint .shelf-key-hint-close` (and the `.stage.is-dark` variants) so they beat `Kbd` / `.icon-button`. Do not restyle `Kbd` or `.icon-button` globally.
- **Do not rewrite App.tsx for this** unless `is-dark` is missing. The original keyboard-hint commit did not touch App.tsx.

## Tasks

- [ ] 🟥 **Step 0: Create feature branch**
  - [ ] 🟥 Branch off main: `git checkout -b cursor/restore-keyboard-hint-contrast-f635`

- [ ] 🟥 **Step 1: Confirm the visual vs PR #7**
  - [ ] 🟥 On Style it, click a shelf so the hint shows (clear `twistory:shelf-key-hint-dismissed` if needed)
  - [ ] 🟥 Screenshot default White wall: expect dark brown card, cream title/sub, cream-tinted keys and close, strong shadow
  - [ ] 🟥 Screenshot Night wall: expect white card, dark text, ink-tinted keys and close, strong shadow
  - [ ] 🟥 If both match [PR #7](https://github.com/xxashleywang/story-bookcase/pull/7), mark this plan done with no code change

- [ ] 🟥 **Step 2: Restore contrast so it actually wins**
  - [ ] 🟥 Keep or re-apply the `5cfd14d` `.shelf-key-hint` / `.stage.is-dark .shelf-key-hint` token block in [`src/index.css`](src/index.css)
  - [ ] 🟥 If keys or close still ignore the tokens, use the nested selectors in Critical Decisions — only those two rules
  - [ ] 🟥 Leave [`src/components/shelf-key-hint.tsx`](src/components/shelf-key-hint.tsx) markup alone unless a class is required for the nested CSS

- [ ] 🟥 **Step 3: Verify**
  - [ ] 🟥 Re-screenshot White and Night
  - [ ] 🟥 `pnpm run typecheck` and `npm test` (35 tests) in `artifacts/bookcase-community`

## Session size
Four tasks, CSS-only unless Step 1 proves `is-dark` is gone. Fine for one session. No split.
