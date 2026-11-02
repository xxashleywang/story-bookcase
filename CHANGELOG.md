# Project changes

## 2026-11-01 — Photo-first gallery sync and Avisven logo concepts

- Brought over the finished Replit community work that had not been committed:
  photo-only room posts, optional blueprints, favourites, account menu,
  photo edit/delete with a retry queue, and optional analytics events.
- Added [#10 Avisven logo concept gallery](prototypes/inspiration/10-avisven-logo-gallery.html).

## 2026-10-31 — Pinwheel default and purposeful loading motion

- Fresh designs now start with **Pinwheel**, using the prototype's `pairs`
  preset. Saved room links continue to load their encoded arrangements.
- Assembly-progress initialization uses the same initial scene as the model,
  so progress stays associated with the correct design.
- Retained the short, bottom-to-top shelf entrance: a gentle twist and lift
  illustrates how shelves stack around the pole, then stops after about 0.9 seconds.
  Model interaction interrupts the entrance; reduced-motion settings skip it.
- Removed continuous model rotation and decorative logo/stamp loops.
- Preserved the merged editing improvements: Front camera by default, clearer
  shelf selection, plain-language pattern controls, and keyboard shelf editing.
- Updated the README and product direction to reflect Pinwheel as the default.
- Validation: full workspace typecheck/build passed with
  `PORT=5000 BASE_PATH=/ pnpm run build`; all 17 existing renderer/keyboard tests
  passed; a fresh-load preview confirmed Pinwheel is selected.

## Full application synchronization

This synchronization adds the complete Replit application, not just the
authentication and photo-storage features.

### Included

- React bookcase configurator and community UI, styling, icons, and public assets.
- Custom finish, wall, and floor color pickers, floor textures, shelf patterns,
  room links, and assembly-progress controls.
- Clerk authentication, username/profile management, and community build
  creation, editing, deletion, browsing, and filtering.
- Photo upload reservations, signed upload URLs, object serving, and
  public/private object access policies.
- Express API routes and middleware, OpenAPI contracts, generated React API
  clients and Zod schemas, and Drizzle database schema source.
- All workspace packages, dependency manifests, pnpm lockfile, TypeScript and
  Vite configuration, Replit artifact configuration, scripts, and component
  preview source.

### History and publication

- The workspace and original GitHub repository began with independent histories.
  They are joined by an explicit merge without rewriting either history.
- The original GitHub `prototypes/` directory and documentation are retained.
  The current application also keeps its own reference copy of the prototype
  renderer under `artifacts/bookcase-community/reference/`.
- Existing Replit backup remotes are unchanged. A separate credential-free
  `github` remote targets `https://github.com/xxashleywang/story-bookcase.git`.
- Publication is through a new synchronization branch and pull request rather
  than a forced update of the default branch.
- The working tree was clean when synchronization started. All existing local
  application commits are included; no feature subset was selected.

### Safety and validation

- A credential-pattern and sensitive-filename scan of all local application
  history found no matches. This is a targeted publication check, not a full
  application security audit.
- Credentials, environment files, dependencies, build outputs, private uploads,
  and live database records are not part of this publication. Existing ignore
  rules are combined, including GitHub's environment-file and log exclusions.
- `pnpm run typecheck`: passed.
- Plain `pnpm run build` initially stopped because the shell did not supply
  `PORT`; supplying only `PORT` then exposed the required `BASE_PATH`.
- `PORT=5000 BASE_PATH=/ pnpm run build`: passed for the full workspace,
  including the API server, web app, and component preview.
- These checks confirm compilation, not live sign-in, uploads, or database
  operations. No application deployment, schema push, or data migration was run.
