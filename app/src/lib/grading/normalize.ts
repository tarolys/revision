import type { AcceptableAnswer } from "../types";

// Spec §4.2 normalization, applied to both the user's input and every
// AcceptableAnswer.value before comparison (unless caseSensitive skips step 2).
const ALLOWED_EXTRA = "+\\-*/=^.°%"; // + - * / = ^ . ° %
const STRIP_RE = new RegExp(`[^a-z0-9\\s${ALLOWED_EXTRA}]`, "gi");

export function normalizeAnswer(raw: string, caseSensitive = false): string {
  let s = raw.trim();
  if (!caseSensitive) s = s.toLowerCase();
  s = s.replace(STRIP_RE, "");
  s = s.replace(/\s+/g, " ");
  return s;
}

/** Spec §4.2 fuzzy-tolerance table, keyed by target token length. */
export function fuzzyToleranceFor(tokenLength: number, setting: AcceptableAnswer["fuzzyTolerance"]): number {
  if (setting === "off") return 0;
  if (typeof setting === "number") return setting;
  // "auto" or unset
  if (tokenLength <= 3) return 0;
  if (tokenLength <= 6) return 1;
  if (tokenLength <= 10) return 2;
  return 3;
}
