import { useEffect, useRef, useState } from "react";
import { TerminalFrame } from "../components/TerminalFrame";
import { TextArea } from "../components/TextArea";
import { Button } from "../components/Button";
import { StatusBadge } from "../components/StatusBadge";
import { getActiveQuestions } from "../lib/db/questions";
import { getDB } from "../lib/db/schema";
import { getReviewPracAnswer, saveDraft, reopenAnswer } from "../lib/db/reviewPrac";
import { buildExportText, exportReviewPrac } from "../lib/importExport";
import { subjectLabel, type RPQuestion, type ReviewPracAnswer, type SubjectSlug } from "../lib/types";
import styles from "./ReviewPrac.module.css";

interface ReviewPracProps {
  subject: SubjectSlug;
  round: number;
}

const AUTOSAVE_DELAY_MS = 500;

export function ReviewPrac({ subject, round }: ReviewPracProps) {
  const [questions, setQuestions] = useState<RPQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, ReviewPracAnswer>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rp = (await getActiveQuestions(subject, "reviewPrac")) as RPQuestion[];
      if (cancelled) return;
      setQuestions(rp);
      const db = await getDB();
      const rows = await Promise.all(rp.map((q) => db.get("reviewPracAnswers", q.id)));
      const map: Record<string, ReviewPracAnswer> = {};
      rows.forEach((row, i) => {
        if (row) map[rp[i].id] = row;
      });
      setAnswers(map);
      setSelectedId(rp[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [subject]);

  useEffect(() => {
    if (!selectedId) return;
    setDraftText(answers[selectedId]?.answerText ?? "");
    setSavedAt(null);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function onChangeDraft(value: string) {
    setDraftText(value);
    if (!selectedId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveDraft(selectedId, value);
      const updated = await getReviewPracAnswer(selectedId);
      if (updated) setAnswers((a) => ({ ...a, [selectedId]: updated }));
      setSavedAt(Date.now());
    }, AUTOSAVE_DELAY_MS);
  }

  async function onReopen(questionId: string) {
    await reopenAnswer(questionId);
    const updated = await getReviewPracAnswer(questionId);
    if (updated) setAnswers((a) => ({ ...a, [questionId]: updated }));
  }

  async function onExportAll() {
    const draftIds = questions.filter((q) => (answers[q.id]?.status ?? "draft") === "draft").map((q) => q.id);
    if (draftIds.length === 0) return;
    const items = draftIds.map((id) => {
      const q = questions.find((qq) => qq.id === id)!;
      return { prompt: q.prompt, answerText: answers[id]?.answerText ?? "" };
    });
    const text = buildExportText(subjectLabel(subject), round, items);
    await navigator.clipboard.writeText(text);
    await exportReviewPrac(draftIds, round);
    const db = await getDB();
    const rows = await Promise.all(draftIds.map((id) => db.get("reviewPracAnswers", id)));
    setAnswers((a) => {
      const next = { ...a };
      rows.forEach((row, i) => {
        if (row) next[draftIds[i]] = row;
      });
      return next;
    });
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2500);
  }

  if (questions.length === 0) {
    return (
      <TerminalFrame command={`edit :mode reviewPrac :subject ${subject}`} bare>
        <div className={styles.empty}>no Review Prac questions for this subject yet.</div>
      </TerminalFrame>
    );
  }

  const selected = questions.find((q) => q.id === selectedId);
  const selectedAnswer = selectedId ? answers[selectedId] : undefined;
  const isExported = selectedAnswer?.status === "exported";
  const draftCount = questions.filter((q) => (answers[q.id]?.status ?? "draft") === "draft").length;

  return (
    <TerminalFrame
      command={`edit :mode reviewPrac :subject ${subject}`}
      bare
      actions={
        <Button variant="ghost" onClick={() => void onExportAll()} disabled={draftCount === 0}>
          export {draftCount} draft{draftCount === 1 ? "" : "s"}
        </Button>
      }
    >
      <div className={styles.layout}>
        <div className={styles.list}>
          {questions.map((q) => {
            const status = answers[q.id]?.status ?? "draft";
            return (
              <button
                key={q.id}
                className={`${styles.listItem} ${q.id === selectedId ? styles.active : ""}`}
                onClick={() => setSelectedId(q.id)}
              >
                <StatusBadge label={status} tone={status === "exported" ? "amber" : "dim"} />
                <span className={styles.listItemPrompt}>{q.prompt}</span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className={styles.editor}>
            <div className={styles.editorHeader}>
              <StatusBadge label={isExported ? "exported" : "draft"} tone={isExported ? "amber" : "good"} />
              {isExported && (
                <Button variant="ghost" onClick={() => void onReopen(selected.id)}>
                  reopen for another attempt
                </Button>
              )}
            </div>

            {selected.context && <div className={styles.context}>{selected.context}</div>}

            <p className={styles.prompt}>{selected.prompt}</p>

            <TextArea
              variant="prose"
              rows={12}
              value={draftText}
              onChange={(e) => onChangeDraft(e.target.value)}
              placeholder="type your response — it autosaves as you go"
            />
            <div className={styles.autosave}>
              {savedAt ? `saved ${new Date(savedAt).toTimeString().slice(0, 8)}` : " "}
            </div>
          </div>
        )}
      </div>

      <div className={styles.exportBar}>
        <span className={styles.exportCount}>
          {draftCount} draft{draftCount === 1 ? "" : "s"} ready to export for round {round}
        </span>
        {copyStatus === "copied" && <span className={styles.exportCount}>&gt;&gt; copied to clipboard</span>}
      </div>
    </TerminalFrame>
  );
}
