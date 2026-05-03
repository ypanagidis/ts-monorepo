import { defineConfig } from "oxlint";

import {
  baseConfig,
  mergeConfigs,
  restrictEnvAccess,
} from "@acme/oxlint-config/base";
import { reactConfig } from "@acme/oxlint-config/react";

export default defineConfig(
  mergeConfigs(baseConfig, reactConfig, restrictEnvAccess, {
    ignorePatterns: [
      ".nitro/**",
      ".output/**",
      ".tanstack/**",
      "src/routeTree.gen.ts",
    ],
  }),
);
