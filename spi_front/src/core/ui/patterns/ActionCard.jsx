import React from "react";

const toneStyles = {
    blue: {
        border: "border-blue-200 dark:border-blue-900/40",
        bg: "bg-gradient-to-br from-blue-50 via-white to-white dark:from-blue-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-blue-600 text-white",
        text: "text-blue-900 dark:text-blue-100",
        hover: "hover:border-blue-400 hover:shadow-md",
        subtitle: "text-blue-700 dark:text-blue-200",
    },
    emerald: {
        border: "border-emerald-200 dark:border-emerald-900/40",
        bg: "bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-emerald-600 text-white",
        text: "text-emerald-900 dark:text-emerald-100",
        hover: "hover:border-emerald-400 hover:shadow-md",
        subtitle: "text-emerald-700 dark:text-emerald-200",
    },
    green: {
        border: "border-green-200 dark:border-green-900/40",
        bg: "bg-gradient-to-br from-green-50 via-white to-white dark:from-green-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-green-600 text-white",
        text: "text-green-900 dark:text-green-100",
        hover: "hover:border-green-400 hover:shadow-md",
        subtitle: "text-green-700 dark:text-green-200",
    },
    indigo: {
        border: "border-indigo-200 dark:border-indigo-900/40",
        bg: "bg-gradient-to-br from-indigo-50 via-white to-white dark:from-indigo-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-indigo-600 text-white",
        text: "text-indigo-900 dark:text-indigo-100",
        hover: "hover:border-indigo-400 hover:shadow-md",
        subtitle: "text-indigo-700 dark:text-indigo-200",
    },
    violet: {
        border: "border-violet-200 dark:border-violet-900/40",
        bg: "bg-gradient-to-br from-violet-50 via-white to-white dark:from-violet-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-violet-600 text-white",
        text: "text-violet-900 dark:text-violet-100",
        hover: "hover:border-violet-400 hover:shadow-md",
        subtitle: "text-violet-700 dark:text-violet-200",
    },
    amber: {
        border: "border-amber-200 dark:border-amber-900/40",
        bg: "bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-amber-500 text-white",
        text: "text-amber-900 dark:text-amber-100",
        hover: "hover:border-amber-400 hover:shadow-md",
        subtitle: "text-amber-700 dark:text-amber-200",
    },
    orange: {
        border: "border-orange-200 dark:border-orange-900/40",
        bg: "bg-gradient-to-br from-orange-50 via-white to-white dark:from-orange-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-orange-500 text-white",
        text: "text-orange-900 dark:text-orange-100",
        hover: "hover:border-orange-400 hover:shadow-md",
        subtitle: "text-orange-700 dark:text-orange-200",
    },
    red: {
        border: "border-red-200 dark:border-red-900/40",
        bg: "bg-gradient-to-br from-red-50 via-white to-white dark:from-red-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-red-600 text-white",
        text: "text-red-900 dark:text-red-100",
        hover: "hover:border-red-400 hover:shadow-md",
        subtitle: "text-red-700 dark:text-red-200",
    },
    pink: {
        border: "border-pink-200 dark:border-pink-900/40",
        bg: "bg-gradient-to-br from-pink-50 via-white to-white dark:from-pink-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-pink-600 text-white",
        text: "text-pink-900 dark:text-pink-100",
        hover: "hover:border-pink-400 hover:shadow-md",
        subtitle: "text-pink-700 dark:text-pink-200",
    },
    cyan: {
        border: "border-cyan-200 dark:border-cyan-900/40",
        bg: "bg-gradient-to-br from-cyan-50 via-white to-white dark:from-cyan-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-cyan-600 text-white",
        text: "text-cyan-900 dark:text-cyan-100",
        hover: "hover:border-cyan-400 hover:shadow-md",
        subtitle: "text-cyan-700 dark:text-cyan-200",
    },
    lime: {
        border: "border-lime-200 dark:border-lime-900/40",
        bg: "bg-gradient-to-br from-lime-50 via-white to-white dark:from-lime-950/40 dark:via-gray-900 dark:to-gray-900",
        icon: "bg-lime-600 text-white",
        text: "text-lime-900 dark:text-lime-100",
        hover: "hover:border-lime-400 hover:shadow-md",
        subtitle: "text-lime-700 dark:text-lime-200",
    },
};

const ActionCard = ({
    icon: Icon,
    title,
    subtitle,
    color = "blue",
    onClick,
    className = "",
}) => {
    const palette = toneStyles[color] || toneStyles.blue;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${palette.border} ${palette.bg} ${palette.hover} ${className}`}
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
                    <p
                        className={`mb-1 text-[10px] font-bold uppercase tracking-wider opacity-70 ${palette.subtitle}`}
                    >
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

export default ActionCard;
