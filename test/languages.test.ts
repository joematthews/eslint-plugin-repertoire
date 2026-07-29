import { describe, it, expect } from "vitest";
import { Linter } from "eslint";
import markdown from "@eslint/markdown";
import * as jsonParser from "jsonc-eslint-parser";
import * as yamlParser from "yaml-eslint-parser";
import * as plainParser from "eslint-parser-plain";
import * as htmlParser from "@html-eslint/parser";
import * as ngParser from "@angular-eslint/template-parser";
import * as vueParser from "vue-eslint-parser";
import * as svelteParser from "svelte-eslint-parser";
import * as astroParser from "astro-eslint-parser";
import repertoire from "../src/index.ts";

const linter = new Linter();

const rules: Linter.RulesRecord = {
  "repertoire/no-undeclared-characters": ["error", { languages: ["en"] }],
};

// A rule fires on node types, and each language names its root differently.
// These run the rule through each one, which the RuleTester cases cannot: they
// all go through the JavaScript parser.
function parsed(parser: Linter.Parser, glob: string): Linter.Config[] {
  return [
    {
      files: [glob],
      plugins: { repertoire },
      languageOptions: { parser },
      rules,
    },
  ];
}

const markdownConfig: Linter.Config[] = [
  {
    files: ["**/*.md"],
    plugins: { repertoire, markdown },
    language: "markdown/gfm",
    rules,
  },
];

const reported = (messages: Linter.LintMessage[]) =>
  messages.map((m) => m.message);

// Every suggestion offered, as the description a reviewer reads and the source
// accepting it would produce. Nothing here is applied without that acceptance.
const suggested = (messages: Linter.LintMessage[], source: string) =>
  messages.flatMap((m) =>
    (m.suggestions ?? []).map((s) => [
      s.desc,
      source.slice(0, s.fix.range[0]) +
        s.fix.text +
        source.slice(s.fix.range[1]),
    ]),
  );

describe("markdown", () => {
  it("reports prose and leaves code spans and fences alone", () => {
    const messages = linter.verify(
      [
        "# Ship it — now",
        "",
        "Use `a — b` inline.",
        "",
        "```js",
        "// x — y",
        "```",
        "",
      ].join("\n"),
      markdownConfig,
      "doc.md",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });

  it("reports a symbol with no shortcode and no plain form, unfixed", () => {
    const { output, messages } = linter.verifyAndFix(
      "# a ─ b\n",
      markdownConfig,
      "doc.md",
    );
    expect(reported(messages)).toEqual(["U+2500 (─) is not used in [en]"]);
    expect(output).toBe("# a ─ b\n");
  });

  it("rewrites emoji as GitHub shortcodes", () => {
    const { output } = linter.verifyAndFix(
      "# Ship it 🚀\n",
      markdownConfig,
      "doc.md",
    );
    expect(output).toBe("# Ship it :rocket:\n");
  });
});

describe("json", () => {
  it("exempts keys and values alike", () => {
    const messages = linter.verify(
      '{ "café": "señor — ok" }',
      parsed(jsonParser, "**/*.json"),
      "data.json",
    );
    expect(reported(messages)).toEqual([]);
  });
});

describe("jsonc and json5", () => {
  it("reports and fixes comments, which strict json cannot have", () => {
    const code = '{\n  // note \u2014 here\n  "a": 1\n}\n';
    const { output } = linter.verifyAndFix(
      code,
      parsed(jsonParser, "**/*.jsonc"),
      "tsconfig.jsonc",
    );
    expect(output).toBe('{\n  // note -- here\n  "a": 1\n}\n');
  });

  it("reports an unquoted key but will not rename it", () => {
    // An unquoted key is an identifier, so the edit is named but neither
    // applied nor offered. An accented letter would not show this: it has no
    // replacement, so there would be no edit to withhold.
    const code = "{ a\u200Db: 1 }";
    const { output, messages } = linter.verifyAndFix(
      code,
      parsed(jsonParser, "**/*.json5"),
      "a.json5",
    );
    expect(reported(messages)).toEqual([
      "U+200D (\u200D) is not used in [en]. Remove it.",
    ]);
    expect(output).toBe(code);
    expect(suggested(messages, code)).toEqual([]);
  });
});

describe("yaml", () => {
  it("reports comments and exempts scalars", () => {
    const messages = linter.verify(
      '# note — here\nname: café\nquoted: "a — b"\n',
      parsed(yamlParser, "**/*.yml"),
      "config.yml",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });
});

describe("html", () => {
  it("reports comments and exempts element bodies and attributes", () => {
    const messages = linter.verify(
      '<!-- note — here -->\n<p title="a — b">café — ok</p>\n',
      parsed(htmlParser, "**/*.html"),
      "page.html",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });

  it("reports each character once, though two roots fire", () => {
    // @html-eslint/parser emits both `Program` and `Document`, and the rule
    // registers a handler for each. Without the scan-once guard every
    // character would be reported twice.
    const messages = linter.verify(
      "<!-- a — b -->\n",
      parsed(htmlParser, "**/*.html"),
      "page.html",
    );
    expect(messages).toHaveLength(1);
  });
});

describe("angular templates", () => {
  it("recovers spans from loc, since offsets live under sourceSpan", () => {
    const messages = linter.verify(
      "<!-- note — here -->\n<p>café — ok</p>\n",
      parsed(ngParser, "**/*.html"),
      "tpl.html",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });
});

describe("svelte", () => {
  it("reports script comments and exempts markup text", () => {
    const messages = linter.verify(
      "<script>\n  // note — here\n</script>\n<p>café — ok</p>\n",
      parsed(svelteParser, "**/*.svelte"),
      "a.svelte",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });
});

describe("astro", () => {
  it("reports frontmatter comments and exempts markup text", () => {
    const messages = linter.verify(
      "---\n// note — here\n---\n<p>café — ok</p>\n",
      parsed(astroParser, "**/*.astro"),
      "a.astro",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });
});

describe("vue", () => {
  it("exempts script strings", () => {
    const messages = linter.verify(
      '<script>\nconst s = "café";\n</script>\n',
      parsed(vueParser, "**/*.vue"),
      "a.vue",
    );
    expect(reported(messages)).toEqual([]);
  });

  it("reports template text, which it cannot see as markup", () => {
    // vue-eslint-parser keeps the template in a separate AST reachable only
    // through defineTemplateBodyVisitor, so sourceCode.traverse() never visits
    // it and no node there can be recognised as text a reader sees.
    const messages = linter.verify(
      "<template>\n  <p>café</p>\n</template>\n",
      parsed(vueParser, "**/*.vue"),
      "a.vue",
    );
    expect(reported(messages)).toEqual(["U+00E9 (é) is not used in [en]"]);
  });
});

describe("files no parser reads", () => {
  it("exempts nothing, because no string can be identified", () => {
    const messages = linter.verify(
      '# stage — prod\necho "a — b"\n',
      parsed(plainParser, "**/*.sh"),
      "deploy.sh",
    );
    expect(reported(messages)).toEqual([
      "U+2014 (—) is not used in [en]. Use '--' instead.",
      "U+2014 (—) is not used in [en]. Use '--' instead.",
    ]);
  });

  it("offers the edit rather than applying it, having no tree to prove it safe", () => {
    const code = "# stage \u2192 prod\n";
    const { output, messages } = linter.verifyAndFix(
      code,
      parsed(plainParser, "**/*.sh"),
      "deploy.sh",
    );
    expect(reported(messages)).toEqual([
      "U+2192 (\u2192) is not used in [en]. Use '->' instead.",
    ]);
    expect(output).toBe(code);
    expect(suggested(messages, code)).toEqual([
      ["Replace with '->'", "# stage -> prod\n"],
    ]);
  });

  it("does not mistake a comment-only source for an unparsed one", () => {
    const linted = new Linter();
    const { output } = linted.verifyAndFix(
      "// stage \u2192 prod\n",
      [{ files: ["**/*.js"], plugins: { repertoire }, rules }],
      "only-a-comment.js",
    );
    expect(output).toBe("// stage -> prod\n");
  });

  it("permits characters named in allow, which disable comments cannot", () => {
    const allowed: Linter.Config[] = [
      {
        files: ["**/*.sh"],
        plugins: { repertoire },
        languageOptions: { parser: plainParser },
        rules: {
          "repertoire/no-undeclared-characters": ["error", { allow: ["→"] }],
        },
      },
    ];
    const messages = linter.verify("# stage → prod\n", allowed, "deploy.sh");
    expect(reported(messages)).toEqual([]);
  });
});
