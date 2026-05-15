import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type { IndexConfig } from "drizzle-orm/mysql-core/query-builders/select";
import type { SelectedFields } from "drizzle-orm/mysql-core/query-builders/select.types";
import type {
  BuildSubquerySelection,
  GetSelectTableName,
  GetSelectTableSelection,
  JoinNullability,
  SelectMode,
  SelectResult,
} from "drizzle-orm/query-builders/select.types";
import type { ColumnsSelection, SQL } from "drizzle-orm/sql/sql";
import type * as Effect from "effect/Effect";

import {
  applyEffectWrapper,
  type QueryEffectHKTBase,
} from "drizzle-orm/effect-core/query-effect";
import { entityKind, is } from "drizzle-orm/entity";
import { MySqlSelectBase } from "drizzle-orm/mysql-core/query-builders/select";
import { MySqlTable } from "drizzle-orm/mysql-core/table";
import { convertIndexToString, toArray } from "drizzle-orm/mysql-core/utils";
import { MySqlViewBase } from "drizzle-orm/mysql-core/view-base";
import { SQL as SQLClass } from "drizzle-orm/sql/sql";
import { Subquery } from "drizzle-orm/subquery";
import { getTableColumns } from "drizzle-orm/utils";
import { ViewBaseConfig } from "drizzle-orm/view-common";

import type { MySqlEffectSession } from "./session.ts";

export type MySqlEffectSelectBuilder<
  TSelection extends SelectedFields | undefined,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> = MySqlEffectSelectBuilderBase<TSelection, TEffectHKT>;

export class MySqlEffectSelectBuilderBase<
  TSelection extends SelectedFields | undefined,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
  TBuilderMode extends "db" | "qb" = "db",
> {
  static readonly [entityKind]: string = "MySqlEffectSelectBuilder";

  private fields: TSelection;
  private session: MySqlEffectSession<TEffectHKT> | undefined;
  private dialect: MySqlDialect;
  private withList: Subquery[] = [];
  private distinct: boolean | undefined;

  constructor(config: {
    fields: TSelection;
    session: MySqlEffectSession<TEffectHKT> | undefined;
    dialect: MySqlDialect;
    withList?: Subquery[];
    distinct?: boolean;
  }) {
    this.fields = config.fields;
    this.session = config.session;
    this.dialect = config.dialect;
    if (config.withList) {
      this.withList = config.withList;
    }
    this.distinct = config.distinct;
  }

  from<TFrom extends MySqlTable | Subquery | MySqlViewBase | SQL>(
    source: TFrom,
    onIndex?: TFrom extends MySqlTable
      ? IndexConfig
      : "Index hint configuration is allowed only for MySqlTable and not for subqueries or views",
  ): MySqlEffectSelectBase<
    GetSelectTableName<TFrom>,
    TSelection extends undefined ? GetSelectTableSelection<TFrom> : TSelection,
    TSelection extends undefined ? "single" : "partial",
    GetSelectTableName<TFrom> extends string
      ? Record<GetSelectTableName<TFrom>, "not-null">
      : {},
    TBuilderMode extends "qb" ? true : false,
    never,
    SelectResult<
      TSelection extends undefined
        ? GetSelectTableSelection<TFrom>
        : TSelection,
      TSelection extends undefined ? "single" : "partial",
      GetSelectTableName<TFrom> extends string
        ? Record<GetSelectTableName<TFrom>, "not-null">
        : {}
    >[],
    BuildSubquerySelection<
      TSelection extends undefined
        ? GetSelectTableSelection<TFrom>
        : TSelection,
      GetSelectTableName<TFrom> extends string
        ? Record<GetSelectTableName<TFrom>, "not-null">
        : {}
    >,
    TEffectHKT
  > {
    const isPartialSelect = !!this.fields;

    let fields: SelectedFields;
    if (this.fields) {
      fields = this.fields;
    } else if (is(source, Subquery)) {
      fields = Object.fromEntries(
        Object.keys(source._.selectedFields).map((key) => [
          key,
          source[
            key as unknown as keyof typeof source
          ] as unknown as SelectedFields[string],
        ]),
      );
    } else if (is(source, MySqlViewBase)) {
      fields = (source as any)[ViewBaseConfig].selectedFields as SelectedFields;
    } else if (is(source, SQLClass)) {
      fields = {};
    } else {
      fields = getTableColumns<MySqlTable>(source);
    }

    let useIndex: string[] = [];
    let forceIndex: string[] = [];
    let ignoreIndex: string[] = [];
    if (is(source, MySqlTable) && onIndex && typeof onIndex !== "string") {
      if (onIndex.useIndex) {
        useIndex = convertIndexToString(toArray(onIndex.useIndex));
      }
      if (onIndex.forceIndex) {
        forceIndex = convertIndexToString(toArray(onIndex.forceIndex));
      }
      if (onIndex.ignoreIndex) {
        ignoreIndex = convertIndexToString(toArray(onIndex.ignoreIndex));
      }
    }

    return new MySqlEffectSelectBase({
      table: source,
      fields,
      isPartialSelect,
      session: this.session as any,
      dialect: this.dialect,
      withList: this.withList,
      distinct: this.distinct,
      useIndex,
      forceIndex,
      ignoreIndex,
    }) as any;
  }
}

export interface MySqlEffectSelectBase<
  TTableName extends string | undefined,
  TSelection extends ColumnsSelection,
  TSelectMode extends SelectMode,
  TNullabilityMap extends Record<string, JoinNullability> =
    TTableName extends string ? Record<TTableName, "not-null"> : {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TDynamic extends boolean = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TExcludedMethods extends string = never,
  TResult extends any[] = SelectResult<
    TSelection,
    TSelectMode,
    TNullabilityMap
  >[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TSelectedFields extends ColumnsSelection = BuildSubquerySelection<
    TSelection,
    TNullabilityMap
  >,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends Effect.Effect<TResult, TEffectHKT["error"], TEffectHKT["context"]> {}

export class MySqlEffectSelectBase<
  TTableName extends string | undefined,
  TSelection,
  TSelectMode extends SelectMode,
  TNullabilityMap extends Record<string, JoinNullability> =
    TTableName extends string ? Record<TTableName, "not-null"> : {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TDynamic extends boolean = false,
  TExcludedMethods extends string = never,
  TResult = SelectResult<TSelection, TSelectMode, TNullabilityMap>[],
  TSelectedFields = BuildSubquerySelection<TSelection, TNullabilityMap>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends MySqlSelectBase<
  TTableName,
  TSelection,
  TSelectMode,
  any,
  TNullabilityMap,
  true,
  TExcludedMethods,
  TResult,
  TSelectedFields
> {
  static override readonly [entityKind]: string = "MySqlEffectSelect";

  override getSQL(): SQL {
    return this.dialect.buildSelectQuery(this.config);
  }
}

applyEffectWrapper(MySqlEffectSelectBase);
