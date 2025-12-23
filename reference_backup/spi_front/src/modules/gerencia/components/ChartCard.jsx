import React from "react";

const ChartCard = ({ title, children, span }) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700 p-4 ${span}`}
    >
      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
        {title}
      </h3>
      <div className="h-64">{children}</div>
    </div>
  );
};

export default ChartCard;
