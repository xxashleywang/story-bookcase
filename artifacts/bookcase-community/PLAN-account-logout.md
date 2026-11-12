# Feature Implementation Plan

**Overall Progress:** `100%`

## TLDR
The account menu on the published app shows the Cursor name and only "My profile". Add "Log out" under it, using the same row the Clerk menu already has, and make it end the session.

## Scope
**In scope:**
- Cursor account menu in `artifacts/bookcase-community/src/components/account-ui.tsx`: "Log out" under "My profile"
- Shared menu markup so the Clerk menu and the Cursor menu stay the same two items
- `POST /api/session/logout` to expire the cookies this host actually received
- If that host still recognizes the viewer, send the browser to Cursor's own logout, which clears the Cursor web session
- Local preview: sign out of the simulated viewer only, and never call Cursor logout from localhost

**Out of scope:**
- A separate Log out button in the header or on the profile hero
- Settings, or any other account item
- Clerk's existing sign-out call
- Changing who can open the published app

**Do not touch:**
- Gallery, Playroom, or profile page layout
- `cursor/identity.ts`
- Cookie values: never log them, never send them back in a response body

## Critical Decisions
- **One menu, two items.** Product direction already says the name opens a dropdown with My profile and Log out. The Clerk menu does this. The published app uses Cursor sign-in, and that menu was missing Log out. Share one panel so they cannot drift.
- **Clear this host's cookies first.** The gate's session cookie, when the browser sends it, is expired by name only. A follow-up `GET /api/session` that returns 401 means the app no longer knows the viewer, so stay on the app home.
- **Cursor web logout is the fallback, not the first step.** `GET https://cursor.com/api/auth/logout` returns 303 and expires `WorkosCursorSessionToken`. Use it only when the app still returns the viewer after the cookie clear. That signs this browser out of Cursor, which is what the private app uses to know who you are.
- **Local preview must not hit that URL.** The dev server simulates a viewer and has no gate cookie. Log out there only hides that preview viewer until Sign in. A click on localhost must not end a real Cursor browser session.

## Tasks

- [x] 🟩 **Step 0: Create feature branch**
  - [x] 🟩 Branch: `cursor/account-menu-logout-652c`

- [x] 🟩 **Step 1: Account menu**
  - [x] 🟩 Render My profile and Log out from one panel for both Clerk and Cursor
  - [x] 🟩 Cursor Log out clears cached account data, then follows the destination rules above
  - [x] 🟩 Pending, retry, and error copy match the existing menu row

- [x] 🟩 **Step 2: Session logout**
  - [x] 🟩 `POST /api/session/logout` is same-origin only and expires received cookie names
  - [x] 🟩 Reject cookie names that are not a plain token, so a name cannot inject headers

- [x] 🟩 **Step 3: Local preview sign-out**
  - [x] 🟩 Remember a preview sign-out and show Sign in until it is cleared
  - [x] 🟩 Do not call `cursor.com` from a local host

- [x] 🟩 **Step 4: Checks**
  - [x] 🟩 Unit tests for cookie expiry and the logout destination
  - [x] 🟩 Open the menu in the browser and confirm Log out sits under My profile, then sign out and back in on the local preview
