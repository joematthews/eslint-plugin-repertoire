// Regenerates the replacement table in the rule documentation from
// `src/replaceable.ts`, which is the only place the pairs are written down.
// `npm run check:generated` runs this and fails if the committed copy differs,
// so the table cannot drift from the map the rule actually uses.
//
// The pairs come from the module rather than its text, so quoting and escapes
// are already resolved. Only the names are read from the source, where they are
// the trailing comment on each entry, in the map's own order.
import { readFileSync, writeFileSync } from "node:fs";
import { REPLACEABLE } from "./src/replaceable.ts";

const SOURCE = "src/replaceable.ts";
const DOC = "docs/rules/no-undeclared-characters.md";
const BEGIN = "<!-- generated from src/replaceable.ts -->";
const END = "<!-- end generated -->";

const ENTRY_LINE = /^\s*\[.+\],\s*\/\/\s*(.+?)\s*$/;

function names(): string[] {
  const found: string[] = [];
  for (const line of readFileSync(SOURCE, "utf8").split("\n")) {
    const match = ENTRY_LINE.exec(line);
    if (match) found.push(match[1]!);
  }
  return found;
}

function codePoint(character: string): string {
  return `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;
}

// A character with nothing to see is named by its code point instead, because a
// code span holding a zero-width space shows the reader an empty box.
function shown(character: string): string {
  return /\s|\p{Cf}/u.test(character) ? codePoint(character) : character;
}

function becomes(ascii: string): string {
  if (ascii === "") return "removed";
  if (ascii === " ") return "a space";
  return `\`${cell(ascii)}\``;
}

// A pipe ends a cell, so an entry that contains one has to escape it.
function cell(value: string): string {
  return value.replaceAll("|", "\\|");
}

const pairs = [...REPLACEABLE];
const labels = names();
if (pairs.length !== labels.length) {
  throw new Error(
    `${SOURCE}: ${pairs.length} entries but ${labels.length} trailing names`,
  );
}

const rows = pairs
  .map(([character, ascii], index) => ({
    character,
    ascii,
    name: labels[index]!,
  }))
  .sort((a, b) => a.character.codePointAt(0)! - b.character.codePointAt(0)!)
  .map(
    (e) =>
      `| \`${cell(shown(e.character))}\` | ${becomes(e.ascii)} | ${e.name} |`,
  );

const table = [
  `${rows.length} characters have an unambiguous ASCII form. Each is reported in every language, and \`--fix\` writes the ASCII unless \`allow\` names the character.`,
  "",
  "| character | becomes | name |",
  "| --- | --- | --- |",
  ...rows,
].join("\n");

const doc = readFileSync(DOC, "utf8");
const begin = doc.indexOf(BEGIN);
const end = doc.indexOf(END);
if (begin === -1 || end === -1) {
  throw new Error(`${DOC} is missing the ${BEGIN} / ${END} markers`);
}

writeFileSync(
  DOC,
  `${doc.slice(0, begin + BEGIN.length)}\n\n${table}\n\n${doc.slice(end)}`,
);
console.log(`Wrote ${rows.length} rows into ${DOC}`);
