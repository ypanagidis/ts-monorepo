import type { MySqlTable } from "drizzle-orm/mysql-core/table";
import type { MySqlViewBase } from "drizzle-orm/mysql-core/view-base";
import type * as Effect from "effect/Effect";

import {
  applyEffectWrapper,
  type QueryEffectHKTBase,
} from "drizzle-orm/effect-core/query-effect";
import { entityKind } from "drizzle-orm/entity";
import { SQL, sql, type SQLWrapper } from "drizzle-orm/sql/sql";

import type { MySqlEffectSession } from "./session.ts";

export interface MySqlEffectCountBuilder<
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
>
  extends
    SQL<number>,
    Effect.Effect<number, TEffectHKT["error"], TEffectHKT["context"]>,
    SQLWrapper<number> {}

export class MySqlEffectCountBuilder<
  TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase,
>
  extends SQL<number>
  implements SQLWrapper<number>
{
  static override readonly [entityKind]: string = "MySqlEffectCountBuilder";

  private sql: SQL<number>;

  private static buildEmbeddedCount(
    source: MySqlTable | MySqlViewBase | SQL | SQLWrapper,
    filters?: SQL<unknown>,
  ): SQL<number> {
    return sql<number>`(select count(*) from ${source}${sql.raw(" where ").if(filters)}${filters})`;
  }

  private static buildCount(
    source: MySqlTable | MySqlViewBase | SQL | SQLWrapper,
    filters?: SQL<unknown>,
  ): SQL<number> {
    return sql<number>`select count(*) as count from ${source}${sql.raw(" where ").if(filters)}${filters}`;
  }

  constructor(
    readonly params: {
      source: MySqlTable | MySqlViewBase | SQL | SQLWrapper;
      filters?: SQL<unknown>;
      session: MySqlEffectSession<TEffectHKT>;
    },
  ) {
    super(
      MySqlEffectCountBuilder.buildEmbeddedCount(params.source, params.filters)
        .queryChunks,
    );

    this.mapWith(Number);

    this.sql = MySqlEffectCountBuilder.buildCount(
      params.source,
      params.filters,
    );
  }

  execute(): Effect.Effect<number, TEffectHKT["error"], TEffectHKT["context"]> {
    return this.params.session.count(this.sql);
  }
}

applyEffectWrapper(MySqlEffectCountBuilder);
