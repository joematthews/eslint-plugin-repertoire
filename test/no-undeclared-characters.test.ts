import { describe, expect, it } from "vitest";
import { Linter, RuleTester } from "eslint";
import markdown from "@eslint/markdown";
import rule from "../src/no-undeclared-characters.ts";

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2023, sourceType: "module" },
});

describe("no-undeclared-characters", () => {
  ruleTester.run("no-undeclared-characters", rule, {
    valid: [
      // ASCII is permitted whatever the language: code is written with it.
      "const separator = ' | ';",
      "// A comment with -- and 'quotes' and ... and $ and @",
      "const template = `a ${b} c`;",

      // Declared languages, in words they are actually written with.
      { code: "// está en caché", options: [{ languages: ["es"] }] },
      { code: "// coração português", options: [{ languages: ["pt"] }] },
      { code: "// für schöne Größe", options: [{ languages: ["de"] }] },
      { code: "// être à côté", options: [{ languages: ["fr"] }] },
      { code: "// zażółć gęślą jaźń", options: [{ languages: ["pl"] }] },

      // Punctuation a language genuinely needs and that has no plain form.
      { code: "// ¿qué? ¡vale!", options: [{ languages: ["es"] }] },

      // Several languages: a character passes if any of them uses it.
      { code: "// caché und Größe", options: [{ languages: ["es", "de"] }] },

      // Tabs and newlines are structure, not prose, and no language lists them.
      { code: "const a = 1;\n\tconst b = 2;\n" },

      // A combining mark folds onto its letter, so a decomposed acute is
      // the same character as a precomposed one. Written as an escape
      // because the two are indistinguishable on screen.
      { code: "// cafe\u0301", options: [{ languages: ["es"] }] },

      // A cluster with no precomposed form is permitted by its parts. Neither
      // script composes, so whole-grapheme and NFC lookups both miss.
      {
        code: "// \u092F\u0939 \u0915\u093E\u092E",
        options: [{ languages: ["hi"] }],
      },
      {
        code: "// \u0E17\u0E33\u0E07\u0E32\u0E19",
        options: [{ languages: ["th"] }],
      },

      // A deliberate character, named. In a comment, where nothing is exempt.
      { code: "// ok 1 · err 0", options: [{ allow: ["·"] }] },

      // `allow` outranks the table of always-denied characters, which is what
      // makes it the escape hatch for files no parser can read.
      { code: "// a — b", options: [{ allow: ["—"] }] },

      // Text a reader sees is the author's choice, whatever the character.
      "const card = 'ok 1 · err 0';",
      "const s = 'a — b';",
      "const family = '👨‍👩‍👧';",
      "const quote = 'don’t';",
      "const bar = '────';",
      "const ok = '✓ done';",
    ],

    invalid: [
      {
        name: "rewrites a pasted em dash in a comment",
        code: "// a comment — with an em dash",
        output: "// a comment -- with an em dash",
        errors: [
          { message: "U+2014 (—) is not used in [en]. Use '--' instead." },
        ],
      },

      {
        name: "rewrites an em dash even where CLDR calls it the language's own",
        code: "// una frase — con guion",
        options: [{ languages: ["es"] }],
        output: "// una frase -- con guion",
        errors: [{ messageId: "undeclaredUse" }],
      },

      {
        name: "rewrites curly quotes, an ellipsis and an arrow to plain forms",
        code: "// ‘a’ “b” … →",
        output: "// 'a' \"b\" ... ->",
        errors: Array.from({ length: 6 }, () => ({
          messageId: "undeclaredUse" as const,
        })),
      },

      {
        name: "reports a character with no plain form and offers no fix",
        code: "// ok 1 · err 0",
        output: null,
        errors: [{ message: "U+00B7 (·) is not used in [en]" }],
      },

      {
        name: "reports a Spanish letter in a project declared as German",
        code: "// está",
        options: [{ languages: ["de"] }],
        errors: [{ message: "U+00E1 (á) is not used in [de]" }],
      },

      {
        name: "names every declared language in the message",
        code: "// größe",
        options: [{ languages: ["en", "es"] }],
        errors: [
          { message: "U+00F6 (ö) is not used in [en, es]" },
          { message: "U+00DF (ß) is not used in [en, es]" },
        ],
      },

      {
        name: "rewrites a no-break space hiding between two tokens",
        code: "const a = 1;",
        output: "const a = 1;",
        errors: [{ messageId: "undeclaredUse" }],
      },

      {
        name: "rewrites ligated operators, and reports one with no plain form",
        code: "// a \u226A b \u2261 c \u2237 d \u2A72",
        output: "// a << b === c :: d \u2A72",
        errors: [
          { messageId: "undeclaredUse" },
          { messageId: "undeclaredUse" },
          { messageId: "undeclaredUse" },
          { messageId: "undeclared" },
        ],
      },

      {
        name: "deletes a zero-width space rather than naming a replacement",
        code: "// a\u200Bb",
        output: "// ab",
        errors: [{ messageId: "undeclaredRemove" }],
      },

      {
        name: "reports the joiner bound to a letter, not the letter",
        code: "// a\u200Db",
        output: "// ab",
        errors: [
          { message: "U+200D (\u200D) is not used in [en]. Remove it." },
        ],
      },

      // The three edits touch end to end, and ESLint takes only the first of
      // any such run per pass, so this one pass leaves the carrier behind.
      {
        name: "names a joiner bound to a denied character, and the carrier",
        code: "// 10‍−‍16",
        output: "// 10−16",
        errors: [
          { message: "U+200D (‍) is not used in [en]. Remove it." },
          { message: "U+2212 (−) is not used in [en]. Use '-' instead." },
          { message: "U+200D (‍) is not used in [en]. Remove it." },
        ],
      },

      {
        name: "names a joiner bound to a denied character that has no plain form",
        code: "// a ※‍ b",
        output: "// a ※ b",
        errors: [
          { message: "U+203B (※) is not used in [en]" },
          { message: "U+200D (‍) is not used in [en]. Remove it." },
        ],
      },

      // Identifiers are checked like prose: they are code, not text a reader
      // was shown.
      {
        name: "reports an undeclared letter in an identifier",
        code: "const caf\u00E9 = 1;",
        output: null,
        errors: [{ message: "U+00E9 (\u00E9) is not used in [en]" }],
      },

      // Removing the joiner here yields a second `const ab`, and a suggestion
      // must leave code that parses.
      {
        name: "withholds even a suggestion where the edit would collide",
        code: "const ab = 2;\nconst a\u200Db = 1;\n",
        output: null,
        errors: [{ messageId: "undeclaredRemove", suggestions: [] }],
      },

      // Persian and Hindi names are written with zero-width characters, so this
      // one is correct as it stands.
      {
        name: "withholds the edit from a Persian name written with a joiner",
        code: "const \u0645\u06CC\u200C\u0634\u0648\u062F = 1;",
        options: [{ languages: ["fa"] }],
        output: null,
        errors: [{ messageId: "undeclaredRemove", suggestions: [] }],
      },

      {
        name: "reports an emoji without guessing a replacement",
        code: "// ship it \u{1F680}",
        output: null,
        errors: [{ messageId: "undeclared", line: 1 }],
      },

      {
        name: "keeps an emoji built from joiners as a single report",
        code: "// \u{1F468}\u200D\u{1F469}\u200D\u{1F467}",
        output: null,
        errors: [{ messageId: "undeclared" }],
      },

      {
        name: "counts a run of the same character in one report",
        code: "// ────",
        output: null,
        errors: [{ message: "U+2500 (─) x4 is not used in [en]" }],
      },
    ],
  });
});

describe("fixing to completion", () => {
  const linter = new Linter();
  const config: Linter.Config = {
    plugins: { repertoire: { rules: { "no-undeclared-characters": rule } } },
    rules: { "repertoire/no-undeclared-characters": "error" },
  };

  // What `--fix` leaves behind, which is what a user sees. RuleTester asserts a
  // single pass, so edits that touch end to end need this to show they settle.
  it("clears a zero-width character bound to a denied one", () => {
    const { output, messages } = linter.verifyAndFix("// 10‍−‍16", config);
    expect(output).toBe("// 10-16");
    expect(messages).toEqual([]);
  });

  it("leaves an emoji built from joiners whole", () => {
    const source = "// \u{1F468}‍\u{1F469}‍\u{1F467}";
    const { output } = linter.verifyAndFix(source, config);
    expect(output).toBe(source);
  });
});

describe("markdown", () => {
  const linter = new Linter();
  const config = [
    {
      files: ["**/*.md"],
      language: "markdown/gfm" as const,
      plugins: {
        markdown,
        repertoire: { rules: { "no-undeclared-characters": rule } },
      },
      rules: { "repertoire/no-undeclared-characters": "error" },
    },
  ] as Linter.Config[];

  const fix = (code: string) =>
    linter.verifyAndFix(code, config, "doc.md").output;
  const report = (code: string) => linter.verify(code, config, "doc.md");

  it("rewrites a denied character in prose", () => {
    expect(fix("Text with an em dash — here.\n")).toBe(
      "Text with an em dash -- here.\n",
    );
  });

  it("rewrites in a heading, a list item and a table cell", () => {
    expect(fix("# Ship — now\n")).toBe("# Ship -- now\n");
    expect(fix("- an — item\n")).toBe("- an -- item\n");
    expect(fix("| a |\n| --- |\n| — |\n")).toBe("| a |\n| --- |\n| -- |\n");
  });

  it("leaves a code span and a fenced block alone", () => {
    const span = "Text with a `code — span` here.\n";
    const fence = "```js\nconst a = 1; // —\n```\n";
    expect(report(span)).toEqual([]);
    expect(report(fence)).toEqual([]);
    expect(fix(span)).toBe(span);
    expect(fix(fence)).toBe(fence);
  });

  it("names an emoji by its GitHub shortcode", () => {
    expect(fix("# Ship it \u{1F680}\n")).toBe("# Ship it :rocket:\n");
  });
});

describe("addresses are reported but never rewritten", () => {
  const linter = new Linter();
  const md = [
    {
      files: ["**/*.md"],
      language: "markdown/gfm" as const,
      plugins: {
        markdown,
        repertoire: { rules: { "no-undeclared-characters": rule } },
      },
      rules: { "repertoire/no-undeclared-characters": "error" },
    },
  ] as Linter.Config[];
  const js: Linter.Config = {
    plugins: { repertoire: { rules: { "no-undeclared-characters": rule } } },
    rules: { "repertoire/no-undeclared-characters": "error" },
  };

  // Rewriting a character inside an address produces a different address that
  // still reads correctly, so every case here reports and offers, never applies.
  const untouched = (
    name: string,
    code: string,
    config: Linter.Config | Linter.Config[],
  ) => {
    it(name, () => {
      const file = Array.isArray(config) ? "doc.md" : undefined;
      const messages = file
        ? linter.verify(code, config, file)
        : linter.verify(code, config);
      const fixed = file
        ? linter.verifyAndFix(code, config, file)
        : linter.verifyAndFix(code, config);
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0]!.suggestions?.length ?? 0).toBeGreaterThan(0);
      expect(fixed.output).toBe(code);
    });
  };

  untouched(
    "a markdown link destination",
    "[docs](https://example.com/a—b)\n",
    md,
  );
  untouched("an autolink", "<https://example.com/a—b>\n", md);
  untouched("an image source", "![alt](https://example.com/a—b.png)\n", md);
  untouched(
    "a link reference definition",
    "[a][a]\n\n[a]: https://example.com/a—b\n",
    md,
  );
  untouched(
    "a raw HTML block",
    '<img src="https://example.com/a—b.png">\n',
    md,
  );
  untouched("a URL in a line comment", "// https://example.com/a—b\n", js);
  untouched("a URL in a block comment", "/* https://example.com/a—b */\n", js);
  untouched(
    "an en dash in a URL",
    "// https://example.com/2024–2025-report\n",
    js,
  );
  untouched("a bare www address", "// www.example.com/a—b\n", js);

  it("rewrites a word that merely begins like a scheme", () => {
    expect(linter.verifyAndFix("// http, but — not a link\n", js).output).toBe(
      "// http, but -- not a link\n",
    );
  });
});
