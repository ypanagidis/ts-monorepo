import { eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { DbService } from "../effect-client";
import { Post as PostTable } from "../schema";

export type Post = typeof PostTable.$inferSelect;
export type NewPost = typeof PostTable.$inferInsert;

// Creation is intentionally narrower than the insert shape. Columns like id and
// timestamps are owned by the database/schema defaults, not callers.
export type CreatePostInput = Pick<NewPost, "title" | "content">;

// Keep operation names in one schema so repository errors can say which method
// failed without accepting arbitrary strings.
const postRepoOperationSchema = Schema.Literals([
  "createPost",
  "deletePost",
  "getPostById",
  "listPosts",
]);

export class PostRepoInvariantError extends Schema.TaggedErrorClass<PostRepoInvariantError>()(
  "PostRepoInvariantError",
  {
    operation: postRepoOperationSchema,
    message: Schema.String,
  },
) {}

export class PostRepoUnexpectedError extends Schema.TaggedErrorClass<PostRepoUnexpectedError>()(
  "PostRepoUnexpectedError",
  {
    operation: postRepoOperationSchema,
    message: Schema.String,
    cause: Schema.Defect,
  },
) {}

export const postRepoErrorSchema = Schema.Union([
  PostRepoInvariantError,
  PostRepoUnexpectedError,
]);

export type PostRepoError = typeof postRepoErrorSchema.Type;

type PostRepoOperation = typeof postRepoOperationSchema.Type;

// Repository methods normalize unknown database/adapter failures into typed
// domain errors. Known repository errors pass through unchanged so callers can
// pattern-match on them reliably.
const mapPostRepoError = (
  operation: PostRepoOperation,
  cause: unknown,
): PostRepoError => {
  if (
    cause instanceof PostRepoInvariantError ||
    cause instanceof PostRepoUnexpectedError
  ) {
    return cause;
  }

  return new PostRepoUnexpectedError({
    operation,
    message: cause instanceof Error ? cause.message : `${operation} failed.`,
    cause,
  });
};

const withPostRepoError = <A>(
  operation: PostRepoOperation,
  effect: Effect.Effect<A, unknown>,
): Effect.Effect<A, PostRepoError> => {
  // Drizzle's Effect adapter already returns Effects. This helper only changes
  // the error channel; it does not execute the database operation.
  return effect.pipe(
    Effect.mapError((cause) => mapPostRepoError(operation, cause)),
  );
};

// Service methods have no environment requirements. The layer below supplies
// DbService once, and each method closes over that concrete database service.
export interface PostRepoService {
  readonly listPosts: () => Effect.Effect<readonly Post[], PostRepoError>;
  readonly getPostById: (
    id: string,
  ) => Effect.Effect<Post | undefined, PostRepoError>;
  readonly createPost: (
    input: CreatePostInput,
  ) => Effect.Effect<Post, PostRepoError>;
  readonly deletePost: (id: string) => Effect.Effect<void, PostRepoError>;
}

export class PostRepo extends Context.Service<PostRepo, PostRepoService>()(
  "@acme/db/PostRepo",
) {}

// Live repository implementation. It depends on DbService, so consumers compose
// this layer with DbLive at the application boundary instead of importing a
// global promise runtime from the db package.
export const PostRepoLive = Layer.effect(
  PostRepo,
  Effect.gen(function* () {
    // DbService is the Effect Drizzle database from effect-client.ts. Pull it
    // from the environment once while constructing the repository service.
    const db = yield* DbService;

    return PostRepo.of({
      listPosts: () =>
        withPostRepoError(
          "listPosts",
          // Relational Drizzle query through the Effect adapter. The returned
          // value is still lazy until the api runtime executes the Effect.
          db.query.Post.findMany({
            orderBy: { id: "desc" },
            limit: 10,
          }),
        ),

      getPostById: (id) =>
        withPostRepoError(
          "getPostById",
          // Use findFirst so missing rows become undefined instead of an error.
          db.query.Post.findFirst({ where: { id } }),
        ),

      createPost: (input) =>
        withPostRepoError(
          "createPost",
          Effect.gen(function* () {
            // returning() should produce the inserted row. Treat an empty result
            // as an invariant violation because callers expect a created Post.
            const [created] = yield* db
              .insert(PostTable)
              .values(input)
              .returning();

            if (created === undefined) {
              return yield* new PostRepoInvariantError({
                operation: "createPost",
                message: "Failed to create post.",
              });
            }

            return created;
          }),
        ),

      deletePost: (id) =>
        withPostRepoError(
          "deletePost",
          // Deletes are fire-and-forget from the API perspective; callers only
          // need to know whether the Effect failed.
          db.delete(PostTable).where(eq(PostTable.id, id)).pipe(Effect.asVoid),
        ),
    } satisfies PostRepoService);
  }),
);
