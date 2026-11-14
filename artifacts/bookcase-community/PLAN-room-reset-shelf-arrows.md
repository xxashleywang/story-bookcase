# Room reset + shelf Up/Down: Implementation Plan

**Overall Progress:** `5%`

## TLDR
Two Playroom fixes in the React configurator. Arrow Up/Down must move the selected shelf after a click (Up = shelf above). Move “Reset to default” off the 3D stage and onto the Room design heading, and make it restore wall and floor only so a custom bookcase stays.

## Scope
**In scope:**
- Style-it Arrow Up/Down moving selection to the shelf above/below
- Move Reset off the stage, next to Room design
- Reset wall + floor only (including custom floor color/texture)

**Out of scope:**
- First-press-selects-a-shelf (user clicks a shelf first)
- Keyboard-hint copy or pair-slot placement
- Showing the numbered rail on Style it
- Camera View, shelf-numbers toggle, randomize rules, Build it
- Prototype HTML

**Do not touch:**
- `reference/story-v2.js` / `reference/story-core.js`
- URL unit encoding (`encodeUnit` / `decodeUnit`)
- Gallery, profile, share, auth
- Left/Right rotate semantics

## Critical Decisions
- **Closed combobox is not a native arrow target.** `shelfActionFromKey` currently bails on `[role="combobox"]`. The Style-it “Select shelf” control is a Radix Select, so Arrow Up/Down open that menu (or do nothing visible) instead of changing shelves. Block native arrows only for typing fields, an *open* list (`aria-expanded="true"` or `[role="listbox"]`), menus, sliders, and dialogs. Enter/Space still open the dropdown.
- **Listen in the capture phase and stop the event when we handle it.** Window bubble loses to Radix and to scroll. After a select action, focus `#bookcase-model` again so the next arrow keeps working.
- **Up is +1 (shelf above), Down is -1 (shelf below).** Keep `moveShelfSelection` clamping. No change to Left/Right rotate.
- **Reset lives on the Room design heading row**, visible while that section is collapsed. Label stays “Reset to default”. The button is a sibling of the `<summary>` (not inside it) so a click cannot toggle the details. `preventDefault` + `stopPropagation` on the button click as a backstop.
- **Reset writes only room fields:** `wall`, `floor`, `floorKind`, `customFloorColor`. Size, finish, shelf directions, selection, camera, numbers, randomize rules, and build progress stay. Do not `removeItem(LAST_SCENE_KEY)`; `hashFor()` will persist the kept bookcase with the default room.
- **Disabled when the room is already default** (White `#F6F4F0`, Pale oak), even if the bookcase is custom.

## Tasks

- [x] 🟩 **Step 0: Branch**
  - [x] 🟩 `cursor/room-reset-shelf-arrows-d25d` from `origin/main`

- [ ] 🟥 **Step 1: Arrow Up/Down select the neighbouring shelf**
  - [ ] 🟥 In `src/lib/shelf-keyboard.ts`, stop treating a closed `[role="combobox"]` as a native key target; keep blocking when `aria-expanded="true"` or focus is in a listbox/input/dialog
  - [ ] 🟥 In `App.tsx`, add the `keydown` listener with `{ capture: true }`, `preventDefault` + `stopPropagation` when an action is handled, and `hostRef.focus({ preventScroll: true })` after a select action
  - [ ] 🟥 Leave rotate (`ArrowLeft` / `ArrowRight`) on the same path

- [ ] 🟥 **Step 2: Keyboard tests**
  - [ ] 🟥 Closed combobox: ArrowUp / ArrowDown still return `{ type: 'select', step: ±1 }`
  - [ ] 🟥 Open combobox or listbox: still `null`
  - [ ] 🟥 `input` / modifier keys / no selection / Build it: still `null`
  - [ ] 🟥 Existing rotate and clamp tests stay green

- [ ] 🟥 **Step 3: Room-only Reset next to Room design**
  - [ ] 🟥 Remove the stage `.stage-reset` button from the 3D section
  - [ ] 🟥 Place the same control (`RotateCcw` + “Reset to default”) on the Room design heading row in the Style pane
  - [ ] 🟥 `resetToDefault` becomes room-only (`createDefaultScene` wall/floor fields); keep `scene.model`
  - [ ] 🟥 Enable/disable from room fields only

- [ ] 🟥 **Step 4: CSS**
  - [ ] 🟥 Drop `.stage-reset` absolute stage positioning
  - [ ] 🟥 Align the new heading-row button with Room design (quiet `button light small`, no emoji)

- [ ] 🟥 **Step 5: Verify**
  - [ ] 🟥 `pnpm --filter @workspace/bookcase-community run test` (keyboard cases included)
  - [ ] 🟥 Browser, Style it: click a middle shelf, ArrowUp selects the one above (editor “N of 11” and 3D highlight); ArrowDown returns; Left/Right still rotate
  - [ ] 🟥 Click a shelf then use arrows without touching the dropdown; arrows must not open “Select shelf”
  - [ ] 🟥 Change wall/floor, Reset: room returns to White + Pale oak, bookcase dirs/size/finish unchanged
  - [ ] 🟥 Change only the bookcase, Reset stays disabled; room already default
  - [ ] 🟥 Reset does not toggle the Room design `<details>` open or closed

## Session size
Six steps, all in `App.tsx`, `shelf-keyboard.ts`, its test, and `index.css`. One session. Do not split.
