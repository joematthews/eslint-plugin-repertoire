import { describe, it, expect } from "vitest";
import charsets from "../src/charsets.json" with { type: "json" };
import { REPLACEABLE } from "../src/replaceable.ts";

const languages = Object.entries(charsets);
const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCharCode(0x20 + i),
);

// The database is generated, so these assert the generator. The last two carry
// the most weight: a declared language must cover the characters it is actually
// written with, or every accented word in a Spanish project is reported.
describe("charsets.json", () => {
  it("gives every language the whole of printable ASCII", () => {
    for (const [language, characters] of languages) {
      const missing = ASCII.filter((c) => !characters.includes(c));
      expect(missing, `${language} should contain all printable ASCII`).toEqual(
        [],
      );
    }
  });

  it("never permits a character that has a plain ASCII form", () => {
    // CLDR lists the em dash as Spanish punctuation and is right, but a
    // developer writing Spanish types a hyphen. A plain form always wins.
    const leaks: string[] = [];
    for (const [language, characters] of languages) {
      for (const replaceable of REPLACEABLE.keys()) {
        if (characters.includes(replaceable))
          leaks.push(`${language}: ${replaceable}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("permits no typesetter's mark, in any language", () => {
    // CLDR's punctuation field lists what a typesetter might reach for. These
    // five are claimed by 23 to 33 of the 46 languages, which is what marks
    // them as nobody's in particular.
    const leaks: string[] = [];
    for (const [language, characters] of languages) {
      for (const mark of [..."\u00A7\u2020\u2021\u2032\u2033"]) {
        if (characters.includes(mark)) leaks.push(`${language}: ${mark}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it("keeps punctuation a language needs and cannot spell any other way", () => {
    expect(charsets.es).toContain("¡");
    expect(charsets.es).toContain("¿");
  });

  it("writes the words each language is actually written with", () => {
    const words: Record<string, string> = {
      es: "está caché señor ¿qué? ¡vale!",
      pt: "coração português avô não",
      fr: "être goût Noël château français",
      de: "für schön groß Käse Übung",
      pl: "zażółć gęślą jaźń",
      tr: "güneş çiçek ıspanak",
      cs: "příliš žluťoučký kůň",
      hu: "árvíztűrő tükörfúrógép",
      sv: "räksmörgås",
      is: "þetta er íslenska",
      el: "καλημέρα κόσμε",
      ru: "съешь ещё этих мягких булок",
      vi: "tiếng Việt",
    };
    for (const [language, sentence] of Object.entries(words)) {
      const permitted = new Set(charsets[language as keyof typeof charsets]);
      const rejected = [...new Set(sentence)].filter(
        (c) => c !== " " && !permitted.has(c),
      );
      expect(
        rejected,
        `${language} should be able to write "${sentence}"`,
      ).toEqual([]);
    }
  });

  it("does not let one language write another", () => {
    // The check that the sets are specific rather than a shared pile of Latin.
    expect(charsets.de).not.toContain("ñ");
    expect(charsets.es).not.toContain("ß");
    expect(charsets.en).not.toContain("é");
    expect(charsets.pt).not.toContain("ü");
  });
});
