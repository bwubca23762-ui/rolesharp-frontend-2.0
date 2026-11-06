import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Generated/vendor output is not authored source. Linting minified Vue
    // bundles produces thousands of false positives and hides real failures.
    // Must stay in sync with tsconfig.json "exclude" — a dir missing from
    // either list silently breaks that tool. .local/build-backups alone once
    // produced 49,912 phantom lint problems; a stale .next produced 67
    // phantom tsc errors. tests/reliability-fixes.test.ts pins the pairing.
    ignores: [
      ".next/**",
      ".next-*/**",
      ".next-playwright/**",
      ".next-qa-build/**",
      ".local/**",
      // Worktrees live under .claude/worktrees/, each with its own .next. From
      // the main checkout those are just more generated output: linting them
      // produced 14,032 phantom problems, none of them in authored source.
      ".claude/**",
      "bin/**",
      "audits/**",
      "tsconfig.jobs-qa.json",
      ".omo/**",
      "outputs/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/triple-slash-reference": "off",
      "@next/next/no-html-link-for-pages": "off",
      "react/no-unescaped-entities": "off",
      // Underscore-prefixed params are a deliberate "kept for signature
      // compatibility, intentionally unused" signal (retired components that
      // must keep accepting props, override hooks). Not an oversight.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
