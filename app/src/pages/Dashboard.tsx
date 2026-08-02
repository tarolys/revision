import { useEffect, useState } from "react";
import { TerminalFrame } from "../components/TerminalFrame";
import { Button } from "../components/Button";
import { SessionLogLine } from "../components/SessionLogLine";
import { getQuestionsBySubject } from "../lib/db/questions";
import { getDB } from "../lib/db/schema";
import { subjectLabel, type Question, type SubjectSlug } from "../lib/types";
import { formatClock } from "../lib/stats";
import styles from "./Dashboard.module.css";

interface DashboardProps {
  subject: SubjectSlug;
  round: number;
}

interface LogEntry {
  attemptId: string;
  questionId: string;
  round: number;
  time: string;
  label: string;
  tone: "good" | "bad" | "amber" | "dim";
  userAnswer: string;
  isCorrect: boolean;
  matchedAnswerIndex?: number;
}

const INLINE_HISTORY_CAP = 24;
const HISTORY_FETCH_CAP = 300;

export function Dashboard({ subject, round }: DashboardProps) {
  const [activeMC, setActiveMC] = useState(0);
  const [activeSA, setActiveSA] = useState(0);
  const [rpTotal, setRpTotal] = useState(0);
  const [rpDrafts, setRpDrafts] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [accuracyPct, setAccuracyPct] = useState<number | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [questionsById, setQuestionsById] = useState<Map<string, Question>>(new Map());
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<LogEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const questions = await getQuestionsBySubject(subject);
      if (cancelled) return;
      setActiveMC(questions.filter((q) => q.mode === "multipleChoice" && q.status === "active").length);
      setActiveSA(questions.filter((q) => q.mode === "shortAnswer" && q.status === "active").length);
      const rpQuestions = questions.filter((q) => q.mode === "reviewPrac");
      setRpTotal(rpQuestions.length);

      const db = await getDB();
      const rpIds = new Set(rpQuestions.map((q) => q.id));
      const answers = await db.getAllFromIndex("reviewPracAnswers", "status", "draft");
      setRpDrafts(answers.filter((a) => rpIds.has(a.questionId)).length);

      const attempts = await db.getAll("attempts");
      const byId = new Map(questions.map((q) => [q.id, q]));
      setQuestionsById(byId);
      const subjectAttempts = attempts.filter((a) => byId.has(a.questionId));
      setTotalAttempts(subjectAttempts.length);
      setAccuracyPct(
        subjectAttempts.length === 0
          ? null
          : Math.round((subjectAttempts.filter((a) => a.isCorrect).length / subjectAttempts.length) * 100),
      );
      const recent = subjectAttempts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, HISTORY_FETCH_CAP)
        .map<LogEntry>((a) => ({
          attemptId: a.attemptId,
          questionId: a.questionId,
          round: a.attemptRound,
          time: formatClock(a.timestamp),
          label: a.isCorrect ? "CORRECT" : "incorrect",
          tone: a.isCorrect ? "good" : "bad",
          userAnswer: a.userAnswer,
          isCorrect: a.isCorrect,
          matchedAnswerIndex: a.matchedAnswerIndex,
        }));
      setLog(recent);
      setViewAllOpen(false);
      setDetailEntry(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [subject, round]);

  const overflowCount = log.length - INLINE_HISTORY_CAP;

  function renderHistoryGrid(entries: LogEntry[]) {
    return (
      <div className={styles.historyGrid}>
        {entries.map((entry) => (
          <button key={entry.attemptId} className={styles.historyItem} onClick={() => setDetailEntry(entry)}>
            <SessionLogLine round={entry.round} time={entry.time} label={entry.label} tone={entry.tone} />
          </button>
        ))}
      </div>
    );
  }

  const detailQuestion = detailEntry ? questionsById.get(detailEntry.questionId) : undefined;

  return (
    <TerminalFrame command={`revision :subject ${subject} :round ${round}`} bare>
      <div className={styles.grid}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>ACTIVE MULTIPLE CHOICE</div>
          <div className={styles.statValue}>{activeMC}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>ACTIVE SHORT ANSWER</div>
          <div className={styles.statValue}>{activeSA}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>REVIEW PRAC DRAFTS</div>
          <div className={styles.statValue}>
            {rpDrafts}
            <span style={{ color: "var(--ink-faint)", fontSize: "1rem" }}> / {rpTotal}</span>
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>ACCURACY — {totalAttempts} LOGGED</div>
          <div className={styles.statValue}>{accuracyPct === null ? "—" : `${accuracyPct}%`}</div>
        </div>
      </div>

      <div className={styles.sectionTitle}>{subjectLabel(subject).toLowerCase()} recent attempts</div>
      {log.length === 0 ? (
        <div className={styles.empty}>no attempts logged yet for this subject</div>
      ) : (
        <div className={styles.historyWrap}>
          {renderHistoryGrid(log.slice(0, INLINE_HISTORY_CAP))}
          {overflowCount > 0 && (
            <button className={styles.viewAllButton} onClick={() => setViewAllOpen(true)}>
              view all ({log.length})
            </button>
          )}
        </div>
      )}

      {viewAllOpen && (
        <div className={styles.overlay}>
          <TerminalFrame
            command={`revision :subject ${subject} :history all`}
            actions={
              <Button variant="primary" onClick={() => setViewAllOpen(false)}>
                done
              </Button>
            }
          >
            {renderHistoryGrid(log)}
          </TerminalFrame>
        </div>
      )}

      {detailEntry && (
        <div className={styles.overlay} style={{ zIndex: 200 }}>
          <TerminalFrame
            command="revision :inspect attempt"
            actions={
              <Button variant="primary" onClick={() => setDetailEntry(null)}>
                back
              </Button>
            }
          >
            <div className={styles.detailMeta}>
              round {String(detailEntry.round).padStart(2, "0")} · {detailEntry.time} ·{" "}
              <span className={detailEntry.isCorrect ? styles.detailGood : styles.detailBad}>
                {detailEntry.isCorrect ? "CORRECT" : "INCORRECT"}
              </span>
            </div>

            {!detailQuestion && <div className={styles.empty}>question no longer available (archived or removed).</div>}

            {detailQuestion && (
              <>
                {detailQuestion.topic && <div className={styles.detailTopic}>topic: {detailQuestion.topic}</div>}
                <p className={styles.detailPrompt}>{detailQuestion.prompt}</p>

                {detailQuestion.mode === "multipleChoice" && (
                  <div className={styles.detailOptions}>
                    {detailQuestion.options.map((opt) => {
                      const isYours = opt.id === detailEntry.userAnswer;
                      const isCorrectOpt = opt.id === detailQuestion.correctOptionId;
                      let cls = styles.detailOption;
                      if (isCorrectOpt) cls = `${styles.detailOption} ${styles.detailOptionCorrect}`;
                      else if (isYours) cls = `${styles.detailOption} ${styles.detailOptionWrong}`;
                      return (
                        <div key={opt.id} className={cls}>
                          {opt.text}
                          {isCorrectOpt && <span className={styles.detailTag}>correct</span>}
                          {isYours && <span className={styles.detailTag}>your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {detailQuestion.mode === "shortAnswer" && (
                  <div className={styles.detailSA}>
                    <div className={styles.detailSARow}>
                      <span className={styles.detailSALabel}>your answer</span>
                      <span>{detailEntry.userAnswer}</span>
                    </div>
                    <div className={styles.detailSARow}>
                      <span className={styles.detailSALabel}>accepted answers</span>
                      <span>
                        {detailQuestion.acceptableAnswers
                          .map((a) => (Array.isArray(a.value) ? a.value.join(", ") : a.value))
                          .join(" · ")}
                      </span>
                    </div>
                    {detailEntry.matchedAnswerIndex !== undefined && (
                      <div className={styles.detailSARow}>
                        <span className={styles.detailSALabel}>matched</span>
                        <span>accepted answer {detailEntry.matchedAnswerIndex + 1}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </TerminalFrame>
        </div>
      )}
    </TerminalFrame>
  );
}
