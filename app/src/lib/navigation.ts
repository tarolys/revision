export type View = "dashboard" | "practice" | "reviewPrac" | "import" | "documentGeneration";

export const VIEWS: { id: View; label: string; command: string }[] = [
  { id: "dashboard", label: "Dashboard", command: "status" },
  { id: "practice", label: "Practice", command: "drill" },
  { id: "reviewPrac", label: "Review Prac", command: "edit :mode reviewPrac" },
  { id: "import", label: "Import", command: "import :round next" },
  { id: "documentGeneration", label: "Document Gen", command: "generate :doc" },
];
