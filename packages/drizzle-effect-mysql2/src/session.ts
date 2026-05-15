import type { MysqlClient } from "@effect/sql-mysql2/MysqlClient";
import type * as V1 from "drizzle-orm/_relations";
import type { EffectCacheShape } from "drizzle-orm/cache/core/cache-effect";
import type { WithCacheConfig } from "drizzle-orm/cache/core/types";
import type { EffectLoggerShape } from "drizzle-orm/effect-core/logger";
import type { QueryEffectHKTBase } from "drizzle-orm/effect-core/query-effect";
import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type { SelectedFieldsOrdered } from "drizzle-orm/mysql-core/query-builders/select.types";
import type {
  Mode,
  MySqlPreparedQueryConfig,
  MySqlPreparedQueryHKT,
  MySqlQueryResultHKT,
  MySqlTransactionConfig,
} from "drizzle-orm/mysql-core/session";
import type {
  AnyRelations,
  RelationalQueryMapperConfig,
} from "drizzle-orm/relations";
import type { Assume } from "drizzle-orm/utils";
import type { Connection } from "effect/unstable/sql/SqlConnection";
import type { SqlError } from "effect/unstable/sql/SqlError";
import type { ResultSetHeader } from "mysql2/promise";

import {
  type EffectDrizzleQueryError,
  EffectTransactionRollbackError,
} from "drizzle-orm/effect-core/errors";
import { entityKind } from "drizzle-orm/entity";
import { type Query, type SQL, sql } from "drizzle-orm/sql/sql";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { MySqlEffectDatabase } from "./mysql-core-effect/db";
import {
  MySqlEffectPreparedQuery,
  type MySqlEffectPreparedQueryHKT,
  type MySqlEffectPreparedQueryKind,
  type MySqlEffectQueryExecutor,
  MySqlEffectSession,
} from "./mysql-core-effect/session";

export interface EffectMySql2QueryEffectHKT extends QueryEffectHKTBase {
  readonly error: EffectDrizzleQueryError;
  readonly context: never;
}

export interface EffectMySql2QueryResultHKT extends MySqlQueryResultHKT {
  type: [this["row"]] extends [ResultSetHeader]
    ? ResultSetHeader
    : Assume<this["row"], object>[];
}

export interface EffectMySql2SessionOptions {
  logger: EffectLoggerShape;
  cache: EffectCacheShape;
  useJitMappers?: boolean;
  mode: Mode;
}

export class EffectMySql2Session<
  TRelations extends AnyRelations,
  TSchema extends V1.TablesRelationalConfig,
> extends MySqlEffectSession<EffectMySql2QueryEffectHKT> {
  static override readonly [entityKind]: string = "EffectMySql2Session";

  constructor(
    private client: MysqlClient,
    dialect: MySqlDialect,
    protected relations: TRelations,
    protected schema: V1.RelationalSchemaConfig<TSchema> | undefined,
    private options: EffectMySql2SessionOptions,
  ) {
    super(dialect, options.mode);
  }

  override prepareQuery<
    T extends MySqlPreparedQueryConfig,
    TPreparedQueryHKT extends MySqlPreparedQueryHKT,
  >(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    customResultMapper?: (rows: unknown[][]) => T["execute"],
    generatedIds?: Record<string, unknown>[],
    returningIds?: SelectedFieldsOrdered,
    queryMetadata?: {
      type: "select" | "update" | "delete" | "insert";
      tables: string[];
    },
    cacheConfig?: WithCacheConfig,
  ): MySqlEffectPreparedQueryKind<TPreparedQueryHKT, T> {
    const executor: MySqlEffectQueryExecutor = (_query, params, mode) => {
      const prepared = this.client.unsafe(query.sql, params);

      if (mode === "raw") {
        return prepared.raw;
      }
      if (mode === "rows") {
        return prepared.values;
      }
      return prepared.withoutTransform;
    };

    return new MySqlEffectPreparedQuery(
      executor,
      query,
      this.options.logger,
      this.options.cache,
      queryMetadata,
      cacheConfig,
      fields,
      this.options.useJitMappers,
      customResultMapper,
      generatedIds,
      returningIds,
    ) as MySqlEffectPreparedQueryKind<TPreparedQueryHKT, T>;
  }

  prepareRelationalQuery<
    T extends MySqlPreparedQueryConfig,
    TPreparedQueryHKT extends MySqlPreparedQueryHKT,
  >(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    customResultMapper: (rows: Record<string, unknown>[]) => T["execute"],
    config: RelationalQueryMapperConfig,
    generatedIds?: Record<string, unknown>[],
    returningIds?: SelectedFieldsOrdered,
  ): MySqlEffectPreparedQueryKind<TPreparedQueryHKT, T> {
    const executor: MySqlEffectQueryExecutor = (_query, params, mode) => {
      const prepared = this.client.unsafe(query.sql, params);

      if (mode === "raw") {
        return prepared.raw;
      }
      if (mode === "rows") {
        return prepared.values;
      }
      return prepared.unprepared;
    };

    return new MySqlEffectPreparedQuery(
      executor,
      query,
      this.options.logger,
      this.options.cache,
      undefined,
      undefined,
      fields,
      this.options.useJitMappers,
      customResultMapper,
      generatedIds,
      returningIds,
      true,
      config,
    ) as MySqlEffectPreparedQueryKind<TPreparedQueryHKT, T>;
  }

  override transaction<A, E, R>(
    transaction: (
      tx: EffectMySql2Transaction<TRelations, TSchema>,
    ) => Effect.Effect<A, E, R>,
    config?: MySqlTransactionConfig,
  ): Effect.Effect<A, E | SqlError, R> {
    const { client, dialect, relations, schema, options } = this;

    return Effect.uninterruptibleMask((restore) =>
      Effect.gen(function* () {
        const existing = yield* Effect.serviceOption(client.transactionService);

        if (Option.isSome(existing)) {
          const [conn, depth] = existing.value;
          const savepointName = `sp${depth + 1}`;
          const txSession = new EffectMySql2Session(
            client,
            dialect,
            relations,
            schema,
            options,
          );
          const tx = new EffectMySql2Transaction(
            dialect,
            txSession,
            relations,
            schema,
            depth + 1,
            options.mode,
          );

          yield* executeStatement(
            dialect,
            conn,
            sql.raw(`savepoint ${savepointName}`),
          );
          const exit = yield* Effect.exit(restore(transaction(tx)));

          if (Exit.isSuccess(exit)) {
            yield* executeStatement(
              dialect,
              conn,
              sql.raw(`release savepoint ${savepointName}`),
            );
          } else {
            yield* executeStatement(
              dialect,
              conn,
              sql.raw(`rollback to savepoint ${savepointName}`),
            );
          }

          return yield* exit;
        }

        return yield* Effect.scoped(
          Effect.gen(function* () {
            const conn = yield* client.reserve;
            const txSession = new EffectMySql2Session(
              client,
              dialect,
              relations,
              schema,
              options,
            );
            const tx = new EffectMySql2Transaction(
              dialect,
              txSession,
              relations,
              schema,
              0,
              options.mode,
            );

            if (config) {
              const setTransactionConfigSql =
                txSession.getSetTransactionSQL(config);
              if (setTransactionConfigSql) {
                yield* executeStatement(dialect, conn, setTransactionConfigSql);
              }
              const startTransactionSql =
                txSession.getStartTransactionSQL(config);
              yield* executeStatement(
                dialect,
                conn,
                startTransactionSql ?? sql`begin`,
              );
            } else {
              yield* executeStatement(dialect, conn, sql`begin`);
            }

            const exit = yield* Effect.exit(
              restore(transaction(tx)).pipe(
                Effect.provideService(client.transactionService, [conn, 0]),
              ),
            );

            if (Exit.isSuccess(exit)) {
              yield* executeStatement(dialect, conn, sql`commit`);
            } else {
              yield* executeStatement(dialect, conn, sql`rollback`);
            }

            return yield* exit;
          }),
        );
      }),
    );
  }
}

export class EffectMySql2Transaction<
  TRelations extends AnyRelations,
  TSchema extends V1.TablesRelationalConfig,
> extends MySqlEffectDatabase<
  EffectMySql2QueryEffectHKT,
  EffectMySql2QueryResultHKT,
  Record<string, unknown>,
  TRelations
> {
  static override readonly [entityKind]: string = "EffectMySql2Transaction";

  constructor(
    override readonly dialect: MySqlDialect,
    override readonly session: EffectMySql2Session<TRelations, TSchema>,
    override readonly relations: TRelations,
    protected readonly schema: V1.RelationalSchemaConfig<TSchema> | undefined,
    protected readonly nestedIndex: number,
    protected override readonly mode: Mode,
  ) {
    super(dialect, session, relations, schema, mode);
  }

  rollback() {
    return new EffectTransactionRollbackError();
  }

  override transaction<A, E, R>(
    transaction: (
      tx: EffectMySql2Transaction<TRelations, TSchema>,
    ) => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | SqlError, R> {
    return this.session.transaction(transaction);
  }
}

function executeStatement(
  dialect: MySqlDialect,
  conn: Connection,
  statement: SQL,
): Effect.Effect<void, SqlError> {
  const query = dialect.sqlToQuery(statement);
  return conn
    .executeUnprepared(query.sql, query.params, undefined)
    .pipe(Effect.asVoid);
}

export interface EffectMySql2PreparedQueryHKT extends MySqlEffectPreparedQueryHKT<EffectMySql2QueryEffectHKT> {
  type: MySqlEffectPreparedQuery<
    Assume<this["config"], MySqlPreparedQueryConfig>,
    EffectMySql2QueryEffectHKT
  >;
}
