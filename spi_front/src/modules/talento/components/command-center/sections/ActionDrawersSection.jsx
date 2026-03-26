import React from "react";
import { FiX } from "react-icons/fi";
import CommandCenterEntityBrowser from "../CommandCenterEntityBrowser";
import PersonnelRequestReview from "../../workspace/PersonnelRequestReview";
import PersonnelRequestForm from "../../../../../core/ui/widgets/PersonnelRequestForm";

/**
 * Drawers y modales operativos del command center.
 */
const ActionDrawersSection = ({
  browserOpen = false,
  onCloseBrowser,
  browserProps,
  createDrawerOpen = false,
  onCloseCreateDrawer,
  onRequestCreated,
  reviewModeOpen = false,
  reviewRequestData = null,
  canApprovePersonnel = false,
  onCloseReview,
  onRequestReviewed,
}) => {
  return (
    <>
      {browserOpen && (
        <div className="fixed inset-0 z-40 flex bg-slate-900/40 xl:hidden">
          <div className="flex-1" aria-hidden="true" onClick={onCloseBrowser} />
          <div className="w-full max-w-md border-l border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">Navegador</p>
              <button
                type="button"
                onClick={onCloseBrowser}
                className="rounded-full border border-slate-300 bg-white p-2 text-slate-700"
              >
                <FiX />
              </button>
            </div>
            <CommandCenterEntityBrowser {...browserProps} />
          </div>
        </div>
      )}

      {createDrawerOpen && (
        <div className="fixed inset-0 z-50 flex bg-slate-900/40">
          <div className="flex-1" aria-hidden="true" onClick={onCloseCreateDrawer} />
          <div className="flex h-full w-full max-w-3xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Nuevo flujo
                </p>
                <h2 className="text-lg font-semibold text-slate-900">
                  Crear solicitud de personal
                </h2>
              </div>
              <button
                type="button"
                onClick={onCloseCreateDrawer}
                className="rounded-full border border-slate-300 bg-white p-2 text-slate-700"
              >
                <FiX />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <PersonnelRequestForm
                isModal={false}
                onClose={onCloseCreateDrawer}
                onSuccess={onRequestCreated}
              />
            </div>
          </div>
        </div>
      )}

      {reviewModeOpen && reviewRequestData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={onCloseReview}
                className="rounded-full border border-slate-300 bg-white p-2 text-slate-700 shadow-sm"
              >
                <FiX />
              </button>
            </div>
            <PersonnelRequestReview
              request={reviewRequestData}
              onCancel={onCloseReview}
              onUpdate={onRequestReviewed}
              canApprove={canApprovePersonnel}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ActionDrawersSection;
