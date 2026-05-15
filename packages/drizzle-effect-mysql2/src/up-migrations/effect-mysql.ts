import type { QueryEffectHKTBase } from "drizzle-orm/effect-core/query-effect";
import type { MigrationMeta } from "drizzle-orm/migrator";

import { sql } from "drizzle-orm/sql/sql";
import {
  GET_VERSION_FOR,
  MIGRATIONS_TABLE_VERSIONS,
  type UpgradeResult,
} from "drizzle-orm/up-migrations/utils";
import * as Effect from "effect/Effect";

import type { MySqlEffectSession } from "../mysql-core-effect/session.ts";

const upgradeFunctions: Record<
  number,
  (
    migrationsTable: string,
    session: MySqlEffectSession<QueryEffectHKTBase>,
    localMigrations: MigrationMeta[],
  ) => Effect.Effect<void, unknown, unknown>
> = {
  0: (migrationsTable, session, localMigrations) =>
    Effect.gen(function* () {
      const table = sql`${sql.identifier(migrationsTable)}`;

      const dbRows = yield* session.all<{
        id: number;
        hash: string;
        created_at: string;
      }>(sql`SELECT id, hash, created_at FROM ${table} ORDER BY id ASC`);

      localMigrations.sort((a, b) =>
        a.folderMillis !== b.folderMillis
          ? a.folderMillis - b.folderMillis
          : (a.name ?? "").localeCompare(b.name ?? ""),
      );

      const byMillis = new Map<number, MigrationMeta[]>();
      const byHash = new Map<string, MigrationMeta>();
      for (const lm of localMigrations) {
        if (!byMillis.has(lm.folderMillis)) {
          byMillis.set(lm.folderMillis, []);
        }
        byMillis.get(lm.folderMillis)!.push(lm);
        byHash.set(lm.hash, lm);
      }

      const toApply: { id: number; name: string }[] = [];
      const unmatchedIds: number[] = [];

      for (const dbRow of dbRows) {
        const stringified = String(dbRow.created_at);
        const millis = Number(
          stringified.substring(0, stringified.length - 3) + "000",
        );
        const candidates = byMillis.get(millis);

        let matched: MigrationMeta | undefined;

        if (candidates && candidates.length === 1) {
          matched = candidates[0];
        } else if (candidates && candidates.length > 1) {
          matched = candidates.find((c) => c.hash === dbRow.hash);
        } else {
          matched = byHash.get(dbRow.hash);
        }

        if (matched) toApply.push({ id: dbRow.id, name: matched.name });
        else unmatchedIds.push(dbRow.id);
      }

      if (unmatchedIds.length > 0) {
        return yield* Effect.die(
          new Error(
            `While upgrading your database migrations table we found ${unmatchedIds.length} migrations (ids: ${unmatchedIds.join(
              ", ",
            )}) in the database that do not match any local migration. This means that some migrations were applied to the database but are missing from the local environment`,
          ),
        );
      }

      yield* session.all(
        sql`ALTER TABLE ${table} ADD ${sql.identifier("name")} text`,
      );
      yield* session.all(
        sql`ALTER TABLE ${table} ADD ${sql.identifier("applied_at")} TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      );

      for (const backfillEntry of toApply) {
        yield* session.all(
          sql`UPDATE ${table} SET ${sql.identifier("name")} = ${backfillEntry.name}, ${sql.identifier(
            "applied_at",
          )} = NULL WHERE ${sql.identifier("id")} = ${backfillEntry.id}`,
        );
      }
    }),
};

export function upgradeIfNeeded<TEffectHKT extends QueryEffectHKTBase>(
  migrationsTable: string,
  session: MySqlEffectSession<TEffectHKT>,
  localMigrations: MigrationMeta[],
): Effect.Effect<UpgradeResult, unknown, unknown> {
  return Effect.gen(function* () {
    const result = yield* session.all<{ "1": 1 }>(
      sql`SELECT 1 FROM information_schema.tables 
			WHERE table_name = ${migrationsTable}
			AND table_schema = DATABASE()`,
    );

    if (result.length === 0) {
      return { newDb: true };
    }

    const rows = yield* session.all<{ column_name: string }>(
      sql`SELECT column_name as \`column_name\`
		FROM information_schema.columns
		WHERE table_name = ${migrationsTable}
		AND table_schema = DATABASE()
		ORDER BY ordinal_position`,
    );

    const version = GET_VERSION_FOR.mysql(rows.map((r) => r.column_name));

    for (let v = version; v < MIGRATIONS_TABLE_VERSIONS.mysql; v++) {
      const upgradeFn = upgradeFunctions[v];
      if (!upgradeFn) {
        return yield* Effect.die(
          new Error(
            `No upgrade path from migration table version ${v} to ${v + 1}`,
          ),
        );
      }
      yield* upgradeFn(migrationsTable, session, localMigrations);
    }

    return { newDb: false };
  });
}
