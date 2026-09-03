import React from "react";
import { FiAward } from "react-icons/fi";

export default function PunctualityWinnerBadge({
  visible = false,
  size = "md",
  className = "",
  title = "Primer lugar en puntualidad del mes",
}) {
  if (!visible) return null;

  const sizeClass = size === "sm"
    ? "h-5 w-5 text-[10px]"
    : size === "lg"
      ? "h-8 w-8 text-sm"
      : "h-6 w-6 text-xs";

  return (
    <span
      className={`pointer-events-none absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full border-2 border-white bg-[radial-gradient(circle_at_30%_30%,#fff7bf_0%,#facc15_40%,#d97706_100%)] text-amber-950 shadow-[0_8px_18px_rgba(202,138,4,0.35)] ${sizeClass} ${className}`}
      title={title}
      aria-label={title}
    >
      <FiAward />
    </span>
  );
}
