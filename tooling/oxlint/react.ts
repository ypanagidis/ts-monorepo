import { defineConfig } from "oxlint";

export const reactConfig = defineConfig({
  plugins: ["react", "jsx-a11y"],
  rules: {
    "react/no-children-prop": "off",
    "react/react-in-jsx-scope": "off",
  },
  settings: {
    react: {
      version: "19.1.4",
    },
  },
});
