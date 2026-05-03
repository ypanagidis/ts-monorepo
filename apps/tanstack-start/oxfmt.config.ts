import { defineConfig } from "oxfmt";

import baseConfig from "@acme/oxfmt-config";

export default defineConfig({
  ...baseConfig,
  ignorePatterns: [
    ".cache/**",
    ".nitro/**",
    ".output/**",
    ".tanstack/**",
    "src/routeTree.gen.ts",
  ],
});
