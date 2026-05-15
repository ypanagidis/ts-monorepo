import type { Column } from "drizzle-orm/column";
import type { SelectedFieldsOrdered } from "drizzle-orm/operations";
import type { UpdateSet } from "drizzle-orm/utils";

import * as DrizzleUtils from "drizzle-orm/utils";

type RuntimeUtils = typeof DrizzleUtils & {
  readonly jitCompatCheck: (isEnabled: boolean | undefined) => boolean;
  readonly mapResultRow: (
    columns: SelectedFieldsOrdered<Column>,
    row: unknown[],
    joinsNotNullableMap: Record<string, boolean> | undefined,
  ) => Record<string, unknown>;
  readonly mapUpdateSet: (
    table: unknown,
    values: Record<string, unknown>,
  ) => UpdateSet;
};

const utils = DrizzleUtils as RuntimeUtils;

export const jitCompatCheck = utils.jitCompatCheck;
export const mapResultRow = utils.mapResultRow;
export const mapUpdateSet = utils.mapUpdateSet;
