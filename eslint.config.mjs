import js from "@eslint/js";
import tseslint from "typescript-eslint";
import markdown from "@eslint/markdown";
import * as jsonParser from "jsonc-eslint-parser";
import * as yamlParser from "yaml-eslint-parser";
import * as plainParser from "eslint-parser-plain";
import prettier from "eslint-config-prettier/flat";
import eslintPlugin from "eslint-plugin-eslint-plugin";
import repertoire from "./src/index.ts";

// The plugin lints itself, across every file it ships or is built from.
// `src/replaceable.ts` and the tests hold the denied characters as data, so
// both are exempt. Everything else is held to the rule, including this file.
const repertoireRules = {
  "repertoire/no-undeclared-characters": ["error", { languages: ["en"] }],
};

export default tseslint.config(
  { ignores: ["dist/", "coverage/", "node_modules/"] },

  // The conventions every ESLint plugin is expected to follow: required meta
  // fields, canonical property order, a schema for every option.
  {
    files: ["src/**/*.ts"],
    extends: [eslintPlugin.configs.recommended],
  },

  // TypeScript, linted with type information. The type-checked sets read the
  // checker rather than the syntax, catching a floating promise or a needless
  // assertion that parsing alone cannot find. Every `.ts` file is in
  // `tsconfig.json`, which is what `projectService` needs to type them.
  {
    files: ["**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { repertoire },
    rules: repertoireRules,
  },

  // This file. It is not TypeScript, so the untyped set is all that applies.
  {
    files: ["**/*.mjs"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { repertoire },
    rules: repertoireRules,
  },

  {
    files: ["**/*.md"],
    language: "markdown/gfm",
    plugins: { markdown, repertoire },
    rules: repertoireRules,
  },

  {
    files: ["**/*.json"],
    languageOptions: { parser: jsonParser },
    plugins: { repertoire },
    rules: repertoireRules,
  },

  {
    files: ["**/*.yml", "**/*.yaml"],
    languageOptions: { parser: yamlParser },
    plugins: { repertoire },
    rules: repertoireRules,
  },

  // Files no parser reads. Nothing is exempt: there is no tree to tell a string
  // from a comment, which is the behaviour the rule is designed around.
  {
    files: ["LICENSE", ".gitignore", ".npmrc", ".nvmrc", ".husky/pre-*"],
    languageOptions: { parser: plainParser },
    plugins: { repertoire },
    rules: repertoireRules,
  },

  {
    files: ["src/replaceable.ts", "test/**/*.ts"],
    rules: { "repertoire/no-undeclared-characters": "off" },
  },

  // Last, so it wins: turns off rules Prettier would fight over during --fix.
  // Only `no-unexpected-multiline` matches today, but this keeps it true as
  // rules are added.
  prettier,
);
