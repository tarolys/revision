import { useEffect, useState } from "react";
import { TerminalFrame } from "../components/TerminalFrame";
import { PromptInput } from "../components/PromptInput";
import { Button } from "../components/Button";
import { SessionLogLine } from "../components/SessionLogLine";
import { getActiveQuestions } from "../lib/db/questions";
import { getAttemptsForQuestion, recordAttempt } from "../lib/db/attempts";
import { gradeMultipleChoice } from "../lib/grading/gradeMultipleChoice";
import { gradeShortAnswer } from "../lib/grading/gradeShortAnswer";
import type { Attempt, MCOption, MCQuestion, Question, SAQuestion, SubjectSlug } from "../lib/types";
import { formatClock } from "../lib/stats";
import styles from "./Practice.module.css";

interface PracticeProps {
  subject: SubjectSlug;
  round: number;
}

interface Feedback {
  isCorrect: boolean;
  matchedAnswerIndex?: number;
}

type Phase = "drilling" | "paused";

/** Fisher-Yates — every pass through the deck gets a fresh order. */
function shuffle<T>(items: T[]): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function Practice({ subject, round }: PracticeProps) {
  const [basePool, setBasePool] = useState<Question[]>([]);
  const [order, setOrder] = useState<Question[]>([]);
  const [optionsByQuestion, setOptionsByQuestion] = useState<Record<string, MCOption[]>>({});
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("drilling");
  const [passResults, setPassResults] = useState<Record<string, boolean>>({});

  const [saValue, setSaValue] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submittedOptionId, setSubmittedOptionId] = useState<string | null>(null);
  const [history, setHistory] = useState<Attempt[]>([]);

  function startPass(questions: Question[]) {
    const shuffledQuestions = shuffle(questions);
    const nextOptions: Record<string, MCOption[]> = {};
    for (const q of shuffledQuestions) {
      if (q.mode === "multipleChoice") nextOptions[q.id] = shuffle(q.options);
    }
    setOrder(shuffledQuestions);
    setOptionsByQuestion(nextOptions);
    setIndex(0);
    setPassResults({});
    setPhase("drilling");
    setFeedback(null);
    setSubmittedOptionId(null);
    setSaValue("");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mc = await getActiveQuestions(subject, "multipleChoice");
      const sa = await getActiveQuestions(subject, "shortAnswer");
      if (cancelled) return;
      const pool = [...mc, ...sa];
      setBasePool(pool);
      startPass(pool);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const current = order[index];

  function displayOptions(question: MCQuestion): MCOption[] {
    return optionsByQuestion[question.id] ?? question.options;
  }

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    getAttemptsForQuestion(current.id).then((rows) => {
      if (!cancelled) setHistory(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  async function submitMC(question: MCQuestion, optionId: string) {
    const isCorrect = gradeMultipleChoice(question, optionId);
    setFeedback({ isCorrect });
    setSubmittedOptionId(optionId);
    setPassResults((r) => ({ ...r, [question.id]: isCorrect }));
    const attempt: Attempt = {
      attemptId: crypto.randomUUID(),
      questionId: question.id,
      attemptRound: round,
      timestamp: Date.now(),
      userAnswer: optionId,
      isCorrect,
    };
    await recordAttempt(attempt);
    setHistory((h) => [...h, attempt]);
  }

  async function submitSA(question: SAQuestion) {
    if (saValue.trim().length === 0) return;
    const result = gradeShortAnswer(question, saValue);
    setFeedback(result);
    setPassResults((r) => ({ ...r, [question.id]: result.isCorrect }));
    const attempt: Attempt = {
      attemptId: crypto.randomUUID(),
      questionId: question.id,
      attemptRound: round,
      timestamp: Date.now(),
      userAnswer: saValue,
      isCorrect: result.isCorrect,
      matchedAnswerIndex: result.matchedAnswerIndex,
    };
    await recordAttempt(attempt);
    setHistory((h) => [...h, attempt]);
  }

  function next() {
    if (index + 1 < order.length) {
      setIndex((i) => i + 1);
      setFeedback(null);
      setSubmittedOptionId(null);
      setSaValue("");
    } else {
      setPhase("paused");
    }
  }

  function retryWrongOnly(wrongIds: string[]) {
    startPass(order.filter((q) => wrongIds.includes(q.id)));
  }

  function restartEverything() {
    startPass(basePool);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (phase !== "drilling" || !current) return;
      if (feedback) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          next();
        }
        return;
      }
      if (current.mode === "multipleChoice") {
        const key = e.key.toLowerCase();
        if (key.length !== 1) return;
        const idx = key.charCodeAt(0) - 97;
        const opts = displayOptions(current);
        if (idx >= 0 && idx < opts.length) {
          e.preventDefault();
          void submitMC(current, opts[idx].id);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, feedback, phase, optionsByQuestion, order, index]);

  if (basePool.length === 0) {
    return (
      <TerminalFrame command={`drill :subject ${subject}`} bare>
        <div className={styles.empty}>no active multiple-choice or short-answer questions for this subject yet — import a round to begin.</div>
      </TerminalFrame>
    );
  }

  if (phase === "paused") {
    const correctCount = order.filter((q) => passResults[q.id]).length;
    const wrongIds = order.filter((q) => passResults[q.id] === false).map((q) => q.id);
    const allCorrect = wrongIds.length === 0;
    return (
      <TerminalFrame command={`drill :subject ${subject}`} bare>
        <div className={styles.pause}>
          <div className={styles.pauseTitle}>&gt;&gt; pass complete</div>
          <div className={styles.pauseTally}>
            <span className={styles.pauseGood}>{correctCount} correct</span>
            {" · "}
            <span className={styles.pauseBad}>{wrongIds.length} wrong</span>
          </div>
          {allCorrect ? (
            <>
              <div className={styles.pauseNote}>every card in this deck has been answered correctly — nice.</div>
              <Button variant="primary" onClick={restartEverything}>
                restart everything
              </Button>
            </>
          ) : (
            <>
              <div className={styles.pauseNote}>drill the {wrongIds.length} question{wrongIds.length === 1 ? "" : "s"} you missed until they're clean.</div>
              <Button variant="primary" onClick={() => retryWrongOnly(wrongIds)}>
                drill wrong questions ({wrongIds.length})
              </Button>
            </>
          )}
        </div>
      </TerminalFrame>
    );
  }

  return (
    <TerminalFrame command={`drill :subject ${subject}`} bare>
      <div className={styles.progress}>
        question {index + 1} / {order.length} · {current.mode}
      </div>

      {current.topic && <div className={styles.topic}>topic: {current.topic}</div>}
      <div className={styles.prompt}>{current.prompt}</div>

      {current.mode === "multipleChoice" && (
        <div className={styles.options}>
          {displayOptions(current).map((opt, i) => {
            let cls = styles.option;
            if (feedback && opt.id === current.correctOptionId) {
              cls = `${styles.option} ${styles.optionCorrect}`;
            } else if (feedback && opt.id === submittedOptionId) {
              cls = `${styles.option} ${styles.optionIncorrectSelected}`;
            }
            return (
              <button
                key={opt.id}
                className={cls}
                disabled={!!feedback}
                onClick={() => void submitMC(current, opt.id)}
              >
                <span className={styles.optionLetter}>[{String.fromCharCode(97 + i)}]</span>
                {opt.text}
              </button>
            );
          })}
        </div>
      )}

      {current.mode === "shortAnswer" && !feedback && (
        <div className={styles.saRow}>
          <PromptInput
            placeholder="type your answer"
            value={saValue}
            onChange={(e) => setSaValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submitSA(current)}
          />
          <Button variant="primary" onClick={() => void submitSA(current)}>
            submit
          </Button>
        </div>
      )}

      {feedback && (
        <div className={`${styles.feedback} ${feedback.isCorrect ? styles.feedbackGood : styles.feedbackBad}`}>
          &gt;&gt; {feedback.isCorrect ? "CORRECT" : "INCORRECT"}
          {feedback.matchedAnswerIndex !== undefined && ` (matched accepted answer ${feedback.matchedAnswerIndex + 1})`}
        </div>
      )}

      <div className={styles.actions}>
        <span />
        {feedback && (
          <Button variant="ghost" onClick={next}>
            next question
          </Button>
        )}
      </div>

      {history.length > 0 && (
        <div className={styles.history}>
          <div className={styles.historyTitle}>history for this question</div>
          {history
            .slice()
            .reverse()
            .map((a) => (
              <SessionLogLine
                key={a.attemptId}
                round={a.attemptRound}
                time={formatClock(a.timestamp)}
                label={a.isCorrect ? "CORRECT" : "incorrect"}
                tone={a.isCorrect ? "good" : "bad"}
              />
            ))}
        </div>
      )}
    </TerminalFrame>
  );
}
