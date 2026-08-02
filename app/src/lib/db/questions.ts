import { getDB } from "./schema";
import type { Question, QuestionMode, SubjectSlug } from "../types";

export async function getQuestion(id: string): Promise<Question | undefined> {
  const db = await getDB();
  return db.get("questions", id);
}

export async function getQuestionsBySubject(subject: SubjectSlug): Promise<Question[]> {
  const db = await getDB();
  return db.getAllFromIndex("questions", "subject", subject);
}

export async function getActiveQuestions(
  subject: SubjectSlug,
  mode: QuestionMode,
): Promise<Question[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("questions", "subject+mode", [subject, mode]);
  return all.filter((q) => q.status === "active");
}

/** MC/SA questions of `subject` currently active are archived; attempt history untouched. RP is never archived. */
export async function archiveActiveMCSA(subject: SubjectSlug): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("questions", "readwrite");
  const all = await tx.store.index("subject").getAll(subject);
  await Promise.all(
    all
      .filter((q) => q.status === "active" && (q.mode === "multipleChoice" || q.mode === "shortAnswer"))
      .map((q) => tx.store.put({ ...q, status: "archived" })),
  );
  await tx.done;
}

export async function putQuestions(questions: Question[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("questions", "readwrite");
  await Promise.all(questions.map((q) => tx.store.put(q)));
  await tx.done;
}
