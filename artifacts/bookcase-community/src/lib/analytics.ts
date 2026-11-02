type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: { track(name: string, data?: AnalyticsData): void | Promise<unknown> };
  }
}

/** Optional published-app analytics must never interrupt the app. */
export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    const result = window.umami?.track(name, data);
    if (result) void Promise.resolve(result).catch(() => {});
  } catch { /* Analytics is best effort, including when blocked by the browser. */ }
}

export type InspirationHandoff = 'blueprint_detail' | 'blueprint_drawer' | 'reference_detail' | 'reference_drawer';
const HANDOFF_PARAM = 'inspiration';

/** Only a fixed source label crosses navigation; no user content or identifiers. */
export function inspirationHref(href: string, handoff: InspirationHandoff): string {
  const url = new URL(href, window.location.origin);
  url.searchParams.set(HANDOFF_PARAM, handoff);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Called by the destination only after the blueprint/reference is ready.
 * Removing the marker first avoids duplicate counts on rerenders and reloads.
 */
export function completeInspirationHandoff(kind: 'blueprint' | 'reference'): void {
  const url = new URL(window.location.href);
  const handoff = url.searchParams.get(HANDOFF_PARAM);
  if (handoff !== `${kind}_detail` && handoff !== `${kind}_drawer`) return;
  url.searchParams.delete(HANDOFF_PARAM);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  trackEvent(kind === 'blueprint' ? 'blueprint_used' : 'inspiration_reference_opened', {
    source: handoff.endsWith('_detail') ? 'room_detail' : 'inspiration_drawer',
    type: kind === 'blueprint' ? 'blueprint_backed' : 'photo_only',
  });
}
