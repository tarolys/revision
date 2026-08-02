import type { TextareaHTMLAttributes } from "react";
import styles from "./TextArea.module.css";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** "prose" (default) is the readable sans face for long-form writing —
   *  question prompts, Review Prac answers. "code" is monospace, for
   *  literal source: LaTeX templates, regex, raw JSON. */
  variant?: "prose" | "code";
}

export function TextArea({ variant = "prose", className, ...rest }: TextAreaProps) {
  return (
    <textarea
      className={`${styles.area} ${styles[variant]} ${className ?? ""}`}
      spellCheck={variant === "prose"}
      {...rest}
    />
  );
}
