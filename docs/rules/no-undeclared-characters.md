# no-undeclared-characters

Reports characters outside the languages a file is written in.

## Options

| option | type | default | meaning |
| --- | --- | --- | --- |
| `languages` | `string[]` | `["en"]` | language codes, as published by [Unicode CLDR](https://cldr.unicode.org/) |
| `allow` | `string[]` | `[]` | characters permitted whatever the languages |

Setting one leaves the other at its default. Printable ASCII is permitted under every setting.

## Setting your languages

Name the languages the file is written in. A character is permitted when any one of them uses it.

```js
// eslint.config.mjs
export default [
  {
    files: ["**/*.ts"],
    plugins: { repertoire },
    rules: {
      "repertoire/no-undeclared-characters": [
        "error",
        { languages: ["de", "pl"] },
      ],
    },
  },
];
```

## Different languages in different files

Configuration is per file glob, so a file with a wider range of languages than the rest of the project gets its own entry. A changelog is the usual case: it carries contributor names from anywhere, whatever language the project itself is written in.

```js
// eslint.config.mjs
import markdown from "@eslint/markdown";
import repertoire from "eslint-plugin-repertoire";

export default [
  {
    files: ["**/*.ts"],
    plugins: { repertoire },
    rules: { "repertoire/no-undeclared-characters": "error" },
  },
  {
    files: ["**/CHANGELOG.md"],
    language: "markdown/gfm",
    plugins: { markdown, repertoire },
    rules: {
      "repertoire/no-undeclared-characters": [
        "error",
        {
          languages: [
            "en",
            "de",
            "es",
            "fr",
            "pl",
            "pt",
            "tr",
            "vi",
            "ja",
            "ko",
            "zh",
          ],
        },
      ],
    },
  },
];
```

Add codes as contributors arrive. The same pattern applies to any file with its own range: a list of authors, a translations file, documentation written in another language.

## `allow`

Characters permitted whatever the languages, for cases a language list does not cover.

```js
"repertoire/no-undeclared-characters": ["error", { allow: ["·", "✅", "≡"] }]
```

`allow` takes precedence over everything else, including the characters denied in every language. Use it for a glyph in terminal output, a mathematical symbol, or a character in a URL. Characters inside strings need no entry, because strings are not checked.

## What the rule does with an edit

| where                                       | reported | fixed | suggested |
| ------------------------------------------- | -------- | ----- | --------- |
| a comment                                   | yes      | yes   | --        |
| markdown text                               | yes      | yes   | --        |
| a string, a JSON value, a `` `code span` `` | no       | --    | --        |
| a URL, anywhere                             | yes      | no    | yes       |
| a markdown link, image or raw HTML block    | yes      | no    | yes       |
| a file no parser reads                      | yes      | no    | yes       |
| a variable or property name                 | yes      | no    | no        |

A suggestion is offered in the editor and is never applied by `--fix`.

In markdown, `--fix` replaces an emoji with its [gemoji](https://github.com/wooorm/gemoji) shortcode: `🚀` becomes `:rocket:`.

## Characters with an ASCII form

<!-- generated from src/replaceable.ts -->

54 characters have an unambiguous ASCII form. Each is reported in every language, and `--fix` writes the ASCII unless `allow` names the character.

| character | becomes | name                                       |
| --------- | ------- | ------------------------------------------ |
| `U+00A0`  | a space | no-break space                             |
| `«`       | `"`     | left-pointing double angle quotation mark  |
| `»`       | `"`     | right-pointing double angle quotation mark |
| `×`       | `x`     | multiplication sign                        |
| `U+2007`  | a space | figure space                               |
| `U+2009`  | a space | thin space                                 |
| `U+200A`  | a space | hair space                                 |
| `U+200B`  | removed | zero width space                           |
| `U+200C`  | removed | zero width non-joiner                      |
| `U+200D`  | removed | zero width joiner                          |
| `‐`       | `-`     | hyphen                                     |
| `‑`       | `-`     | non-breaking hyphen                        |
| `‒`       | `-`     | figure dash                                |
| `–`       | `-`     | en dash                                    |
| `—`       | `--`    | em dash                                    |
| `―`       | `--`    | horizontal bar                             |
| `‘`       | `'`     | left single quotation mark                 |
| `’`       | `'`     | right single quotation mark                |
| `‚`       | `'`     | single low-9 quotation mark                |
| `“`       | `"`     | left double quotation mark                 |
| `”`       | `"`     | right double quotation mark                |
| `„`       | `"`     | double low-9 quotation mark                |
| `•`       | `*`     | bullet                                     |
| `…`       | `...`   | horizontal ellipsis                        |
| `U+202F`  | a space | narrow no-break space                      |
| `‹`       | `<`     | single left-pointing angle quotation mark  |
| `›`       | `>`     | single right-pointing angle quotation mark |
| `U+2060`  | removed | word joiner                                |
| `←`       | `<-`    | leftwards arrow                            |
| `→`       | `->`    | rightwards arrow                           |
| `↔`       | `<->`   | left right arrow                           |
| `↜`       | `<~`    | leftwards squiggle arrow                   |
| `↝`       | `~>`    | rightwards squiggle arrow                  |
| `⇐`       | `<=`    | leftwards double arrow                     |
| `⇒`       | `=>`    | rightwards double arrow                    |
| `⇔`       | `<=>`   | left right double arrow                    |
| `−`       | `-`     | minus sign                                 |
| `∧`       | `/\`    | logical and                                |
| `∨`       | `\/`    | logical or                                 |
| `∷`       | `::`    | proportion                                 |
| `≈`       | `~~`    | almost equal to                            |
| `≔`       | `:=`    | colon equals                               |
| `≟`       | `?=`    | questioned equal to                        |
| `≠`       | `!=`    | not equal to                               |
| `≡`       | `===`   | identical to                               |
| `≢`       | `!==`   | not identical to                           |
| `≤`       | `<=`    | less-than or equal to                      |
| `≥`       | `>=`    | greater-than or equal to                   |
| `≪`       | `<<`    | much less-than                             |
| `≫`       | `>>`    | much greater-than                          |
| `⊲`       | `<\|`   | normal subgroup of                         |
| `⊳`       | `\|>`   | contains as normal subgroup                |
| `U+3000`  | a space | ideographic space                          |
| `U+FEFF`  | removed | zero width no-break space                  |

<!-- end generated -->

No `languages` value permits these, including the quotation marks CLDR lists as punctuation for a given language. `allow` is how you keep one.

## Language codes

```
af ar bg ca cs cy da de el en es et eu fa fi fr ga gl he hi hr hu id is it ja
ko lt lv ms nb nl pl pt ro ru sk sl sr sv sw th tr uk vi zh
```

## Parsers

Set a parser for the files you want read. Strings are exempt wherever a parser identifies them.

| files | parser | strings exempt |
| --- | --- | --- |
| `.ts` `.js` | `typescript-eslint`, or none | yes |
| `.md` | `@eslint/markdown` | code spans and fences |
| `.json` | `jsonc-eslint-parser` | yes |
| `.yml` | `yaml-eslint-parser` | yes |
| `.html` | `@html-eslint/parser` | yes |
| `.vue` | `vue-eslint-parser` | `<script>` only |
| `.svelte` | `svelte-eslint-parser` | yes |
| `.astro` | `astro-eslint-parser` | yes |
| `.html` (Angular) | `@angular-eslint/template-parser` | yes |
| anything else | `eslint-parser-plain` | no |

With `vue-eslint-parser`, text in `<template>` is read as prose. Declare the language it is written in, or name the characters in `allow`.

In a file no parser reads, nothing is exempt and `eslint-disable` comments have no effect. Use `allow`.

## Reporting a problem

A character reported that your language uses, or one missed that it does not: [open an issue](https://github.com/joematthews/eslint-plugin-repertoire/issues).
