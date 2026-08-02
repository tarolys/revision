import type { AcceptableAnswer, SAQuestion } from "../types";
import { normalizeAnswer, fuzzyToleranceFor } from "./normalize";
import { levenshtein } from "./levenshtein";

export interface GradeResult {
  isCorrect: boolean;
  matchedAnswerIndex?: number;
}

function fuzzyEquals(a: string, b: string, tolerance: number): boolean {
  if (tolerance === 0) return a === b;
  return levenshtein(a, b) <= tolerance;
}

function matchExact(rawAnswer: string, answer: AcceptableAnswer): boolean {
  const caseSensitive = answer.caseSensitive ?? false;
  const value = answer.value as string;
  const userNorm = normalizeAnswer(rawAnswer, caseSensitive);
  const targetNorm = normalizeAnswer(value, caseSensitive);
  const tolerance = fuzzyToleranceFor(targetNorm.length, answer.fuzzyTolerance ?? "auto");
  return fuzzyEquals(userNorm, targetNorm, tolerance);
}

function matchRegex(rawAnswer: string, answer: AcceptableAnswer): boolean {
  const value = answer.value as string;
  const flags = answer.caseSensitive ? "" : "i";
  const re = new RegExp(value, flags);
  return re.test(rawAnswer.trim());
}

function matchKeywords(rawAnswer: string, answer: AcceptableAnswer): boolean {
  const caseSensitive = answer.caseSensitive ?? false;
  const keywords = answer.value as string[];
  const requireAll = answer.requireAll ?? true;
  const userTokens = normalizeAnswer(rawAnswer, caseSensitive).split(" ").filter(Boolean);

  const keywordPresent = (keyword: string): boolean => {
    const keywordTokens = normalizeAnswer(keyword, caseSensitive).split(" ").filter(Boolean);
    return keywordTokens.every((kwToken) => {
      const tolerance = fuzzyToleranceFor(kwToken.length, answer.fuzzyTolerance ?? "auto");
      return userTokens.some((userToken) => fuzzyEquals(userToken, kwToken, tolerance));
    });
  };

  return requireAll ? keywords.every(keywordPresent) : keywords.some(keywordPresent);
}

/** Spec §4.2 — tries each acceptableAnswers entry in order; any match makes it correct. */
export function gradeShortAnswer(question: SAQuestion, rawAnswer: string): GradeResult {
  for (let i = 0; i < question.acceptableAnswers.length; i++) {
    const answer = question.acceptableAnswers[i];
    const matched =
      answer.type === "exact"
        ? matchExact(rawAnswer, answer)
        : answer.type === "regex"
          ? matchRegex(rawAnswer, answer)
          : matchKeywords(rawAnswer, answer);
    if (matched) return { isCorrect: true, matchedAnswerIndex: i };
  }
  return { isCorrect: false };
}
