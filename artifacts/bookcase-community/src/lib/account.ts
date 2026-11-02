/** Pure helpers for the private profile area. Kept framework-free so they can be unit tested. */

type Key = readonly unknown[];

/** Every cache that can show a post, a save state, a username or a count. */
export function isAccountAffectedKey(key: Key) {
  const head = key[0];
  if (typeof head !== 'string') return false;
  return head.startsWith('/api/builds') || head.startsWith('/api/profiles/me') || head.startsWith('/api/community');
}

/** Private lists are keyed by identity so one account can never read another's cached page. */
export function privateListKey(base: Key, userId: string | null) {
  return [...base, { identity: userId ?? 'signed-out' }];
}

/** Sign-in URL that comes back to the same place with a pending save. */
export function saveIntentHref(basePath: string, origin: string, pathname: string, search: string, hash: string, buildId: number) {
  const params = new URLSearchParams(search);
  params.set('save', String(buildId));
  const back = `${origin}${pathname}?${params.toString()}${hash}`;
  return `${basePath}/sign-in?redirect_url=${encodeURIComponent(back)}`;
}

export function readSaveIntent(search: string) {
  const raw = new URLSearchParams(search).get('save');
  const id = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  return id && id > 0 ? id : null;
}

/** Photo removal plan for the edit dialog. */
export function photoRemovalPlan(existing: string[], removed: string[]) {
  const remaining = existing.filter((p) => !removed.includes(p));
  return { remaining, removesLast: existing.length > 0 && remaining.length === 0 };
}

export function cleanupMessage(pending: number) {
  if (pending <= 0) return '';
  return `${pending} deleted ${pending === 1 ? 'photo is' : 'photos are'} still waiting to be cleared from storage.`;
}
