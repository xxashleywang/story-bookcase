// Cursor app identity: the simulated viewer for local development. Yours to edit; add-app-identity seeds this file once and never rewrites it.
// While neither CURSOR_APP_ID nor VERCEL is set, a request without the identity header reads as this viewer, with simulated: true and an empty token. Nothing verified it.
// This stays null so that path is signed out. A missing publish setting must not invent a person, and must not invent an administrator. Set a viewer here only on a machine you control, and do not set teamRole to "admin". Never write a real person's identity here.

import type { DevViewer } from "./identity.js";

export const DEV_VIEWER: DevViewer | null = null;
