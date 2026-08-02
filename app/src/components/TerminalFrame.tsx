import type { ReactNode } from "react";
import styles from "./TerminalFrame.module.css";

interface TerminalFrameProps {
  /** rendered after the "$ " prompt glyph in the frame's title bar */
  command: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** drops the panel border/background and lets content run full-width,
   *  for primary study screens that shouldn't read as a floating card */
  bare?: boolean;
}

export function TerminalFrame({ command, children, actions, className, bare }: TerminalFrameProps) {
  return (
    <section className={`${styles.frame} ${bare ? styles.bare : ""} ${className ?? ""}`}>
      <header className={styles.titleBar}>
        <span className={styles.prompt}>
          <span className={styles.promptGlyph} aria-hidden="true">
            $
          </span>
          {command}
        </span>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
