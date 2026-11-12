/** JSON mutations stay small. Photos stop at the same 12 MB the upload route already advertised. */
export const JSON_BODY_LIMIT = 100_000;
export const PHOTO_BODY_LIMIT = 12_000_000;

function declaredLength(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw === null || raw.trim() === "") return null;
  if (!/^\d+$/.test(raw.trim())) return Number.NaN;
  return Number(raw);
}

/**
 * Read at most `limit` bytes. A missing Content-Length is not treated as zero:
 * chunked requests omit it, and the previous check then buffered the whole body.
 * Returns null when the declared or actual size is over the limit, and cancels
 * the rest of the stream so it is not buffered.
 */
export async function readBounded(request: Request, limit: number): Promise<Uint8Array | null> {
  const declared = declaredLength(request);
  if (declared !== null && (!Number.isFinite(declared) || declared > limit)) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Object JSON only, capped at JSON_BODY_LIMIT. Empty means {}. Oversize and invalid JSON are null. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  const bytes = await readBounded(request, JSON_BODY_LIMIT);
  if (!bytes) return null;
  if (bytes.byteLength === 0) return {};
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
