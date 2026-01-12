import React from "react";

const toneStyles = {
    blue: {
        from: "from-blue-600",
        to: "to-blue-500",
        bg: "bg-blue-50",
        text: "text-blue-600",
    },
    emerald: {
        from: "from-emerald-600",
        to: "to-emerald-500",
        bg: "bg-emerald-50",
        text: "text-emerald-600",
    },
    green: {
        from: "from-green-600",
        to: "to-green-500",
        bg: "bg-green-50",
        text: "text-green-600",
    },
    indigo: {
        from: "from-indigo-600",
        to: "to-indigo-500",
        bg: "bg-indigo-50",
        text: "text-indigo-600",
    },
    violet: {
        from: "from-violet-600",
        to: "to-violet-500",
        bg: "bg-violet-50",
        text: "text-violet-600",
    },
    amber: {
        from: "from-amber-500",
        to: "to-orange-500",
        bg: "bg-amber-50",
        text: "text-amber-600",
    },
    orange: {
        from: "from-orange-500",
        to: "to-red-500",
        bg: "bg-orange-50",
        text: "text-orange-600",
    },
    red: {
        from: "from-red-600",
        to: "to-red-500",
        bg: "bg-red-50",
        text: "text-red-600",
    },
    pink: {
        from: "from-pink-600",
        to: "to-pink-500",
        bg: "bg-pink-50",
        text: "text-pink-600",
    },
    cyan: {
        from: "from-cyan-600",
        to: "to-cyan-500",
        bg: "bg-cyan-50",
        text: "text-cyan-600",
    },
};

const StatCard = ({
    label,
    value,
    icon: Icon,
    color = "blue",
    trend,
    className = "",
}) => {
    const palette = toneStyles[color] || toneStyles.blue;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md ${className}`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{label}</p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-900">{value}</h3>
                    {trend && (
                        <div className={`mt-2 flex items-center text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
                            <span className="ml-1 text-gray-400">vs mes anterior</span>
                        </div>
                    )}
                </div>
                {Icon && (
                    <div className={`rounded-xl p-3 bg-gradient-to-br shadow-sm ${palette.from} ${palette.to} text-white`}>
                        <Icon size={24} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
