import { useSettings, pickVariant } from "../context/SettingsContext";
import type { Explain } from "../types/domain";

/**
 * Renders the simple or expert variant of dual-variant copy based on the
 * current detail mode. Centralizing this keeps every section mode-aware with
 * one line.
 */
export default function Explainer({
  content,
  as: Tag = "p",
  className,
}: {
  content: Explain;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}) {
  const { mode } = useSettings();
  return <Tag className={className}>{pickVariant(content, mode)}</Tag>;
}
