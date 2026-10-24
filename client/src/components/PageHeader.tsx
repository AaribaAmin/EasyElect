import { type ReactNode } from "react";
import styles from "./PageHeader.module.css";

export default function PageHeader({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        {icon && (
          <span aria-hidden="true" className={styles.icon}>
            {icon}
          </span>
        )}
        {title}
      </h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
    </header>
  );
}
