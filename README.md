# Twistory

## Current application

The current React application is in `artifacts/bookcase-community`, backed by
`artifacts/api-server`. It includes the bookcase configurator, custom color
pickers, community builds, Clerk sign-in, member profiles, and photo uploads
through Replit App Storage. The original static prototypes below are preserved
for reference; their feature descriptions apply to those prototypes.

### Development and checks

- Use Node.js 24 and pnpm, then run `pnpm install --frozen-lockfile`.
- `pnpm run typecheck` checks the workspace.
- `PORT=5000 BASE_PATH=/ pnpm run build` checks types and builds all applications.
  The Vite configurations require both variables even during a build; Replit
  supplies each service's port and base path when running managed workflows.
- Run the existing Replit workflows for the web app and API. Outside those
  workflows, configure their ports, base paths, and routing before starting the
  corresponding package's `dev` script.
- Authentication, database access, and uploads require environment configuration
  in the host's secret manager. Never commit credentials or `.env` files.
  Uploaded photos and live database records are not stored in this repository.

Fresh designs start with the **Pinwheel** arrangement in the Front view.
Opening a shared room link preserves its saved arrangement. On loading, shelves
gently twist into place from bottom to top in a single, roughly 0.9-second
entrance. The animation respects reduced-motion settings, stops on model
interaction, and does not change shelf directions or assembly progress.

See [CHANGELOG.md](CHANGELOG.md) for recent changes, the full-project synchronization scope,
history preservation, and validation results.

## Original Playroom prototype

Plan a [Herman Miller Story bookcase](https://store.hermanmiller.com/furniture-shelving-storage-bookcases/story-bookcase/2197172.html) before you assemble it: pick height and finish, paint the wall, choose a floor, twist each shelf, then tick shelves off as you build.

**Chosen direction:** [Playroom](prototypes/v3/g-playroom.html) · [live](https://xxashleywang.github.io/story-bookcase/prototypes/v3/g-playroom.html)

Open it locally by serving the `prototypes` folder, then visit `/v3/g-playroom.html`. A shareable design lives in the URL hash (size, color, shelf directions).

## What you can do in Playroom

- Style Standard (9 shelves) or Tall (11 shelves) in the current Herman Miller finishes, or a custom preview color
- Paint the wall and pick a laminate or carpet floor (including mix-your-own color)
- Start from a named pattern, or **Randomize** with optional rules (block a direction, no two neighbours alike)
- Fine-tune one shelf at a time by clicking it on the 3D model
- Switch to **Build it** to tick shelves off; unbuilt shelves show as dashed outlines so you can see the bone structure
- Browse starter looks under **Get inspired** (community uploads are not wired up yet)

## Other prototypes

Earlier explorations still open from these indexes. They share the same link format, so a design copied from one opens in another.

- [Round 1](prototypes/index.html) — Compass, Blueprint, Catalog, Pocket, Studio
- [Round 2](prototypes/v2/index.html) — Showroom, Spotlight, In the room, Bento
- [Round 3](prototypes/v3/index.html) — Gallery, Workshop, Playroom

## What's next

See [prototypes/BACKLOG.md](prototypes/BACKLOG.md) for parked ideas (community gallery, photo uploads, marketplace wishlist) and [prototypes/v3/PLAN-finetune-and-randomize.md](prototypes/v3/PLAN-finetune-and-randomize.md) for the remaining Fine-tune discoverability work.
