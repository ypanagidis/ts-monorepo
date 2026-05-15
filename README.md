# Full-Stack TypeScript Template

A pnpm/Turborepo template for building full-stack TypeScript applications with TanStack Start, Effect, Better Auth, Drizzle, tRPC, and OXC-powered tooling.

This repo was started from [t3-oss/create-t3-turbo](https://github.com/t3-oss/create-t3-turbo). The original starter has been adapted substantially: this template adds an Effect Platform service, Effect-backed database access, modern OXC lint/format tooling, `tsgo` typechecking, TanStack Form helpers, and Drizzle 1.0 RC support.

## What Is Included

```text
apps
  core-api            Standalone Effect Platform HTTP API
  tanstack-start      TanStack Start web app with tRPC, auth, forms, and query
packages
  api                 tRPC router package used by the web app
  api-contracts       Effect HttpApi contracts for the standalone API
  auth                Better Auth setup and schema generation
  db                  Drizzle schema, clients, and Effect repository services
  shared              Shared app helpers, including TanStack Form bindings
  ui                  shadcn-style React UI package
  validators          Shared Zod validation schemas
tooling
  github              Shared GitHub configuration package
  oxfmt               Shared oxfmt configuration
  oxlint              Shared oxlint configuration and local rules
  tailwind            Shared Tailwind configuration
  typescript          Shared strict TypeScript configuration
.agents
  skills              Local agent skills installed from mattpocock/skills
skills-lock.json      Pinned skill sources and hashes
```

The workspace still uses `@acme` as the placeholder package scope. Rename it when you turn the template into a real product.

## Stack

| Area            | Choice                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Package manager | pnpm `10.19.0`                                                                                               |
| Monorepo runner | Turborepo `^2.5.8`                                                                                           |
| Runtime         | Node `^24.13.0`                                                                                              |
| Web app         | TanStack Start `^1.167.61`, TanStack Router `^1.169.1`, React `19.1.4`, Vite `7.1.12`, Nitro `3.0.1-alpha.1` |
| Data fetching   | TanStack Query `^5.100.8`, `@trpc/tanstack-react-query` `^11.7.1`, SuperJSON                                 |
| Forms           | TanStack Form `1.29.1` with shared field/form components in `@acme/shared/form`                              |
| API             | tRPC `^11.7.1` inside the web app and Effect HttpApi for the standalone API                                  |
| Auth            | Better Auth `1.6.9` with the Drizzle adapter and Discord OAuth wiring                                        |
| Database        | MySQL 8 via Docker, local Drizzle ORM build, Drizzle Kit `1.0.0-rc.1`, Drizzle Zod                    |
| Effect          | Effect `4.0.0-beta.60`, `@effect/platform-node`, `@effect/sql-mysql2`, Effect language service               |
| Validation      | Zod `4.4.2`                                                                                                  |
| Styling         | Tailwind CSS `^4.1.16`, shadcn-style UI package, Base UI primitives                                          |
| Linting         | oxlint `^1.62.0`, `oxlint-tsgolint` `^0.22.1`, shared repo rules                                             |
| Formatting      | oxfmt `^0.47.0` with import sorting and Tailwind class sorting                                               |
| Typechecking    | `tsgo` from `@typescript/native-preview` `7.0.0-dev.20260421.2`                                              |

## Applications

### `apps/tanstack-start`

The web app runs on port `3001` in development. It uses TanStack Start with file-based routes and server routes for `/api/trpc/*` and `/api/auth/*`.

Key pieces:

- TanStack Router preloads route data with `defaultPreload: "intent"`.
- TanStack Query is integrated with router SSR hydration through `@tanstack/react-router-ssr-query`.
- tRPC is exposed from a TanStack Start server route and consumed through `@trpc/tanstack-react-query`.
- Better Auth is exposed from `/api/auth/*` and currently wires Discord OAuth.
- `@acme/shared/form` provides typed TanStack Form primitives for app forms.
- `@acme/ui` provides the shared React component library.

### `apps/core-api`

The standalone API is an Effect Platform service. It defaults to port `4000` and is configured through Effect `Config`.

Routes and docs:

- `GET /` returns API metadata.
- `GET /healthz` and `GET /readyz` return liveness/readiness status.
- `/v1/posts` exposes list, get, create, and delete post endpoints.
- `/openapi.json` exposes the OpenAPI document generated from Effect `HttpApi` contracts.
- `/docs` serves Scalar API docs.

The API composes Effect `Layer`s for config, CORS, route handlers, docs, the database, and repositories.

## Packages

### `@acme/api`

tRPC router package for the TanStack Start app. It exposes `appRouter`, `AppRouter`, context helpers, and routers for auth and posts. Database work is delegated to Effect repository services and converted to Promises only at the tRPC boundary.

### `@acme/api-contracts`

Effect `HttpApi` contracts for the standalone `core-api`. Schemas are defined with Effect `Schema`, annotated for OpenAPI, and shared by the server implementation.

### `@acme/auth`

Better Auth configuration. It uses the Better Auth Drizzle adapter, Discord social login, and the OAuth proxy plugin. The auth schema is generated into `packages/db/src/auth-schema.ts`.

### `@acme/db`

Database package containing:

- Drizzle schema for app tables and generated Better Auth tables.
- A direct Drizzle client for libraries that need the standard adapter.
- An Effect Drizzle client via `drizzle-orm/effect-mysql2`.
- `DbService`, `DbLive`, and `DbTestLive` layers.
- Effect repository services such as `PostRepo` with typed domain errors.

### `@acme/shared`

Shared application utilities. Today this includes `@acme/shared/form`, a TanStack Form wrapper with reusable field components, submit/reset controls, and UI integration.

### `@acme/ui`

Shared React UI package with shadcn-style components, Base UI primitives, Tailwind helpers, charts, toasts, form fields, navigation, overlays, and layout primitives.

### `@acme/validators`

Shared Zod schemas used by forms and API boundaries. The current post form schema preserves nullable form state and transforms it into the stricter create-post input schema.

## Tooling

### oxlint

Every package uses `oxlint --type-aware`. Shared config lives in `tooling/oxlint` and enables correctness/suspicious rules, TypeScript rules, import rules, React/a11y rules where needed, Turbo env checks, and a local `acme/no-process-env` rule to enforce validated environment access.

### oxfmt

Formatting uses `oxfmt`. Shared config lives in `tooling/oxfmt` and sets an 80-column print width, deterministic import ordering, `@acme` import groups, and Tailwind class sorting for `cn` and `cva`.

### tsgo

Typechecking uses `tsgo` through `@typescript/native-preview` for workspace scripts. The shared TypeScript config is strict, includes the Effect language service plugin, uses bundler module resolution, and keeps incremental build info under `.cache`.

### Turborepo

Root scripts fan out through Turbo. `lint` and `typecheck` depend on upstream `topo`/`build` tasks, while `dev`, `format:fix`, database push/studio, and `ui-add` are uncached.

### Agent skills

The repo includes local agent skills from [mattpocock/skills](https://github.com/mattpocock/skills), installed under `.agents/skills` and pinned in `skills-lock.json` with their source paths and hashes.

Installed skills:

- `caveman`
- `diagnose`
- `grill-me`
- `grill-with-docs`
- `improve-codebase-architecture`
- `setup-matt-pocock-skills`
- `tdd`
- `to-issues`
- `to-prd`
- `triage`
- `write-a-skill`
- `zoom-out`

## Requirements

- Node `^24.13.0`
- pnpm `^10.19.0`
- Docker, if you want the local PostgreSQL service

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Start MySQL:

```bash
docker compose up -d mysql
```

Push the Drizzle schema:

```bash
pnpm db:push
```

Generate the Better Auth schema after auth model changes:

```bash
pnpm auth:generate
```

Run the full workspace in watch mode:

```bash
pnpm dev
```

The TanStack Start app runs at `http://localhost:3001`. The standalone Effect API uses `PORT` or defaults to `http://localhost:4000`.

## Environment

`.env.example` documents the local defaults:

```env
MYSQL_URL="mysql://root:mysql@localhost:3306/acme"
APP_URL="http://localhost:3001"
AUTH_SECRET="supersecret"
AUTH_DISCORD_ID=""
AUTH_DISCORD_SECRET=""
```

`apps/core-api` also reads `PORT` and `CORS_ALLOWED_ORIGINS`. `CORS_ALLOWED_ORIGINS="*"` is treated as open CORS by the current config.

## Scripts

| Command              | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `pnpm dev`           | Runs workspace dev tasks through Turbo watch              |
| `pnpm build`         | Builds packages/apps through Turbo                        |
| `pnpm typecheck`     | Runs `tsgo` typechecking across the workspace             |
| `pnpm lint`          | Runs type-aware oxlint across the workspace               |
| `pnpm lint:fix`      | Runs oxlint with `--fix`                                  |
| `pnpm format`        | Checks formatting with oxfmt                              |
| `pnpm format:fix`    | Formats files with oxfmt                                  |
| `pnpm db:push`       | Pushes the Drizzle schema to MySQL                     |
| `pnpm db:studio`     | Opens Drizzle Studio                                      |
| `pnpm auth:generate` | Regenerates Better Auth Drizzle schema                    |
| `pnpm ui-add`        | Runs the shadcn CLI for `@acme/ui` and formats the result |
| `pnpm lint:ws`       | Runs `sherif` workspace checks                            |

## Database And Auth Flow

Local MySQL is defined in `compose.yaml` as `mysql:8`, database `acme`, root password `mysql`, exposed on port `3306`.

Drizzle owns the schema in `packages/db/src/schema.ts`. Better Auth generated tables live in `packages/db/src/auth-schema.ts` and are re-exported from the main schema file.

Auth requests are handled by the TanStack Start server route at `/api/auth/*`. tRPC protected procedures use the auth session in context before running Effect-backed repository work.

## Effect Usage

Effect is used as the service and data-access backbone, not just as a utility dependency.

- `apps/core-api` launches an Effect Platform HTTP server with `Layer.launch` and `NodeRuntime.runMain`.
- `packages/api-contracts` defines HTTP contracts with Effect `HttpApi` and `Schema`.
- `packages/db` exposes an Effect Drizzle client, database layers, transaction-scoped test layer, repository services, and typed repository errors.
- `packages/api` keeps repository methods as Effects until tRPC handlers run them with the runtime provided in request context.

When changing Effect code, consult `effect-solutions` first as required by this repo's agent instructions.

## Adding Things

Add a UI component:

```bash
pnpm ui-add
```

Add a package:

```bash
pnpm turbo gen init
```

After adding env vars, update `.env.example` and `turbo.json` `globalEnv` if the value is read during Turbo tasks.
