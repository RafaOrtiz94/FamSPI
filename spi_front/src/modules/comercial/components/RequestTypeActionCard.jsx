import React from "react";

const toneStyles = {
  blue: {
    border: "border-blue-200 dark:border-blue-900/40",
    bg: "bg-gradient-to-br from-blue-50 via-white to-white dark:from-blue-950/40 dark:via-gray-900 dark:to-gray-900",
    icon: "bg-blue-600",
    subtitle: "text-blue-700 dark:text-blue-200",
    chip: "bg-blue-100/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
    button: "bg-blue-600 hover:bg-blue-700",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-900/40",
    bg: "bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-gray-900 dark:to-gray-900",
    icon: "bg-amber-500",
    subtitle: "text-amber-700 dark:text-amber-200",
    chip: "bg-amber-100/80 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100",
    button: "bg-amber-500 hover:bg-amber-600",
  },
  violet: {
    border: "border-violet-200 dark:border-violet-900/40",
    bg: "bg-gradient-to-br from-violet-50 via-white to-white dark:from-violet-950/30 dark:via-gray-900 dark:to-gray-900",
    icon: "bg-violet-600",
    subtitle: "text-violet-700 dark:text-violet-200",
    chip: "bg-violet-100/80 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
    button: "bg-violet-600 hover:bg-violet-700",
  },
};

const RequestTypeActionCard = ({
  title,
  subtitle,
  description,
  chips = [],
  icon: Icon,
  tone = "blue",
  ctaLabel = "Crear solicitud",
  onClick,
}) => {
  const palette = toneStyles[tone] || toneStyles.blue;

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-5 shadow-sm transition dark:border-opacity-50 ${
        palette.border
      } ${palette.bg}`}
    >
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className={`rounded-2xl p-3 text-white shadow-sm ${palette.icon}`}>
            <Icon size={22} />
          </div>
        ) : null}
        <div className="space-y-2">
          {subtitle ? (
            <p className={`text-xs font-semibold uppercase tracking-wide ${palette.subtitle}`}>
              {subtitle}
            </p>
          ) : null}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${palette.chip}`}
            >
              {chip}
            </span>
          ))}
        </div>
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className={`ml-auto inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${palette.button}`}
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default RequestTypeActionCard;
