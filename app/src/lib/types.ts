// Mirrors revision-app-backend-spec-2.md §1–§2, §7. This file is the schema
// contract; grading/import/export/document-generation logic all read it.

export type SubjectSlug =
  | "sciThinking"
  | "science"
  | "maths"
  | "english"
  | "history"
  | "geography";

export type QuestionMode = "multipleChoice" | "shortAnswer" | "reviewPrac";

export const SUBJECTS: { slug: SubjectSlug; label: string; modes: QuestionMode[] }[] = [
  { slug: "sciThinking", label: "Sci-thinking", modes: ["multipleChoice", "shortAnswer", "reviewPrac"] },
  { slug: "science", label: "Science", modes: ["multipleChoice", "shortAnswer", "reviewPrac"] },
  { slug: "maths", label: "Maths", modes: ["multipleChoice", "shortAnswer", "reviewPrac"] },
  { slug: "english", label: "English", modes: ["reviewPrac"] },
  { slug: "history", label: "History", modes: ["shortAnswer", "reviewPrac"] },
  { slug: "geography", label: "Geography", modes: ["shortAnswer", "reviewPrac"] },
];

export function subjectLabel(slug: SubjectSlug): string {
  return SUBJECTS.find((s) => s.slug === slug)?.label ?? slug;
}

export function subjectSupportsMode(slug: SubjectSlug, mode: QuestionMode): boolean {
  return SUBJECTS.find((s) => s.slug === slug)?.modes.includes(mode) ?? false;
}

export interface QuestionBase {
  id: string;
  subject: SubjectSlug;
  mode: QuestionMode;
  prompt: string;
  topic?: string;
  importRound: number;
  status: "active" | "archived";
}

export interface MCOption {
  id: string;
  text: string;
}

export interface MCQuestion extends QuestionBase {
  mode: "multipleChoice";
  options: MCOption[];
  correctOptionId: string;
}

export type AcceptableAnswerType = "exact" | "regex" | "keywords";

export interface AcceptableAnswer {
  type: AcceptableAnswerType;
  value: string | string[];
  requireAll?: boolean;
  caseSensitive?: boolean;
  fuzzyTolerance?: "auto" | "off" | number;
}

export interface SAQuestion extends QuestionBase {
  mode: "shortAnswer";
  acceptableAnswers: AcceptableAnswer[];
}

export interface RPQuestion extends QuestionBase {
  mode: "reviewPrac";
  context?: string;
}

export type Question = MCQuestion | SAQuestion | RPQuestion;

export interface Attempt {
  attemptId: string;
  questionId: string;
  attemptRound: number;
  timestamp: number;
  userAnswer: string;
  isCorrect: boolean;
  matchedAnswerIndex?: number;
}

export type ReviewPracStatus = "draft" | "exported";

export interface ReviewPracAnswer {
  questionId: string;
  answerText: string;
  status: ReviewPracStatus;
  lastModified: number;
  exportedInRound?: number;
}

export interface ReviewPracExportHistoryEntry {
  historyId: string;
  questionId: string;
  answerText: string;
  exportedInRound: number;
  timestamp: number;
}

export interface AppMeta {
  currentRound: number;
  lastImportTimestamp: number;
}

// --- Document Generation (spec §7) ---

export interface DocumentTemplate {
  id: string;
  name: string;
  subject?: SubjectSlug;
  latexSource: string;
  placeholders: string[];
  /** subset of `placeholders` written as [^^name^] — rendered as a big paragraph field, not a single line */
  paragraphFields: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DocumentFieldDraft {
  templateId: string;
  fieldName: string;
  value: string;
  lastModified: number;
}
