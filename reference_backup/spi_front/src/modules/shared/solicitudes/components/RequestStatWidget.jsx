import React from 'react';
import { FiChevronRight } from 'react-icons/fi';

const RequestStatWidget = ({
    title,
    count,
    icon: Icon,
    color = "blue",
    onClick,
    loading = false
}) => {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
        purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400",
        amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
        emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
        indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
        orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400",
    };

    return (
        <div
            onClick={onClick}
            className="group bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
        >
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[color] || colorClasses.blue}`}>
                    {Icon && <Icon className="w-6 h-6" />}
                </div>
                {loading ? (
                    <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : (
                    <span className="text-sm font-medium text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex items-center gap-1">
                        Ver todo <FiChevronRight className="w-4 h-4" />
                    </span>
                )}
            </div>

            <div>
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                    {title}
                </h3>
                {count !== undefined && (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {loading ? "-" : count}
                    </p>
                )}
            </div>
        </div>
    );
};

export default RequestStatWidget;
