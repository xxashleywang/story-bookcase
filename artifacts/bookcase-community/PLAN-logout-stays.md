# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Log out currently leaves ImagineMōde and lands on `cursor.com` with `{"error":"Invalid navigation for logout request"}`. Log out should keep the person on the page they already have open. The header button then says **Log in**. Designing a bookcase stays free. Logging in is required only when they share or upload a photo.

## Scope
**In scope:**
- Cursor log out in `artifacts/bookcase-community/src/components/account-ui.tsx`: stay on the current page
- Header control in `artifacts/bookcase-community/src/App.tsx`: the signed-out label is `Log in`
- In-app signed-out state so the planner remains usable and the account menu is hidden
- Share / photo upload still asks them to log in, then returns to that share
- Unit test for the logout destination (it must not be Cursor's website)

**Out of scope:**
- Changing who can open the published app. It stays private. People who were never invited still cannot open the URL.
- A new login system. Log in uses the Cursor session that already opened the app.
- Gallery reads, favourites, and profile pages. Saving a favourite still asks for an account. The profile page still requires one.
- The security-review notes from the last publish (simulated admin viewer, upload body size, old API CORS)

**Do not touch:**
- `cursor/identity.ts` and `cursor/identity.dev.ts`
- `https://cursor.com/api/auth/logout` (do not navigate there)
- Playroom styling, shelf controls, copy-link, and print sheet
- App visibility

## Critical Decisions
- **Stay on the page.** The live failure is `useCursorLogout` sending the browser to `https://cursor.com/api/auth/logout` when the app still recognizes the viewer. Cursor rejects that navigation. Log out must not change the URL. The planner, including the design in the URL hash, stays put.
- **In-app sign-out, not a Cursor website sign-out.** This app is private, so ending the Cursor browser session makes the next load hit Cursor's gate and the planner disappears. Log out hides the account in this tab and blocks sharing. The gate session stays, which is why a refresh can still open the app. **Log in** shows the account menu again.
- **Login gates sharing, not designing.** Size, finish, shelves, copy link, and print sheet do not check an account. `Share your bookcase` (photo or attached blueprint) still goes through `useShareGate`. If they are only hidden by this in-app sign-out and the Cursor session is still there, logging in continues the share. It does not show the "open it from your Cursor link" page.
- **One header label.** The button that replaces the name menu says `Log in`, on the Cursor path and the Clerk path. Other sentences such as "Sign in to save" stay as they are.

## Tasks

- [ ] 🟥 **Step 0: Create feature branch**
  - [ ] 🟥 Branch off main: `cursor/logout-stays-on-page-652c`

- [ ] 🟥 **Step 1: Log out stays here**
  - [ ] 🟥 Remove the navigation to `cursor.com` and the full-page redirect home
  - [ ] 🟥 Remember an in-app signed-out state and clear cached account data without leaving the current URL
  - [ ] 🟥 Header shows `Log in` instead of the name menu

- [ ] 🟥 **Step 2: Log in restores the account**
  - [ ] 🟥 `Log in` clears the in-app signed-out state when the Cursor session is still present
  - [ ] 🟥 `Share your bookcase` while signed out this way logs them back in and opens the share, instead of the dead-end sign-in page

- [ ] 🟥 **Step 3: Checks**
  - [ ] 🟥 Update the logout-destination test so the published path never chooses Cursor's website
  - [ ] 🟥 In the browser: log out, confirm the planner is still on screen and the button says `Log in`, change a shelf with no login prompt, then confirm share asks to log in
