import type { MCQuestion } from "../types";

export function gradeMultipleChoice(question: MCQuestion, selectedOptionId: string): boolean {
  return selectedOptionId === question.correctOptionId;
}
