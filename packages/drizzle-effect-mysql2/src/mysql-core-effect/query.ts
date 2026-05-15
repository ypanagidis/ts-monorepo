import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type { MySqlPreparedQueryConfig } from "drizzle-orm/mysql-core/session";
import type { MySqlTable } from "drizzle-orm/mysql-core/table";
import type { MySqlView } from "drizzle-orm/mysql-core/view";
import type { Query, SQL, SqlCommenterInput } from "drizzle-orm/sql/sql";
import type { KnownKeysOnly } from "drizzle-orm/utils";
import type * as Effect from "effect/Effect";

import {
  applyEffectWrapper,
  type QueryEffectHKTBase,
} from "drizzle-orm/effect-core/query-effect";
import { entityKind } from "drizzle-orm/entity";
import {
  type BuildQueryResult,
  type BuildRelationalQueryResult,
  type DBQueryConfigWithComment,
  makeDefaultRqbMapper,
  type TableRelationalConfig,
  type TablesRelationalConfig,
} from "drizzle-orm/relations";

import type {
  MySqlEffectPreparedQueryKind,
  MySqlEffectSession,
} from "./session.ts";

export class MySqlEffectRelationalQueryBuilder<
  TEffectHKT extends QueryEffectHKTBase,
  TSchema extends TablesRelationalConfig,
  TFields extends TableRelationalConfig,
> {
  static readonly [entityKind]: string = "MySqlEffectRelationalQueryBuilderV2";

  constructor(
    private schema: TSchema,
    private table: MySqlTable | MySqlView,
    private tableConfig: TableRelationalConfig,
    private dialect: MySqlDialect,
    private session: MySqlEffectSession<TEffectHKT>,
  ) {}

  findMany<TConfig extends DBQueryConfigWithComment<"many", TSchema, TFields>>(
    config?: KnownKeysOnly<
      TConfig,
      DBQueryConfigWithComment<"many", TSchema, TFields>
    > & {
      comment?: SqlCommenterInput;
    },
  ): MySqlEffectRelationalQuery<
    BuildQueryResult<TSchema, TFields, TConfig>[],
    TEffectHKT
  > {
    return new MySqlEffectRelationalQuery(
      this.schema,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      (config as DBQueryConfigWithComment<"many"> | undefined) ?? true,
      "many",
    );
  }

  findFirst<
    TSelection extends DBQueryConfigWithComment<"one", TSchema, TFields>,
  >(
    config?: KnownKeysOnly<
      TSelection,
      DBQueryConfigWithComment<"one", TSchema, TFields>
    > & {
      comment?: SqlCommenterInput;
    },
  ): MySqlEffectRelationalQuery<
    BuildQueryResult<TSchema, TFields, TSelection> | undefined,
    TEffectHKT
  > {
    return new MySqlEffectRelationalQuery(
      this.schema,
      this.table,
      this.tableConfig,
      this.dialect,
      this.session,
      (config as DBQueryConfigWithComment<"one"> | undefined) ?? true,
      "first",
    );
  }
}

export interface MySqlEffectRelationalQuery<
  TResult,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends Effect.Effect<TResult, TEffectHKT["error"], TEffectHKT["context"]> {}

export class MySqlEffectRelationalQuery<
  TResult,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> {
  static readonly [entityKind]: string = "MySqlEffectRelationalQueryV2";

  declare protected $brand: "MySqlEffectRelationalQuery";

  constructor(
    private schema: TablesRelationalConfig,
    private table: MySqlTable | MySqlView,
    private tableConfig: TableRelationalConfig,
    private dialect: MySqlDialect,
    private session: MySqlEffectSession<TEffectHKT>,
    private config: DBQueryConfigWithComment<"many" | "one"> | true,
    private mode: "many" | "first",
  ) {}

  prepare(): MySqlEffectPreparedQueryKind<
    any,
    MySqlPreparedQueryConfig & { execute: TResult; iterator: never }
  > {
    const { query, builtQuery } = this._toSQL();
    return this.session.prepareRelationalQuery(
      builtQuery,
      undefined,
      makeDefaultRqbMapper({
        isFirst: this.mode === "first",
        parseJson: false,
        parseJsonIfString: false,
        rootJsonMappers: true,
        selection: query.selection,
      }),
      {
        isFirst: this.mode === "first",
        parseJson: false,
        parseJsonIfString: false,
        rootJsonMappers: true,
        selection: query.selection,
      },
    ) as MySqlEffectPreparedQueryKind<
      any,
      MySqlPreparedQueryConfig & { execute: TResult; iterator: never }
    >;
  }

  private _getQuery() {
    return this.dialect.buildRelationalQuery({
      schema: this.schema,
      table: this.table,
      tableConfig: this.tableConfig,
      queryConfig: this.config,
      mode: this.mode,
    });
  }

  private _toSQL(): { query: BuildRelationalQueryResult; builtQuery: Query } {
    const query = this._getQuery();

    const builtQuery = this.dialect.sqlToQuery(query.sql);

    return { builtQuery, query };
  }

  /** @internal */
  getSQL(): SQL {
    return this._getQuery().sql;
  }

  toSQL(): Query {
    return this._toSQL().builtQuery;
  }

  execute(placeholderValues?: Record<string, unknown>) {
    return this.prepare().execute(placeholderValues);
  }
}

applyEffectWrapper(MySqlEffectRelationalQuery);
