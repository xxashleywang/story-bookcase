# Playroom + Gallery CTA cleanup and muted Randomize — Implementation Plan

**Overall Progress:** `100%`

## TLDR
The Playroom (`artifacts/bookcase-community/src/App.tsx`) shows six buttons around the configurator, and three of them do overlapping things. The gallery page repeats the problem with two "Share" buttons. The Randomize chip is also louder than the rest of the pane. This plan:

1. Mutes Randomize while keeping its dice and settings buttons visibly paired.
2. Cuts the Playroom from six buttons to three, with one clear primary action, and leaves one share button on the gallery page.
3. Renames "room" to "bookcase" wherever we mean the community gallery or sharing, since V1 is only the Story bookcase.

## What each button does today (from the code)
| Button | Where | What it actually does |
|---|---|---|
| Room gallery | Header | Goes to `/inspiration`, the community feed of shared builds |
| Share a room | Header (Playroom + gallery) | Opens `PublishDialog` with "attach blueprint" **off** (photo-first post). Needs sign-in + username |
| Sign in | Header | Sign-in page |
| Copy room link | Bottom of Style tab | Copies the current URL. The design lives in the URL hash, so the link reopens this exact bookcase. Private, nothing is posted, no sign-in |
| Share your build | Bottom of Style tab | Opens the **same** `PublishDialog`, with "attach blueprint" **on**. Needs sign-in + username |
| Share your room | Gallery hero | Opens the same gallery share dialog as the header button |
| Get inspired | Below the Playroom | Opens a drawer with the 8 newest community builds and "use this look". Same data as the gallery |

## Scope
**In scope:**
- Randomize + rules chip styling (`.pattern.random`, `.random-controls` in `src/index.css`)
- Playroom header, Style-tab footer, Build-tab footer, and the "Get inspired" row in `src/App.tsx`
- Gallery page header + hero: one share button, new headline, bookcase copy
- Copy on the profile page and share dialog where "room" means a shared bookcase

**Out of scope:**
- Multi-furniture support or gallery categories (future)
- Redesigning `PublishDialog` beyond its title/labels
- Gallery layout, search behaviour, sorting
- Sign-in / account flow

**Do not touch:**
- "Room design" section (wall + floor really is the room)
- URL hash encoding of the scene
- `useShareGate` sign-in/username gating
- API, DB schema, `/inspiration` route path (keeps existing links working)

## Critical Decisions
- **Randomize stays a pair, but the pairing comes from shape, not a loud colour.** Dice and settings become one joined split pill: a shared rounded container with a thin divider between the two halves, so they read as one control. The container uses a soft butter tint (`#fff1cc`-ish, much paler than today's `--butter`) so it still differs from the cream presets without pulling focus. When rolled, only the dice half turns ink, matching an active preset; the coral active state goes away.
- **One primary CTA in the Playroom: "Share your bookcase".** The only coral button. Opens `PublishDialog` with blueprint attached (today's "Share your build" behaviour). Photo is still optional inside the dialog, so the header "Share a room" button is removed.
- **Copy link is demoted, not deleted.** It's the only no-account way to save or send a design. It becomes a quiet icon button (link icon, tooltip/aria-label "Copy link to this design") next to the primary CTA. The `window.alert` stays as-is (out of scope).
- **Get inspired is removed** (Ashley: yes). The header "Gallery" link is the single way into the community. Gallery detail pages already let people open a blueprint in the Playroom, so "use this look" isn't lost.
- **Header is two items on every page:** "Gallery" (Ashley's pick) and "Sign in" / account menu. No share button in the header anywhere.
- **Gallery page keeps one share button:** the hero "Share your bookcase". The empty-state button only shows when there are no results, so it can't appear next to the hero one; it gets the same label.
- **Result:** Playroom goes from 6 buttons to 3 (Gallery, Sign in, Share your bookcase) plus one icon button. Gallery goes from 2 share buttons to 1.

## Headline choice (resolved)
Selected headline: **"Shelfies from the community."**  
Eyebrow: **"Twistory gallery"**.

| # | Headline | Why |
|---|---|---|
| A | **Every shelf has a story. Here are theirs.** | Echoes the tagline in the header; ties the brand together |
| B | **Real bookcases, real homes.** | Plain and bookcase-specific; says "these aren't renders" |
| C | **Steal a shelf you love.** | Action-first; matches "open the blueprint in your Playroom" |
| D | **Shelfies from the community.** | Playful, social; works if posts are mostly photos |
| E | **How everyone else twisted theirs.** | Uses the twist mechanic (rotating shelves) that makes Story unique |

Supporting line, proposed for any headline: "Story bookcases styled by the community. Some come with a blueprint you can open and make your own." Search placeholder: "Search a bookcase, maker, or detail…".

## Tasks

- [x] 🟩 **Step 0: Branch**
  - [x] 🟩 Implemented on `cursor/cta-cleanup-plan-7dd0`.

- [x] 🟩 **Step 1: Randomize split pill**
  - [x] 🟩 Wrapped dice + settings in one shared split control with a pale butter container
  - [x] 🟩 Rolled state now uses ink on the dice half; rules-count badge remains readable

- [x] 🟩 **Step 2: Header**
  - [x] 🟩 Removed "Share a room" from `Header` and removed `openPublish` prop wiring
  - [x] 🟩 Renamed "Room gallery" to "Gallery"

- [x] 🟩 **Step 3: Playroom footers**
  - [x] 🟩 Style tab now uses icon-only copy-link + coral "Share your bookcase"
  - [x] 🟩 Build tab CTA renamed to "Share your bookcase"

- [x] 🟩 **Step 4: Remove Get inspired**
  - [x] 🟩 Removed the button, `InspirationDrawer`, and related Playroom wiring
  - [x] 🟩 Kept the "is in the gallery. See it" confirmation after publishing

- [x] 🟩 **Step 5: Gallery + copy pass**
  - [x] 🟩 Gallery updated with chosen headline, revised supporting line, search placeholder, and share labels
  - [x] 🟩 Profile share CTAs updated to "Share your bookcase"
  - [x] 🟩 `PublishDialog` title/copy updated away from "room"

- [x] 🟩 **Step 6: Verify**
  - [x] 🟩 `pnpm run typecheck:libs`
  - [x] 🟩 `pnpm --filter @workspace/bookcase-community run typecheck`
  - [x] 🟩 `pnpm --filter @workspace/bookcase-community run test` (35 passing tests)
