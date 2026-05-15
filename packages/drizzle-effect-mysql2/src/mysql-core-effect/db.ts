import type * as V1 from "drizzle-orm/_relations";
import type { MutationOption } from "drizzle-orm/cache/core/cache";
import type { EffectCacheShape } from "drizzle-orm/cache/core/cache-effect";
import type { QueryEffectHKTBase } from "drizzle-orm/effect-core/query-effect";
import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type { SelectedFields } from "drizzle-orm/mysql-core/query-builders/select.types";
import type {
  Mode,
  MySqlQueryResultHKT,
  MySqlQueryResultKind,
  MySqlTransactionConfig,
} from "drizzle-orm/mysql-core/session";
import type { MySqlTable } from "drizzle-orm/mysql-core/table";
import type { MySqlView } from "drizzle-orm/mysql-core/view";
import type { MySqlViewBase } from "drizzle-orm/mysql-core/view-base";
import type { AnyRelations, EmptyRelations } from "drizzle-orm/relations";

import { entityKind } from "drizzle-orm/entity";
import { type SQL, sql, type SQLWrapper } from "drizzle-orm/sql/sql";
import * as Effect from "effect/Effect";

import type { MySqlEffectSession } from "./session.ts";

import { MySqlEffectCountBuilder } from "./count";
import { MySqlEffectDeleteBase } from "./delete";
import { MySqlEffectInsertBuilder } from "./insert";
import { MySqlEffectRelationalQueryBuilder } from "./query";
import {
  type MySqlEffectSelectBuilder,
  MySqlEffectSelectBuilderBase,
} from "./select";
import { MySqlEffectUpdateBuilder } from "./update";

export class MySqlEffectDatabase<
  TEffectHKT extends QueryEffectHKTBase,
  TQueryResult extends MySqlQueryResultHKT,
  TFullSchema extends Record<string, unknown> = Record<string, never>,
  TRelations extends AnyRelations = EmptyRelations,
> {
  static readonly [entityKind]: string = "MySqlEffectDatabase";

  declare readonly _: {
    readonly fullSchema: TFullSchema;
    readonly relations: TRelations;
    readonly session: MySqlEffectSession<TEffectHKT>;
    readonly schema: V1.TablesRelationalConfig | undefined;
  };

  query: {
    [K in keyof TRelations]: MySqlEffectRelationalQueryBuilder<
      TEffectHKT,
      TRelations,
      TRelations[K]
    >;
  };

  $cache: { invalidate: EffectCacheShape["onMutate"] };

  constructor(
    /** @internal */
    readonly dialect: MySqlDialect,
    /** @internal */
    readonly session: MySqlEffectSession<TEffectHKT>,
    readonly relations: TRelations,
    schema: V1.RelationalSchemaConfig<V1.TablesRelationalConfig> | undefined,
    protected readonly mode: Mode,
  ) {
    this._ = {
      fullSchema: (schema?.fullSchema as TFullSchema) ?? ({} as TFullSchema),
      relations,
      session,
      schema: schema?.schema,
    };

    this.query = {} as (typeof this)["query"];
    for (const [tableName, relation] of Object.entries(relations)) {
      (
        this.query as MySqlEffectDatabase<
          TEffectHKT,
          TQueryResult,
          TFullSchema,
          AnyRelations
        >["query"]
      )[tableName] = new MySqlEffectRelationalQueryBuilder(
        relations,
        relations[relation.name]!.table as MySqlTable | MySqlView,
        relation,
        dialect,
        session,
      );
    }

    this.$cache = {
      invalidate: (_params: MutationOption) => Effect.void,
    };
  }

  select(): MySqlEffectSelectBuilder<undefined, TEffectHKT>;
  select<TSelection extends SelectedFields>(
    fields: TSelection,
  ): MySqlEffectSelectBuilder<TSelection, TEffectHKT>;
  select<TSelection extends SelectedFields | undefined>(
    fields?: TSelection,
  ): MySqlEffectSelectBuilder<TSelection, TEffectHKT> {
    return new MySqlEffectSelectBuilderBase({
      fields: fields ?? undefined,
      session: this.session,
      dialect: this.dialect,
    }) as MySqlEffectSelectBuilder<TSelection, TEffectHKT>;
  }

  insert<TTable extends MySqlTable>(
    table: TTable,
  ): MySqlEffectInsertBuilder<TTable, TQueryResult, TEffectHKT> {
    return new MySqlEffectInsertBuilder(table, this.session, this.dialect);
  }

  update<TTable extends MySqlTable>(
    table: TTable,
  ): MySqlEffectUpdateBuilder<TTable, TQueryResult, TEffectHKT> {
    return new MySqlEffectUpdateBuilder(table, this.session, this.dialect);
  }

  delete<TTable extends MySqlTable>(
    table: TTable,
  ): MySqlEffectDeleteBase<TTable, TQueryResult, TEffectHKT> {
    return new MySqlEffectDeleteBase(table, this.session, this.dialect);
  }

  $count(
    source: MySqlTable | MySqlViewBase | SQL | SQLWrapper,
    filters?: SQL<unknown>,
  ) {
    return new MySqlEffectCountBuilder({
      source,
      filters,
      session: this.session,
    });
  }

  execute<T extends { [column: string]: any } = Record<string, unknown>>(
    query: SQLWrapper | string,
  ): Effect.Effect<
    MySqlQueryResultKind<TQueryResult, T>,
    TEffectHKT["error"],
    TEffectHKT["context"]
  > {
    return this.session.execute(
      typeof query === "string" ? sql.raw(query) : query.getSQL(),
    ) as Effect.Effect<
      MySqlQueryResultKind<TQueryResult, T>,
      TEffectHKT["error"],
      TEffectHKT["context"]
    >;
  }

  transaction<A, E, R>(
    transaction: (tx: unknown) => Effect.Effect<A, E, R>,
    config?: MySqlTransactionConfig,
  ) {
    return this.session.transaction(transaction, config);
  }
}
