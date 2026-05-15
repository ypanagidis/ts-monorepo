import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

import * as schema from "./schema";

const connectionString = process.env.MYSQL_URL;

if (!connectionString) {
  throw new Error("Missing MYSQL_URL");
}

const relations = defineRelations(schema);

export const db = drizzle(connectionString, {
  relations,
  schema,
  mode: "default",
});
