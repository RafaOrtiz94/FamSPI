import React from "react";
import CommandCenterWorkspaceHeader from "../CommandCenterWorkspaceHeader";

/**
 * Sección del encabezado principal del workspace con contexto dinámico.
 */
const WorkspaceHeaderSection = ({
  currentEntity,
  currentContextKind,
  summaryBadges,
  onOpenBrowser,
  onToggleFocus,
  focusMode,
  primaryAction,
  secondaryActions,
  workflowInfo,
}) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <CommandCenterWorkspaceHeader
        currentEntity={currentEntity}
        currentContextKind={currentContextKind}
        summaryBadges={summaryBadges}
        onOpenBrowser={onOpenBrowser}
        onToggleFocus={onToggleFocus}
        focusMode={focusMode}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        workflowInfo={workflowInfo}
      />
    </div>
  );
};

export default WorkspaceHeaderSection;
