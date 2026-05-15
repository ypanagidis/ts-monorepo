import { index, snakeCase } from "drizzle-orm/mysql-core";

export const user = snakeCase.table("user", (t) => ({
  id: t.varchar({ length: 255 }).primaryKey(),
  name: t.text().notNull(),
  email: t.varchar({ length: 255 }).notNull().unique(),
  emailVerified: t.boolean().default(false).notNull(),
  image: t.text(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().onUpdateNow().notNull(),
}));

export const session = snakeCase.table(
  "session",
  (t) => ({
    id: t.varchar({ length: 255 }).primaryKey(),
    expiresAt: t.timestamp().notNull(),
    token: t.varchar({ length: 255 }).notNull().unique(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp().defaultNow().onUpdateNow().notNull(),
    ipAddress: t.varchar({ length: 45 }),
    userAgent: t.text(),
    userId: t
      .varchar({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  }),
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = snakeCase.table(
  "account",
  (t) => ({
    id: t.varchar({ length: 255 }).primaryKey(),
    accountId: t.varchar({ length: 255 }).notNull(),
    providerId: t.varchar({ length: 255 }).notNull(),
    userId: t
      .varchar({ length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: t.text(),
    refreshToken: t.text(),
    idToken: t.text(),
    accessTokenExpiresAt: t.timestamp(),
    refreshTokenExpiresAt: t.timestamp(),
    scope: t.text(),
    password: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp().defaultNow().onUpdateNow().notNull(),
  }),
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = snakeCase.table(
  "verification",
  (t) => ({
    id: t.varchar({ length: 255 }).primaryKey(),
    identifier: t.varchar({ length: 255 }).notNull(),
    value: t.text().notNull(),
    expiresAt: t.timestamp().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp().defaultNow().onUpdateNow().notNull(),
  }),
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
