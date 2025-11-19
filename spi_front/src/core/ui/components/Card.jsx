import React from "react";
import clsx from "clsx";

const Card = ({ title, children, className }) => {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-white/10 bg-white/70 p-5 text-slate-800 shadow-[0_15px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-900/70 dark:text-slate-100",
        className
      )}
    >
      {title && <h3 className="mb-3 text-lg font-semibold">{title}</h3>}
      {children}
    </div>
  );
};

export default Card;
