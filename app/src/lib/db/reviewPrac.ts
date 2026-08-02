import { getDB } from "./schema";
import type { ReviewPracAnswer, ReviewPracExportHistoryEntry } from "../types";

export async function getReviewPracAnswer(questionId: string): Promise<ReviewPracAnswer | undefined> {
  const db = await getDB();
  return db.get("reviewPracAnswers", questionId);
}

export async function getDraftAnswersForQuestions(questionIds: string[]): Promise<ReviewPracAnswer[]> {
  const db = await getDB();
  const rows = await Promise.all(questionIds.map((id) => db.get("reviewPracAnswers", id)));
  return rows.filter((r): r is ReviewPracAnswer => r !== undefined && r.status === "draft");
}

/** Debounced autosave path (spec §3.3) — called ~500ms after typing stops. */
export async function saveDraft(questionId: string, answerText: string): Promise<void> {
  const db = await getDB();
  const existing = await db.get("reviewPracAnswers", questionId);
  const next: ReviewPracAnswer = {
    questionId,
    answerText,
    status: "draft",
    lastModified: Date.now(),
    exportedInRound: existing?.status === "exported" ? existing.exportedInRound : undefined,
  };
  await db.put("reviewPracAnswers", next);
}

/** Snapshot + flip draft -> exported for every row included in a bundle (spec §6.3). */
export async function markExported(questionIds: string[], round: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["reviewPracAnswers", "reviewPracExportHistory"], "readwrite");
  const answers = tx.objectStore("reviewPracAnswers");
  const history = tx.objectStore("reviewPracExportHistory");
  const now = Date.now();

  await Promise.all(
    questionIds.map(async (questionId) => {
      const row = await answers.get(questionId);
      if (!row) return;
      const snapshot: ReviewPracExportHistoryEntry = {
        historyId: crypto.randomUUID(),
        questionId,
        answerText: row.answerText,
        exportedInRound: round,
        timestamp: now,
      };
      await history.put(snapshot);
      await answers.put({ ...row, status: "exported", exportedInRound: round });
    }),
  );
  await tx.done;
}

/** Reopening is an explicit, round-independent action (spec §2.6). answerText is left untouched. */
export async function reopenAnswer(questionId: string): Promise<void> {
  const db = await getDB();
  const row = await db.get("reviewPracAnswers", questionId);
  if (!row) return;
  await db.put("reviewPracAnswers", {
    ...row,
    status: "draft",
    lastModified: Date.now(),
  });
}
