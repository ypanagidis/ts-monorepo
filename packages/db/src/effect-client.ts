import type { CustomTypesConfig } from "pg";

import { PgClient } from "@effect/sql-pg";
import { defineRelations } from "drizzle-orm";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Config, Context, Deferred, Effect, Layer } from "effect";
import { types } from "pg";

import * as schema from "./schema";

// Build Drizzle's relational query metadata from the package schema. This is
// separate from `schema` because Drizzle uses it to power `db.query.*` APIs.
const relations = defineRelations(schema);

// Keep date/time-like values as raw strings from `pg` so Drizzle owns the final
// column decoding. Without this, `pg` can eagerly coerce timestamps before
// Drizzle sees them, which can produce inconsistent date handling.
const passthroughDateTypeIds = new Set([
  1082, 1114, 1115, 1182, 1184, 1185, 1186, 1187, 1231,
]);
const pgTypes: CustomTypesConfig = {
  getTypeParser: (typeId, format) => {
    if (passthroughDateTypeIds.has(typeId)) {
      return (value: string) => value;
    }

    return types.getTypeParser(typeId, format);
  },
};

// Shared Drizzle config for the Effect adapter. Passing both `schema` and
// `relations` keeps the database instance schema-aware, while `snake_case`
// matches this package's table/column naming convention.
const drizzleConfig = {
  schema,
  relations,
  casing: "snake_case" as const,
};

// Shared PgClient layer used by both the production and test DB layers. It
// reads POSTGRES_URL through Effect Config and preserves Drizzle's date parsing.
const PgClientLive = PgClient.layerConfig({
  url: Config.redacted("POSTGRES_URL"),
  types: Config.succeed(pgTypes),
});

// Effect that constructs the Drizzle database. It expects a PgClient in the
// environment; `makeWithDefaults` only supplies Drizzle's logger/cache services.
const dbEffect = PgDrizzle.makeWithDefaults(drizzleConfig);
export type Db = Omit<Effect.Success<typeof dbEffect>, "$client">;

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

// Main application layer. It builds the PgClient pool from POSTGRES_URL and then
// provides DbService. Use this at the app boundary.
//
// Example:
//   Effect.runPromise(program.pipe(Effect.provide(DbLive)));
export const DbLive = Layer.effect(DbService, dbEffect).pipe(
  Layer.provide(PgClientLive),
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
      .transaction((tx) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(transaction, tx);
          return yield* Effect.never;
        }),
      )
      .pipe(Effect.forkScoped);

    const tx = yield* Deferred.await(transaction);

    return Context.make(DbService, tx);
  }),
).pipe(Layer.provide(PgClientLive));
