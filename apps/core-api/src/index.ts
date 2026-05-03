import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { HttpApiScalar } from "effect/unstable/httpapi";

import { CoreApi } from "@acme/api-contracts";
import { DbLive } from "@acme/db/effect-client";
import { PostRepoLive } from "@acme/db/repositories";

import { CoreApiConfig } from "./config.js";
import { makeCoreApiHttpApiLayer } from "./routes/core-api.http-api.js";

import { createServer } from "node:http";

const databaseLayer = PostRepoLive.pipe(Layer.provide(DbLive));

const apiLayer = makeCoreApiHttpApiLayer();

const docsLayer = HttpApiScalar.layer(CoreApi, {
  path: "/docs",
  scalar: {
    theme: "saturn",
    layout: "classic",
    darkMode: true,
    defaultOpenAllTags: false,
  },
});

const makeServerLayer = Effect.gen(function* () {
  const config = yield* CoreApiConfig;
  const corsLayer = HttpRouter.cors({
    allowedOrigins: config.corsAllowedOrigins,
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization"],
    exposedHeaders: ["location"],
    maxAge: 86_400,
  });

  const appLayer = Layer.mergeAll(apiLayer, docsLayer, corsLayer);

  yield* Effect.logInfo(`Starting core-api on port ${config.port}`);

  return HttpRouter.serve(appLayer).pipe(
    Layer.provide(NodeHttpServer.layer(createServer, { port: config.port })),
  );
});

const serverLayer = Layer.unwrap(makeServerLayer).pipe(
  Layer.provide(CoreApiConfig.layer),
  Layer.provide(databaseLayer),
);

Layer.launch(serverLayer).pipe(NodeRuntime.runMain);
