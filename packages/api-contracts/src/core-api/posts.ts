import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/unstable/httpapi";

export const PostIdParams = {
  postId: Schema.String.check(Schema.isNonEmpty()),
};

export const Post = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.NullOr(Schema.DateFromString),
}).annotate({ identifier: "Post" });
export type Post = typeof Post.Type;

export const CreatePostPayload = Schema.Struct({
  title: Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
  content: Schema.Trim.check(Schema.isNonEmpty(), Schema.isMaxLength(256)),
}).annotate({ identifier: "CreatePostPayload" });
export type CreatePostPayload = typeof CreatePostPayload.Type;

export const ListPostsResponse = Schema.Struct({
  items: Schema.Array(Post),
}).annotate({ identifier: "ListPostsResponse" });
export type ListPostsResponse = typeof ListPostsResponse.Type;

export const PostNotFoundError = Schema.Struct({
  _tag: Schema.tag("PostNotFoundError"),
  message: Schema.String,
}).pipe(HttpApiSchema.status(404));
export type PostNotFoundError = typeof PostNotFoundError.Type;

export const PostServiceUnavailableError = Schema.Struct({
  _tag: Schema.tag("PostServiceUnavailableError"),
  message: Schema.String,
}).pipe(HttpApiSchema.status(503));
export type PostServiceUnavailableError =
  typeof PostServiceUnavailableError.Type;

const postErrors = [PostNotFoundError, PostServiceUnavailableError] as const;

export const PostsGroup = HttpApiGroup.make("posts")
  .add(
    HttpApiEndpoint.get("listPosts", "/", {
      success: ListPostsResponse,
      error: PostServiceUnavailableError,
    }).annotate(OpenApi.Summary, "List posts"),
  )
  .add(
    HttpApiEndpoint.get("getPost", "/:postId", {
      params: PostIdParams,
      success: Post,
      error: postErrors,
    }).annotate(OpenApi.Summary, "Get a post"),
  )
  .add(
    HttpApiEndpoint.post("createPost", "/", {
      payload: CreatePostPayload,
      success: Post,
      error: PostServiceUnavailableError,
    }).annotate(OpenApi.Summary, "Create a post"),
  )
  .add(
    HttpApiEndpoint.delete("deletePost", "/:postId", {
      params: PostIdParams,
      error: postErrors,
    }).annotate(OpenApi.Summary, "Delete a post"),
  )
  .annotate(OpenApi.Description, "Post read and write endpoints.");
