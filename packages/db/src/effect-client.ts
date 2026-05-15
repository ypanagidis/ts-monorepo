import type { MysqlClient as MysqlClientService } from "@effect/sql-mysql2/MysqlClient";

import { MysqlClient } from "@effect/sql-mysql2";
import { defineRelations } from "drizzle-orm";
import { Config, Context, Deferred, Effect, Layer } from "effect";

import * as MySqlDrizzle from "@acme/drizzle-effect-mysql2";

import * as schema from "./schema";

// Build Drizzle's relational query metadata from the package schema. This is
// separate from `schema` because Drizzle uses it to power `db.query.*` APIs.
const relations = defineRelations(schema);

// Shared Drizzle config for the Effect adapter. Passing both `schema` and
// `relations` keeps the database instance schema-aware, while `snake_case`
// matches this package's table/column naming convention.
const drizzleConfig = {
  schema,
  relations,
  casing: "snake_case" as const,
  mode: "default" as const,
};

// Shared MysqlClient layer used by both the production and test DB layers. It
// reads MYSQL_URL through Effect Config.
const MySqlClientLive = MysqlClient.layerConfig({
  url: Config.redacted("MYSQL_URL"),
});

// Effect that constructs the Drizzle database. It expects a MysqlClient in the
// environment; `makeWithDefaults` only supplies Drizzle's logger/cache services.
export type Db = MySqlDrizzle.EffectMySql2Database<
  typeof schema,
  typeof relations
>;
const dbEffect = MySqlDrizzle.makeWithDefaults(
  drizzleConfig,
) as unknown as Effect.Effect<Db, never, MysqlClientService>;

// Single service tag for dependency injection. Inside Effect programs,
// `yield* DbService` returns the schema-aware Drizzle database.
//
// Example:
//   const program = Effect.gen(function* () {
//     const db = yield* DbService;
//     return yield* db.query.Post.findMany();
//   });
export class DbService extends Context.Service<DbService, Db>()(
  "@acme/db/DbService",
) {}

// Main application layer. It builds the MysqlClient pool from MYSQL_URL and then
// provides DbService. Use this at the app boundary.
//
// Example:
//   Effect.runPromise(program.pipe(Effect.provide(DbLive)));
export const DbLive = Layer.effect(DbService, dbEffect).pipe(
  Layer.provide(MySqlClientLive),
);

// Test layer. It uses Drizzle's transaction API, keeps the transaction fiber
// open for the layer scope, and relies on scoped interruption to make Drizzle
// roll the transaction back. Use it per test when writes must be isolated.
//
// Example:
//   it.effect("creates a post", () =>
//     Effect.gen(function* () {
//       const db = yield* DbService;
//       yield* db.insert(schema.Post).values({ title: "t", content: "c" });
//     }).pipe(Effect.provide(DbTestLive)),
//   );
export const DbTestLive = Layer.effectContext(
  Effect.gen(function* () {
    const db = yield* dbEffect;
    const transaction = yield* Deferred.make<Db>();

    yield* db
      .transaction((tx: any) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(transaction, tx as Db);
          return yield* Effect.never;
        }),
      )
      .pipe(Effect.forkScoped);

    const tx = yield* Deferred.await(transaction);

    return Context.make(DbService, tx);
  }),
).pipe(Layer.provide(MySqlClientLive));
