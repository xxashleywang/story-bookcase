import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useClerk, useUser } from '@clerk/react';
import { Bookmark, ChevronDown, LoaderCircle, LogOut, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Build } from '@workspace/api-client-react';
import { getGetBuildQueryKey, useRemoveFavourite, useSaveFavourite } from '@workspace/api-client-react';
import { useDialogFocus } from '@/components/share-dialog';
import { isAccountAffectedKey, readSaveIntent, saveIntentHref } from '@/lib/account';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Refresh every public, private, detail and summary view that could show this change. */
export function refreshAccountViews(client: QueryClient) {
  return client.invalidateQueries({ predicate: (q) => isAccountAffectedKey(q.queryKey) });
}

/** Signs out after stopping and dropping every cached account response. */
export function useLogout() {
  const { signOut } = useClerk();
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const logout = async () => {
    if (pending) return;
    setPending(true); setFailed(false);
    await client.cancelQueries();
    client.clear();
    try { await signOut({ redirectUrl: `${basePath}/` }); }
    catch { setFailed(true); setPending(false); }
  };
  return { logout, pending, failed };
}

export function LogoutButton({ className = 'button light small' }: { className?: string }) {
  const { logout, pending, failed } = useLogout();
  return <span className="logout-wrap">
    <button type="button" className={className} onClick={logout} disabled={pending} data-testid="button-logout">
      {pending ? <LoaderCircle size={14} className="spin" /> : <LogOut size={14} />}{pending ? 'Logging out' : failed ? 'Retry log out' : 'Log out'}
    </button>
    {failed && <span className="logout-error" role="alert">Log out did not finish. Check your connection and retry.</span>}
  </span>;
}

export function AccountMenu() {
  const { user } = useUser();
  const { logout, pending, failed } = useLogout();
  const name = user?.firstName || user?.fullName || user?.username || 'Account';
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" className="button light small account-menu-trigger" data-testid="button-account-menu">
        <span>{name}</span><ChevronDown size={13} aria-hidden="true"/>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} collisionPadding={12} className="account-menu" aria-label="Account">
      <DropdownMenuItem asChild className="account-menu-item">
        <Link href="/profile"><UserRound size={16} aria-hidden="true"/>My profile</Link>
      </DropdownMenuItem>
      <DropdownMenuItem className="account-menu-item account-menu-logout" disabled={pending}
        onSelect={(event) => { event.preventDefault(); void logout(); }} data-testid="button-account-logout">
        {pending ? <LoaderCircle size={16} className="spin" aria-hidden="true"/> : <LogOut size={16} aria-hidden="true"/>}
        {pending ? 'Logging out…' : failed ? 'Retry log out' : 'Log out'}
      </DropdownMenuItem>
      {failed && <p className="account-menu-error" role="alert">Log out did not finish. Check your connection and retry.</p>}
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Save toggle for a room post. Never rendered inside a link. */
export function FavouriteButton({ build, variant = 'card' }: { build: Build; variant?: 'card' | 'detail' }) {
  const { isSignedIn, user } = useUser();
  const identity = isSignedIn ? user?.id ?? null : null;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const client = useQueryClient();
  const save = useSaveFavourite();
  const remove = useRemoveFavourite();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pop, setPop] = useState(0);
  const pressed = optimistic ?? !!build.isFavourite;
  const errorId = useId();
  const resumed = useRef(false);
  // Account switch: drop any in-flight pressed/pending/error state from the previous identity.
  useEffect(() => { setOptimistic(null); setBusy(false); setError(''); }, [identity]);

  const run = async (next: boolean) => {
    const startedAs = identityRef.current;
    const stale = () => identityRef.current !== startedAs;
    setBusy(true); setError(''); setOptimistic(next); setPop((n) => n + 1);
    try {
      if (next) await save.mutateAsync({ id: build.id }); else await remove.mutateAsync({ id: build.id });
      if (stale()) return;
      client.setQueryData<Build>(getGetBuildQueryKey(build.id), (old) => old ? { ...old, isFavourite: next } : old);
      await refreshAccountViews(client);
      if (stale()) return;
      setOptimistic(null);
    } catch {
      if (stale()) return;
      setOptimistic(null);
      setError(next ? 'Could not save. Try again.' : 'Could not remove. Try again.');
    } finally { if (!stale()) setBusy(false); }
  };
  const runRef = useRef(run);
  runRef.current = run;

  // Finish a save that started as a guest and went through sign-in.
  useEffect(() => {
    if (!isSignedIn || resumed.current || readSaveIntent(window.location.search) !== build.id) return;
    resumed.current = true;
    const params = new URLSearchParams(window.location.search);
    params.delete('save');
    const rest = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
    if (!build.isFavourite) void runRef.current(true);
  }, [isSignedIn, build.id, build.isFavourite]);

  const toggle = () => {
    if (busy) return;
    if (!isSignedIn) {
      window.location.assign(saveIntentHref(basePath, window.location.origin, window.location.pathname, window.location.search, window.location.hash, build.id));
      return;
    }
    void run(!pressed);
  };
  const label = pressed ? `Saved: remove "${build.title}" from favourites` : `Save "${build.title}" to favourites`;
  return <span className={`fav-wrap ${variant}`}>
    <button type="button" className={`fav-button ${variant} ${pressed ? 'on' : ''}`} aria-pressed={pressed} aria-label={variant === 'card' ? label : undefined}
      aria-describedby={error ? errorId : undefined} aria-busy={busy} onClick={toggle} data-testid={`button-favourite-${build.id}`}>
      <Bookmark key={pop} size={variant === 'card' ? 16 : 17} className={pop ? 'fav-pop' : ''} fill={pressed ? 'currentColor' : 'none'} aria-hidden="true" />
      {variant === 'detail' && <span>{pressed ? 'Saved to favourites' : isSignedIn ? 'Save to favourites' : 'Sign in to save'}</span>}
    </button>
    {error && <span className="fav-error" id={errorId} role="alert">{error}</span>}
  </span>;
}

/** Focused, accessible confirmation for destructive actions. Owns pending and error state. */
export function ConfirmDialog({ eyebrow, title, children, confirmLabel, pendingLabel, cancelLabel = 'Keep it', onConfirm, close }: {
  eyebrow: string; title: string; children: ReactNode; confirmLabel: string; pendingLabel: string; cancelLabel?: string;
  onConfirm: () => Promise<unknown>; close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId(), bodyId = useId();
  useDialogFocus(ref, close, busy);
  const confirm = async () => {
    setBusy(true); setError('');
    try { await onConfirm(); close(); }
    catch (e) {
      const data = (e as { data?: { error?: string } })?.data;
      setError(data?.error || 'That did not go through. Nothing was changed; try again.');
      setBusy(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
    <div ref={ref} className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} aria-busy={busy} tabIndex={-1}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 id={titleId}>{title}</h2>
      <div id={bodyId} className="confirm-body">{children}</div>
      {error && <p className="status error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button light" data-autofocus onClick={close} disabled={busy}>{cancelLabel}</button>
        <button type="button" className="button danger" onClick={confirm} disabled={busy} data-testid="button-confirm-destructive">
          {busy ? <><LoaderCircle size={15} className="spin" />{pendingLabel}</> : confirmLabel}
        </button>
      </div>
    </div>
  </div>;
}
