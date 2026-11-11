# Feature Implementation Plan

**Overall Progress:** `100%`

## TLDR
Lock the ImagineMōde logo mockup to **Concept 3 (Build-Once Blocks I)** and set **all type** — page chrome, brand name, and tagline — in **Clash Display**.

## Scope
**In scope:** `artifacts/imaginemode-logo-mockups/index.html` (and its PNG preview)
**Out of scope:** app prototypes, other brand names, buying/embedding Blubird
**Do not touch:** `prototypes/**`, unrelated artifacts

## Critical Decisions
- Decision 1: Clash Display only — drop the 5-font comparison now that a typeface is chosen
- Decision 2: Load all 6 Clash Display weights (Extralight–Bold) so the page can show a small weight range
- Decision 3: Keep Concept 3 mark, tagline “Design it first. Build it once.”, coral/cream vibe
- Decision 4: No fake italic if Clash Display has no italic files — use a lighter weight for the tagline
- Decision 5: Stay on existing branch `cursor/imaginemode-logo-mockups-bbc5`

## Tasks

- [ ] 🟩 **Step 0: Confirm branch**
  - [ ] 🟩 Already on `cursor/imaginemode-logo-mockups-bbc5`

- [x] 🟩 **Step 1: Load Clash Display (6 weights)**
  - [x] 🟩 Remove Bricolage / Cabinet / Satoshi / Space Grotesk / IBM Plex Mono font links
  - [x] 🟩 Load Clash Display 200–700 from Fontshare

- [x] 🟩 **Step 2: Apply Clash Display to every text role**
  - [x] 🟩 Page title, labels, notes, meta
  - [x] 🟩 Brand name `ImagineMōde`
  - [x] 🟩 Tagline `Design it first. Build it once.`

- [x] 🟩 **Step 3: Rebuild page as Concept 3 + Clash Display kit**
  - [x] 🟩 Primary / mono / on-dark / small icons
  - [x] 🟩 Optional 6-weight wordmark row

- [x] 🟩 **Step 4: Preview, commit, push**
  - [x] 🟩 Refresh PNG + localhost HTML
  - [x] 🟩 Commit, push, update PR
