import { type ReactNode } from "react";
import styles from "./PageHeader.module.css";
import Icon from "./icons/Icon";
import type { IconName } from "./icons/types";

export default function PageHeader({
  icon,
  title,
  subtitle,
  children,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        {icon && (
          <span className={styles.icon}>
            <Icon name={icon} decorative />
          </span>
        )}
        {title}
      </h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      {children}
    </header>
  );
}
