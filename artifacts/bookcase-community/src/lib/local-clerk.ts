/** Clerk is the account system on Replit. Cursor hosting signs people in itself, so this stays off unless the key is set. */
export const clerkConfigured = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
export const clerkEnabled = clerkConfigured;
