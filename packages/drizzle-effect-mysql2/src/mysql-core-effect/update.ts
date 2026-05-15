import type { MySqlDialect } from "drizzle-orm/mysql-core/dialect";
import type {
  MySqlQueryResultHKT,
  MySqlQueryResultKind,
} from "drizzle-orm/mysql-core/session";
import type { MySqlTable } from "drizzle-orm/mysql-core/table";
import type { SQLWrapper } from "drizzle-orm/sql/sql";
import type * as Effect from "effect/Effect";

import {
  applyEffectWrapper,
  type QueryEffectHKTBase,
} from "drizzle-orm/effect-core/query-effect";
import { entityKind } from "drizzle-orm/entity";
import {
  MySqlUpdateBase,
  type MySqlUpdateSetSource,
} from "drizzle-orm/mysql-core/query-builders/update";

import type { MySqlEffectSession } from "./session.ts";

import { mapUpdateSet } from "../drizzle-internals.ts";

export class MySqlEffectUpdateBuilder<
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> {
  static readonly [entityKind]: string = "MySqlEffectUpdateBuilder";

  constructor(
    private table: TTable,
    private session: MySqlEffectSession<TEffectHKT>,
    private dialect: MySqlDialect,
  ) {}

  set(
    values: MySqlUpdateSetSource<TTable>,
  ): MySqlEffectUpdateBase<TTable, TQueryResult, TEffectHKT> {
    return new MySqlEffectUpdateBase(
      this.table,
      mapUpdateSet(this.table, values),
      this.session as any,
      this.dialect,
    );
  }
}

export interface MySqlEffectUpdateBase<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
>
  extends
    Effect.Effect<
      MySqlQueryResultKind<TQueryResult, never>,
      TEffectHKT["error"],
      TEffectHKT["context"]
    >,
    SQLWrapper {}

export class MySqlEffectUpdateBase<
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends MySqlUpdateBase<TTable, TQueryResult, any, true> {
  static override readonly [entityKind]: string = "MySqlEffectUpdate";
}

applyEffectWrapper(MySqlEffectUpdateBase);
