import React from "react";
import clsx from "clsx";

const Card = ({ title, children, className, ...rest }) => {
  return (
    <div
      {...rest}
      className={clsx(
        "rounded-2xl border border-white/10 bg-white/70 p-5 text-slate-800 shadow-[0_15px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-900/70 dark:text-slate-100",
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
