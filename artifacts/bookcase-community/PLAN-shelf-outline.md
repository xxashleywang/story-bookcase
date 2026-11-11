# Feature Implementation Plan
**Overall Progress:** `0%`

## TLDR
Two small Playroom edits, nothing else. Selecting a shelf focuses `#bookcase-model`, and the browser’s default focus outline is clipped by `.stage` (`overflow: hidden` + `border-radius: 28px`), so the stage card shows a broken navy ring. Hide that outline in CSS and leave the focus calls in place so keyboard shelf controls keep working. In the Build it meter, change `Base and post are counted.` to `Base and post are in place.` and leave the rest of that sentence alone.

This document is the plan only. It does not implement the UI change.

## Scope
**In scope:**
- Suppress the visible focus outline on `#bookcase-model` in `artifacts/bookcase-community/src/index.css`.
- Replace one phrase in the incomplete-build meter sentence in `artifacts/bookcase-community/src/App.tsx`.

**Out of scope:**
- Build it tab fraction removal (`Build it` plus `doneSteps/totalSteps` on the tab).
- Click-anywhere deselect.
- Rules click-away.
- Those three are a separate request. Do not fold them into this change.

**Do not touch:**
- Gallery, share dialog, and share/copy-link buttons.
- Story-core progress storage (`Story3D.getProgress` / `setProgress`, `normalizeBuildProgress`).
- Build-step math (`buildSteps`, percent, `doneSteps`, `totalSteps`, `nextShelf`).
- `prototypes/v3/g-playroom.html` and `artifacts/bookcase-community/reference/g-playroom.html`.
- Shelf selection itself (`setSelected`, `onSelect`, rail ticks, `ShelfSelector`).
- The two `hostRef.current?.focus({ preventScroll:true })` calls.
- The finished-state meter line, and the `Build it` tab label.

## Critical Decisions
- **Cause, confirmed in source.** There is no authored outline on the stage or the model host. `Configurator` selects a shelf and then focuses the host:
  - `selectRef.current` in `artifacts/bookcase-community/src/App.tsx` (the 3D `onSelect` path) calls `hostRef.current?.focus({ preventScroll:true })`.
  - The style-tab rail tick `onClick` calls the same `focus`.
  - The host is `<div id="bookcase-model" ref={hostRef} tabIndex={-1} aria-label="Bookcase model" />`, so programmatic focus is allowed.
  - In `artifacts/bookcase-community/src/index.css`, `.stage` is `overflow: hidden` and `border-radius: 28px` (22px under the 680px breakpoint). `#bookcase-model` is `position: absolute; inset: 0` (and `top: 65px` on the short layout). The user-agent focus outline is painted on that box and clipped by the stage’s rounded overflow, which is why the corners look cut off.
- **Change the CSS, not the focus calls.** Add this rule next to the existing `#bookcase-model` declaration in `src/index.css`:

  ```css
  #bookcase-model:focus,
  #bookcase-model:focus-visible {
    outline: none;
  }
  ```

  `:focus` is required, not only `:focus-visible`, because the ring appears after `element.focus()` from a click. Do not put `outline: none` on `.stage`, `button`, or a global selector. Coral `:focus-visible` outlines on real controls (view buttons, shelf editor, shelf-number toggle) stay.
- **Keep both focus calls and `tabIndex={-1}`.** Keyboard shelf controls are the `window` `keydown` listener `onArrow` in `Configurator` (`App.tsx`), which calls `shelfActionFromKey` from `src/lib/shelf-keyboard.ts`. That helper ignores keys whose target is inside `NATIVE_KEY_TARGETS` (inputs, combobox, dialog, and similar). Focusing `#bookcase-model` moves focus off the clicked rail button and off any field that would swallow the arrows. Removing `.focus()`, `tabIndex`, or shelf selection would be the wrong fix. The visible outline is the only thing to remove.
- **Copy is a single phrase swap.** In the Build it meter ternary (`App.tsx`, the `` `Base and post are counted. Next: shelf ${nextShelf + 1}, facing ...` `` string), replace `Base and post are counted.` with `Base and post are in place.` Keep `Next: shelf ${nextShelf + 1}, facing ${directions[scene.model.dirs[nextShelf]]?.label.toLowerCase()}.` exactly. Do not edit `Every shelf is on. Anchor it to the wall with the strap in the box.`

## Tasks

- [ ] 🟥 **Step 0: Feature branch**
  - [ ] 🟥 From current `main`, create `cursor/shelf-outline-copy-af5f`. Cloud agents must use the `cursor/` prefix and the `-af5f` suffix, not `feature/`.
  - [ ] 🟥 Land the product edit on that branch. Do not implement it on the plan branch.

- [ ] 🟥 **Step 1: Remove the clipped navy focus outline**
  - [ ] 🟥 In `artifacts/bookcase-community/src/index.css`, add `#bookcase-model:focus, #bookcase-model:focus-visible { outline: none; }` beside the existing `#bookcase-model` rule.
  - [ ] 🟥 Leave both `hostRef.current?.focus({ preventScroll:true })` calls, `tabIndex={-1}`, and `aria-label="Bookcase model"` unchanged.

- [ ] 🟥 **Step 2: Build meter sentence**
  - [ ] 🟥 In `artifacts/bookcase-community/src/App.tsx`, change the incomplete-build meter phrase to `Base and post are in place.`
  - [ ] 🟥 Keep the `Next: shelf N, facing …` continuation, the finished-state line, the progress math, and the `Build it` tab label.

- [ ] 🟥 **Step 3: Verify in the browser**
  - [ ] 🟥 On Style it, select a shelf by clicking the model and by clicking a rail tick. The stage card has no navy/blue ring, and the rounded corners stay clean.
  - [ ] 🟥 With a shelf selected, ArrowUp/ArrowDown still move the selection and ArrowLeft/ArrowRight still rotate it (window `keydown` in `Configurator`).
  - [ ] 🟥 On Build it, before the bookcase is finished, the meter reads `Base and post are in place. Next: shelf N, facing …`. The finished line and the tab fraction are unchanged.
