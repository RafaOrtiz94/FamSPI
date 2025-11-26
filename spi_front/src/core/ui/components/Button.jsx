import React from "react";
import clsx from "clsx";

const variantClasses = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow focus:ring-blue-500/30 active:bg-blue-800",
  secondary:
    "bg-white text-gray-700 border border-gray-300 shadow-sm hover:bg-gray-50 focus:ring-gray-200 active:bg-gray-100",
  outline:
    "border border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500/30 active:bg-blue-100",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow focus:ring-red-500/30 active:bg-red-800",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-200",
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
