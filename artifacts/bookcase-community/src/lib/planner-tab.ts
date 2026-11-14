/**
 * The Style it / Build it control is a path on the planner.
 * Build it is /build-it. Style it is /. A shared design is /d/<code> on either tab.
 * Any other path stays Style it so a stray call cannot invent a third tab.
 */
import { encodeDesign, formatPlannerPath, legacyConfigFromHash, parsePlannerPath, referenceIdFromSearch } from './design-url.ts';
import type { PlannerLocation } from './design-url.ts';

export type PlannerTab = 'style' | 'build';

function pathnameOf(path: string): string {
  const bare = path.split(/[?#]/)[0];
  if (bare.length > 1) return bare.replace(/\/+$/, '') || '/';
  return bare || '/';
}

function relativeToBase(pathname: string, base: string) {
  const prefix = base.replace(/\/$/, '');
  const path = pathnameOf(pathname);
  if (!prefix) return path || '/';
  if (path === prefix) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || '/';
  return path;
}

function withoutKeys(search: string, keys: string[]) {
  const params = new URLSearchParams(search);
  for (const key of keys) params.delete(key);
  const next = params.toString();
  return next ? `?${next}` : '';
}

/** Build it when the path is /build-it or a design saved on that tab. Query and hash are ignored. */
export function plannerTabFromPath(path: string): PlannerTab {
  return parsePlannerPath(path)?.tab ?? 'style';
}

export function plannerPathForTab(tab: PlannerTab): '/' | '/build-it' {
  return tab === 'build' ? '/build-it' : '/';
}

/** True only for the planner, including a short design link or a photo reference. Gallery and profile are not. */
export function isPlannerPath(path: string): boolean {
  return parsePlannerPath(path) !== null;
}

/**
 * Address for a tab. A design stays in the path as /d/<code>, and a photo reference stays as /from/<id>.
 * An old design hash is folded into that short path. `base` is the app prefix without a trailing slash.
 */
export function plannerAddress(base: string, tab: PlannerTab, pathname: string, search: string, hash: string): string {
  const relative = relativeToBase(pathname, base);
  const parsed: PlannerLocation = parsePlannerPath(relative) ?? { tab: 'style', code: null, referenceId: null, share: false };
  const legacy = legacyConfigFromHash(hash);
  const code = parsed.code ?? (legacy ? encodeDesign(legacy) : null);
  const next = formatPlannerPath({
    tab,
    code,
    referenceId: parsed.referenceId ?? referenceIdFromSearch(search),
    share: false,
  });
  const prefix = base.replace(/\/$/, '');
  const path = next === '/' ? `${prefix}/` : `${prefix}${next}`;
  const cleaned = withoutKeys(search, ['ref', 'share']);
  const leftover = code ? '' : (legacy ? `#${legacy}` : '');
  return `${path}${cleaned}${leftover}`;
}
