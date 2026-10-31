import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
  baseDirectory: fileURLToPath(new URL(".", import.meta.url)),
});

const eslintConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "e2e/artifacts/**",
      "next-env.d.ts",
      "scripts/**", // Preserve the existing tooling exclusion.
      "js/**", // Legacy site scripts, removed before this migration.
      "css/**", // Legacy vendored styles, removed before this migration.
    ],
  },
  { files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"] },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/no-unescaped-entities": "off",
    },
  }),
];

export default eslintConfig;
