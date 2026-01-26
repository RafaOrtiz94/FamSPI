import React from "react";

const toneStyles = {
    blue: {
        border: "border-blue-200/60 dark:border-blue-900/40",
        bg: "bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 dark:from-blue-950/40 dark:via-blue-900 dark:to-blue-800",
        icon: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm",
        text: "text-blue-900 dark:text-blue-100",
        hover: "hover:border-blue-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-blue-700/80 dark:text-blue-200",
    },
    emerald: {
        border: "border-emerald-200/60 dark:border-emerald-900/40",
        bg: "bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 dark:from-emerald-950/40 dark:via-emerald-900 dark:to-emerald-800",
        icon: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm",
        text: "text-emerald-900 dark:text-emerald-100",
        hover: "hover:border-emerald-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-emerald-700/80 dark:text-emerald-200",
    },
    green: {
        border: "border-green-200/60 dark:border-green-900/40",
        bg: "bg-gradient-to-br from-green-50 via-green-100 to-green-200 dark:from-green-950/40 dark:via-green-900 dark:to-green-800",
        icon: "bg-gradient-to-br from-green-500 to-green-600 text-white shadow-sm",
        text: "text-green-900 dark:text-green-100",
        hover: "hover:border-green-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-green-700/80 dark:text-green-200",
    },
    indigo: {
        border: "border-indigo-200/60 dark:border-indigo-900/40",
        bg: "bg-gradient-to-br from-indigo-50 via-indigo-100 to-indigo-200 dark:from-indigo-950/40 dark:via-indigo-900 dark:to-indigo-800",
        icon: "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm",
        text: "text-indigo-900 dark:text-indigo-100",
        hover: "hover:border-indigo-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-indigo-700/80 dark:text-indigo-200",
    },
    violet: {
        border: "border-violet-200/60 dark:border-violet-900/40",
        bg: "bg-gradient-to-br from-violet-50 via-violet-100 to-violet-200 dark:from-violet-950/40 dark:via-violet-900 dark:to-violet-800",
        icon: "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm",
        text: "text-violet-900 dark:text-violet-100",
        hover: "hover:border-violet-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-violet-700/80 dark:text-violet-200",
    },
    amber: {
        border: "border-amber-200/60 dark:border-amber-900/40",
        bg: "bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200 dark:from-amber-950/40 dark:via-amber-900 dark:to-amber-800",
        icon: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm",
        text: "text-amber-900 dark:text-amber-100",
        hover: "hover:border-amber-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-amber-700/80 dark:text-amber-200",
    },
    orange: {
        border: "border-orange-200/60 dark:border-orange-900/40",
        bg: "bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 dark:from-orange-950/40 dark:via-orange-900 dark:to-orange-800",
        icon: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm",
        text: "text-orange-900 dark:text-orange-100",
        hover: "hover:border-orange-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-orange-700/80 dark:text-orange-200",
    },
    red: {
        border: "border-red-200/60 dark:border-red-900/40",
        bg: "bg-gradient-to-br from-red-50 via-red-100 to-red-200 dark:from-red-950/40 dark:via-red-900 dark:to-red-800",
        icon: "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-sm",
        text: "text-red-900 dark:text-red-100",
        hover: "hover:border-red-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-red-700/80 dark:text-red-200",
    },
    pink: {
        border: "border-pink-200/60 dark:border-pink-900/40",
        bg: "bg-gradient-to-br from-pink-50 via-pink-100 to-pink-200 dark:from-pink-950/40 dark:via-pink-900 dark:to-pink-800",
        icon: "bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-sm",
        text: "text-pink-900 dark:text-pink-100",
        hover: "hover:border-pink-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-pink-700/80 dark:text-pink-200",
    },
    cyan: {
        border: "border-cyan-200/60 dark:border-cyan-900/40",
        bg: "bg-gradient-to-br from-cyan-50 via-cyan-100 to-cyan-200 dark:from-cyan-950/40 dark:via-cyan-900 dark:to-cyan-800",
        icon: "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-sm",
        text: "text-cyan-900 dark:text-cyan-100",
        hover: "hover:border-cyan-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-cyan-700/80 dark:text-cyan-200",
    },
    lime: {
        border: "border-lime-200/60 dark:border-lime-900/40",
        bg: "bg-gradient-to-br from-lime-50 via-lime-100 to-lime-200 dark:from-lime-950/40 dark:via-lime-900 dark:to-lime-800",
        icon: "bg-gradient-to-br from-lime-500 to-lime-600 text-white shadow-sm",
        text: "text-lime-900 dark:text-lime-100",
        hover: "hover:border-lime-400 hover:shadow-lg hover:-translate-y-1",
        subtitle: "text-lime-700/80 dark:text-lime-200",
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
