import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi,
} from "effect/unstable/httpapi";

export const SystemIndexResponse = Schema.Struct({
  name: Schema.NonEmptyString,
  version: Schema.NonEmptyString,
  docsPath: Schema.NonEmptyString,
  openApiPath: Schema.NonEmptyString,
}).annotate({ identifier: "SystemIndexResponse" });
export type SystemIndexResponse = typeof SystemIndexResponse.Type;

export const SystemHealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
}).annotate({ identifier: "SystemHealthResponse" });
export type SystemHealthResponse = typeof SystemHealthResponse.Type;

export const SystemGroup = HttpApiGroup.make("system")
  .add(
    HttpApiEndpoint.get("getIndex", "/", {
      success: SystemIndexResponse,
    }).annotate(OpenApi.Summary, "API index"),
  )
  .add(
    HttpApiEndpoint.get("health", "/healthz", {
      success: SystemHealthResponse,
    }).annotate(OpenApi.Summary, "Liveness probe"),
  )
  .add(
    HttpApiEndpoint.get("ready", "/readyz", {
      success: SystemHealthResponse,
    }).annotate(OpenApi.Summary, "Readiness probe"),
  )
  .annotate(OpenApi.Description, "System metadata and health probes.");
