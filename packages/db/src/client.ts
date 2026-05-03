import { sql } from "@vercel/postgres";
import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/vercel-postgres";

import * as schema from "./schema";

const relations = defineRelations(schema);

export const db = drizzle(sql, { relations });
