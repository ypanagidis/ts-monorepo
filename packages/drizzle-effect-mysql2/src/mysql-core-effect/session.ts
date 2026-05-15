import type { WithCacheConfig } from "drizzle-orm/cache/core/types";
import type { EffectLoggerShape } from "drizzle-orm/effect-core/logger";
import type {
  QueryEffectHKTBase,
  QueryEffectKind,
} from "drizzle-orm/effect-core/query-effect";
import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type { SelectedFieldsOrdered } from "drizzle-orm/mysql-core/query-builders/select.types";
import type {
  Mode,
  MySqlPreparedQueryConfig,
  MySqlPreparedQueryHKT,
  MySqlTransactionConfig,
} from "drizzle-orm/mysql-core/session";
import type {
  RelationalQueryMapperConfig,
  RelationalRowsMapper,
} from "drizzle-orm/relations";
import type { SqlError } from "effect/unstable/sql/SqlError";

import { NoopCache, strategyFor } from "drizzle-orm/cache/core/cache";
import {
  EffectCache,
  type EffectCacheShape,
} from "drizzle-orm/cache/core/cache-effect";
import { Column } from "drizzle-orm/column";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors";
import { entityKind, is } from "drizzle-orm/entity";
import { fillPlaceholders, type Query, type SQL } from "drizzle-orm/sql/sql";
import { sql } from "drizzle-orm/sql/sql";
import {
  assertUnreachable,
  type Assume,
  makeJitQueryMapper,
  type RowsMapper,
} from "drizzle-orm/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";

import { mapResultRow } from "../drizzle-internals.ts";

export type MySqlEffectQueryMode = "raw" | "rows" | "objects";

export type MySqlEffectQueryExecutor = (
  query: Query,
  params: unknown[],
  mode: MySqlEffectQueryMode,
) => Effect.Effect<unknown, unknown, unknown>;

export interface MySqlEffectPreparedQueryHKT<
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends MySqlPreparedQueryHKT {
  type: MySqlEffectPreparedQuery<
    Assume<this["config"], MySqlPreparedQueryConfig>,
    TEffectHKT
  >;
}

export type MySqlEffectPreparedQueryKind<
  TKind extends MySqlPreparedQueryHKT,
  TConfig extends MySqlPreparedQueryConfig,
> = (TKind & { readonly config: TConfig })["type"];

export class MySqlEffectPreparedQuery<
  T extends MySqlPreparedQueryConfig,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
  TIsRqbV2 extends boolean = false,
> {
  static readonly [entityKind]: string = "MySqlEffectPreparedQuery";

  /** @internal */
  joinsNotNullableMap?: Record<string, boolean>;

  private jitMapper?:
    | RowsMapper<
        (T["execute"] extends any[] ? T["execute"][number] : T["execute"])[]
      >
    | RelationalRowsMapper<T["execute"]>;

  constructor(
    private executor: MySqlEffectQueryExecutor,
    private query: Query,
    private logger: EffectLoggerShape,
    private effectCache: EffectCacheShape,
    private effectQueryMetadata:
      | {
          type: "select" | "update" | "delete" | "insert";
          tables: string[];
        }
      | undefined,
    private effectCacheConfig: WithCacheConfig | undefined,
    private fields: SelectedFieldsOrdered | undefined,
    private useJitMappers: boolean | undefined,
    private customResultMapper?: (
      rows: TIsRqbV2 extends true ? Record<string, unknown>[] : unknown[][],
    ) => T["execute"],
    private generatedIds?: Record<string, unknown>[],
    private returningIds?: SelectedFieldsOrdered,
    private isRqbV2Query?: TIsRqbV2,
    _rqbConfig?: RelationalQueryMapperConfig,
  ) {
    if (
      effectCache &&
      effectCache.strategy() === "all" &&
      effectCacheConfig === undefined
    ) {
      this.effectCacheConfig = { enabled: true, autoInvalidate: true };
    }
    if (!this.effectCacheConfig?.enabled) {
      this.effectCacheConfig = undefined;
    }
  }

  execute(
    placeholderValues: Record<string, unknown> = {},
  ): QueryEffectKind<TEffectHKT, T["execute"]> {
    if (this.isRqbV2Query) return this.executeRqbV2(placeholderValues);

    return Effect.gen({ self: this }, function* () {
      const params = fillPlaceholders(this.query.params, placeholderValues);
      const { fields, customResultMapper, returningIds, generatedIds } = this;

      yield* this.logger.logQuery(this.query.sql, params);

      if (!fields && !customResultMapper) {
        const res = yield* this.queryWithCache(
          this.query.sql,
          params,
          Effect.suspend(() => this.executor(this.query, params, "raw")),
        );

        if (returningIds) {
          const { insertId, affectedRows } = res as {
            insertId: number;
            affectedRows: number;
          };
          const returningResponse = [];
          let j = 0;
          for (let i = insertId; i < insertId + affectedRows; i++) {
            for (const column of returningIds) {
              const key = returningIds[0]!.path[0]!;
              if (is(column.field, Column)) {
                if (
                  column.field.primary &&
                  (column.field as any).autoIncrement
                ) {
                  returningResponse.push({ [key]: i });
                }
                if (column.field.defaultFn && generatedIds) {
                  returningResponse.push({ [key]: generatedIds[j]![key] });
                }
              }
            }
            j++;
          }

          return returningResponse as T["execute"];
        }
        return res as T["execute"];
      }

      const result = yield* this.queryWithCache(
        this.query.sql,
        params,
        Effect.suspend(() => this.executor(this.query, params, "rows")),
      );
      const rows = result as unknown[][];

      if (customResultMapper) {
        return customResultMapper(
          rows as TIsRqbV2 extends true
            ? Record<string, unknown>[]
            : unknown[][],
        );
      }

      return this.useJitMappers
        ? (this.jitMapper =
            (this.jitMapper as RowsMapper<
              (T["execute"] extends any[]
                ? T["execute"][number]
                : T["execute"])[]
            >) ??
            makeJitQueryMapper<
              (T["execute"] extends any[]
                ? T["execute"][number]
                : T["execute"])[]
            >(fields!, this.joinsNotNullableMap))(rows)
        : rows.map((row) =>
            mapResultRow(fields!, row, this.joinsNotNullableMap),
          );
    }) as QueryEffectKind<TEffectHKT, T["execute"]>;
  }

  private executeRqbV2(
    placeholderValues: Record<string, unknown> = {},
  ): QueryEffectKind<TEffectHKT, T["execute"]> {
    return Effect.gen({ self: this }, function* () {
      const params = fillPlaceholders(this.query.params, placeholderValues);

      yield* this.logger.logQuery(this.query.sql, params);

      const rows = yield* this.queryWithCache(
        this.query.sql,
        params,
        Effect.suspend(() => this.executor(this.query, params, "objects")),
      );

      return (
        this.customResultMapper as (
          rows: Record<string, unknown>[],
        ) => T["execute"]
      )(rows as Record<string, unknown>[]);
    }) as QueryEffectKind<TEffectHKT, T["execute"]>;
  }

  iterator(): AsyncGenerator<T["iterator"]> {
    throw new Error("MySQL Effect query iterators are not implemented yet");
  }

  private queryWithCache<A, E, R>(
    queryString: string,
    params: any[],
    query: Effect.Effect<A, E, R>,
  ) {
    return Effect.gen({ self: this }, function* () {
      const { effectCache: cache } = this;

      const cacheStrat: Awaited<ReturnType<typeof strategyFor>> =
        cache && !is(cache.cache, NoopCache)
          ? yield* Effect.tryPromise(() =>
              strategyFor(
                queryString,
                params,
                this.effectQueryMetadata,
                this.effectCacheConfig,
              ),
            )
          : { type: "skip" as const };

      if (cacheStrat.type === "skip") {
        return yield* query;
      }

      if (cacheStrat.type === "invalidate") {
        const result = yield* query;
        yield* cache.onMutate({ tables: cacheStrat.tables });

        return result;
      }

      if (cacheStrat.type === "try") {
        const { tables, key, isTag, autoInvalidate, config } = cacheStrat;
        const fromCache: any[] | undefined = yield* cache.get(
          key,
          tables,
          isTag,
          autoInvalidate,
        );

        if (typeof fromCache !== "undefined") return fromCache as unknown as A;

        const result = yield* query;

        yield* cache.put(
          key,
          result,
          autoInvalidate ? tables : [],
          isTag,
          config,
        );

        return result;
      }

      assertUnreachable(cacheStrat);
    }).pipe(
      Effect.provideService(EffectCache, this.effectCache),
      Effect.mapError(
        (e) =>
          new EffectDrizzleQueryError({
            query: queryString,
            params,
            cause: Cause.fail(e),
          }),
      ),
    );
  }
}

export abstract class MySqlEffectSession<
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> {
  static readonly [entityKind]: string = "MySqlEffectSession";

  constructor(
    protected dialect: MySqlDialect,
    protected mode: Mode,
  ) {}

  abstract prepareQuery<
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
  ): MySqlEffectPreparedQueryKind<TPreparedQueryHKT, T>;

  abstract prepareRelationalQuery<
    T extends MySqlPreparedQueryConfig,
    TPreparedQueryHKT extends MySqlPreparedQueryHKT,
  >(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    customResultMapper: (rows: Record<string, unknown>[]) => T["execute"],
    config: RelationalQueryMapperConfig,
    generatedIds?: Record<string, unknown>[],
    returningIds?: SelectedFieldsOrdered,
  ): MySqlEffectPreparedQueryKind<TPreparedQueryHKT, T>;

  execute<T>(query: SQL): QueryEffectKind<TEffectHKT, T> {
    const prepared = this.prepareQuery<
      MySqlPreparedQueryConfig & { execute: T; iterator: never },
      MySqlEffectPreparedQueryHKT<TEffectHKT>
    >(this.dialect.sqlToQuery(query), undefined);

    return prepared.execute() as QueryEffectKind<TEffectHKT, T>;
  }

  all<T = unknown>(query: SQL): QueryEffectKind<TEffectHKT, T[]> {
    return this.execute<T[]>(query);
  }

  count(sql: SQL): QueryEffectKind<TEffectHKT, number> {
    return this.all<{ count: string }>(sql).pipe(
      Effect.map((res) => Number(res[0]?.count ?? 0)),
    );
  }

  protected getSetTransactionSQL(
    config: MySqlTransactionConfig,
  ): SQL | undefined {
    const parts: string[] = [];

    if (config.isolationLevel) {
      parts.push(`isolation level ${config.isolationLevel}`);
    }

    return parts.length
      ? sql`set transaction ${sql.raw(parts.join(" "))}`
      : undefined;
  }

  protected getStartTransactionSQL(
    config: MySqlTransactionConfig,
  ): SQL | undefined {
    const parts: string[] = [];

    if (config.withConsistentSnapshot) {
      parts.push("with consistent snapshot");
    }

    if (config.accessMode) {
      parts.push(config.accessMode);
    }

    return parts.length
      ? sql`start transaction ${sql.raw(parts.join(" "))}`
      : undefined;
  }

  abstract transaction<A, E, R>(
    transaction: (tx: unknown) => Effect.Effect<A, E, R>,
    config?: MySqlTransactionConfig,
  ): Effect.Effect<A, E | SqlError, R>;
}
