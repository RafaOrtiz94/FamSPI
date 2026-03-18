import React from "react";
import { FiCheck, FiX, FiFile, FiCheckSquare, FiSquare } from "react-icons/fi";
import { checklistSections } from "../collaboratorProfileDefinitions";

const PersonnelChecklist = ({
  profileData,
  documents,
  onToggleFlag,
  lockedSections = [],
  readOnly = false,
}) => {
  const isDocUploaded = (docKey) => {
    return documents.some((d) => d.doc_type === docKey);
  };

  const getOverallCompletion = () => {
    let total = 0;
    let done = 0;
    checklistSections.forEach((section) => {
      section.items.forEach((item) => {
        total += 1;
        const isChecked = item.type === "doc"
          ? isDocUploaded(item.docType)
          : Boolean(profileData?.onboarding?.[item.flagKey]);
        if (isChecked) done += 1;
      });
    });
    return {
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  };

  const overall = getOverallCompletion();

  const getSectionStatus = (section) => {
    const total = section.items.length;
    let done = 0;
    section.items.forEach((item) => {
      if (item.type === "doc") {
        if (isDocUploaded(item.docType)) done++;
      } else {
        if (profileData?.onboarding?.[item.flagKey]) done++;
      }
    });
    return { total, done, complete: total > 0 && done === total };
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Progreso del checklist</h3>
            <p className="text-xs text-slate-500">
              {overall.done} de {overall.total} validaciones completadas
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {overall.percent}%
          </span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${overall.percent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {checklistSections.map((section) => {
        const { total, done, complete } = getSectionStatus(section);
        const isLocked = lockedSections.includes(section.title);

        return (
          <div
            key={section.title}
            className={`flex flex-col rounded-xl border p-4 transition-all ${
              complete
                ? "border-emerald-200 bg-emerald-50/30"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">
                  {section.title}
                </h4>
                <p className="text-[10px] text-gray-500">
                  {done} / {total} completado
                </p>
              </div>
              {complete ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <FiCheck size={14} />
                </div>
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <span className="text-[10px] font-bold">
                    {Math.round((done / total) * 100)}%
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              {section.items.map((item, idx) => {
                const isDoc = item.type === "doc";
                const isChecked = isDoc
                  ? isDocUploaded(item.docType)
                  : Boolean(profileData?.onboarding?.[item.flagKey]);

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 text-xs ${
                      isChecked ? "text-gray-700" : "text-gray-500"
                    }`}
                  >
                    {isDoc ? (
                      <FiFile
                        className={`mt-0.5 shrink-0 ${
                          isChecked ? "text-blue-500" : "text-gray-300"
                        }`}
                      />
                    ) : (
                      <button
                        onClick={() => !isLocked && !readOnly && onToggleFlag(item.flagKey)}
                        disabled={isLocked || readOnly}
                        className={`mt-0.5 shrink-0 focus:outline-none ${
                          isLocked || readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        }`}
                      >
                        {isChecked ? (
                          <FiCheckSquare className="text-blue-600" />
                        ) : (
                          <FiSquare className="text-gray-300 hover:text-gray-400" />
                        )}
                      </button>
                    )}
                    <span className={isChecked ? "font-medium" : ""}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default PersonnelChecklist;
