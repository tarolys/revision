import type { Attempt } from "./types";

export interface QuestionStats {
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number | null;
  lastAttemptAt: number | null;
  lastCorrect: boolean | null;
}

// Spec §2.5 — nothing here is stored; it's derived on read from the attempts log.
export function computeStats(attempts: Attempt[]): QuestionStats {
  if (attempts.length === 0) {
    return { totalAttempts: 0, correctAttempts: 0, accuracy: null, lastAttemptAt: null, lastCorrect: null };
  }
  const correctAttempts = attempts.filter((a) => a.isCorrect).length;
  const last = attempts[attempts.length - 1];
  return {
    totalAttempts: attempts.length,
    correctAttempts,
    accuracy: correctAttempts / attempts.length,
    lastAttemptAt: last.timestamp,
    lastCorrect: last.isCorrect,
  };
}

export function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}
