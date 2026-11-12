# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Selecting **Build it** should put the planner at `/build-it` on the existing host (`imaginemode.apps.grok.bot`). Selecting **Style it** returns the path to `/`. The design hash and query string stay. The 3D scene does not reload.

## Scope
**In scope:** The Style it / Build it control in the planner (`Configurator` in `artifacts/bookcase-community/src/App.tsx`), the three route lists that render `Home`, and a small pure helper plus test for path ↔ tab.

**Out of scope:**
- Changing the published hostname. The request spelled `imagineomde`; the live host and the wordmark are `imaginemode`. The path is the only URL change.
- A separate history entry per tab click.
- Gallery, profile, sign-in, or inspiration routes.
- The static prototypes (`prototypes/`, `artifacts/bookcase-community/reference/g-playroom.html`).

**Do not touch:**
- Design hash format (`hashFor`, `addressHash`, `blueprintHref` in `src/lib/community.ts`). Shared designs stay `#unit~wall~floor…`.
- `reference/story-core.js` and `reference/story-v2.js`.
- `app/[[...slug]]/route.ts`. It already serves the SPA shell for any path, including `/build-it`.

## Critical Decisions
- **Path, not a query flag.** Build it is `/build-it`. Style it is `/`. Profile’s `?tab=` pattern is a different page and stays as it is.
- **The URL has to survive refresh.** Today `tab` is `useState('style')` and only `/` renders `Home`. `/build-it` matches the wouter catch-all and shows `NotFound`, even though the server returns the app shell. Cold load, refresh, and back-from-gallery must open Build it when the path is `/build-it`.
- **Do not remount the planner.** `hashFor` and the profile tabs already rewrite the address with `history.replaceState` and keep the current search and hash. Do the same here. Routing the click through `setLocation` would unmount `Home` (two `<Route>` elements) and replay the shelf intro. `Home` stays mounted for both paths.
- **One history slot.** Replace the current entry. Back leaves the planner (or returns to gallery) with the last selected tab, instead of stepping Style it ↔ Build it.
- **Keep hash and search on every write.** `hashFor`, reference `?ref=`, share `?share=`, and inspiration handoff already append to `window.location.pathname`. After the path flips they must keep `/build-it` or `/` and must not drop `#…`.
- **Blueprint links still open `/#…`.** `openBlueprint` treats only `/` as “already on the planner.” A blueprint from the gallery keeps navigating to `/#design` and showing Style it. No change to that handoff.
- **Same route rule in all three trees.** `AccountRoutes`, `LocalRoutes`, and `CursorRoutes` each have their own `<Switch>`. The published app in the screenshot uses the Cursor tree. Missing any one of them leaves that mode on the 404 page.

## Tasks

- [ ] 🟥 **Step 0: Create feature branch**
  - [ ] 🟥 Branch off main: `cursor/build-it-url-ff67` (this plan is already on that branch)

- [ ] 🟥 **Step 1: Path helper**
  - [ ] 🟥 Add `plannerTabFromPath` and `plannerPathForTab` in `artifacts/bookcase-community/src/lib/planner-tab.ts`
  - [ ] 🟥 Cover `/`, `/build-it`, and any other path (Style it) in `artifacts/bookcase-community/tests/planner-tab.test.mjs`

- [ ] 🟥 **Step 2: Keep Home mounted for both paths**
  - [ ] 🟥 In `AccountRoutes`, `LocalRoutes`, and `CursorRoutes`, render `Home` when the location is `/` or `/build-it`, and use the existing `<Switch>` for every other path
  - [ ] 🟥 Do not key `Home` by the path

- [ ] 🟥 **Step 3: Sync the tab and the address**
  - [ ] 🟥 Initialize `tab` in `Configurator` from `plannerTabFromPath(stripBase(window.location.pathname))`
  - [ ] 🟥 Build it click: `replaceState` to `/build-it` plus the current search and hash, then `setTab('build')`
  - [ ] 🟥 Style it click: `replaceState` to `/` plus the current search and hash, then `setTab('style')`
  - [ ] 🟥 Leave `hashFor` writing `pathname + search + hash` so later edits stay on whichever path is current

- [ ] 🟥 **Step 4: Verify**
  - [ ] 🟥 `pnpm test` includes the new helper test
  - [ ] 🟥 In the browser: Style it is `/`; Build it becomes `/build-it`; switching back returns to `/`; the hash (when a design is not the default) and `?ref=` stay; the 3D scene does not replay its intro; refresh on `/build-it` opens Build it; Gallery → Back restores the last tab

## Session size
Five steps, one UI control plus a route guard. Fits one session.
