# Gallery hero, empty-state CTA, and logged-in nav — Implementation Plan

**Overall Progress:** `0%`

## TLDR
Four gallery/nav polish items from the screenshots, in the live app (`artifacts/bookcase-community`): rename the empty-state share button, cut the "Shelfies from the community." headline in half, delete the hero-right stats + share block, and paint the logged-in account chip coral.

## Scope
**In scope:**
- Gallery hero markup in `src/App.tsx` (`Gallery`)
- Empty-state CTA label on `/inspiration`
- `.gallery-hero` heading size and leftover two-column CSS in `src/index.css`
- Logged-in `AccountMenu` trigger in `src/components/account-ui.tsx` (header, every page)

**Out of scope:**
- Playroom "Share your bookcase" buttons (Style/Build tabs)
- Profile "Share your bookcase" links
- Share dialog title (`Share your bookcase` in `share-dialog.tsx`)
- Gallery search, sort, empty-state copy besides the button label
- Guest "Sign in" chip and the "Gallery" nav link
- Community summary API / schema (only stop calling it from the gallery hero)

**Do not touch:**
- `useShareGate`, `PublishDialog`, `?share=` deep-link into the gallery
- `/inspiration` route path
- Prototypes (`prototypes/v3/e-gallery.html` and friends)

## Critical Decisions
- **"Middle CTA" is the empty-state button in the gallery well, not the hero-right button.** Screenshot 2 is the hero-right block and gets deleted. The remaining share control on the gallery page is the dashed-well button; that label becomes "Share your design".
- **Populated gallery has no share button after this.** The empty-state CTA only renders when there are no results. Do not add a replacement share control. Keep `openShare` / `PublishDialog` / `?share=` so profile and empty-state still open the same dialog.
- **"Drop by 2x" means half the type size.** Current `.gallery-hero h1` is `clamp(44px, 7vw, 82px)`. Change it to `clamp(22px, 3.5vw, 41px)`.
- **Screenshot 2 is the whole hero-right column.** Delete the stats paragraph (`N bookcases from N people…`) and its "Share your bookcase" button. Leave eyebrow + headline. Drop `useGetCommunitySummary` from `Gallery` because nothing else on that page reads it. Leave `getGetCommunitySummaryQueryKey` invalidation on publish as-is.
- **Orange nav = logged-in account chip only.** Screenshot 3 is Gallery + Ashley. Gallery stays `.button.light`. Guest "Sign in" stays ink `.button.small`. `AccountMenu` trigger changes from `.button.light.small` to `.button.coral.small`. Update `.account-menu-trigger[data-state="open"]` so the open state does not snap back to `--hairline` beige.

## Tasks

- [ ] 🟥 **Step 0: Create feature branch**
  - [ ] 🟥 Branch off main: `git checkout -b cursor/gallery-hero-nav-0498`

- [ ] 🟥 **Step 1: Rename the empty-state CTA**
  - [ ] 🟥 In `Gallery` empty state, change `Share your bookcase` to `Share your design`
  - [ ] 🟥 Keep the existing `Camera` SVG icon and `openShare` handler

- [ ] 🟥 **Step 2: Halve the Shelfies headline**
  - [ ] 🟥 In `src/index.css`, change `.gallery-hero h1` from `clamp(44px,7vw,82px)` to `clamp(22px,3.5vw,41px)`

- [ ] 🟥 **Step 3: Remove the hero-right block**
  - [ ] 🟥 Delete the second `gallery-hero` column (summary copy + `data-testid="button-share-room"`)
  - [ ] 🟥 Remove `useGetCommunitySummary` from `Gallery` and its unused import if nothing else in the file still calls the hook
  - [ ] 🟥 Drop `.gallery-hero > div:last-child` (it currently styles the right column; after the delete it would wrongly target the headline)
  - [ ] 🟥 Simplify `.gallery-hero` from two-column flex to a single-column block

- [ ] 🟥 **Step 4: Coral account chip when signed in**
  - [ ] 🟥 `AccountMenu` trigger: `button light small account-menu-trigger` → `button coral small account-menu-trigger`
  - [ ] 🟥 Restyle `[data-state="open"]` so the chip stays coral (darker coral is fine; beige is not)
  - [ ] 🟥 Confirm Gallery and Sign in chips are unchanged

- [ ] 🟥 **Step 5: Verify**
  - [ ] 🟥 `pnpm --filter @workspace/bookcase-community run typecheck`
  - [ ] 🟥 `pnpm --filter @workspace/bookcase-community run test`
  - [ ] 🟥 Browser: empty gallery (CTA says Share your design; no hero-right block; smaller headline)
  - [ ] 🟥 Browser: logged-out nav (Gallery light, Sign in ink) vs logged-in nav (Gallery light, account chip coral) on gallery and Playroom
  - [ ] 🟥 Browser: mobile viewport so the halved headline still reads as a title
