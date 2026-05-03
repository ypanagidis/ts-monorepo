import { defineConfig } from "oxlint";

import {
  baseConfig,
  mergeConfigs,
  restrictEnvAccess,
} from "@acme/oxlint-config/base";

export default defineConfig(
  mergeConfigs(baseConfig, restrictEnvAccess, {
    ignorePatterns: ["script/**"],
  }),
);
