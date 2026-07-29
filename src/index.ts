import type { ESLint, Linter } from "eslint";
import manifest from "../package.json" with { type: "json" };
import noUndeclaredCharacters from "./no-undeclared-characters.ts";

const plugin = {
  // From package.json, so a release cannot ship a plugin claiming the wrong
  // version.
  meta: { name: manifest.name, version: manifest.version },
  rules: { "no-undeclared-characters": noUndeclaredCharacters },
} satisfies ESLint.Plugin;

/**
 * Shareable configs. `recommended` covers a project written in English.
 *
 * Any other language is a one-line rule entry, so there is no preset per
 * combination:
 *
 * ```js
 * rules: {
 *   "repertoire/no-undeclared-characters": ["error", { languages: ["en", "es"] }],
 * }
 * ```
 */
const configs = {
  recommended: {
    plugins: { repertoire: plugin },
    rules: { "repertoire/no-undeclared-characters": "error" },
  },
} satisfies Record<string, Linter.Config>;

/** The plugin, with its rules and shareable configs. */
export default { ...plugin, configs };

// Types only. A value export here would stop the CommonJS build emitting
// `module.exports = plugin`, forcing `require()` callers through `.default`.
export type { Options } from "./no-undeclared-characters.ts";
