import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Question,
  Attempt,
  ReviewPracAnswer,
  ReviewPracExportHistoryEntry,
  AppMeta,
  DocumentTemplate,
  DocumentFieldDraft,
} from "../types";

interface RevisionDB extends DBSchema {
  questions: {
    key: string;
    value: Question;
    indexes: { subject: string; mode: string; "subject+mode": [string, string] };
  };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { questionId: string; attemptRound: number };
  };
  reviewPracAnswers: {
    key: string;
    value: ReviewPracAnswer;
    indexes: { status: string };
  };
  reviewPracExportHistory: {
    key: string;
    value: ReviewPracExportHistoryEntry;
    indexes: { questionId: string; exportedInRound: number };
  };
  meta: {
    key: string;
    value: unknown;
  };
  documentTemplates: {
    key: string;
    value: DocumentTemplate;
    indexes: { subject: string };
  };
  documentFieldDrafts: {
    key: [string, string];
    value: DocumentFieldDraft;
    indexes: { templateId: string };
  };
}

const DB_NAME = "revision-app";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RevisionDB>> | undefined;

export function getDB(): Promise<IDBPDatabase<RevisionDB>> {
  dbPromise ??= openDB<RevisionDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const questions = db.createObjectStore("questions", { keyPath: "id" });
      questions.createIndex("subject", "subject");
      questions.createIndex("mode", "mode");
      questions.createIndex("subject+mode", ["subject", "mode"]);

      const attempts = db.createObjectStore("attempts", { keyPath: "attemptId" });
      attempts.createIndex("questionId", "questionId");
      attempts.createIndex("attemptRound", "attemptRound");

      const rpAnswers = db.createObjectStore("reviewPracAnswers", { keyPath: "questionId" });
      rpAnswers.createIndex("status", "status");

      const rpHistory = db.createObjectStore("reviewPracExportHistory", { keyPath: "historyId" });
      rpHistory.createIndex("questionId", "questionId");
      rpHistory.createIndex("exportedInRound", "exportedInRound");

      db.createObjectStore("meta");

      const templates = db.createObjectStore("documentTemplates", { keyPath: "id" });
      templates.createIndex("subject", "subject");

      const drafts = db.createObjectStore("documentFieldDrafts", {
        keyPath: ["templateId", "fieldName"],
      });
      drafts.createIndex("templateId", "templateId");
    },
  });
  return dbPromise;
}

export async function getMeta(): Promise<AppMeta> {
  const db = await getDB();
  const existing = (await db.get("meta", "appMeta")) as AppMeta | undefined;
  if (existing) return existing;
  const initial: AppMeta = { currentRound: 1, lastImportTimestamp: 0 };
  await db.put("meta", initial, "appMeta");
  return initial;
}

export async function setMeta(meta: AppMeta): Promise<void> {
  const db = await getDB();
  await db.put("meta", meta, "appMeta");
}
