import { defineConfig } from "oxlint";

import { baseConfig, mergeConfigs } from "@acme/oxlint-config/base";

export default defineConfig(mergeConfigs(baseConfig));
