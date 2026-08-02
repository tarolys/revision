import type { AcceptableAnswer, Question, QuestionMode, SubjectSlug } from "./types";
import { SUBJECTS, subjectSupportsMode } from "./types";
import { getMeta, setMeta } from "./db/schema";
import { archiveActiveMCSA, putQuestions } from "./db/questions";
import { getDraftAnswersForQuestions, markExported } from "./db/reviewPrac";

// --- Import (spec §5) ---

interface RawQuestion {
  mode: QuestionMode;
  prompt: string;
  topic?: string;
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  acceptableAnswers?: unknown[];
  context?: string;
}

interface RawSubjectBlock {
  subject: string;
  questions: RawQuestion[];
}

interface ImportPayload {
  importVersion: number;
  subjects: RawSubjectBlock[];
}

export interface RejectedQuestion {
  subject: string;
  prompt: string;
  reason: string;
}

export interface ImportResult {
  round: number;
  acceptedCount: number;
  rejected: RejectedQuestion[];
}

function validQuestionShape(q: RawQuestion): string | undefined {
  if (q.mode === "multipleChoice") {
    if (!q.options || q.options.length < 2) return "multipleChoice needs at least 2 options";
    if (!q.correctOptionId || !q.options.some((o) => o.id === q.correctOptionId)) {
      return "correctOptionId does not match any option id";
    }
  } else if (q.mode === "shortAnswer") {
    if (!q.acceptableAnswers || q.acceptableAnswers.length < 1) {
      return "shortAnswer needs at least 1 acceptableAnswers entry";
    }
  } else if (q.mode === "reviewPrac") {
    if (!q.prompt || q.prompt.trim().length === 0) return "reviewPrac needs a non-empty prompt";
  } else {
    return `unrecognized mode: ${String(q.mode)}`;
  }
  return undefined;
}

/** Spec §5.3–§5.4: validate every question, then archive + write in one round. */
export async function importPayload(payload: ImportPayload): Promise<ImportResult> {
  const meta = await getMeta();
  const newRound = meta.currentRound + 1;

  const rejected: RejectedQuestion[] = [];
  const accepted: Question[] = [];
  const subjectsPresent = new Set<SubjectSlug>();

  for (const block of payload.subjects) {
    const subjectSlug = SUBJECTS.find((s) => s.slug === block.subject)?.slug;
    if (!subjectSlug) {
      for (const q of block.questions) {
        rejected.push({ subject: block.subject, prompt: q.prompt, reason: "unrecognized subject" });
      }
      continue;
    }

    for (const q of block.questions) {
      if (!subjectSupportsMode(subjectSlug, q.mode)) {
        rejected.push({
          subject: subjectSlug,
          prompt: q.prompt,
          reason: `${subjectSlug} does not support mode "${q.mode}"`,
        });
        continue;
      }
      const shapeError = validQuestionShape(q);
      if (shapeError) {
        rejected.push({ subject: subjectSlug, prompt: q.prompt, reason: shapeError });
        continue;
      }

      subjectsPresent.add(subjectSlug);
      const base = {
        id: crypto.randomUUID(),
        subject: subjectSlug,
        prompt: q.prompt,
        topic: q.topic,
        importRound: newRound,
        status: "active" as const,
      };
      if (q.mode === "multipleChoice") {
        accepted.push({
          ...base,
          mode: "multipleChoice",
          options: q.options!,
          correctOptionId: q.correctOptionId!,
        });
      } else if (q.mode === "shortAnswer") {
        accepted.push({
          ...base,
          mode: "shortAnswer",
          acceptableAnswers: q.acceptableAnswers as AcceptableAnswer[],
        });
      } else {
        accepted.push({ ...base, mode: "reviewPrac", context: q.context });
      }
    }
  }

  for (const subject of subjectsPresent) {
    await archiveActiveMCSA(subject);
  }
  await putQuestions(accepted);
  await setMeta({ currentRound: newRound, lastImportTimestamp: Date.now() });

  return { round: newRound, acceptedCount: accepted.length, rejected };
}

// --- Export (spec §6) ---

export function buildExportText(
  subjectLabel: string,
  round: number,
  items: { prompt: string; answerText: string }[],
): string {
  const header = [
    "You are receiving a batch of Review Prac responses from a self-study app for marking.",
    "For each numbered item below, respond with: a mark (correct / partially correct / incorrect),",
    "brief feedback on what's missing or wrong, and a model answer. Keep your response structured",
    "per-question, in the same order, so it's easy to match against the originals below.",
    "",
    `Subject: ${subjectLabel} — Round ${round}`,
    "",
  ].join("\n");

  const body = items
    .map((item, i) => {
      const answer = item.answerText.trim().length > 0 ? item.answerText : "(no answer given)";
      return `${i + 1}. ${item.prompt}\nMy answer: ${answer}`;
    })
    .join("\n\n");

  return `${header}${body}\n`;
}

/** Spec §6.3: snapshot every included row into history, then flip draft -> exported. */
export async function exportReviewPrac(questionIds: string[], round: number): Promise<void> {
  await markExported(questionIds, round);
}

export { getDraftAnswersForQuestions };
