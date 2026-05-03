import { HttpApi, OpenApi } from "effect/unstable/httpapi";

import { PostsGroup } from "./posts.js";
import { SystemGroup } from "./system.js";

export const CoreApi = HttpApi.make("coreApi")
  .add(SystemGroup)
  .add(PostsGroup.prefix("/v1/posts"))
  .annotate(OpenApi.Title, "Core API")
  .annotate(OpenApi.Version, "0.0.0")
  .annotate(OpenApi.Description, "Standalone Effect Platform core API.");
