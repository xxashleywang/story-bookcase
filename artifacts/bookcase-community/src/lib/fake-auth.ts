export const FAKE_AUTH_NAME = 'Ashley';
const STORAGE_KEY = 'twistory:fake-auth';

export function fakeAuthAllowed(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Query param wins. Missing param keeps the stored flag. Off-loopback is always off. */
export function resolveFakeAuth(search: string, stored: boolean, allowed: boolean) {
  if (!allowed) return false;
  const raw = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('fakeAuth');
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return stored;
}

export function isFakeAuthOn() {
  if (typeof window === 'undefined' || !fakeAuthAllowed(window.location.hostname)) return false;
  try { return window.sessionStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

function persistFakeAuth(on: boolean) {
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, '1');
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

function storedFakeAuth() {
  try { return window.sessionStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

/** Read ?fakeAuth=, persist it, and strip the param so it does not leak into share links. */
export function consumeFakeAuth() {
  if (typeof window === 'undefined' || !fakeAuthAllowed(window.location.hostname)) return false;
  const on = resolveFakeAuth(window.location.search, storedFakeAuth(), true);
  persistFakeAuth(on);
  if (new URLSearchParams(window.location.search).has('fakeAuth')) {
    const params = new URLSearchParams(window.location.search);
    params.delete('fakeAuth');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }
  return on;
}

export function clearFakeAuth() {
  persistFakeAuth(false);
}
