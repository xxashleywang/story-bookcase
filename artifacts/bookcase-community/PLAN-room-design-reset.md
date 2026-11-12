# Room-only reset: Implementation Plan

**Overall Progress:** `100%`

## TLDR
Move `Reset to default` off the bookcase stage and put it beside the **Room design** heading. Show it only after the wall or floor differs from the default room. Clicking it restores the room and leaves the bookcase exactly as the user designed it.

## Scope
**In scope:**
- `artifacts/bookcase-community/src/App.tsx` — button placement, visibility, and a room-only reset
- `artifacts/bookcase-community/src/index.css` — drop the stage position; style the button in the Room design summary
- One small pure helper plus a test for "has the room changed?"

**Out of scope:**
- Resetting bookcase size, finish, shelf directions, the selected shelf, view, shelf numbers, randomize rules, or build progress
- A session "dirty" flag. Compare the current wall and floor to the default room, including a shared link that already has a different wall or floor
- The Playroom prototype (`prototypes/v3/g-playroom.html`)
- Gallery, publish, share, and Build it

**Do not touch:**
- `reference/story-core.js` and `reference/story-v2.js`
- The hash format in `hashFor()` (model, wall, floor id, floor kind, custom floor color)
- `createDefaultScene()` defaults: White wall `#F6F4F0`, Pale oak (`FLOORS[0]`), floor kind Laminate, custom floor color `#B9A48A`
- `LAST_SCENE_KEY`. Do not remove it. The existing `hashFor(scene)` effect rewrites the hash and storage with the kept bookcase and the restored room

## Critical Decisions
- **The button lives in the Room design summary, immediately after the words "Room design".** The wall/floor subtitle and chevron stay to the right. It is visible while the section is collapsed. It is not rendered on Build it, because that pane does not include Room design.
- **Hide it until the room differs. Do not disable it.** `roomDesignChanged` is true when the wall hex differs from `#F6F4F0` (case-insensitive, so a custom wall counts) or `scene.floor.id` differs from `pale` (another preset, or Make your own). Choosing Make your own already sets `floor.id` to `custom`, including a custom color or Wood/Carpet texture, so that counts as a different floor. Changing only the bookcase does not.
- **Reset writes the default room fields onto the current scene and stops there.** Restore `wall`, `floor` (a copy of the default floor), `floorKind`, and `customFloorColor`. Keep `scene.model` (size, finish, shelf directions). Do not touch selection, tab, rules, view, shelf numbers, roll state, or build progress, and do not call `Story3D.setProgress`.
- **Remove `isAtDefault` and `resetToDefault`.** They mean "the entire visit is back to a first load" (model, rules, view, progress, and `localStorage.removeItem`). Nothing else reads `isAtDefault`. Leaving them would make the next reset wipe the bookcase again.
- **A click must not toggle the section.** The control is a `<button>` inside `<summary>`. `preventDefault` and `stopPropagation` on the click. Scope the open-state chevron rule to the chevron itself: `.room-preview[open] summary h2 svg` currently rotates every svg in that heading, which would spin the reset icon.
- **Let the summary row wrap.** The panel is about 400px. Title, button, subtitle, and chevron do not fit on one line. Keep the button beside "Room design"; let the subtitle wrap instead of squashing it.

## Tasks

- [x] 🟩 **Step 0: Create feature branch**
  - [x] 🟩 Branch off main: `cursor/room-design-reset-97f3`

- [x] 🟩 **Step 1: Room-changed helper**
  - [x] 🟩 Add a pure `roomDesignChanged` check for wall hex and floor id against the default room
  - [x] 🟩 Test: default room is false; another wall, a custom wall, and another floor (including `custom`) are true; a bookcase-only difference is false

- [x] 🟩 **Step 2: Move the button**
  - [x] 🟩 Remove the stage button and the `.stage-reset` rule
  - [x] 🟩 Render `Reset to default` (existing `button light small` and `RotateCcw`) beside "Room design" only when `roomDesignChanged` is true
  - [x] 🟩 Stop the click from opening or closing the section, and keep the chevron as the only icon that rotates

- [x] 🟩 **Step 3: Room-only reset**
  - [x] 🟩 Restore wall, floor, floor kind, and custom floor color from `createDefaultScene()`
  - [x] 🟩 Leave the bookcase model and every other piece of configurator state in place
  - [x] 🟩 Rely on `hashFor(scene)` to persist the kept bookcase with the default room

## Session size
Four tasks, all in the configurator. Fits one session.
