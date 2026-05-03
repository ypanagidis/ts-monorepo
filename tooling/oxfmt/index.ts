import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: [".cache/**"],
  printWidth: 80,
  sortImports: {
    customGroups: [
      {
        groupName: "react-libs",
        elementNamePattern: [
          "react",
          "react-*",
          "react-native",
          "react-native-*",
        ],
      },
      {
        groupName: "acme-types",
        elementNamePattern: ["@acme", "@acme/**"],
        modifiers: ["type"],
      },
      {
        groupName: "acme",
        elementNamePattern: ["@acme", "@acme/**"],
      },
      {
        groupName: "internal-types",
        elementNamePattern: ["~/**", "./**", "../**"],
        modifiers: ["type"],
      },
    ],
    groups: [
      "type",
      "react-libs",
      "external",
      "acme-types",
      "acme",
      "internal-types",
      "internal",
      ["parent", "sibling", "index"],
      "style",
      "unknown",
    ],
    internalPattern: ["~/", "@/", "@acme/"],
  },
  sortTailwindcss: {
    functions: ["cn", "cva"],
  },
});
