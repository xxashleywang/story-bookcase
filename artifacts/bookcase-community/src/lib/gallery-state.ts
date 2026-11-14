export type GalleryPhase = 'loading' | 'error' | 'posts' | 'empty';

/** Longer than the server read cap, so a finished empty list is not cut off and shown as a failure. */
export const GALLERY_LOAD_MS = 12_000;

/**
 * A pending read is still loading. A failed read is an error.
 * Zero posts is an empty gallery, including when the list is missing.
 */
export function galleryPhase(input: { pending: boolean; failed: boolean; count: number }): GalleryPhase {
  if (input.pending) return 'loading';
  if (input.failed) return 'error';
  return input.count > 0 ? 'posts' : 'empty';
}

export async function withGalleryDeadline<T>(
  parent: AbortSignal,
  run: (signal: AbortSignal) => Promise<T>,
  waitMs = GALLERY_LOAD_MS,
): Promise<T> {
  const controller = new AbortController();
  const onParent = () => controller.abort();
  const timer = setTimeout(() => controller.abort(), waitMs);
  if (parent.aborted) controller.abort();
  else parent.addEventListener('abort', onParent);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', onParent);
  }
}
