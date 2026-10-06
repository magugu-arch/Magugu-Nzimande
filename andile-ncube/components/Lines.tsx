import type { ElementType, ReactNode } from "react";

/**
 * A heading set as explicit lines, each masked so it can rise into place
 * inside <Motion>. Line breaks are editorial decisions, so they are passed in
 * rather than left to the browser.
 */
export function Lines({
  lines,
  as: Tag = "h2",
  className = "",
  id,
}: {
  lines: ReactNode[];
  as?: ElementType;
  className?: string;
  id?: string;
}) {
  return (
    <Tag className={className} data-lines="" id={id}>
      {lines.map((line, i) => (
        <span key={i} className="mask-line">
          <span data-line="">{line}</span>
        </span>
      ))}
    </Tag>
  );
}
