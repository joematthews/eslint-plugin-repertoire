// Rebuild src/charsets.json from Unicode CLDR: `npm run extract`.
//
// CLDR publishes the characters each language is written with, which is exactly
// what this plugin asks -- nothing to model, just read the field. Punctuation is
// included minus REPLACEABLE, so a mark with an ASCII form is dropped from every
// language and one without a plain form is kept.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REPLACEABLE } from "./src/replaceable.ts";

const here = dirname(fileURLToPath(import.meta.url));
const CLDR = join(here, "node_modules/cldr-misc-full/main");

// Curated rather than all 766 CLDR locales, most being regional variants that
// repeat their parent. Adding one is a single line and needs no judgement.
const LANGUAGES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "cs",
  "sk",
  "hu",
  "ro",
  "hr",
  "sl",
  "sv",
  "nb",
  "da",
  "fi",
  "is",
  "et",
  "lv",
  "lt",
  "tr",
  "el",
  "ru",
  "uk",
  "bg",
  "sr",
  "he",
  "ar",
  "fa",
  "hi",
  "th",
  "vi",
  "ja",
  "ko",
  "zh",
  "id",
  "ms",
  "sw",
  "af",
  "ca",
  "eu",
  "gl",
  "cy",
  "ga",
];

// Added to every language: source code is written with it whatever the prose.
const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCharCode(0x20 + i),
);

// Expands a CLDR set such as `[a b {ch} d-f]`. Items are space separated;
// braces group a sequence, a backslash escapes, and a hyphen makes a range.
function expand(spec: string): string[] {
  const body = spec.replace(/^\[/, "").replace(/\]$/, "");
  const members: string[] = [];

  for (const token of body.split(/\s+/).filter(Boolean)) {
    const items = [...token.matchAll(/\{([^}]*)\}|\\(.)|(.)-(.)|(.)/gsu)];

    for (const [, braced, escaped, rangeFrom, rangeTo, single] of items) {
      if (braced !== undefined) members.push(braced);
      else if (escaped !== undefined) members.push(escaped);
      else if (rangeFrom !== undefined && rangeTo !== undefined) {
        for (
          let code = rangeFrom.codePointAt(0)!;
          code <= rangeTo.codePointAt(0)!;
          code += 1
        ) {
          members.push(String.fromCodePoint(code));
        }
      } else if (single !== undefined) members.push(single);
    }
  }

  return members;
}

// CLDR lists lowercase only.
function bothCases(characters: string[]): string[] {
  return characters.flatMap((character) => [
    character.toLowerCase(),
    character.toUpperCase(),
  ]);
}

// A mark claimed by this many languages or more is not one language's, whatever
// CLDR's punctuation field says. The measured gap is wide: the marks below sit
// at 23 to 33 languages, and the most widely shared structural mark, Spanish
// `\u00BF`, sits at 5.
const SHARED_BY = 10;

// Whether a punctuation mark belongs to a writing system rather than to a
// typesetter. Unicode answers most of it: a mark that ends a sentence, that
// pairs as a bracket or quote, or that belongs to a script of its own is
// structural. Spanish `\u00BF` and `\u00A1` have none of those properties and
// are still structural, which is what the language count catches -- they are
// claimed by a handful of languages, a typesetter's mark by most of them.
function isStructural(mark: string, languages: number): boolean {
  return (
    /\p{Terminal_Punctuation}/u.test(mark) ||
    /\p{Ps}|\p{Pe}|\p{Pi}|\p{Pf}/u.test(mark) ||
    !/\p{Script=Common}|\p{Script=Latin}/u.test(mark) ||
    languages < SHARED_BY
  );
}

if (!existsSync(CLDR)) {
  console.error("Missing cldr-misc-full. Run `npm install` first.\n");
  process.exit(1);
}

// Per language, the fields this needs, read once.
const sources = new Map<string, { letters: string[]; marks: string[] }>();
for (const language of LANGUAGES) {
  const path = join(CLDR, language, "characters.json");
  if (!existsSync(path)) {
    console.error(`  ${language}: not in CLDR, skipping`);
    continue;
  }
  const { exemplarCharacters, punctuation } = (
    JSON.parse(readFileSync(path, "utf-8")) as {
      main: Record<
        string,
        { characters: { exemplarCharacters: string; punctuation?: string } }
      >;
    }
  ).main[language]!.characters;
  sources.set(language, {
    letters: bothCases(expand(exemplarCharacters)),
    marks: expand(punctuation ?? "").filter((mark) => !REPLACEABLE.has(mark)),
  });
}

// How many languages claim each mark, which the classifier needs before it can
// judge any single one.
const claims = new Map<string, number>();
for (const { marks } of sources.values()) {
  for (const mark of new Set(marks)) {
    claims.set(mark, (claims.get(mark) ?? 0) + 1);
  }
}

const typographic = new Set(
  [...claims]
    .filter(([mark, n]) => !isStructural(mark, n))
    .map(([mark]) => mark),
);

const charsets: Record<string, string> = {};

for (const [language, { letters, marks }] of sources) {
  const structural = marks.filter((mark) => !typographic.has(mark));

  // Single characters only. CLDR lists sequences such as `{ch}` for languages
  // treating them as one letter, but the rule reads a file character by
  // character.
  const characters = new Set(
    [...ASCII, ...letters, ...structural].filter(
      (character) => [...character].length === 1,
    ),
  );

  charsets[language] = [...characters].sort().join("");
  const beyond = [...characters].filter((c) => !ASCII.includes(c));
  console.log(
    `  ${language.padEnd(3)} ${String(characters.size).padStart(4)}  ${beyond.join("")}`,
  );
}

writeFileSync(
  join(here, "src/charsets.json"),
  `${JSON.stringify(charsets, null, 2)}\n`,
  "utf-8",
);
console.log(
  `\nWrote src/charsets.json (${Object.keys(charsets).length} languages)`,
);
