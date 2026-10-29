import React from "react";
import clsx from "clsx";

const Card = ({ title, children, className, ...rest }) => {
  return (
    <div
      {...rest}
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        className
      )}
    >
      {title && <h3 className="mb-3 text-lg font-semibold">{title}</h3>}
      {children}
    </div>
  );
};

const CardHeader = ({ children, className, ...rest }) => {
  return (
    <div
      {...rest}
      className={clsx("flex flex-col space-y-1.5 p-6", className)}
    >
      {children}
    </div>
  );
};

const CardTitle = ({ children, className, ...rest }) => {
  return (
    <h3
      {...rest}
      className={clsx("text-2xl font-semibold leading-none tracking-tight", className)}
    >
      {children}
    </h3>
  );
};

const CardContent = ({ children, className, ...rest }) => {
  return (
    <div
      {...rest}
      className={clsx("p-6 pt-0", className)}
    >
      {children}
    </div>
  );
};

export default Card;
export { Card, CardHeader, CardTitle, CardContent };
