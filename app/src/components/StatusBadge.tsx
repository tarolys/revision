import styles from "./StatusBadge.module.css";

export type StatusTone = "amber" | "good" | "bad" | "dim";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

export function StatusBadge({ label, tone = "dim" }: StatusBadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      [{label.toUpperCase()}]
    </span>
  );
}
