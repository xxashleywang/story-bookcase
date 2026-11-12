import { spaHtml } from "../../src/server/spa-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return new Response(spaHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
