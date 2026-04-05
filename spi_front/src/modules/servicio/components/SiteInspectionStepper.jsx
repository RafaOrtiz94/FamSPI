import React from "react";

const ANSWERS = ["SI", "NO", "N/A"];

const SiteInspectionStepper = ({
 sections = [],
 checklist = {},
 errors = {},
 touched = false,
 disabled = false,
 onChange = () => {},
}) => {
 return (
 <div className="space-y-3 rounded-lg border border-slate-200 p-3">
 {sections.map((group) => (
 <section key={group.section} className="space-y-2">
 <h4 className="text-sm font-semibold text-slate-800">{group.section}</h4>
 <div className="space-y-2">
 {(group.items || []).map((question) => {
 const value = checklist?.[question.key] || "";
 const hasError = Boolean(touched && errors?.[question.key]);
 return (
 <div
 key={question.key}
 className={`rounded border p-2 ${
 hasError ? "border-rose-300 bg-rose-50" : "border-slate-200"
 }`}
 >
 <p className="text-sm text-slate-700">{question.label}</p>
 <div className="mt-2 flex flex-wrap gap-4 text-sm">
 {ANSWERS.map((option) => {
 if (option === "N/A" && !question.allowsNA) return null;
 return (
 <label key={option} className="inline-flex items-center gap-2">
 <input
 type="radio"
 name={`site-check-${question.key}`}
 value={option}
 checked={value === option}
 disabled={disabled}
 onChange={(event) => onChange(question.key, event.target.value)}
 />
 {option}
 </label>
 );
 })}
 </div>
 {hasError ? <p className="mt-1 text-xs text-rose-700">{errors[question.key]}</p> : null}
 </div>
 );
 })}
 </div>
 </section>
 ))}
 </div>
 );
};

export default SiteInspectionStepper;
