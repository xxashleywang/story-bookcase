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
  /** Real viewer id. Kept while the account is hidden so the planner does not remount. */
  viewerId: string | null;
  /** True after Log out. The Cursor gate session is still there; the account is only hidden. */
  signedOutInApp: boolean;
  /** Shows the account menu again. Does not leave the page. */
  resumeSession: () => void;
  /** Hides the account on this page. Does not leave the page or end the Cursor session. */
  signOutInApp: () => void;
};

const SIGNOUT_KEY = 'twistory:signed-out';
const noop = () => {};

function rememberSignedOut() {
  try { window.sessionStorage.setItem(SIGNOUT_KEY, '1'); } catch { /* ignore */ }
}

function forgetSignedOut() {
  try { window.sessionStorage.removeItem(SIGNOUT_KEY); } catch { /* ignore */ }
}

function readSignedOut() {
  try { return window.sessionStorage.getItem(SIGNOUT_KEY) === '1'; } catch { return false; }
}

const signedOut: AccountState = {
  isLoaded: false, isSignedIn: false, user: null, viewerId: null, signedOutInApp: false,
  resumeSession: noop, signOutInApp: noop,
};
const AccountContext = createContext<AccountState>(signedOut);

export function CursorAccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Pick<AccountState, 'isLoaded' | 'isSignedIn' | 'user'>>(signedOut);
  const [hidden, setHidden] = useState(readSignedOut);
  const resumeSession = () => { forgetSignedOut(); setHidden(false); };
  const signOutInApp = () => { rememberSignedOut(); setHidden(true); };
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
  const sessionPresent = state.isLoaded && state.isSignedIn;
  const shown: AccountState = {
    isLoaded: state.isLoaded,
    isSignedIn: hidden ? false : state.isSignedIn,
    user: hidden ? null : state.user,
    viewerId: state.user?.id ?? null,
    signedOutInApp: hidden && sessionPresent,
    resumeSession,
    signOutInApp,
  };
  return <AccountContext.Provider value={shown}>{children}</AccountContext.Provider>;
}

export function useCursorAccount() {
  return useContext(AccountContext);
}
