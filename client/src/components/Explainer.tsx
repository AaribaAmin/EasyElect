import { useSettings } from "../context/SettingsContext";
import { selectVariant, DETAIL_UNAVAILABLE } from "../lib/explain";
import type { Explain } from "../types/domain";

/**
 * Renders the simple or expert variant of dual-variant copy based on the
 * current detail mode. Centralizing this keeps every section mode-aware with
 * one line.
 *
 * When the variant matching the current mode is missing, a "detail
 * unavailable" indication is shown in its place while the surrounding record
 * presentation is preserved (Req 8.2).
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
  const selection = selectVariant(content, mode);
  if (selection.available) {
    return <Tag className={className}>{selection.text}</Tag>;
  }
  return (
    <Tag className={className} data-detail-unavailable="true">
      <em>{DETAIL_UNAVAILABLE}</em>
    </Tag>
  );
}
