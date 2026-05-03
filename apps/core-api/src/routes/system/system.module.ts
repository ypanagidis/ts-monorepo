import { Effect } from "effect";

import type {
  SystemHealthResponse,
  SystemIndexResponse,
} from "@acme/api-contracts";

export const getIndex = () => {
  return Effect.succeed({
    name: "core-api",
    version: "0.0.0",
    docsPath: "/docs",
    openApiPath: "/openapi.json",
  } satisfies SystemIndexResponse);
};

export const health = () =>
  Effect.succeed({ status: "ok" } satisfies SystemHealthResponse);

export const ready = () =>
  Effect.succeed({ status: "ok" } satisfies SystemHealthResponse);
