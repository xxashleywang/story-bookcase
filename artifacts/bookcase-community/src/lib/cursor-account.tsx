import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export type CursorAccountUser = {
  id: string;
  firstName: string;
  fullName: string;
  username: null;
};

type AccountState = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: CursorAccountUser | null;
  /** True only after Log out on a local preview. The published app never sets this. */
  previewSignedOut: boolean;
  /** Brings the simulated local viewer back. No-op for a real Cursor session. */
  resumePreview: () => void;
};

const PREVIEW_SIGNOUT_KEY = 'twistory:preview-signed-out';
const noop = () => {};

export function isLocalAccountPreview() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
}

export function markPreviewSignedOut() {
  try { window.sessionStorage.setItem(PREVIEW_SIGNOUT_KEY, '1'); } catch { /* ignore */ }
}

export function clearPreviewSignedOut() {
  try { window.sessionStorage.removeItem(PREVIEW_SIGNOUT_KEY); } catch { /* ignore */ }
}

function readPreviewSignedOut() {
  if (!isLocalAccountPreview()) return false;
  try { return window.sessionStorage.getItem(PREVIEW_SIGNOUT_KEY) === '1'; } catch { return false; }
}

const signedOut: AccountState = { isLoaded: false, isSignedIn: false, user: null, previewSignedOut: false, resumePreview: noop };
const AccountContext = createContext<AccountState>(signedOut);

export function CursorAccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AccountState, 'previewSignedOut' | 'resumePreview'>>(signedOut);
  const [previewSignedOut, setPreviewSignedOut] = useState(readPreviewSignedOut);
  const resumePreview = () => {
    clearPreviewSignedOut();
    setPreviewSignedOut(false);
  };
  useEffect(() => {
    let cancel = false;
    fetch('/api/session', { headers: { accept: 'application/json' }, cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { id?: unknown; name?: unknown; firstName?: unknown } | null) => {
        if (cancel) return;
        if (!data || typeof data.id !== 'string' || !data.id) {
          setState({ isLoaded: true, isSignedIn: false, user: null });
          return;
        }
        const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Account';
        const firstName = typeof data.firstName === 'string' && data.firstName.trim() ? data.firstName.trim() : name;
        setState({ isLoaded: true, isSignedIn: true, user: { id: data.id, firstName, fullName: name, username: null } });
      })
      .catch(() => { if (!cancel) setState({ isLoaded: true, isSignedIn: false, user: null }); });
    return () => { cancel = true; };
  }, []);
  const shown: AccountState = previewSignedOut
    ? { isLoaded: true, isSignedIn: false, user: null, previewSignedOut: true, resumePreview }
    : { ...state, previewSignedOut: false, resumePreview };
  return <AccountContext.Provider value={shown}>{children}</AccountContext.Provider>;
}

export function useCursorAccount() {
  return useContext(AccountContext);
}
