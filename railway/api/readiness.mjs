import { readdir, readFile } from "node:fs/promises"
import { createHash } from "node:crypto"

export async function expectedMigrations(folder) {
  const entries = (await readdir(folder, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
  if (!entries.length) throw new Error("migration_files_missing")
  return Promise.all(
    entries.map(async (entry) => ({
      name: entry.name,
      checksum: createHash("sha256")
        .update(await readFile(new URL(`${entry.name}/migration.sql`, folder)))
        .digest("hex"),
    })),
  )
}
export function migrationsMatch(expected, rows) {
  return expected.every((entry) =>
    rows.some(
      (row) =>
        row.migration_name === entry.name &&
        row.checksum === entry.checksum &&
        row.finished_at &&
        !row.rolled_back_at,
    ),
  )
}
export async function waitForMigrations(
  connect,
  expected,
  { timeoutMs = 150_000, delayMs = 1500 } = {},
) {
  const deadline = Date.now() + timeoutMs
  do {
    const client = connect()
    try {
      await client.connect()
      const { rows } = await client.query(
        'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = ANY($1)',
        [expected.map((entry) => entry.name)],
      )
      if (migrationsMatch(expected, rows)) {
        await client.query('SELECT 1 FROM "Restaurant" LIMIT 1')
        return
      }
    } catch {
      /* Missing schema and unavailable dependencies remain bounded. */
    } finally {
      await client.end().catch(() => undefined)
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(delayMs, Math.max(0, deadline - Date.now()))),
    )
  } while (Date.now() < deadline)
  throw new Error("database_migrations_not_ready")
}
