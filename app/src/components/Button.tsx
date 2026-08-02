import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
}

export function Button({ variant = "ghost", className, children, ...rest }: ButtonProps) {
  return (
    <button className={`${styles.btn} ${styles[variant]} ${className ?? ""}`} {...rest}>
      {children}
    </button>
  );
}
