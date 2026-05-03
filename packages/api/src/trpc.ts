/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { Effect, Layer, ManagedRuntime } from "effect";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import type { Auth } from "@acme/auth";
import type { PostRepo } from "@acme/db/repositories";

import { DbLive } from "@acme/db/effect-client";
import { PostRepoLive } from "@acme/db/repositories";

type AuthApi = Auth["api"];

// The api package is the application boundary for database-backed tRPC calls.
// The db package exposes only services and layers; it does not decide how those
// services are run inside a web framework.
const apiLayer = PostRepoLive.pipe(Layer.provide(DbLive));

// Keep one memo map for the long-lived api runtime so expensive layer resources,
// especially the Postgres client pool below DbLive, are built once and reused.
const apiMemoMap = Layer.makeMemoMapUnsafe();

// tRPC is Promise-based, while repository code is Effect-based. This runtime is
// the explicit bridge between those worlds and should be used only at request
// boundaries, not from the db package itself.
export type ApiRuntime = ManagedRuntime.ManagedRuntime<PostRepo, unknown>;

// Shared runtime for the default app wiring. Tests or alternate hosts can pass a
// different runtime into createTRPCContext without changing any router code.
export const apiRuntime: ApiRuntime = ManagedRuntime.make(apiLayer, {
  memoMap: apiMemoMap,
});

export interface TRPCContext {
  // Keep authApi on ctx so auth routes can continue to call the Better Auth API.
  readonly authApi: AuthApi;
  // The session is loaded once while building context so protectedProcedure can
  // refine it before individual routers run.
  readonly session: Awaited<ReturnType<AuthApi["getSession"]>>;
  // All Effect services needed by tRPC procedures are accessed through this
  // runtime. The context carries the runtime, not promise-shaped repository
  // wrappers, so repositories stay expressed as Effect services.
  readonly runtime: ApiRuntime;
}

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

const createTRPCContextEffect = (opts: {
  headers: Headers;
  auth: { api: AuthApi };
  runtime: ApiRuntime;
}) =>
  Effect.gen(function* () {
    const authApi = opts.auth.api;

    // Better Auth still exposes a Promise API. Wrap it once here so context
    // creation remains an Effect program until the final runtime.runPromise call.
    const session = yield* Effect.tryPromise(() =>
      authApi.getSession({
        headers: opts.headers,
      }),
    ).pipe(Effect.orDie);

    return {
      authApi,
      session,
      // Pass the host-provided runtime through ctx so procedures can run repo
      // effects at the tRPC edge while keeping domain/database code Effect-only.
      runtime: opts.runtime,
    };
  });

// tRPC asks createContext for a Promise. This is the single Promise boundary for
// context creation; everything inside createTRPCContextEffect remains Effectful.
export const createTRPCContext = (opts: {
  headers: Headers;
  auth: { api: AuthApi };
  runtime: ApiRuntime;
}) => opts.runtime.runPromise(createTRPCContextEffect(opts));
/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
    },
  }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an articifial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev 100-500ms
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });
