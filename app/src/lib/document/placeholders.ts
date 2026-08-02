// Spec §7.1/§7.4 — placeholder token is [^name^], chosen because it's
// plain ASCII and doesn't collide with real LaTeX syntax ({}, \, $, %).
// A doubled opening caret — [^^name^] — marks the field as a paragraph
// (multi-line) field instead of a single-line one; the closing token is
// unchanged either way.
const PLACEHOLDER_RE = /\[\^(\^)?([A-Za-z0-9_]+)\^\]/g;

export interface PlaceholderInfo {
  name: string;
  isParagraph: boolean;
}

/** Unique placeholders, in order of first appearance in the source. */
export function extractPlaceholderInfos(latexSource: string): PlaceholderInfo[] {
  const seen = new Set<string>();
  const ordered: PlaceholderInfo[] = [];
  for (const match of latexSource.matchAll(PLACEHOLDER_RE)) {
    const name = match[2];
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push({ name, isParagraph: !!match[1] });
    }
  }
  return ordered;
}

/** Unique placeholder names, in order of first appearance in the source. */
export function extractPlaceholders(latexSource: string): string[] {
  return extractPlaceholderInfos(latexSource).map((p) => p.name);
}

/** Turns a placeholder name into a human-readable field label (spec §7.4). */
export function placeholderLabel(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** Substitutes every occurrence of each placeholder with its field value (spec §7.5 step 2). */
export function substitutePlaceholders(
  latexSource: string,
  values: Record<string, string>,
): string {
  return latexSource.replace(PLACEHOLDER_RE, (_match, _isParagraph: string | undefined, name: string) => values[name] ?? "");
}
