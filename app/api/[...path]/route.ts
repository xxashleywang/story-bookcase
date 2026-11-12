import { dispatch } from "../../../src/server/dispatch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function segments(context: { params: Promise<{ path: string[] }> | { path: string[] } }) {
  const params = await context.params;
  return params.path;
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return dispatch("GET", request, await segments(context));
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return dispatch("POST", request, await segments(context));
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return dispatch("PUT", request, await segments(context));
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return dispatch("PATCH", request, await segments(context));
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return dispatch("DELETE", request, await segments(context));
}
