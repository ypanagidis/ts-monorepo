import { HttpApiBuilder } from "effect/unstable/httpapi";

import { CoreApi } from "@acme/api-contracts";

import { getIndex, health, ready } from "./system.module.js";

export const SystemHandlersLive = HttpApiBuilder.group(
  CoreApi,
  "system",
  (handlers) => {
    return handlers
      .handle("getIndex", () => getIndex())
      .handle("health", () => health())
      .handle("ready", () => ready());
  },
);
