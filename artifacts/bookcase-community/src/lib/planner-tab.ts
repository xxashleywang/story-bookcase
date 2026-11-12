/**
 * The Style it / Build it control is a path on the planner.
 * Build it is /build-it. Style it is /. Any other path stays Style it
 * so a stray call cannot invent a third tab.
 */
export type PlannerTab = 'style' | 'build';

function pathnameOf(path: string): string {
  const bare = path.split(/[?#]/)[0];
  if (bare.length > 1) return bare.replace(/\/+$/, '') || '/';
  return bare || '/';
}

/** Build it only when the path is exactly /build-it. Query and hash are ignored. */
export function plannerTabFromPath(path: string): PlannerTab {
  return pathnameOf(path) === '/build-it' ? 'build' : 'style';
}

export function plannerPathForTab(tab: PlannerTab): '/' | '/build-it' {
  return tab === 'build' ? '/build-it' : '/';
}

/** True only for the planner. Gallery, a single post, and profile are not. */
export function isPlannerPath(path: string): boolean {
  const pathname = pathnameOf(path);
  return pathname === '/' || pathname === '/build-it';
}

/**
 * Address for a tab, keeping the current query and design hash.
 * `base` is the app prefix without a trailing slash. Empty when the app is served at /.
 */
export function plannerAddress(base: string, tab: PlannerTab, search: string, hash: string): string {
  const prefix = base.replace(/\/$/, '');
  const path = plannerPathForTab(tab);
  const pathname = path === '/' ? `${prefix}/` : `${prefix}${path}`;
  return `${pathname}${search}${hash}`;
}
