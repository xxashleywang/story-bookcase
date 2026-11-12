# Gallery hero, empty-state CTA, and logged-in nav — Implementation Plan

**Overall Progress:** `100%` (plus local fake-auth preview)

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

- [x] 🟩 **Step 0: Create feature branch**
  - [x] 🟩 `cursor/gallery-hero-nav-0498` from the plan branch (plan file already on `cursor/gallery-hero-nav-plan-0498`)

- [x] 🟩 **Step 1: Rename the empty-state CTA**
  - [x] 🟩 Gallery empty state now says `Share your design`
  - [x] 🟩 Kept the existing `Camera` SVG icon and `openShare` handler

- [x] 🟩 **Step 2: Halve the Shelfies headline**
  - [x] 🟩 `.gallery-hero h1` is now `clamp(22px,3.5vw,41px)`

- [x] 🟩 **Step 3: Remove the hero-right block**
  - [x] 🟩 Deleted the second `gallery-hero` column (summary copy + `data-testid="button-share-room"`)
  - [x] 🟩 Removed `useGetCommunitySummary` from `Gallery` and the unused import
  - [x] 🟩 Dropped `.gallery-hero > div:last-child`
  - [x] 🟩 `.gallery-hero` is a single-column block

- [x] 🟩 **Step 4: Coral account chip when signed in**
  - [x] 🟩 `AccountMenu` trigger is `button coral small account-menu-trigger`
  - [x] 🟩 Open state uses darker coral `#e85a3c` instead of `--hairline`
  - [x] 🟩 Gallery stays `button light small`; Sign in stays `button small`

- [x] 🟩 **Step 5: Verify**
  - [x] 🟩 `pnpm --filter @workspace/bookcase-community run typecheck`
  - [x] 🟩 `pnpm --filter @workspace/bookcase-community run test` (54 passing)
  - [x] 🟩 Empty gallery: CTA is Share your design; hero is only eyebrow + headline; computed h1 is 41px desktop / 22px at 390px
  - [x] 🟩 Logged-out nav: Gallery `button light small`, Sign in `button small` on gallery and Playroom. Logged-in coral chip verified by class (`button coral small`) and a CSS injection (Clerk is not configured in this preview, so a real session was not used)
  - [x] 🟩 Share your design click (signed out) goes to `/sign-in?redirect_url=...inspiration?share=photo`. Populated gallery has no share CTA. Playroom still says Share your bookcase.

- [x] 🟩 **Step 6: Local fake-auth preview**
  - [x] 🟩 Loopback only: `http://localhost:5173/inspiration?fakeAuth=1` (or `127.0.0.1`). `?fakeAuth=0` or Account menu "Exit preview" turns it off.
  - [x] 🟩 Stays off on any non-loopback host, even if the query param is present.
