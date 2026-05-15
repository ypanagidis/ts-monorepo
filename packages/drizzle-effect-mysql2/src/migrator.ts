import type { MigratorInitError } from "drizzle-orm/effect-core/errors";
import type { MigrationConfig } from "drizzle-orm/migrator";
import type { AnyRelations } from "drizzle-orm/relations";

import { MigratorInitError as MigratorInitErrorValue } from "drizzle-orm/effect-core/errors";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getMigrationsToRun } from "drizzle-orm/migrator.utils";
import { sql } from "drizzle-orm/sql/sql";
import * as Effect from "effect/Effect";

import type { EffectMySql2Database } from "./driver.ts";

import { upgradeIfNeeded } from "./up-migrations/effect-mysql.ts";

export function migrate<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations,
>(
  db: EffectMySql2Database<TSchema, TRelations>,
  config: Omit<MigrationConfig, "migrationsSchema">,
): Effect.Effect<void, unknown | MigratorInitError, unknown> {
  const migrations = readMigrationFiles(config);
  const migrationsTable = config.migrationsTable ?? "__drizzle_migrations";

  return Effect.gen(function* () {
    const { newDb } = yield* upgradeIfNeeded(
      migrationsTable,
      db.session,
      migrations,
    );

    if (newDb) {
      const migrationTableCreate = sql`
			CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
				id SERIAL PRIMARY KEY,
				hash TEXT NOT NULL,
				created_at BIGINT,
				name TEXT,
				applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`;
      yield* db.session.execute(migrationTableCreate);
    }

    const dbMigrations = yield* db.session.all<{
      id: number;
      hash: string;
      created_at: string;
      name: string | null;
    }>(
      sql`select id, hash, created_at, name from ${sql.identifier(migrationsTable)}`,
    );

    if ((config as { init?: boolean }).init) {
      if (dbMigrations.length) {
        return yield* new MigratorInitErrorValue({
          exitCode: "databaseMigrations",
        });
      }

      if (migrations.length > 1) {
        return yield* new MigratorInitErrorValue({
          exitCode: "localMigrations",
        });
      }

      const [migration] = migrations;

      if (!migration) return;

      yield* db.session.execute(
        sql`insert into ${sql.identifier(
          migrationsTable,
        )} (\`hash\`, \`created_at\`, \`name\`) values(${migration.hash}, ${migration.folderMillis}, ${migration.name})`,
      );

      return;
    }

    const migrationsToRun = getMigrationsToRun({
      localMigrations: migrations,
      dbMigrations,
    });
    yield* db.session.transaction((tx: any) =>
      Effect.gen(function* () {
        for (const migration of migrationsToRun) {
          for (const stmt of migration.sql) {
            yield* tx.execute(sql.raw(stmt));
          }
          yield* tx.execute(
            sql`insert into ${sql.identifier(
              migrationsTable,
            )} (\`hash\`, \`created_at\`, \`name\`) values(${migration.hash}, ${migration.folderMillis}, ${migration.name})`,
          );
        }
      }),
    );
  });
}
