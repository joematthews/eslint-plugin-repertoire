import type {
  RuleDefinition,
  RuleDefinitionTypeOptions,
  RuleFixer,
} from "@eslint/core";
import charsets from "./charsets.json" with { type: "json" };
import { REPLACEABLE } from "./replaceable.ts";
import { shortcodeFor } from "./emoji.ts";

type Range = [number, number];

// CLDR codes this build knows, and the schema's enum of valid `languages`.
export const LANGUAGES = Object.keys(charsets);

// Declared as `meta.defaultOptions` and merged again in create(). ESLint applies the meta
// property from 9.15 and ignores it before that, so the merge is what lets the rule run on
// an older one. Neither is redundant: the declaration is what tooling reads.
const DEFAULTS: Options = { languages: ["en"], allow: [] };

// Segment as a reader sees it, so an emoji sequence counts as one character.
const GRAPHEMES = new Intl.Segmenter("en", { granularity: "grapheme" });

// Structure rather than prose, and no language lists them.
const WHITESPACE = ["\t", "\n", "\r"];

// The characters REPLACEABLE maps to nothing: the zero-width ones. They bind to
// the letter before them, so they need finding inside a grapheme, not just as
// one of their own.
const REMOVABLE = new Set(
  [...REPLACEABLE].filter(([, to]) => to === "").map(([from]) => from),
);

// mdast's root. Markdown is the only place a `:shortcode:` means anything.
const MARKDOWN_ROOT = "root";

// Each language names its root differently. Registering all three is what lets
// one rule cover a flat config broken down by file glob.
const ROOTS = ["Program", "root", "Document"] as const;

// Text a reader sees, and therefore exempt. Comments are absent on purpose, and
// a language with no tree exempts nothing -- so there is no list to maintain.
const TEXT_BEARING = new Set([
  "Literal", // JS and TS string
  "TemplateElement", // JS and TS template chunk
  "JSONLiteral", // jsonc-eslint-parser
  "JSONStringLiteral",
  "YAMLScalar", // yaml-eslint-parser
  "Text", // @html-eslint element body
  "AttributeValue", // @html-eslint
  "HTMLText", // shared by vue-eslint-parser and svelte-eslint-parser
  "HTMLRawText",
  "VText", // vue-eslint-parser template text
  "VLiteral", // vue-eslint-parser attribute value
  "SvelteText", // svelte-eslint-parser
  "SvelteLiteral",
  "JSXText", // astro-eslint-parser, and JSX generally
  "inlineCode", // markdown: a `code span` is markdown's string
  "code", // markdown: a fenced block, likewise
]);

// Markdown nodes whose text is a target rather than prose: a link destination,
// an image source, a reference label, raw HTML. Rewriting one changes where it
// points, so the edit is offered rather than applied -- the same reasoning that
// governs a file no parser read. A `link` covers autolinks and bare GFM URLs
// too, where the visible text is itself the URL, so the whole node qualifies.
const RISKY = new Set([
  "link",
  "image",
  "linkReference",
  "imageReference",
  "definition",
  "html",
]);

// A URL written in running text, which no parser marks out: inside a comment it
// is just prose to the tree. Rewriting a character in one gives a different
// address that still reads correctly, so the edit is offered rather than
// applied. A URL in running text ends at whitespace, which bounds the token
// tested here.
const URL_LIKE = /^[<([]?(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:)/i;

// Nodes that name a binding. A parser rejects an emoji or an em dash in one
// long before the rule runs, so what reaches here is legal and stays as written.
const IDENTIFIER = new Set([
  "Identifier",
  "PrivateIdentifier",
  "JSXIdentifier",
  "JSONIdentifier",
]);

/** Options for `repertoire/no-undeclared-characters` in a flat config. */
export interface Options {
  /**
   * Languages this project is written in, as CLDR codes.
   *
   * Printable ASCII is always permitted, so this only ever adds. A character is
   * allowed when any listed language uses it.
   *
   * @example ["en", "es"] // also allows Spanish letters and inverted marks
   */
  languages: string[];

  /** Extra characters this project uses deliberately, whatever the language. */
  allow: string[];
}

// What the rule needs from a SourceCode. Every ESLint language offers these,
// which is how one rule reads a TypeScript file and a markdown file alike.
interface ReadableSource {
  getText(): string;
  getLocFromIndex(index: number): { line: number; column: number };
  // A language with no tree simply yields no steps.
  traverse?: () => Iterable<{ phase: number; target: NodeWithPosition }>;
  getRange?: (node: unknown) => Range | undefined;
  getIndexFromLoc?: (loc: { line: number; column: number }) => number;
  getAllComments?: () => unknown[];
}

interface NodeWithPosition {
  type?: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

type RepertoireMessageId =
  | "undeclared"
  | "undeclaredUse"
  | "undeclaredRemove"
  | "suggestUse"
  | "suggestRemove";

// How far the rule goes with an edit it knows: rewrite it, offer it for review,
// or name it in the message and stop there.
type Delivery = "apply" | "offer" | "withhold";

type RepertoireRule = RuleDefinition<
  RuleDefinitionTypeOptions & {
    RuleOptions: [Options];
    MessageIds: RepertoireMessageId;
  }
>;

const rule: RepertoireRule = {
  meta: {
    type: "problem",
    defaultOptions: [DEFAULTS],
    // Prose is prose whatever the file holds it, so the rule reads every
    // language ESLint can be taught: TypeScript, markdown, JSON, YAML, and a
    // framework template alike.
    languages: ["*"],
    docs: {
      description:
        "Disallow characters outside the languages the project is written in",
      url: "https://github.com/joematthews/eslint-plugin-repertoire/blob/main/docs/rules/no-undeclared-characters.md",
      recommended: true,
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [
      {
        type: "object",
        properties: {
          languages: {
            description:
              "CLDR codes for the languages this project is written in. Printable ASCII is always permitted, so this only ever adds.",
            type: "array",
            items: { type: "string", enum: LANGUAGES },
            uniqueItems: true,
            minItems: 1,
          },
          allow: {
            description:
              "Characters this project uses deliberately, whatever the language. Takes precedence over every other check.",
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      undeclared: "{{name}} is not used in [{{languages}}]",
      undeclaredUse:
        "{{name}} is not used in [{{languages}}]. Use '{{replacement}}' instead.",
      undeclaredRemove: "{{name}} is not used in [{{languages}}]. Remove it.",
      suggestUse: "Replace with '{{replacement}}'",
      suggestRemove: "Remove it",
    },
  },

  create(context) {
    const { languages, allow } = { ...DEFAULTS, ...context.options[0] };

    const permitted = new Set([...WHITESPACE, ...allow]);
    for (const language of languages) {
      for (const character of charsets[language as keyof typeof charsets] ??
        "") {
        permitted.add(character);
      }
    }

    // `context.sourceCode` from 8.40, `getSourceCode()` before it.
    const withOlderAccessor = context as unknown as {
      getSourceCode?: () => unknown;
    };
    const source = (context.sourceCode ??
      withOlderAccessor.getSourceCode?.()) as unknown as ReadableSource;
    const listed = languages.join(", ");

    function scan(isMarkdown: boolean): void {
      const text = source.getText();

      // Grapheme segmentation: an emoji built from joiners is one character to
      // report and one range to fix. It folds combining marks onto their
      // letter, which is why the membership test falls back to NFC.
      const graphemes = [...GRAPHEMES.segment(text)].map(
        (piece) => piece.segment,
      );
      const { visible, identifiers, risky, parsed } = collectSpans(source);
      const within = (spans: Range[], at: number) =>
        spans.some(([from, to]) => at >= from && at < to);
      // Three ways a grapheme can be permitted. Whole, for the ordinary case.
      // Composed, for a decomposed accent whose precomposed form is listed.
      // Piecewise, for scripts where a cluster has no precomposed form at all:
      // a Devanagari consonant carrying a vowel sign, or a Thai consonant
      // carrying a vowel, is one grapheme of two code points and is only ever
      // permitted by its parts.
      const isPermitted = (value: string) =>
        permitted.has(value) ||
        permitted.has(value.normalize("NFC")) ||
        [...value].every((part) => permitted.has(part));

      // An emoji has no plain form, but markdown has a name for it that reads
      // as words even where nothing renders it.
      const plainFor = (value: string) =>
        REPLACEABLE.get(value) ??
        (isMarkdown ? shortcodeFor(value) : undefined);

      // Renaming a binding needs scope the rule does not have, so an edit there
      // is named but never handed over. An address and an unparsed file both
      // hold text that might not be prose, so the edit waits for a human.
      function deliveryFor(start: number): Delivery {
        if (within(identifiers, start)) return "withhold";
        if (!parsed) return "offer";
        if (within(risky, start)) return "offer";
        if (withinUrl(text, start)) return "offer";
        return "apply";
      }

      function report(
        character: string,
        range: Range,
        repeats: number,
        replacement: string | undefined,
        delivery: Delivery,
      ): void {
        // Naming the replacement is the whole value of the message here: five
        // dash-like characters become `-` and two become `--`, which no reader
        // can infer from the code point alone.
        const data: Record<string, string> = {
          name: describe(character, repeats),
          languages: listed,
        };
        let messageId: RepertoireMessageId = "undeclared";
        let suggestion: RepertoireMessageId | undefined;
        if (replacement === "") {
          messageId = "undeclaredRemove";
          suggestion = "suggestRemove";
        } else if (replacement !== undefined) {
          messageId = "undeclaredUse";
          suggestion = "suggestUse";
          data.replacement = replacement;
        }

        // One edit, delivered as far as the evidence allows.
        const edit: RuleFixer = (fixer) =>
          fixer.replaceTextRange(range, (replacement ?? "").repeat(repeats));

        context.report({
          loc: {
            start: source.getLocFromIndex(range[0]),
            end: source.getLocFromIndex(range[1]),
          },
          messageId,
          data,
          fix: replacement !== undefined && delivery === "apply" ? edit : null,
          suggest:
            suggestion !== undefined && delivery === "offer"
              ? [{ messageId: suggestion, data, fix: edit }]
              : null,
        });
      }

      let index = 0;

      for (let i = 0; i < graphemes.length; i += 1) {
        const grapheme = graphemes[i]!;
        const start = index;
        index += grapheme.length;

        if (isPermitted(grapheme)) continue;

        // A run of the same character is one mistake, not twenty.
        let repeats = 1;
        while (graphemes[i + 1] === grapheme) {
          index += grapheme.length;
          i += 1;
          repeats += 1;
        }

        // Text a reader will see is the author's choice, not ours to overrule.
        // Prose is the target: comments, markdown, and any unparseable file.
        if (within(visible, start)) continue;

        const delivery = deliveryFor(start);

        // A zero-width character binds to the character before it, so both
        // arrive as one grapheme. What remains once they are taken out decides
        // whether they are intruders: a remainder that stands on its own is
        // carrying them, and each is reported at its own offset. An emoji built
        // from joiners leaves several characters behind, none of which stands
        // alone, so it stays a single report.
        const parts = [...grapheme];
        const stripped = parts.filter((part) => !REMOVABLE.has(part)).join("");
        const standsAlone = isPermitted(stripped) || [...stripped].length === 1;

        if (stripped !== grapheme && standsAlone) {
          let at = start;
          for (const part of parts) {
            const range: Range = [at, at + part.length];
            at += part.length;
            if (REMOVABLE.has(part)) {
              report(part, range, 1, "", delivery);
            } else if (part === stripped && !isPermitted(stripped)) {
              // The carrier is denied in its own right, so it is named and
              // rewritten as it would be with nothing bound to it.
              report(part, range, 1, plainFor(part), delivery);
            }
          }
          continue;
        }

        report(grapheme, [start, index], repeats, plainFor(grapheme), delivery);
      }
    }

    // Fire once, on whichever root the active language uses. Which root fired
    // is also how the scan knows whether it is reading markdown.
    let scanned = false;
    const once = (root: string) => (): void => {
      if (scanned) return;
      scanned = true;
      scan(root === MARKDOWN_ROOT);
    };
    return Object.fromEntries(ROOTS.map((root) => [root, once(root)]));
  },
};

// Not every parser puts `range` on a node -- Angular's template parser carries
// offsets under `sourceSpan` -- but `loc` plus getIndexFromLoc is universal.
function rangeFromLoc(
  source: ReadableSource,
  node: NodeWithPosition,
): Range | undefined {
  if (node.loc === undefined || source.getIndexFromLoc === undefined)
    return undefined;
  try {
    return [
      source.getIndexFromLoc(node.loc.start),
      source.getIndexFromLoc(node.loc.end),
    ];
  } catch {
    return undefined;
  }
}

interface Spans {
  visible: Range[];
  identifiers: Range[];
  // Text that addresses something, so an edit is offered rather than applied.
  risky: Range[];
  // Whether the parser described the file at all. See `collectSpans`.
  parsed: boolean;
}

// One walk, because markdown offers no getNodeByRangeIndex and Angular's
// throws. A language that cannot be walked yields nothing, so nothing is
// exempt and nothing is treated as an identifier.
function collectSpans(source: ReadableSource): Spans {
  const visible: Range[] = [];
  const identifiers: Range[] = [];
  const risky: Range[] = [];
  let nodes = 0;
  try {
    for (const step of source.traverse?.() ?? []) {
      if (step.phase !== 1) continue;
      nodes += 1;
      const type = step.target?.type;
      if (type === undefined) continue;
      let into: Range[];
      if (TEXT_BEARING.has(type)) into = visible;
      else if (IDENTIFIER.has(type)) into = identifiers;
      else if (RISKY.has(type)) into = risky;
      else continue;
      const range =
        source.getRange?.(step.target) ?? rangeFromLoc(source, step.target);
      if (range) into.push(range);
    }
  } catch {
    return { visible: [], identifiers: [], risky: [], parsed: false };
  }

  // A parser that yields nothing but a root and reports no comments has
  // described the file to us not at all, which is what eslint-parser-plain
  // does. A comment-only JavaScript file also has a single node, so the
  // comments are what tell the two apart.
  const comments = source.getAllComments?.().length ?? 0;
  return { visible, identifiers, risky, parsed: nodes > 1 || comments > 0 };
}

// Whether the character at `at` sits inside a URL. The token is taken as the
// run of non-whitespace around it, because that is what delimits a URL written
// into a comment or a line of prose.
function withinUrl(text: string, at: number): boolean {
  let from = at;
  while (from > 0 && !isSpace(text[from - 1]!)) from -= 1;
  let to = at;
  while (to < text.length && !isSpace(text[to]!)) to += 1;
  return URL_LIKE.test(text.slice(from, to));
}

function isSpace(character: string): boolean {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r"
  );
}

// Names a character the way an error message should, e.g. `U+2500 (-) x24`.
function describe(character: string, repeats: number): string {
  const hex = character
    .codePointAt(0)!
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");
  return `U+${hex} (${character})${repeats > 1 ? ` x${repeats}` : ""}`;
}

export default rule;
