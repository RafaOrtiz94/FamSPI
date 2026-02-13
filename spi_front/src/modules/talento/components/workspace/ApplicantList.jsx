import React from "react";
import { FiUser } from "react-icons/fi";

const ApplicantList = ({ applicants, loading, selectedApplicantId, onSelect }) => {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No se encontraron postulantes para este cargo.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {applicants.map((applicant) => (
        <button
          key={applicant.id}
          onClick={() => onSelect(applicant)}
          className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition ${
            String(applicant.id) === String(selectedApplicantId)
              ? "border-blue-400 bg-blue-50 ring-1 ring-blue-400"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
              <FiUser />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{applicant.fullname}</p>
              <p className="text-xs text-gray-500 truncate">{applicant.email}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Actualizado: {new Date(applicant.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ApplicantList;
