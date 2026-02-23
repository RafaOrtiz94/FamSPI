import React from "react";
import SectionNavigator from "./SectionNavigator";
import SectionContent from "./SectionContent";
import ObservedCaseBanner from "./ObservedCaseBanner";
import { useBusinessCaseWorkspaceOptional } from "./BusinessCaseWorkspaceContext";

const WorkspaceContent = ({
  selectedSection,
  businessCase,
  uiGuidance,
  onSectionSelect,
  onSectionSave
}) => {
  const workspace = useBusinessCaseWorkspaceOptional();
  const resolvedSelectedSection = selectedSection ?? workspace?.selectedSection;
  const resolvedBusinessCase = businessCase ?? workspace?.businessCase;
  const resolvedGuidance = uiGuidance ?? workspace?.uiGuidance;
  const resolvedSelect = onSectionSelect ?? workspace?.setSelectedSection;
  const resolvedSave = onSectionSave ?? workspace?.onSectionSave;
  const observationData = resolvedGuidance?.observationData;

  return (
    <div className="space-y-6">
      {/* Observed Case Banner - Shows when case is in OBSERVADO state */}
      <ObservedCaseBanner observationData={observationData} />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section Navigator - Left sidebar on desktop, Top on mobile */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <SectionNavigator
            selectedSection={resolvedSelectedSection}
            uiGuidance={resolvedGuidance}
            observationData={observationData}
            onSectionSelect={resolvedSelect}
          />
        </div>

        {/* Section Content - Main area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
             <SectionContent
                selectedSection={resolvedSelectedSection}
                businessCase={resolvedBusinessCase}
                uiGuidance={resolvedGuidance}
                observationData={observationData}
                onSectionSave={resolvedSave}
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceContent;
