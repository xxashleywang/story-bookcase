import { AsyncLocalStorage } from "node:async_hooks";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
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

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as T[];
  }
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return (await (await local).query<T>(text, params)).rows;
}

export async function transaction<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const client = await pool.connect();
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
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => [])).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}
