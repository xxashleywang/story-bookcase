const COOKIE_NAME = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_COOKIES = 32;

/**
 * Set-Cookie headers that expire every cookie this request carried.
 * Names only: values are never copied, and a name that could break a header is skipped.
 */
export function expiredSessionCookies(cookieHeader: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const part of cookieHeader.split(";")) {
    const name = (part.split("=", 1)[0] ?? "").trim();
    if (!COOKIE_NAME.test(name) || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length >= MAX_COOKIES) break;
  }
  return names.map((name) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
}
