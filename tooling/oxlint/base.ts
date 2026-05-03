import { defineConfig } from "oxlint";

type OxlintConfig = Parameters<typeof defineConfig>[0];

const mergeUnique = <T>(...values: (T[] | null | undefined)[]) => [
  ...new Set(values.flatMap((value) => value ?? [])),
];

export const mergeConfigs = (...configs: OxlintConfig[]): OxlintConfig =>
  configs.reduce<OxlintConfig>(
    (merged, config) => ({
      ...merged,
      ...config,
      categories: {
        ...merged.categories,
        ...config.categories,
      },
      env: {
        ...merged.env,
        ...config.env,
      },
      globals: {
        ...merged.globals,
        ...config.globals,
      },
      ignorePatterns: mergeUnique(merged.ignorePatterns, config.ignorePatterns),
      jsPlugins: mergeUnique(merged.jsPlugins, config.jsPlugins),
      options: {
        ...merged.options,
        ...config.options,
      },
      overrides: [...(merged.overrides ?? []), ...(config.overrides ?? [])],
      plugins: mergeUnique(merged.plugins, config.plugins),
      rules: {
        ...merged.rules,
        ...config.rules,
      },
      settings: {
        ...merged.settings,
        ...config.settings,
      },
    }),
    {},
  );

export const restrictEnvAccess = defineConfig({
  overrides: [
    {
      files: ["**/*.js", "**/*.ts", "**/*.tsx"],
      rules: {
        "acme/no-process-env": "error",
        "eslint/no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "process",
                importNames: ["env"],
                message:
                  "Use `import { env } from '~/env'` instead to ensure validated types.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["**/env.ts"],
      rules: {
        "acme/no-process-env": "off",
        "eslint/no-restricted-imports": "off",
      },
    },
  ],
});

export const baseConfig = defineConfig({
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  env: {
    browser: true,
    es2026: true,
    node: true,
  },
  ignorePatterns: ["**/*.config.*"],
  jsPlugins: [
    { name: "acme", specifier: "@acme/oxlint-config/acme-plugin" },
    "eslint-plugin-turbo",
  ],
  options: {
    reportUnusedDisableDirectives: "error",
  },
  plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
  rules: {
    "eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "import/no-unassigned-import": "off",
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    "turbo/no-undeclared-env-vars": "error",
    "typescript/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", fixStyle: "separate-type-imports" },
    ],
    "typescript/no-misused-promises": [
      "error",
      { checksVoidReturn: { attributes: false } },
    ],
    "typescript/no-non-null-assertion": "error",
    "typescript/no-unnecessary-condition": [
      "error",
      { allowConstantLoopConditions: true },
    ],
  },
});
