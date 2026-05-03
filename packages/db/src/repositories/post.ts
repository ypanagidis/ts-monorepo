import { eq } from "drizzle-orm";
import { Context, Effect, Layer, ManagedRuntime, Schema } from "effect";

import { DbLive, DbService } from "../effect-client";
import { Post as PostTable } from "../schema";

export type Post = typeof PostTable.$inferSelect;
export type NewPost = typeof PostTable.$inferInsert;

export type CreatePostInput = Pick<NewPost, "title" | "content">;

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
  return effect.pipe(
    Effect.mapError((cause) => mapPostRepoError(operation, cause)),
  );
};

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

export const PostRepoLive = Layer.effect(
  PostRepo,
  Effect.gen(function* () {
    const db = yield* DbService;

    return PostRepo.of({
      listPosts: () =>
        withPostRepoError(
          "listPosts",
          db.query.Post.findMany({
            orderBy: { id: "desc" },
            limit: 10,
          }),
        ),

      getPostById: (id) =>
        withPostRepoError(
          "getPostById",
          db.query.Post.findFirst({ where: { id } }),
        ),

      createPost: (input) =>
        withPostRepoError(
          "createPost",
          Effect.gen(function* () {
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
          db.delete(PostTable).where(eq(PostTable.id, id)).pipe(Effect.asVoid),
        ),
    } satisfies PostRepoService);
  }),
);

const postRepoMemoMap = Layer.makeMemoMapUnsafe();

export const PostRepoRuntime = ManagedRuntime.make(
  PostRepoLive.pipe(Layer.provide(DbLive)),
  { memoMap: postRepoMemoMap },
);
