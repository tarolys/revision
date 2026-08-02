import { SUBJECTS, subjectSupportsMode, type SubjectSlug } from "../lib/types";
import { VIEWS, type View } from "../lib/navigation";
import { Caret } from "./Caret";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  round: number;
  subject: SubjectSlug;
  onSubjectChange: (subject: SubjectSlug) => void;
  view: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ round, subject, onSubjectChange, view, onViewChange }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandGlyph}>&gt;_</span> revision.log
        <Caret />
      </div>

      <div className={styles.roundBadge}>ROUND {String(round).padStart(2, "0")}</div>

      <nav className={styles.section}>
        <div className={styles.sectionTitle}>subjects</div>
        <ul className={styles.list}>
          {SUBJECTS.map((s) => (
            <li key={s.slug}>
              <button
                className={`${styles.navItem} ${subject === s.slug ? styles.active : ""}`}
                onClick={() => onSubjectChange(s.slug)}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <nav className={styles.section}>
        <div className={styles.sectionTitle}>commands</div>
        <ul className={styles.list}>
          {VIEWS.filter((v) => {
            if (v.id === "practice") {
              return subjectSupportsMode(subject, "multipleChoice") || subjectSupportsMode(subject, "shortAnswer");
            }
            if (v.id === "reviewPrac") return subjectSupportsMode(subject, "reviewPrac");
            return true;
          }).map((v) => (
            <li key={v.id}>
              <button
                className={`${styles.navItem} ${view === v.id ? styles.active : ""}`}
                onClick={() => onViewChange(v.id)}
              >
                <span className={styles.promptGlyph}>$</span> {v.command}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
