import pg from "pg";

/** Dedicated connection: lock waiters cannot exhaust the ordinary query pool. */
export async function withAdvisoryLock<T>(key: number, work: () => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [key]);
    return await work();
  } finally {
    // Session termination releases the lock, including after a disconnected caller.
    await client.end();
  }
}
