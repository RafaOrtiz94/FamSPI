import React from "react";
import clsx from "clsx";
import Card from "./Card";

const SectionCard = ({ variant = "base", children, className, ...rest }) => {
  const paddingVariants = {
    compact: "p-3 md:p-4",
    base: "p-4 md:p-6",
    roomy: "p-6 md:p-8",
  };

  return (
    <Card
      className={clsx(paddingVariants[variant] || paddingVariants.base, className)}
      {...rest}
    >
      {children}
    </Card>
  );
};

export default SectionCard;
