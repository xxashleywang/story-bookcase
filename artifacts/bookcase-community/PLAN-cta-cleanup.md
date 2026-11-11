# Playroom + Gallery CTA cleanup and muted Randomize — Implementation Plan

**Overall Progress:** `0%`

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

## Open question for Ashley: gallery headline
Pick one (or mix). Eyebrow becomes **"Twistory gallery"** in all cases.

| # | Headline | Why |
|---|---|---|
| A | **Every shelf has a story. Here are theirs.** | Echoes the tagline in the header; ties the brand together |
| B | **Real bookcases, real homes.** | Plain and bookcase-specific; says "these aren't renders" |
| C | **Steal a shelf you love.** | Action-first; matches "open the blueprint in your Playroom" |
| D | **Shelfies from the community.** | Playful, social; works if posts are mostly photos |
| E | **How everyone else twisted theirs.** | Uses the twist mechanic (rotating shelves) that makes Story unique |

Supporting line, proposed for any headline: "Story bookcases styled by the community. Some come with a blueprint you can open and make your own." Search placeholder: "Search a bookcase, maker, or detail…".

## Tasks

- [ ] 🟥 **Step 0: Branch**
  - [ ] 🟥 On `cursor/cta-cleanup-plan-7dd0` (this plan). Implementation goes on the same branch once approved.

- [ ] 🟥 **Step 1: Randomize split pill**
  - [ ] 🟥 Wrap dice + settings in one container with a shared pale butter background, shared radius, thin divider
  - [ ] 🟥 Rolled state: dice half ink, settings half unchanged; rules-count badge readable in both states

- [ ] 🟥 **Step 2: Header**
  - [ ] 🟥 Remove "Share a room" from `Header` (drop the `openPublish` prop and its callers on Playroom + gallery)
  - [ ] 🟥 Rename "Room gallery" → "Gallery"

- [ ] 🟥 **Step 3: Playroom footers**
  - [ ] 🟥 Style tab: icon-only copy-link button + coral "Share your bookcase"
  - [ ] 🟥 Build tab: "Share build" → "Share your bookcase"

- [ ] 🟥 **Step 4: Remove Get inspired**
  - [ ] 🟥 Remove the button, `InspirationDrawer`, and its `useListBuilds` call from the Playroom
  - [ ] 🟥 Keep the "is in the gallery. See it" confirmation after publishing

- [ ] 🟥 **Step 5: Gallery + copy pass** (headline pending pick)
  - [ ] 🟥 Gallery: eyebrow, chosen headline, supporting line, search placeholder, hero + empty-state button → "Share your bookcase"
  - [ ] 🟥 Profile: empty state + "Share a room" buttons → "Share your bookcase"
  - [ ] 🟥 `PublishDialog` title/labels if they say "room"

- [ ] 🟥 **Step 6: Verify in browser**
  - [ ] 🟥 Desktop + mobile: header has 2 items on Playroom and gallery; Playroom has 1 coral CTA + copy icon; gallery has 1 share button
  - [ ] 🟥 Randomize reads as one paired control, quieter than before, idle and rolled
  - [ ] 🟥 Share opens the dialog with blueprint attached; copy-link copies a URL that reopens the same design
  - [ ] 🟥 Gallery and profile share buttons still open the dialog
