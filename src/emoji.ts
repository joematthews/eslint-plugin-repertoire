import { gemoji } from "gemoji";

// `gemoji` is GitHub's own dataset, so a shortcode from here is one GitHub
// renders. Built lazily: a few thousand entries most projects never ask for.
let names: Map<string, string> | undefined;

// Undefined when no shortcode exists for the character.
export function shortcodeFor(character: string): string | undefined {
  names ??= new Map(gemoji.map((entry) => [entry.emoji, entry.names[0]!]));
  const name = names.get(character);
  return name === undefined ? undefined : `:${name}:`;
}
