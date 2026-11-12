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
};

const signedOut: AccountState = { isLoaded: false, isSignedIn: false, user: null };
const AccountContext = createContext<AccountState>(signedOut);

export function CursorAccountProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccountState>(signedOut);
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
  return <AccountContext.Provider value={state}>{children}</AccountContext.Provider>;
}

export function useCursorAccount() {
  return useContext(AccountContext);
}
