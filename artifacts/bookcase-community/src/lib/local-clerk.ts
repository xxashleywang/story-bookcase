/** Local preview has no Clerk instance. Never derive a clerk.localhost key. */
export const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const clerkEnabled = !(isLocalHost && !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
