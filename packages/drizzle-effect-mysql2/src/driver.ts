import type {
  Mode,
  MySqlTransactionConfig,
} from "drizzle-orm/mysql-core/session";
import type { AnyRelations, EmptyRelations } from "drizzle-orm/relations";
import type { DrizzleConfig } from "drizzle-orm/utils";

import { MysqlClient } from "@effect/sql-mysql2/MysqlClient";
import * as V1 from "drizzle-orm/_relations";
import { EffectCache } from "drizzle-orm/cache/core/cache-effect";
import { EffectLogger } from "drizzle-orm/effect-core";
import { entityKind } from "drizzle-orm/entity";
import { DrizzleError } from "drizzle-orm/errors";
import { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { jitCompatCheck } from "./drizzle-internals.ts";
import { MySqlEffectDatabase } from "./mysql-core-effect/db";
import {
  type EffectMySql2QueryEffectHKT,
  type EffectMySql2QueryResultHKT,
  EffectMySql2Session,
  type EffectMySql2Transaction,
} from "./session.ts";

export class EffectMySql2Database<
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
> extends MySqlEffectDatabase<
  EffectMySql2QueryEffectHKT,
  EffectMySql2QueryResultHKT,
  TSchema,
  TRelations
> {
  static override readonly [entityKind]: string = "EffectMySql2Database";

  override transaction<A, E, R>(
    transaction: (
      tx: EffectMySql2Transaction<
        TRelations,
        V1.ExtractTablesWithRelations<TSchema>
      >,
    ) => Effect.Effect<A, E, R>,
    config?: MySqlTransactionConfig,
  ) {
    return (
      this.session as EffectMySql2Session<
        TRelations,
        V1.ExtractTablesWithRelations<TSchema>
      >
    ).transaction(transaction, config);
  }
}

export type EffectDrizzleMySql2Config<
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
> = Omit<DrizzleConfig<TSchema, TRelations>, "cache" | "logger" | "schema"> &
  ({ schema: TSchema; mode: Mode } | { schema?: undefined; mode?: Mode });

export const DefaultServices = Layer.merge(
  EffectCache.Default,
  EffectLogger.Default,
);

export const make = Effect.fn("MySql2Drizzle.make")(function* <
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
>(config: EffectDrizzleMySql2Config<TSchema, TRelations> = {}) {
  const client = yield* MysqlClient;
  const cache = yield* EffectCache;
  const logger = yield* EffectLogger;

  const dialect = new MySqlDialect();

  let schema: V1.RelationalSchemaConfig<V1.TablesRelationalConfig> | undefined;
  if (config.schema) {
    if (config.mode === undefined) {
      return yield* Effect.die(
        new DrizzleError({
          message:
            'You need to specify "mode": "planetscale" or "default" when providing a schema. Read more: https://orm.drizzle.team/docs/rqb#modes',
        }),
      );
    }

    const tablesConfig = V1.extractTablesRelationalConfig(
      config.schema,
      V1.createTableRelationsHelpers,
    );
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    };
  }

  const mode = config.mode ?? "default";
  const relations = config.relations ?? ({} as TRelations);
  const session = new EffectMySql2Session(client, dialect, relations, schema, {
    logger,
    cache,
    mode,
    useJitMappers: jitCompatCheck(config.jit),
  });
  const db = new EffectMySql2Database(
    dialect,
    session,
    relations,
    schema,
    mode,
  ) as EffectMySql2Database<TSchema, TRelations>;
  (<any>db).$client = client;
  (<any>db).$cache = cache;
  if ((<any>db).$cache) {
    (<any>db).$cache["invalidate"] = cache.onMutate;
  }

  return db as EffectMySql2Database<TSchema, TRelations> & {
    $client: MysqlClient;
  };
});

export const makeWithDefaults = <
  TSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
>(
  config: EffectDrizzleMySql2Config<TSchema, TRelations> = {},
) => make(config).pipe(Effect.provide(DefaultServices));
