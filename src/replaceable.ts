// Both the fix table and the deny list: each character has an unambiguous ASCII
// form, so the rule rewrites it and permits it in no language. Membership
// requires the rewrite be beyond argument, hence no middle dot.
export const REPLACEABLE: ReadonlyMap<string, string> = new Map([
  ["‐", "-"], // hyphen
  ["‑", "-"], // non-breaking hyphen
  ["‒", "-"], // figure dash
  ["–", "-"], // en dash
  ["—", "--"], // em dash
  ["―", "--"], // horizontal bar
  ["−", "-"], // minus sign

  ["‘", "'"], // left single quotation mark
  ["’", "'"], // right single quotation mark
  ["‚", "'"], // single low-9 quotation mark
  ["“", '"'], // left double quotation mark
  ["”", '"'], // right double quotation mark
  ["„", '"'], // double low-9 quotation mark
  ["«", '"'], // left-pointing double angle quotation mark
  ["»", '"'], // right-pointing double angle quotation mark
  ["‹", "<"], // single left-pointing angle quotation mark
  ["›", ">"], // single right-pointing angle quotation mark

  ["…", "..."], // horizontal ellipsis
  ["•", "*"], // bullet
  ["×", "x"], // multiplication sign
  ["→", "->"], // rightwards arrow
  ["←", "<-"], // leftwards arrow
  ["↔", "<->"], // left right arrow
  ["⇒", "=>"], // rightwards double arrow
  ["⇐", "<="], // leftwards double arrow
  ["⇔", "<=>"], // left right double arrow
  ["≤", "<="], // less-than or equal to
  ["≥", ">="], // greater-than or equal to
  ["≠", "!="], // not equal to

  // Operators a programming font ligates from ASCII. FiraCode renders `->` as
  // an arrow and `===` as an identity sign, so the ASCII is the source form and
  // the glyph is what a paste left behind. Anything it ligates belongs here.
  ["≪", "<<"], // much less-than
  ["≫", ">>"], // much greater-than
  ["∷", "::"], // proportion
  ["≔", ":="], // colon equals
  ["≡", "==="], // identical to
  ["≢", "!=="], // not identical to
  ["≈", "~~"], // almost equal to
  ["≟", "?="], // questioned equal to
  ["∧", "/\\"], // logical and
  ["∨", "\\/"], // logical or
  ["⊲", "<|"], // normal subgroup of
  ["⊳", "|>"], // contains as normal subgroup
  ["↝", "~>"], // rightwards squiggle arrow
  ["↜", "<~"], // leftwards squiggle arrow

  // Invisible characters survive review because there is nothing to see, and
  // break string comparison silently.
  [" ", " "], // no-break space
  [" ", " "], // narrow no-break space
  [" ", " "], // figure space
  [" ", " "], // thin space
  [" ", " "], // hair space
  ["　", " "], // ideographic space
  ["​", ""], // zero width space
  ["‌", ""], // zero width non-joiner
  ["‍", ""], // zero width joiner
  ["⁠", ""], // word joiner
  ["﻿", ""], // zero width no-break space
]);
