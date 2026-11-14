import { AsyncLocalStorage } from "node:async_hooks";
import { readdir, readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
// A host that never answers must not hold the gallery open until the platform kills it.
const CONNECT_WAIT_MS = 8_000;
let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;

type SchemaName = "public" | "preview";
const schemaStore = new AsyncLocalStorage<SchemaName>();

const TABLES = {
  profiles: true,
  photos: true,
  builds: true,
  favourites: true,
  photo_deletions: true,
} as const;

export type TableName = keyof typeof TABLES;
export type Query = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

export function table(name: TableName): string {
  const schema = schemaStore.getStore();
  if (!schema) {
    if (databaseUrl === "") return `public.${name}`;
    throw new Error("schema not selected");
  }
  return `${schema}.${name}`;
}

export function withSchema<T>(
  stage: "production" | "preview",
  fn: () => Promise<T>,
): Promise<T> {
  return schemaStore.run(stage === "preview" ? "preview" : "public", fn);
}

function postgres(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 5,
      connectionTimeoutMillis: CONNECT_WAIT_MS,
    });
    pool.on("error", (error: Error & { code?: string }) => {
      console.error("gallery database connection dropped", error.code ?? error.name);
    });
  }
  return pool;
}

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    return (await postgres().query(text, params)).rows as T[];
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return (await (await local).query<T>(text, params)).rows;
}

export async function transaction<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    const client = await postgres().connect();
    const query: Query = async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
      (await client.query(text, params)).rows as T[];
    try {
      await client.query("begin");
      const result = await fn(query);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  await sql("begin");
  try {
    const result = await fn(sql);
    await sql("commit");
    return result;
  } catch (error) {
    await sql("rollback");
    throw error;
  }
}

async function startLocal(): Promise<PGlite> {
  // Production uses Postgres. Loading the in-memory engine there only delays the first gallery read.
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
