import { getIdentity, requireIdentity } from "../../cursor/identity";
import { withSchema } from "../lib/db";
import * as gallery from "./gallery";
import { expiredSessionCookies } from "./session-cookies";

const PRIVATE = { "cache-control": "private, no-store" };

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE });
}

function isResult(value: unknown): value is { status: number; error: string } {
  return Boolean(value && typeof value === "object" && "status" in value && "error" in value);
}

function send(value: unknown, status = 200) {
  if (isResult(value)) return json({ error: value.error }, value.status);
  if (value && typeof value === "object" && "ok" in value) return new Response(null, { status: 204, headers: PRIVATE });
  return json(value, status);
}

function allowsMutation(request: Request, kind: string) {
  if (kind === "key") return true;
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function withViewer(request: Request, mutation: boolean, run: (viewer: gallery.Viewer) => Promise<Response>) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (mutation && !allowsMutation(request, identity.kind)) return json({ error: "That request was blocked." }, 403);
  const viewer: gallery.Viewer = { id: identity.sub, name: identity.name, kind: identity.kind };
  return withSchema(identity.stage, () => run(viewer));
}

/** Gallery browsing. A signed-in viewer still gets their own hearts and ownership; a guest can look. */
async function withGuest(request: Request, run: (viewer: gallery.Viewer) => Promise<Response>) {
  const identity = await getIdentity(request);
  const viewer: gallery.Viewer = identity.verified
    ? { id: identity.sub, name: identity.name, kind: identity.kind }
    : { id: "", name: "", kind: "person" };
  const stage = identity.verified ? identity.stage : "production";
  return withSchema(stage, () => run(viewer));
}

function integerId(raw: string | undefined) {
  if (!raw || !/^[1-9][0-9]{0,8}$/.test(raw)) return null;
  return Number(raw);
}

function cursorOf(search: URLSearchParams) {
  const raw = search.get("cursor");
  if (!raw) return null;
  return integerId(raw);
}

async function readJson(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 100_000) return null;
  const text = await request.text();
  if (text.length > 100_000) return null;
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export async function dispatch(method: string, request: Request, path: string[]): Promise<Response> {
  const url = new URL(request.url);
  const key = `${method} ${path.join("/")}`;

  if (key === "GET healthz") return json({ status: "ok" });

  if (key === "GET session") {
    const identity = await getIdentity(request);
    if (!identity.verified) return json({ error: "Sign in required." }, 401);
    const name = identity.name.trim() || "Account";
    return json({ id: identity.sub, name, firstName: name.split(/\s+/)[0] || name });
  }

  if (key === "POST session/logout") {
    if (!allowsMutation(request, "person")) return json({ error: "That request was blocked." }, 403);
    const headers = new Headers(PRIVATE);
    for (const cookie of expiredSessionCookies(request.headers.get("cookie") ?? "")) {
      headers.append("set-cookie", cookie);
    }
    return new Response(null, { status: 204, headers });
  }

  if (key === "GET community/summary") {
    return withGuest(request, async () => send(await gallery.communitySummary()));
  }

  if (key === "GET builds") {
    return withGuest(request, async (viewer) => send(await gallery.listBuilds(viewer, url.searchParams)));
  }

  if (key === "POST builds") {
    const body = await readJson(request);
    if (!body) return json({ error: "Check the build details and photos." }, 400);
    return withViewer(request, true, async (viewer) => send(await gallery.createBuild(viewer, body), 201));
  }

  if (path[0] === "builds" && path.length === 2 && (method === "GET" || method === "PATCH" || method === "DELETE")) {
    const id = integerId(path[1]);
    if (!id) return json({ error: "Invalid build id." }, 400);
    if (method === "GET") return withGuest(request, async (viewer) => send(await gallery.getBuild(viewer, id)));
    if (method === "DELETE") return withViewer(request, true, async (viewer) => send(await gallery.deleteBuild(viewer, id)));
    const body = await readJson(request);
    if (!body) return json({ error: "Invalid build update." }, 400);
    return withViewer(request, true, async (viewer) => send(await gallery.updateBuild(viewer, id, body)));
  }

  if (path[0] === "builds" && path[2] === "favourite" && path.length === 3 && (method === "PUT" || method === "DELETE")) {
    const id = integerId(path[1]);
    if (!id) return json({ error: "Invalid post." }, 400);
    return withViewer(request, true, async (viewer) => send(
      method === "PUT" ? await gallery.saveFavourite(viewer, id) : await gallery.removeFavourite(viewer, id),
    ));
  }

  if (key === "GET profiles/me") return withViewer(request, false, async (viewer) => send(await gallery.getProfile(viewer)));
  if (key === "PATCH profiles/me") {
    const body = await readJson(request);
    if (!body || typeof body.username !== "string") return json({ error: "Usernames must be 3–24 characters and include at least one letter or number." }, 400);
    return withViewer(request, true, async (viewer) => send(await gallery.saveUsername(viewer, body.username as string)));
  }
  if (key === "GET profiles/username-availability") {
    return withViewer(request, false, async () => send(await gallery.usernameAvailable(url.searchParams.get("username") ?? "")));
  }
  if (key === "GET profiles/me/builds" || key === "GET profiles/me/favourites") {
    const cursor = cursorOf(url.searchParams);
    if (url.searchParams.get("cursor") && !cursor) return json({ error: "Invalid page cursor." }, 400);
    const kind = path[2] === "favourites" ? "favourites" : "uploads";
    return withViewer(request, false, async (viewer) => send(
      kind === "favourites" ? await gallery.listMyFavourites(viewer, cursor) : await gallery.listMyBuilds(viewer, cursor),
    ));
  }
  if (key === "POST profiles/me/photo-cleanup") {
    return withViewer(request, true, async (viewer) => send(await gallery.retryPhotoCleanup(viewer)));
  }

  if (key === "POST storage/uploads/request-url") {
    const body = await readJson(request);
    if (!body) return json({ error: "Missing or invalid required fields" }, 400);
    return withViewer(request, true, async (viewer) => send(await gallery.requestUpload(viewer, body)));
  }

  if (method === "PUT" && path[0] === "storage" && path[1] === "uploads" && path[2] === "raw" && path.length === 4) {
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 12_000_000) return json({ error: "That photo is larger than 12 MB." }, 413);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > 12_000_000) return json({ error: "That photo is larger than 12 MB." }, 413);
    const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    return withViewer(request, true, async (viewer) => send(await gallery.storeUpload(viewer, path[3], type, bytes)));
  }

  if (method === "GET" && path[0] === "storage" && path[1] === "objects" && path[2] === "uploads" && path.length === 4) {
    return withGuest(request, async (viewer) => {
      const photo = await gallery.readPhoto(viewer, path[3]);
      if ("error" in photo) return json({ error: photo.error }, photo.status);
      const bytes = Buffer.from(photo.body);
      return new Response(bytes, {
        headers: {
          ...PRIVATE,
          "content-type": photo.contentType,
          "x-content-type-options": "nosniff",
        },
      });
    });
  }

  return json({ error: "Not found." }, 404);
}
