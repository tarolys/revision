import { useState } from "react";
import { TerminalFrame } from "../components/TerminalFrame";
import { TextArea } from "../components/TextArea";
import { PromptInput } from "../components/PromptInput";
import { Button } from "../components/Button";
import { importPayload, type ImportResult } from "../lib/importExport";
import { SUBJECTS, subjectSupportsMode, type AcceptableAnswer, type QuestionMode, type SubjectSlug } from "../lib/types";
import styles from "./Import.module.css";

interface ImportProps {
  onImported: () => void;
  onDone: () => void;
}

const PLACEHOLDER = `{
  "importVersion": 1,
  "subjects": [
    {
      "subject": "maths",
      "questions": [
        { "mode": "shortAnswer", "prompt": "...", "acceptableAnswers": [...] }
      ]
    }
  ]
}`;

const MODES: QuestionMode[] = ["multipleChoice", "shortAnswer", "reviewPrac"];

function buildInstructions(): string {
  const subjectLines = SUBJECTS.map((s) => `  - "${s.slug}" (${s.label}) — supports: ${s.modes.join(", ")}`).join("\n");
  return `Generate a JSON payload for importing revision questions into my app. Match this exact schema:

{
  "importVersion": 1,
  "subjects": [
    { "subject": "<slug>", "questions": [ <question>, ... ] }
  ]
}

Valid subject slugs and the question modes each one supports:
${subjectLines}

Each <question> is one of:

multipleChoice:
  { "mode": "multipleChoice", "prompt": "...", "topic": "optional",
    "options": [{ "id": "a", "text": "..." }, { "id": "b", "text": "..." }, ...],
    "correctOptionId": "a" }
  — needs at least 2 options; correctOptionId must match one option's id.

shortAnswer:
  { "mode": "shortAnswer", "prompt": "...", "topic": "optional",
    "acceptableAnswers": [
      { "type": "exact", "value": "..." },
      { "type": "regex", "value": "^...$" },
      { "type": "keywords", "value": ["word1", "word2"], "requireAll": true }
    ] }
  — needs at least 1 acceptableAnswers entry. "type" is "exact" | "regex" | "keywords".
    "value" is a string for exact/regex, a string array for keywords.
    Optional per-entry fields: "caseSensitive" (bool, default false),
    "requireAll" (bool, keywords only, default true),
    "fuzzyTolerance" ("auto" | "off" | a number, default "auto").

reviewPrac:
  { "mode": "reviewPrac", "prompt": "...", "topic": "optional", "context": "optional" }
  — needs a non-empty prompt.

Rules: every question needs a non-empty "prompt". A subject only accepts modes listed
for it above — don't emit a mode a subject doesn't support. Output ONLY the JSON, no
commentary, ready to paste directly into the import box.`;
}

const INSTRUCTIONS = buildInstructions();

interface ManualCard {
  key: string;
  subject: SubjectSlug;
  mode: QuestionMode;
  prompt: string;
  topic: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  acceptableAnswers: AcceptableAnswer[];
  context: string;
}

function blankOptions(): { id: string; text: string }[] {
  return [
    { id: "a", text: "" },
    { id: "b", text: "" },
  ];
}

function blankAcceptableAnswers(): AcceptableAnswer[] {
  return [{ type: "exact", value: "" }];
}

function firstSupportedMode(subject: SubjectSlug): QuestionMode {
  return MODES.find((m) => subjectSupportsMode(subject, m)) ?? "reviewPrac";
}

function blankCard(subject: SubjectSlug, mode: QuestionMode): ManualCard {
  return {
    key: crypto.randomUUID(),
    subject,
    mode,
    prompt: "",
    topic: "",
    options: blankOptions(),
    correctOptionId: "a",
    acceptableAnswers: blankAcceptableAnswers(),
    context: "",
  };
}

function cardIsValid(card: ManualCard): string | null {
  if (card.prompt.trim().length === 0) return "prompt is required";
  if (card.mode === "multipleChoice") {
    const filled = card.options.filter((o) => o.text.trim().length > 0);
    if (filled.length < 2) return "needs at least 2 options";
    if (!filled.some((o) => o.id === card.correctOptionId)) return "pick which option is correct";
  } else if (card.mode === "shortAnswer") {
    const filled = card.acceptableAnswers.filter((a) =>
      Array.isArray(a.value) ? a.value.some((v) => v.trim().length > 0) : String(a.value).trim().length > 0,
    );
    if (filled.length < 1) return "needs at least 1 acceptable answer";
  }
  return null;
}

function cardToRawQuestion(card: ManualCard) {
  const base = {
    prompt: card.prompt.trim(),
    topic: card.topic.trim() || undefined,
  };
  if (card.mode === "multipleChoice") {
    const options = card.options.filter((o) => o.text.trim().length > 0);
    return { ...base, mode: "multipleChoice" as const, options, correctOptionId: card.correctOptionId };
  }
  if (card.mode === "shortAnswer") {
    const acceptableAnswers = card.acceptableAnswers
      .map((a) => ({
        ...a,
        value: Array.isArray(a.value) ? a.value.map((v) => v.trim()).filter(Boolean) : String(a.value).trim(),
      }))
      .filter((a) => (Array.isArray(a.value) ? a.value.length > 0 : a.value.length > 0));
    return { ...base, mode: "shortAnswer" as const, acceptableAnswers };
  }
  return { ...base, mode: "reviewPrac" as const, context: card.context.trim() || undefined };
}

export function Import({ onImported, onDone }: ImportProps) {
  const [source, setSource] = useState<"json" | "manual">("json");

  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);

  const [draft, setDraft] = useState<ManualCard>(() => blankCard("maths", "multipleChoice"));
  const [queue, setQueue] = useState<ManualCard[]>([]);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function copyInstructions() {
    await navigator.clipboard.writeText(INSTRUCTIONS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function updateDraftSubject(subject: SubjectSlug) {
    setDraft((d) => ({
      ...d,
      subject,
      mode: subjectSupportsMode(subject, d.mode) ? d.mode : firstSupportedMode(subject),
    }));
  }

  function updateDraftMode(mode: QuestionMode) {
    setDraft((d) => ({ ...d, mode }));
  }

  function addCardToQueue() {
    const err = cardIsValid(draft);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setQueue((q) => [...q, draft]);
    setDraft(blankCard(draft.subject, draft.mode));
  }

  function removeCard(key: string) {
    setQueue((q) => q.filter((c) => c.key !== key));
  }

  async function runJsonImport() {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setError("not valid JSON — check for a trailing comma or unclosed brace");
      return;
    }
    setBusy(true);
    try {
      const res = await importPayload(parsed as Parameters<typeof importPayload>[0]);
      setResult(res);
      setRaw("");
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "import failed");
    } finally {
      setBusy(false);
    }
  }

  async function runManualImport() {
    if (queue.length === 0) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const bySubject = new Map<SubjectSlug, ReturnType<typeof cardToRawQuestion>[]>();
      for (const card of queue) {
        const list = bySubject.get(card.subject) ?? [];
        list.push(cardToRawQuestion(card));
        bySubject.set(card.subject, list);
      }
      const payload = {
        importVersion: 1,
        subjects: Array.from(bySubject.entries()).map(([subject, questions]) => ({ subject, questions })),
      };
      const res = await importPayload(payload as Parameters<typeof importPayload>[0]);
      setResult(res);
      setQueue([]);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TerminalFrame command="import :round next">
      <div className={styles.sourceToggle}>
        <button
          className={`${styles.sourceTab} ${source === "json" ? styles.sourceTabActive : ""}`}
          onClick={() => setSource("json")}
        >
          paste JSON
        </button>
        <button
          className={`${styles.sourceTab} ${source === "manual" ? styles.sourceTabActive : ""}`}
          onClick={() => setSource("manual")}
        >
          write cards manually
        </button>
      </div>

      {source === "json" && (
        <>
          <TextArea
            variant="code"
            rows={16}
            placeholder={PLACEHOLDER}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => void copyInstructions()}>
              {copied ? "copied to clipboard" : "copy format instructions"}
            </Button>
            <Button variant="primary" disabled={busy || raw.trim().length === 0} onClick={() => void runJsonImport()}>
              {busy ? "importing…" : "run import"}
            </Button>
          </div>
        </>
      )}

      {source === "manual" && (
        <>
          <div className={styles.manualForm}>
            <div className={styles.manualRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="manual-subject">
                  SUBJECT
                </label>
                <select
                  id="manual-subject"
                  className={styles.select}
                  value={draft.subject}
                  onChange={(e) => updateDraftSubject(e.target.value as SubjectSlug)}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="manual-mode">
                  MODE
                </label>
                <select
                  id="manual-mode"
                  className={styles.select}
                  value={draft.mode}
                  onChange={(e) => updateDraftMode(e.target.value as QuestionMode)}
                >
                  {MODES.filter((m) => subjectSupportsMode(draft.subject, m)).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="manual-topic">
                TOPIC (optional)
              </label>
              <PromptInput
                id="manual-topic"
                value={draft.topic}
                onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                placeholder="e.g. calculus"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="manual-prompt">
                PROMPT
              </label>
              <TextArea
                id="manual-prompt"
                rows={3}
                value={draft.prompt}
                onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                placeholder="the question text"
              />
            </div>

            {draft.mode === "multipleChoice" && (
              <fieldset className={styles.field}>
                <legend className={styles.fieldLabel}>OPTIONS — mark the correct one</legend>
                {draft.options.map((opt, i) => (
                  <div className={styles.optionRow} key={opt.id}>
                    <input
                      type="radio"
                      name="correctOption"
                      aria-label={`mark option ${opt.id} correct`}
                      checked={draft.correctOptionId === opt.id}
                      onChange={() => setDraft((d) => ({ ...d, correctOptionId: opt.id }))}
                    />
                    <PromptInput
                      aria-label={`option ${opt.id} text`}
                      value={opt.text}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          options: d.options.map((o, j) => (j === i ? { ...o, text: e.target.value } : o)),
                        }))
                      }
                      placeholder={`option ${opt.id}`}
                    />
                    {draft.options.length > 2 && (
                      <button
                        className={styles.removeGlyph}
                        onClick={() =>
                          setDraft((d) => ({ ...d, options: d.options.filter((_, j) => j !== i) }))
                        }
                        aria-label="remove option"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className={styles.addRowButton}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      options: [...d.options, { id: String.fromCharCode(97 + d.options.length), text: "" }],
                    }))
                  }
                >
                  + add option
                </Button>
              </fieldset>
            )}

            {draft.mode === "shortAnswer" && (
              <fieldset className={styles.field}>
                <legend className={styles.fieldLabel}>ACCEPTABLE ANSWERS</legend>
                {draft.acceptableAnswers.map((ans, i) => (
                  <div className={styles.answerRow} key={i}>
                    <select
                      className={styles.select}
                      aria-label={`acceptable answer ${i + 1} type`}
                      value={ans.type}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          acceptableAnswers: d.acceptableAnswers.map((a, j) =>
                            j === i
                              ? {
                                  type: e.target.value as AcceptableAnswer["type"],
                                  value: e.target.value === "keywords" ? [""] : "",
                                }
                              : a,
                          ),
                        }))
                      }
                    >
                      <option value="exact">exact</option>
                      <option value="regex">regex</option>
                      <option value="keywords">keywords</option>
                    </select>
                    <PromptInput
                      aria-label={`acceptable answer ${i + 1} value`}
                      value={Array.isArray(ans.value) ? ans.value.join(", ") : ans.value}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          acceptableAnswers: d.acceptableAnswers.map((a, j) =>
                            j === i
                              ? {
                                  ...a,
                                  value: ans.type === "keywords" ? e.target.value.split(",") : e.target.value,
                                }
                              : a,
                          ),
                        }))
                      }
                      placeholder={ans.type === "keywords" ? "word one, word two" : "expected answer"}
                    />
                    {draft.acceptableAnswers.length > 1 && (
                      <button
                        className={styles.removeGlyph}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            acceptableAnswers: d.acceptableAnswers.filter((_, j) => j !== i),
                          }))
                        }
                        aria-label="remove acceptable answer"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className={styles.addRowButton}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      acceptableAnswers: [...d.acceptableAnswers, { type: "exact", value: "" }],
                    }))
                  }
                >
                  + add acceptable answer
                </Button>
              </fieldset>
            )}

            {draft.mode === "reviewPrac" && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="manual-context">
                  CONTEXT / RUBRIC (optional)
                </label>
                <TextArea
                  id="manual-context"
                  rows={3}
                  value={draft.context}
                  onChange={(e) => setDraft((d) => ({ ...d, context: e.target.value }))}
                  placeholder="anything worth carrying alongside the prompt"
                />
              </div>
            )}

            <div className={styles.actions}>
              <Button variant="ghost" onClick={addCardToQueue}>
                + add card to queue
              </Button>
            </div>
          </div>

          {queue.length > 0 && (
            <div className={styles.queue}>
              <div className={styles.queueTitle}>
                {queue.length} card{queue.length === 1 ? "" : "s"} queued
              </div>
              <ul className={styles.queueList}>
                {queue.map((c) => (
                  <li key={c.key} className={styles.queueItem}>
                    <span className={styles.queueTag}>
                      [{c.subject}/{c.mode}]
                    </span>{" "}
                    {c.prompt.slice(0, 70)}
                    {c.prompt.length > 70 ? "…" : ""}
                    <button className={styles.removeGlyph} onClick={() => removeCard(c.key)} aria-label="remove card">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.actions}>
                <Button variant="primary" disabled={busy} onClick={() => void runManualImport()}>
                  {busy ? "importing…" : `run import (${queue.length})`}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className={styles.error}>error: {error}</div>}

      {result && (
        <div className={styles.result}>
          <div className={styles.summary}>
            round {result.round} — {result.acceptedCount} question
            {result.acceptedCount === 1 ? "" : "s"} accepted
          </div>
          {result.rejected.length > 0 && (
            <>
              <div className={styles.rejectedTitle}>
                {result.rejected.length} rejected
              </div>
              <ul className={styles.rejectedList}>
                {result.rejected.map((r, i) => (
                  <li key={i} className={styles.rejectedItem}>
                    [{r.subject}] {r.prompt.slice(0, 60)}
                    {r.prompt.length > 60 ? "…" : ""} — {r.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onDone}>
              back to dashboard
            </Button>
          </div>
        </div>
      )}
    </TerminalFrame>
  );
}
