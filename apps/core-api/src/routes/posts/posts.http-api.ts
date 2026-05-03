import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CoreApi } from "@acme/api-contracts";

import { createPost, deletePost, getPost, listPosts } from "./posts.module.js";

export const PostsHandlersLive = HttpApiBuilder.group(
  CoreApi,
  "posts",
  (handlers) => {
    return handlers
      .handle("listPosts", () => listPosts())
      .handle("getPost", ({ params }) => getPost(params.postId))
      .handle("createPost", ({ payload }) => createPost(payload))
      .handle("deletePost", ({ params }) => deletePost(params.postId));
  },
);
