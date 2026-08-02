import { getDB } from "./schema";
import type { Attempt } from "../types";

export async function recordAttempt(attempt: Attempt): Promise<void> {
  const db = await getDB();
  await db.put("attempts", attempt);
}

export async function getAttemptsForQuestion(questionId: string): Promise<Attempt[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("attempts", "questionId", questionId);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}
