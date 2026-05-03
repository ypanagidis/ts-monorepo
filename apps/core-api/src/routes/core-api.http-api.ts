import { Layer } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CoreApi } from "@acme/api-contracts";

import { PostsHandlersLive } from "./posts/posts.http-api.js";
import { SystemHandlersLive } from "./system/system.http-api.js";

const CoreApiHandlersLive = Layer.mergeAll(
  SystemHandlersLive,
  PostsHandlersLive,
);

export const makeCoreApiHttpApiLayer = () => {
  return HttpApiBuilder.layer(CoreApi, { openapiPath: "/openapi.json" }).pipe(
    Layer.provide(CoreApiHandlersLive),
  );
};
