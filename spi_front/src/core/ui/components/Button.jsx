import React from "react";
import clsx from "clsx";

const variantClasses = {
  primary:
    "bg-gradient-to-r from-accent to-emerald-400 text-white shadow-lg shadow-emerald-500/30 hover:opacity-90 focus:ring-accent/30",
  secondary:
    "bg-white text-primary border border-white/60 shadow-sm hover:-translate-y-0.5 hover:shadow-lg focus:ring-primary/20",
  outline:
    "border border-primary/60 text-primary hover:bg-primary/5 focus:ring-primary/30",
  danger:
    "bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/30 hover:opacity-90 focus:ring-rose-300/40",
  ghost:
    "text-white/80 hover:text-white hover:bg-white/10 focus:ring-white/20",
};

const renderIcon = (maybeIcon) => {
  if (!maybeIcon) return null;
  if (React.isValidElement(maybeIcon)) return maybeIcon;
  if (typeof maybeIcon === "function") {
    const IconComponent = maybeIcon;
    return <IconComponent size={16} />;
  }
  return null;
};

const Button = ({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className,
  icon,
  trailingIcon,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold tracking-tight transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent",
        variantClasses[variant] || variantClasses.primary,
        className
      )}
    >
      {icon ? <span className="text-base">{renderIcon(icon)}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="text-base">{renderIcon(trailingIcon)}</span> : null}
    </button>
  );
};

export default Button;
