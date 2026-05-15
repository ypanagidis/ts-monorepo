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
import { MySqlDeleteBase } from "drizzle-orm/mysql-core/query-builders/delete";

import type { MySqlEffectSession } from "./session.ts";

export interface MySqlEffectDeleteBase<
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

export class MySqlEffectDeleteBase<
  TTable extends MySqlTable,
  TQueryResult extends MySqlQueryResultHKT,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> extends MySqlDeleteBase<TTable, TQueryResult, any, true> {
  static override readonly [entityKind]: string = "MySqlEffectDelete";

  constructor(
    table: TTable,
    session: MySqlEffectSession<TEffectHKT>,
    dialect: MySqlDialect,
  ) {
    super(table, session as any, dialect);
  }
}

applyEffectWrapper(MySqlEffectDeleteBase);
