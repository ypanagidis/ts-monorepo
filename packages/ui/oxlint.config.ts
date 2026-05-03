import { defineConfig } from "oxlint";

import { baseConfig, mergeConfigs } from "@acme/oxlint-config/base";
import { reactConfig } from "@acme/oxlint-config/react";

export default defineConfig(
  mergeConfigs(baseConfig, reactConfig, {
    ignorePatterns: ["dist/**"],
  }),
);
