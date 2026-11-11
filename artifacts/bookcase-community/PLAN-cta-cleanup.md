# Playroom CTA cleanup + muted Randomize — Implementation Plan

**Overall Progress:** `0%`

## TLDR
The Playroom (`artifacts/bookcase-community/src/App.tsx`) shows six buttons around the configurator, and three of them do overlapping things. The Randomize chip is also louder than the rest of the pane. This plan:

1. Mutes Randomize so it sits with the other arrangement chips.
2. Cuts the six buttons down to three, with one clear primary action.
3. Renames "room" to "bookcase" wherever we mean the community gallery or sharing, since V1 is only the Story bookcase.

## What each button does today (from the code)
| Button | Where | What it actually does |
|---|---|---|
| Room gallery | Header | Goes to `/inspiration`, the community feed of shared builds |
| Share a room | Header | Opens `PublishDialog` with "attach blueprint" **off** (photo-first post). Needs sign-in + username |
| Sign in | Header | Sign-in page |
| Copy room link | Bottom of Style tab | Copies the current URL. The design lives in the URL hash, so the link reopens this exact bookcase. Private, nothing is posted, no sign-in |
| Share your build | Bottom of Style tab | Opens the **same** `PublishDialog`, with "attach blueprint" **on**. Needs sign-in + username |
| Get inspired | Below the Playroom | Opens a drawer with the 8 newest community builds and "use this look". Same data as the gallery |

So: "Share a room" and "Share your build" are one dialog with a different checkbox default. "Get inspired" and "Room gallery" are two doors into the same community feed. "Copy room link" is genuinely different (private, no account), but its label doesn't say that.

## Scope
**In scope:**
- Randomize + rules chip styling (`.pattern.random` in `src/index.css`)
- Playroom header, Style-tab footer, Build-tab footer, and the "Get inspired" row in `src/App.tsx`
- Copy on the gallery page, profile page and share dialog where "room" means a shared bookcase

**Out of scope:**
- Multi-furniture support or gallery categories (future)
- Redesigning `PublishDialog` beyond its title/labels
- Gallery page layout, search, sorting
- Sign-in / account flow

**Do not touch:**
- "Room design" section (wall + floor really is the room)
- URL hash encoding of the scene
- `useShareGate` sign-in/username gating
- API, DB schema, `/inspiration` route path (keeps existing links working)

## Critical Decisions
- **Randomize matches the preset chips.** Default background becomes `var(--cream)` like the other chips, with only the dice icon to set it apart. Active/rolled state becomes `var(--ink)` like an active preset, instead of coral. The rules chip follows the same styling.
- **One primary CTA: "Share your bookcase".** The only coral button in the Playroom. Opens `PublishDialog` with blueprint attached (today's "Share your build" behaviour). Photo is still optional inside the dialog, so the header "Share a room" button is removed from the Playroom.
- **Copy link is demoted, not deleted.** It's the only no-account way to save or send a design. It becomes a quiet icon button (link icon, tooltip/aria-label "Copy link to this design") next to the primary CTA. The `window.alert` stays as-is (out of scope).
- **One way into the community: the header "Gallery" link.** The "Get inspired" button and drawer are removed from the Playroom. Gallery detail pages already let people open a blueprint in the Playroom, so "use this look" isn't lost.
- **Header becomes two items:** "Gallery" (light) and "Sign in" / account menu. On the gallery page itself, its own hero "Share your bookcase" button stays and the header share button goes away too, for consistency.
- **Result:** Playroom goes from 6 buttons to 3 (Gallery, Sign in, Share your bookcase) plus one icon button, with a single coral action.

## Open questions for Ashley
1. OK to drop **Get inspired** entirely, or keep it as the gallery's entry point (and drop the header link instead)?
2. Header label: **"Gallery"** or **"Bookcase gallery"**? (Shorter fits mobile better.)
3. Gallery hero headline "Rooms people actually live in." → proposed **"Bookcases people actually live with."** Keep, or suggest another?

## Tasks

- [ ] 🟥 **Step 0: Branch**
  - [ ] 🟥 On `cursor/cta-cleanup-plan-7dd0` (this plan). Implementation goes on the same branch once approved.

- [ ] 🟥 **Step 1: Mute Randomize**
  - [ ] 🟥 `.pattern.random` → cream background; `.pattern.random.active` → ink, matching `.pattern.active`
  - [ ] 🟥 Check the rules-count badge is still readable in both states

- [ ] 🟥 **Step 2: Header**
  - [ ] 🟥 Remove "Share a room" from `Header` (drop the `openPublish` prop and its callers)
  - [ ] 🟥 Rename "Room gallery" → "Gallery" (pending Q2)

- [ ] 🟥 **Step 3: Style-tab footer**
  - [ ] 🟥 Replace the two buttons with: icon-only copy-link button + coral "Share your bookcase"
  - [ ] 🟥 Build-tab "Share build" → "Share your bookcase" for the same label everywhere

- [ ] 🟥 **Step 4: Remove Get inspired** (pending Q1)
  - [ ] 🟥 Remove the button row, `InspirationDrawer`, and its `useListBuilds` call from the Playroom
  - [ ] 🟥 Keep the "is in the gallery. See it" confirmation after publishing

- [ ] 🟥 **Step 5: Copy pass, "room" → "bookcase"**
  - [ ] 🟥 Gallery hero, eyebrow, empty states, search placeholder, "Share your room" buttons
  - [ ] 🟥 Profile empty state + profile "Share a room" buttons
  - [ ] 🟥 `PublishDialog` title/labels if they say "room"

- [ ] 🟥 **Step 6: Verify in browser**
  - [ ] 🟥 Desktop + mobile width: header has 2 items, Style tab has 1 coral CTA + copy icon
  - [ ] 🟥 Randomize: idle and rolled states look like the preset chips
  - [ ] 🟥 Share opens the dialog with blueprint attached; copy-link copies a URL that reopens the same design
  - [ ] 🟥 Gallery and profile pages still open the share dialog
