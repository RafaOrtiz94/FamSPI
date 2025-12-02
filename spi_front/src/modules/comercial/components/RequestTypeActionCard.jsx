import React from "react";

const toneStyles = {
  blue: {
    border: "border-blue-200 dark:border-blue-900/40",
    bg: "bg-gradient-to-br from-blue-50 via-white to-white dark:from-blue-950/40 dark:via-gray-900 dark:to-gray-900",
    icon: "bg-blue-600 text-white",
    text: "text-blue-900 dark:text-blue-100",
    hover: "hover:border-blue-400 hover:shadow-md",
  },
  amber: {
    border: "border-amber-200 dark:border-amber-900/40",
    bg: "bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/30 dark:via-gray-900 dark:to-gray-900",
    icon: "bg-amber-500 text-white",
    text: "text-amber-900 dark:text-amber-100",
    hover: "hover:border-amber-400 hover:shadow-md",
  },
  violet: {
    border: "border-violet-200 dark:border-violet-900/40",
    bg: "bg-gradient-to-br from-violet-50 via-white to-white dark:from-violet-950/30 dark:via-gray-900 dark:to-gray-900",
    icon: "bg-violet-600 text-white",
    text: "text-violet-900 dark:text-violet-100",
    hover: "hover:border-violet-400 hover:shadow-md",
  },
};

const RequestTypeActionCard = ({
  title,
  subtitle,
  icon: Icon,
  tone = "blue",
  onClick,
}) => {
  const palette = toneStyles[tone] || toneStyles.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${palette.border} ${palette.bg} ${palette.hover}`}
    >
      {Icon && (
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 group-hover:scale-110 ${palette.icon}`}
        >
          <Icon size={32} />
        </div>
      )}

      <div className="text-center">
        {subtitle && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider opacity-70">
            {subtitle}
          </p>
        )}
        <h3 className={`text-sm font-bold leading-tight ${palette.text}`}>
          {title}
        </h3>
      </div>
    </button>
  );
};

export default RequestTypeActionCard;
