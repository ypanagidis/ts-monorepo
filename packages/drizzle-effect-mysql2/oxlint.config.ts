import { defineConfig } from "oxlint";

import { baseConfig, mergeConfigs } from "@acme/oxlint-config/base";

export default defineConfig(
  mergeConfigs(baseConfig, {
    ignorePatterns: ["dist/**"],
    rules: {
      "eslint/no-underscore-dangle": "off",
      "import/consistent-type-specifier-style": "off",
      "typescript/no-non-null-assertion": "off",
      "typescript/no-redundant-type-constituents": "off",
      "typescript/no-unnecessary-condition": "off",
      "typescript/no-unsafe-declaration-merging": "off",
    },
  }),
);
