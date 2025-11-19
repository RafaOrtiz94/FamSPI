import React from "react";

const KpiCard = ({ title, value, icon: Icon, color }) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-soft border-l-4 ${color} p-4 flex justify-between items-center transition hover:shadow-hover`}
    >
      <div>
        <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
          {title}
        </p>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </h2>
      </div>
      <Icon className="text-3xl text-gray-400 dark:text-gray-300" />
    </div>
  );
};

export default KpiCard;
