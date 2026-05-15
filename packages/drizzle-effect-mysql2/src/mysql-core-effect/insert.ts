import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type {
  MySqlQueryResultHKT,
  MySqlQueryResultKind,
} from "drizzle-orm/mysql-core/session";
import type { MySqlTable } from "drizzle-orm/mysql-core/table";
import type { SQL } from "drizzle-orm/sql/sql";
import type * as Effect from "effect/Effect";

import {
  applyEffectWrapper,
  type QueryEffectHKTBase,
} from "drizzle-orm/effect-core/query-effect";
import { entityKind, is } from "drizzle-orm/entity";
import {
  MySqlInsertBase,
  type MySqlInsertSelectQueryBuilder,
  type MySqlInsertValue,
} from "drizzle-orm/mysql-core/query-builders/insert";
import { QueryBuilder } from "drizzle-orm/mysql-core/query-builders/query-builder";
import { Param, SQL as SQLClass } from "drizzle-orm/sql/sql";
import { Table } from "drizzle-orm/table";
import { haveSameKeys } from "drizzle-orm/utils";

import type { MySqlEffectSession } from "./session.ts";

const TableColumns = (Table as unknown as { Symbol: { Columns: symbol } })
  .Symbol.Columns;

export class MySqlEffectInsertBuilder<
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> {
  static readonly [entityKind]: string = "MySqlEffectInsertBuilder";

  private shouldIgnore = false;

  constructor(
    private table: TTable,
    private session: MySqlEffectSession<TEffectHKT>,
    private dialect: MySqlDialect,
  ) {}

  ignore(): this {
    this.shouldIgnore = true;
    return this;
  }

  values(
    value: MySqlInsertValue<TTable>,
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT>;
  values(
    values: MySqlInsertValue<TTable>[],
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT>;
  values(
    values: MySqlInsertValue<TTable> | MySqlInsertValue<TTable>[],
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT> {
    values = Array.isArray(values) ? values : [values];
    if (values.length === 0) {
      throw new Error("values() must be called with at least one value");
    }
    const mappedValues = values.map((entry) => {
      const result: Record<string, Param | SQL> = {};
      const cols = (this.table as any)[TableColumns];
      for (const colKey of Object.keys(entry)) {
        const colValue = entry[colKey as keyof typeof entry];
        result[colKey] = is(colValue, SQLClass)
          ? colValue
          : new Param(colValue, cols[colKey]);
      }
      return result;
    });

    return new MySqlEffectInsertBase(
      this.table,
      mappedValues,
      this.shouldIgnore,
      this.session as any,
      this.dialect,
    );
  }

  select(
    selectQuery: (qb: QueryBuilder) => MySqlInsertSelectQueryBuilder<TTable>,
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT>;
  select(
    selectQuery: (qb: QueryBuilder) => SQL,
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT>;
  select(
    selectQuery: SQL,
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT>;
  select(
    selectQuery: MySqlInsertSelectQueryBuilder<TTable>,
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT>;
  select(
    selectQuery:
      | SQL
      | MySqlInsertSelectQueryBuilder<TTable>
      | ((qb: QueryBuilder) => MySqlInsertSelectQueryBuilder<TTable> | SQL),
  ): MySqlEffectInsertBase<TTable, TQueryResult, undefined, TEffectHKT> {
    const select =
      typeof selectQuery === "function"
        ? selectQuery(new QueryBuilder())
        : selectQuery;

    if (
      !is(select, SQLClass) &&
      !haveSameKeys((this.table as any)[TableColumns], select._.selectedFields)
    ) {
      throw new Error(
        "Insert select error: selected fields are not the same or are in a different order compared to the table definition",
      );
    }

    return new MySqlEffectInsertBase(
      this.table,
      select,
      this.shouldIgnore,
      this.session as any,
      this.dialect,
      true,
    );
  }
}

export interface MySqlEffectInsertBase<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  TReturning extends Record<string, unknown> | undefined = undefined,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends Effect.Effect<
  TReturning extends undefined
    ? MySqlQueryResultKind<TQueryResult, never>
    : TReturning[],
  TEffectHKT["error"],
  TEffectHKT["context"]
> {}

export class MySqlEffectInsertBase<
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  TReturning extends Record<string, unknown> | undefined = undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends MySqlInsertBase<TTable, TQueryResult, any, TReturning, true> {
  static override readonly [entityKind]: string = "MySqlEffectInsert";

  override $returningId(): any {
    super.$returningId();
    return this as any;
  }
}

applyEffectWrapper(MySqlEffectInsertBase);
