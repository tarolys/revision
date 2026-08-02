# Revision App — Backend / Data-Logic Specification

Scope: data model, storage, grading logic, import schema, export format. No UI, layout, or styling is described anywhere below — that's a separate pass.

Three decisions that materially change the schema have been confirmed and are built into the design below: MC/Short-Answer questions are replaced (not accumulated) on each new import for a subject; Export is scoped to the current subject only; exported Review Prac answers can be reopened for a fresh attempt later.

---

## 1. Fixed App Configuration

Subjects and their supported modes are fixed by the app itself, not part of imported data:

| Subject slug   | Display name  | Modes supported                        |
|----------------|---------------|------------------------------------------|
| `sciThinking`  | Sci-thinking  | multipleChoice, shortAnswer, reviewPrac |
| `science`      | Science       | multipleChoice, shortAnswer, reviewPrac |
| `maths`        | Maths         | multipleChoice, shortAnswer, reviewPrac |
| `english`      | English       | reviewPrac                              |
| `history`      | History       | shortAnswer, reviewPrac                 |
| `geography`    | Geography     | shortAnswer, reviewPrac                 |

This map is the single source of truth for import validation — any imported question whose `mode` isn't in its subject's list is rejected at import time (see §6.3).

---

## 2. Data Model

### 2.1 Question (base fields, all modes)

```ts
interface QuestionBase {
  id: string;            // app-generated UUID at import time, never supplied by import JSON
  subject: SubjectSlug;
  mode: "multipleChoice" | "shortAnswer" | "reviewPrac";
  prompt: string;
  topic?: string;         // free-text tag, e.g. "Chain rule" — for future spaced-repetition grouping
  importRound: number;    // round number this question was added in
  status: "active" | "archived"; // meaningful for MC/SA only — see §5.4. RP questions are always active; their own lifecycle is tracked on ReviewPracAnswer instead.
}
```

### 2.2 Multiple Choice

```ts
interface MCQuestion extends QuestionBase {
  mode: "multipleChoice";
  options: { id: string; text: string }[];
  correctOptionId: string; // must match one options[].id
}
```

### 2.3 Short Answer

```ts
interface SAQuestion extends QuestionBase {
  mode: "shortAnswer";
  acceptableAnswers: AcceptableAnswer[]; // matches if ANY entry matches — see §4.2
}

interface AcceptableAnswer {
  type: "exact" | "regex" | "keywords";
  value: string | string[];   // string for exact/regex, string[] for keywords
  requireAll?: boolean;       // keywords only, default true
  caseSensitive?: boolean;    // default false
  fuzzyTolerance?: "auto" | "off" | number; // default "auto" — see §4.2
}
```

### 2.4 Review Prac

```ts
interface RPQuestion extends QuestionBase {
  mode: "reviewPrac";
  context?: string; // optional supporting material/rubric text, shown alongside the prompt
}
```

### 2.5 Attempt record (Multiple Choice & Short Answer only)

One row per submission — never overwritten, so full history accumulates.

```ts
interface Attempt {
  attemptId: string;      // app-generated, auto-increment or UUID
  questionId: string;
  attemptRound: number;   // round current at time of this attempt (may differ from the question's importRound if re-attempted later)
  timestamp: number;      // epoch ms
  userAnswer: string;     // raw text (SA) or selected option id (MC)
  isCorrect: boolean;
  matchedAnswerIndex?: number; // SA only — which acceptableAnswers[] entry matched, for later review
}
```

No aggregate/streak fields are stored redundantly. Total attempts, accuracy, last-attempt date, etc. are all derived from this table on read — the data volume involved (hundreds to low thousands of questions, not millions) makes on-the-fly computation cheap, and it removes an entire class of cache-invalidation bugs. This table alone is sufficient input for a spaced-repetition scheduler later (SM-2-style or otherwise) without any schema change.

### 2.6 Review Prac answer record

One row per RP question — this *is* overwritten as the user types (autosave), unlike attempts.

```ts
interface ReviewPracAnswer {
  questionId: string;
  answerText: string;         // "" until the user types something; retained across reopen
  status: "draft" | "exported";
  lastModified: number;       // epoch ms, updated on every autosave or reopen
  exportedInRound?: number;   // round of the most recent export, present while status is "exported"
}
```

Because exported answers can be reopened for a fresh attempt, `answerText` on its own isn't enough to keep a record of what was actually sent in a past export — it gets overwritten if the question is reopened and re-answered. A separate history table snapshots each export:

```ts
interface ReviewPracExportHistory {
  historyId: string;   // app-generated
  questionId: string;
  answerText: string;  // snapshot of the answer at the moment of export
  exportedInRound: number;
  timestamp: number;
}
```

**Exporting** a draft RP answer: write a snapshot into `reviewPracExportHistory`, then set the live row's `status` to `"exported"` and `exportedInRound` to the current round. The live `answerText` is left as-is.

**Reopening** an exported RP answer: an explicit action, not tied to a new import round — it can happen at any time. Sets `status` back to `"draft"` and updates `lastModified`. `answerText` is left untouched (the user is editing from where they left off, not starting blank); they can clear it themselves if they want a fresh start. Once reopened, the question is eligible for the next Export again.

### 2.7 App meta

```ts
interface AppMeta {
  currentRound: number;   // starts at 1, incremented by 1 on every successful Import
  lastImportTimestamp: number;
}
```

---

## 3. Storage

**IndexedDB**, not localStorage. Reasoning: localStorage's ~5–10MB ceiling and synchronous API are a poor fit once attempt history accumulates across many rounds and subjects (your existing revision docs run 50+ pages per exam period — the question volume behind that is not small), and IndexedDB gives indexed lookups by subject/mode/questionId without loading everything into memory on every read.

### 3.1 Object stores

| Store              | Key path      | Indexes                          |
|---------------------|---------------|-----------------------------------|
| `questions`          | `id`          | `subject`, `mode`, `[subject+mode]` |
| `attempts`           | `attemptId`   | `questionId`, `attemptRound`      |
| `reviewPracAnswers`  | `questionId`  | `status`                          |
| `reviewPracExportHistory` | `historyId` | `questionId`, `exportedInRound` |
| `meta`                | `key`         | —                                  |

### 3.2 Persists vs. ephemeral

**Persists (IndexedDB):** every imported question across all subjects/modes/rounds, whether currently active or archived; every MC/SA attempt ever made; every RP answer (draft or exported) and its status, plus a snapshot of each export in `reviewPracExportHistory`; round counter and import timestamp.

**Ephemeral (never stored, lost on refresh):** the raw text sitting in the import paste field before you click Import; the raw export text after generation (it lives only in the clipboard); any "correct/incorrect" flash shown immediately after an MC/SA submission — that information already lives permanently in the `attempts` row, it just isn't re-derived as a transient display state.

### 3.3 Autosave behaviour for Review Prac

Every change to an RP answer's text writes to `reviewPracAnswers`, debounced (e.g. 500ms after the user stops typing) rather than on every keystroke, so a closed tab or crash mid-sentence loses at most the last half-second of typing.

---

## 4. Grading Logic

### 4.1 Multiple Choice

Direct comparison: `isCorrect = (selectedOptionId === question.correctOptionId)`. An attempt row is written regardless of correctness.

### 4.2 Short Answer

**Normalization** (applied to both the user's input and every `AcceptableAnswer.value` before comparison, unless `caseSensitive: true` skips the lowercasing step):

1. Trim leading/trailing whitespace.
2. Lowercase.
3. Strip all characters except letters, digits, whitespace, and the symbol set `+ - * / = ^ . ° %` (this keeps numeric/scientific answers like `9.8 m/s^2` intact while dropping stray punctuation like trailing full stops or quote marks).
4. Collapse repeated whitespace to a single space.

**Matching**, tried against each `AcceptableAnswer` entry in order — any single entry matching makes the answer correct overall:

- **`exact`** — normalized user answer compared to normalized `value` using the fuzzy-tolerance rule below.
- **`regex`** — `value` is used as a regex pattern (case-insensitive unless `caseSensitive: true`), tested against the *raw* trimmed input, no normalization or fuzziness applied. This is the escape hatch for when you want to be precise on purpose.
- **`keywords`** — `value` is a list of required words/phrases. Each keyword is split into its own tokens; every token in a keyword must fuzzy-match some token in the user's normalized answer (order-independent) for that keyword to count as present. If `requireAll` is true (default), every keyword in the list must be present; if false, any one keyword present is sufficient.

**Fuzzy tolerance** (Levenshtein edit distance), the answer to "what counts as an acceptable spelling deviation":

| Target token length | Max edit distance allowed |
|---|---|
| ≤ 3 characters | 0 (no fuzziness — too easy to false-positive, e.g. "cat" vs "cot") |
| 4–6 characters | 1 |
| 7–10 characters | 2 |
| 11+ characters | 3 (capped) |

`fuzzyTolerance: "auto"` (the default) uses this table. `"off"` forces exact-only matching for that entry. A specific integer overrides the table entirely — useful if you know a particular answer needs to be stricter or looser than the default curve.

The attempt record stores which `acceptableAnswers` index matched (if any), so a later review screen can show *why* something was marked right or wrong.

### 4.3 Review Prac

No grading. The typed text is stored as-is via the autosave path in §3.3. There is nothing to compute here — this mode exists purely to capture your response for later export.

---

## 5. JSON Import Schema

### 5.1 Shape

```json
{
  "importVersion": 1,
  "subjects": [
    {
      "subject": "maths",
      "questions": [
        {
          "mode": "multipleChoice",
          "prompt": "What is the derivative of x^2?",
          "options": [
            { "id": "a", "text": "x" },
            { "id": "b", "text": "2x" },
            { "id": "c", "text": "2x^2" },
            { "id": "d", "text": "x^2/2" }
          ],
          "correctOptionId": "b",
          "topic": "Differentiation basics"
        },
        {
          "mode": "shortAnswer",
          "prompt": "State the rule used to differentiate composite functions.",
          "acceptableAnswers": [
            { "type": "keywords", "value": ["chain", "rule"], "requireAll": true }
          ],
          "topic": "Chain rule"
        },
        {
          "mode": "reviewPrac",
          "prompt": "Prove that the derivative of sin(x) is cos(x) from first principles.",
          "context": "Marking scheme: expects the limit definition, expansion of sin(x+h), and correct use of standard limits.",
          "topic": "First principles"
        }
      ]
    }
  ]
}
```

`subjects` is an array so one import can cover one subject (the common case) or several at once without a schema change either way.

### 5.2 Field notes

- `subject` must be one of the six canonical slugs from §1 (`sciThinking`, `science`, `maths`, `english`, `history`, `geography`) — not the display name.
- `id` is never supplied in the import JSON; the app generates it, avoiding any collision risk between separately-generated Claude outputs.
- `options[].id` only needs to be unique within its own question.

### 5.3 Validation on import

For every question in the payload, in order:

1. `subject` is a recognised slug — reject the question if not.
2. `mode` is one of the modes that subject supports per §1 — reject if not (e.g. a `multipleChoice` question under `english` is rejected).
3. Mode-specific shape check: MC needs ≥2 `options` and a `correctOptionId` that matches one of them; SA needs ≥1 `acceptableAnswers` entry; RP needs only a non-empty `prompt`.

Rejected questions are skipped individually rather than failing the whole import — a batch of 20 questions with one malformed entry shouldn't discard the other 19. (How a rejection is surfaced to you is a UI concern, out of scope here — the data-logic contract is just that invalid entries don't get written to `questions`.)

### 5.4 What happens on a successful import

1. `AppMeta.currentRound` increments by 1.
2. For every subject present in the import payload: all currently `active` questions of mode `multipleChoice` or `shortAnswer` belonging to that subject are set to `status: "archived"`. Their attempt history in `attempts` is untouched — archiving a question never deletes or alters past attempts, it only removes it from the pool of questions available for a fresh attempt. Review Prac questions for that subject are not affected by this step at all; they don't get archived by a new import.
3. Each valid question in the payload is written to `questions` with a fresh `id`, `importRound` set to the new round number, and `status: "active"`.

Net effect: at any point in time, the active MC/SA pool for a subject is just whatever was imported most recently for that subject, while the full history of every question ever attempted (including archived ones) stays queryable for later spaced-repetition work.

---

## 6. Plain-Text Export Format

### 6.1 What gets bundled

All `reviewPracAnswers` rows with `status: "draft"` belonging to the subject currently open in the app — not across every subject. If you want to export Review Prac from two different subjects, that's two separate export actions, one per subject.

### 6.2 Format

```
You are receiving a batch of Review Prac responses from a self-study app for marking.
For each numbered item below, respond with: a mark (correct / partially correct / incorrect),
brief feedback on what's missing or wrong, and a model answer. Keep your response structured
per-question, in the same order, so it's easy to match against the originals below.

Subject: Maths — Round 3

1. Prove that the derivative of sin(x) is cos(x) from first principles.
My answer: I started with the limit definition but didn't finish expanding sin(x+h)...

2. [next question prompt]
My answer: (no answer given)
```

Single subject per export, so one header line rather than repeated `=== Subject ===` blocks. Blank answers are rendered explicitly as `(no answer given)` rather than an empty line, so the marking instructions don't have to guess whether that was a paste error.

### 6.3 State change on export, and reopening

Every RP row included in the bundle has a snapshot written to `reviewPracExportHistory`, then its live `status` flipped from `draft` to `exported` with `exportedInRound` set to the round active at export time (see §2.6). This isn't permanent — an exported question can be reopened at any later point (not tied to a new import round), which sets it back to `draft` with its existing answer text intact, ready to be edited and included in a future export.

---

## 7. Document Generation

Scope: a LaTeX template with placeholder tokens is pasted into the app once, saved, and reused. The app derives a set of input fields directly from the template's own text (no separate field-definition step), and renders the filled-in template to PDF entirely client-side via a XeLaTeX-in-WASM engine — no server round-trip, consistent with the rest of this app's local-first design.

This is an independent feature from quizzing (§1–§6): a template's optional `subject` tag is for filtering/organization only and is not validated against the mode matrix in §1, since "document generation" isn't one of the modes a subject supports.

### 7.1 Placeholder syntax

Ordinary LaTeX has no reserved use for the ASCII pair `[^` `^]` — plain keyboard characters, don't collide with `{}`, `\`, `$`, or `%`, and are visually unmistakable when scanning template source. A placeholder is therefore:

```
[^field_name^]
```

where `field_name` matches `[A-Za-z0-9_]+`. Extraction regex:

```
/\[\^([A-Za-z0-9_]+)\^\]/g
```

Deliberately rejected alternatives: `<<name>>` (collides with guillemet-style quoting used by some babel locales), `%%name%%` (`%` starts a LaTeX comment, so a template with an unfilled/mistyped token could silently truncate the rest of its line if a bug ever let raw source reach the compiler), `{{name}}` (indistinguishable from a plain brace group at a glance, and legal LaTeX already nests bare `{...}` constantly), `⟦name⟧` (unmistakable but non-ASCII — awkward to type and rendered as a fallback-font tofu glyph in the app's chosen typefaces).

### 7.2 Data model

```ts
interface DocumentTemplate {
  id: string;              // app-generated UUID
  name: string;
  subject?: SubjectSlug;   // optional tag, filtering only — not part of §1's validation
  latexSource: string;     // raw pasted template, including [^placeholder^] tokens
  placeholders: string[];  // cached extraction result — see §7.3; recomputed and overwritten on every edit to latexSource
  createdAt: number;
  updatedAt: number;
}

interface DocumentFieldDraft {
  templateId: string;
  fieldName: string;   // one of the owning template's current placeholders
  value: string;        // raw text, substituted into the template verbatim (no escaping — see §7.5)
  lastModified: number; // epoch ms, updated on autosave
}
```

`DocumentFieldDraft` rows are keyed by the compound `[templateId+fieldName]` — one row per field per template, autosaved the same debounced way as `reviewPracAnswers` (§3.3), so a filled-in form survives a refresh.

### 7.3 Storage

| Store                  | Key path              | Indexes     |
|-------------------------|------------------------|-------------|
| `documentTemplates`     | `id`                   | `subject`   |
| `documentFieldDrafts`   | `[templateId+fieldName]` | `templateId` |

**Persists:** every saved template and its cached `placeholders` list; every field draft value, per template.

**Ephemeral:** the generated PDF bytes themselves. Like the RP export text (§3.2), a generated document is a one-shot output — it's handed to the browser as a download, not written back to IndexedDB. Regenerating from the same saved field values is cheap (a re-run of §7.6), so there's no need to persist the binary.

### 7.4 Field-discovery logic

On every change to a template's `latexSource` (initial paste or a later edit):

1. Run the §7.1 regex over the full source, collecting each captured `field_name` in order of first appearance.
2. De-duplicate by name, preserving first-seen order — a placeholder used five times in the template still produces exactly one field.
3. Write this list to `DocumentTemplate.placeholders`, replacing whatever was cached before.
4. Reconcile `documentFieldDrafts` against the new list: drafts whose `fieldName` is still present are left untouched (so editing a template that already has content typed in doesn't blank it out); drafts whose `fieldName` is no longer present are deleted; a new draft row (`value: ""`) is created for every name that's newly appeared.

The number of input fields shown for a template is just `placeholders.length` at read time — nothing about field count is stored independently of this derivation, same philosophy as the derived-on-read attempt stats in §2.5.

### 7.5 Generation logic

Given a template and its current field draft values:

1. **Validate**: every entry in `placeholders` must have a non-empty corresponding draft value. Generation is refused (nothing is sent to the render step) if any are blank — substituting an empty string for a missed field would silently delete content from the rendered document rather than surfacing the problem.
2. **Substitute**: for each placeholder name, replace every occurrence of `[^name^]` in `latexSource` with its draft value, verbatim. No HTML-style escaping is applied — the inserted value is itself LaTeX source (e.g. a field's value might legitimately be `\textbf{x^2}`), and the output of this step must be a complete, self-contained `.tex` document ready to hand to the compiler.
3. Pass the substituted string to the rendering pipeline (§7.6).

### 7.6 Rendering pipeline (XeLaTeX in-browser)

Rendering runs entirely client-side using a XeTeX engine compiled to WebAssembly (the SwiftLaTeX `xetex.wasm` engine and its JS wrapper are the reference implementation for this — a full XeTeX build that runs in a Web Worker with no server dependency once its assets are loaded). This keeps the feature consistent with the rest of the app: no upload of your template or answers to any backend.

Pipeline:

1. **Lazy-load the engine.** The WASM binary and its bundled TeX Live package image are large (tens of MB) — load them on first use of Document Generation, not on app start, and cache the initialized engine instance for the rest of the session.
2. **Run in a Web Worker.** Compilation is synchronous and CPU-heavy; it must not block the main thread. The worker owns the engine instance and the two calls below.
3. **Write and compile:**
   - `writeMemFSFile("main.tex", substitutedSource)`
   - `setEngineMainFile("main.tex")`
   - `compileLaTeX()` → returns `{ pdf: Uint8Array, status, log }`
4. **Cross-reference rerun (edge case):** if `status === 0` but `log` contains a "Rerun to get cross-references right" style notice, call `compileLaTeX()` a second time before returning — templates that use `\ref`, `\tableofcontents`, or similar need a second pass to resolve correctly, same as native XeLaTeX.
5. **Failure path:** if `status !== 0`, no PDF is produced — surface `log` verbatim (it's the compiler's own error output: undefined control sequence, mismatched braces, missing package, etc.) rather than attempting to interpret it.

**Font caveat, worth flagging explicitly:** XeLaTeX's headline feature is `fontspec`-based access to arbitrary system fonts, but there is no "system" inside a WASM sandbox — only fonts pre-bundled into the engine's TeX Live package image are available to `\setmainfont` and friends. Templates that assume an arbitrary installed font won't render as expected; this is a hard constraint of running XeLaTeX in-browser, not a bug to fix later.

### 7.7 Output handling

On a successful compile: wrap the returned `pdf` bytes in a `Blob` (`type: "application/pdf"`), create an object URL via `URL.createObjectURL`, and offer it as a download (filename derived from the template's `name`). The object URL is revoked once the download completes or a new generation runs — it's a view onto ephemeral bytes, not a stored artifact (§7.3).

---

## 8. Confirmed Decisions

- Importing a subject archives that subject's previously-active MC/SA questions rather than accumulating them; attempt history is preserved regardless.
- Export bundles Review Prac answers for the current subject only, not globally.
- Exported Review Prac answers can be reopened for a fresh attempt at any time, independent of the round cycle.
- Document Generation placeholders use the `[^name^]` token (plain ASCII), never a style that could collide with real LaTeX syntax.
- Input field count for a template is always derived live from regex-scanning its source, never stored as an independent number.
- Rendering happens fully client-side via a WASM XeLaTeX engine — no backend involvement, and generated PDFs are never persisted, only produced on demand for download.
