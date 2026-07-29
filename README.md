# eslint-plugin-repertoire

[![npm](https://img.shields.io/npm/v/eslint-plugin-repertoire.svg)](https://www.npmjs.com/package/eslint-plugin-repertoire) [![license](https://img.shields.io/npm/l/eslint-plugin-repertoire.svg)](LICENSE)

> **character repertoire** -- the collection of characters included in a character set.
>
> -- [The Unicode Glossary](https://www.unicode.org/glossary/)

**Finds characters your keyboard cannot type, and tells you what to write instead.** Em dashes, curly quotes and invisible zero-width characters arrive by copy and paste, and some of them cannot be seen in a review.

You name the languages a file is written in. Characters those languages use are permitted, and the rest are reported.

These two lines declare two different variables:

```js
const cache = new Map();
const cach‍e = new Map();
```

## Install

```sh
npm install --save-dev eslint-plugin-repertoire
```

Requires ESLint 9.15 or later.

## Usage

```js
// eslint.config.mjs
import repertoire from "eslint-plugin-repertoire";

export default [
  {
    files: ["**/*.ts"],
    plugins: { repertoire },
    rules: { "repertoire/no-undeclared-characters": "error" },
  },
];
```

`languages` defaults to `["en"]`. Name the languages a file is written in:

```js
"repertoire/no-undeclared-characters": ["error", { languages: ["de", "pl"] }]
```

Configuration is per file glob, so a file with a wider range than the rest of the project -- a changelog carrying contributor names, a translations file -- gets its own entry. See [configuring the rule](docs/rules/no-undeclared-characters.md).

Every report names the character by code point, so two that look alike are told apart, and gives the ASCII form where one exists:

```
src/card.ts
  1:11  error  U+2013 (–) is not used in [en]. Use '-' instead    repertoire/no-undeclared-characters
  1:20  error  U+2014 (—) is not used in [en]. Use '--' instead   repertoire/no-undeclared-characters
  2:9   error  U+200B (​) is not used in [en]. Remove it           repertoire/no-undeclared-characters
```

## Rules

| rule | fixable | recommended |
| --- | --- | --- |
| [`no-undeclared-characters`](docs/rules/no-undeclared-characters.md) | yes | yes |

## Character data

Which characters each language is written with comes from [Unicode CLDR](https://cldr.unicode.org/), read from the [`cldr-misc-full`](https://www.npmjs.com/package/cldr-misc-full) package and rebuilt with `npm run extract`.

## License

[MIT](LICENSE)
