import type { RunnableQuery } from "drizzle-orm/runnable-query";
import type { PreparedQuery } from "drizzle-orm/session";
import type { Query, SQL, SQLWrapper } from "drizzle-orm/sql/sql";
import type * as Effect from "effect/Effect";

import {
  applyEffectWrapper,
  type QueryEffectHKTBase,
} from "drizzle-orm/effect-core/query-effect";
import { entityKind } from "drizzle-orm/entity";

export interface MySqlEffectRaw<
  TResult,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
>
  extends
    Effect.Effect<TResult, TEffectHKT["error"], TEffectHKT["context"]>,
    RunnableQuery<TResult, "mysql">,
    SQLWrapper {}

export class MySqlEffectRaw<
  TResult,
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
> implements RunnableQuery<TResult, "mysql"> {
  static readonly [entityKind]: string = "MySqlEffectRaw";

  declare readonly _: {
    readonly dialect: "mysql";
    readonly result: TResult;
  };

  constructor(
    public execute: () => Effect.Effect<
      TResult,
      TEffectHKT["error"],
      TEffectHKT["context"]
    >,
    private sql: SQL,
    private query: Query,
    private mapBatchResult: (result: unknown) => unknown,
  ) {}

  _prepare(): PreparedQuery {
    return this;
  }

  getSQL(): SQL {
    return this.sql;
  }

  getQuery(): Query {
    return this.query;
  }

  mapResult(response: unknown): unknown {
    return this.mapBatchResult(response);
  }
}

applyEffectWrapper(MySqlEffectRaw);
