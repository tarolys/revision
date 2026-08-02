import styles from "./SessionLogLine.module.css";

interface SessionLogLineProps {
  round: number;
  time: string;
  label: string;
  tone?: "good" | "bad" | "amber" | "dim";
}

export function SessionLogLine({ round, time, label, tone = "dim" }: SessionLogLineProps) {
  return (
    <div className={styles.line}>
      <span className={styles.round}>round {String(round).padStart(2, "0")}</span>
      <span className={styles.time}>{time}</span>
      <span className={`${styles.label} ${styles[tone]}`}>{label}</span>
    </div>
  );
}
