import type { InputHTMLAttributes } from "react";
import styles from "./PromptInput.module.css";

export function PromptInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <span className={styles.glyph} aria-hidden="true">
        &gt;
      </span>
      <input className={styles.input} autoComplete="off" spellCheck={false} {...rest} />
    </div>
  );
}
