import { Effect } from "effect";

import type {
  CreatePostPayload,
  ListPostsResponse,
  Post as ApiPost,
} from "@acme/api-contracts";
import type { Post as DbPost, PostRepoError } from "@acme/db/repositories";

import {
  PostNotFoundError,
  PostServiceUnavailableError,
} from "@acme/api-contracts";
import { PostRepo } from "@acme/db/repositories";

const toApiPost = (post: DbPost): ApiPost => ({
  id: post.id,
  title: post.title,
  content: post.content,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});

const toServiceUnavailable = (
  error: PostRepoError,
): PostServiceUnavailableError => {
  return PostServiceUnavailableError.make({
    message: error.message,
  });
};

const withPostBoundaryError = <A>(
  effect: Effect.Effect<A, PostRepoError, PostRepo>,
): Effect.Effect<A, PostServiceUnavailableError, PostRepo> => {
  return effect.pipe(Effect.mapError(toServiceUnavailable));
};

export const listPosts = Effect.fn("coreApi.posts.listPosts")(function* () {
  const posts = yield* withPostBoundaryError(
    PostRepo.use((repo) => repo.listPosts()),
  );

  return {
    items: posts.map(toApiPost),
  } satisfies ListPostsResponse;
});

export const getPost = Effect.fn("coreApi.posts.getPost")(function* (
  postId: string,
) {
  const post = yield* withPostBoundaryError(
    PostRepo.use((repo) => repo.getPostById(postId)),
  );

  if (post === undefined) {
    return yield* Effect.fail(
      PostNotFoundError.make({
        message: `Post ${postId} was not found.`,
      }),
    );
  }

  return toApiPost(post);
});

export const createPost = Effect.fn("coreApi.posts.createPost")(function* (
  payload: CreatePostPayload,
) {
  const post = yield* withPostBoundaryError(
    PostRepo.use((repo) => repo.createPost(payload)),
  );

  return toApiPost(post);
});

export const deletePost = Effect.fn("coreApi.posts.deletePost")(function* (
  postId: string,
) {
  yield* getPost(postId);
  yield* withPostBoundaryError(PostRepo.use((repo) => repo.deletePost(postId)));
});
