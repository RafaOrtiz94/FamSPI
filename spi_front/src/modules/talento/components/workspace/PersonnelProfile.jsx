import React, { useState } from "react";
import { FiChevronDown, FiChevronUp, FiLock, FiUnlock } from "react-icons/fi";
import { profileSections } from "../collaboratorProfileDefinitions";

const PersonnelProfile = ({
 profileData,
 onChange,
 onSave,
 loading,
 saving,
 errors = {},
 readOnly = false,
 canUnlockSections = false,
 sections = profileSections,
}) => {
 const [openSections, setOpenSections] = useState(new Set(["personal", "laboral"]));
 const [unlockedSections, setUnlockedSections] = useState(new Set());

 const toggleSection = (sectionKey) => {
 const newOpen = new Set(openSections);
 if (newOpen.has(sectionKey)) {
 newOpen.delete(sectionKey);
 } else {
 newOpen.add(sectionKey);
 }
 setOpenSections(newOpen);
 };

 const toggleLock = (sectionKey, e) => {
 e.stopPropagation();
 if (!canUnlockSections) return;
 
 const newUnlocked = new Set(unlockedSections);
 if (newUnlocked.has(sectionKey)) {
 newUnlocked.delete(sectionKey);
 } else {
 newUnlocked.add(sectionKey);
 }
 setUnlockedSections(newUnlocked);
 // Callback to parent if needed to persist unlock state
 };

 const handleChange = (sectionKey, fieldKey, value) => {
 onChange(sectionKey, fieldKey, value);
 };

 if (!profileData) return null;

 return (
 <div className="space-y-4">
 {sections.map((section) => {
 const isOpen = openSections.has(section.key);
 // Logic for locked sections could be more complex based on backend data
 // For now assuming all editable unless specified otherwise in props
 const isLocked = false; 

 return (
 <div
 key={section.key}
 className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:shadow-sm"
 >
 <button
 type="button"
 onClick={() => toggleSection(section.key)}
 className="flex w-full items-center justify-between bg-gray-50 px-4 py-3 text-left"
 >
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold text-gray-900">
 {section.title}
 </span>
 {errors[section.key] && (
 <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
 !
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 text-gray-500">
 {isOpen ? <FiChevronUp /> : <FiChevronDown />}
 </div>
 </button>

 {isOpen && (
 <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
 {section.fields.map((field) => (
 <div key={field.key} className="space-y-1">
 <label className="block text-xs font-medium text-gray-500">
 {field.label}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </label>
 {field.readOnly ? (
 <div className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 border border-transparent">
 {profileData[section.key]?.[field.key] ?? "N/A"}
 </div>
 ) : (
 <input
 type={field.type || "text"}
 inputMode={field.inputMode}
 pattern={field.pattern}
 maxLength={field.maxLength}
 placeholder={field.placeholder}
 value={profileData[section.key]?.[field.key] || ""}
 onChange={(e) =>
 handleChange(section.key, field.key, e.target.value)
 }
 className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${
 errors[`${section.key}.${field.key}`]
 ? "border-red-300 bg-red-50"
 : "border-gray-300"
 }`}
 disabled={readOnly || isLocked}
 />
 )}
 {errors[`${section.key}.${field.key}`] && (
 <p className="text-[10px] text-red-500">
 {errors[`${section.key}.${field.key}`]}
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 );
};

export default PersonnelProfile;
