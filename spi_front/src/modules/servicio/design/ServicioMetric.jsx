import React from "react";
import ServicioCard from "./ServicioCard";

const ServicioMetric = ({ label, value }) => (
  <ServicioCard className="px-4 py-3">
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: "var(--st-text-faint)" }}
    >
      {label}
    </p>
    <p className="mt-2 text-xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
      {value}
    </p>
  </ServicioCard>
);

export default ServicioMetric;
