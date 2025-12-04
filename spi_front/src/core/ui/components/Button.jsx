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
  success:
    "bg-green-600 text-white shadow-sm hover:bg-green-700 hover:shadow focus:ring-green-500/30 active:bg-green-800",
  warning:
    "bg-amber-500 text-white shadow-sm hover:bg-amber-600 hover:shadow focus:ring-amber-400/30 active:bg-amber-700",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-200",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-sm rounded-2xl",
  lg: "px-5 py-2.5 text-base rounded-2xl",
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
  leftIcon,
  rightIcon,
  size = "md",
  loading = false,
  disabled = false,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  const leading = leftIcon || icon;
  const trailing = rightIcon || trailingIcon;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={clsx(
        "inline-flex items-center gap-2 font-semibold tracking-tight transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-60 disabled:cursor-not-allowed",
        sizeClasses[size] || sizeClasses.md,
        variantClasses[variant] || variantClasses.primary,
        className
      )}
      {...rest}
    >
      {leading ? <span className="text-base">{renderIcon(leading)}</span> : null}
      <span>{loading ? "Procesando..." : children}</span>
      {trailing ? <span className="text-base">{renderIcon(trailing)}</span> : null}
    </button>
  );
};

export default Button;
