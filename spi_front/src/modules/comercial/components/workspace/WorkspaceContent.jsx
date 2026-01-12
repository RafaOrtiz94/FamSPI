import React from "react";
import SectionNavigator from "./SectionNavigator";
import SectionContent from "./SectionContent";
import ObservedCaseBanner from "./ObservedCaseBanner";

const WorkspaceContent = ({
  selectedSection,
  businessCase,
  uiGuidance,
  onSectionSelect,
  onSectionSave
}) => {
  const observationData = uiGuidance?.observationData;

  return (
    <div className="space-y-6">
      {/* Observed Case Banner - Shows when case is in OBSERVADO state */}
      <ObservedCaseBanner observationData={observationData} />

      <div className="flex gap-6">
        {/* Section Navigator - Left sidebar */}
        <div className="w-80 flex-shrink-0">
          <SectionNavigator
            selectedSection={selectedSection}
            uiGuidance={uiGuidance}
            observationData={observationData}
            onSectionSelect={onSectionSelect}
          />
        </div>

        {/* Section Content - Main area */}
        <div className="flex-1 min-w-0">
          <SectionContent
            selectedSection={selectedSection}
            businessCase={businessCase}
            uiGuidance={uiGuidance}
            observationData={observationData}
            onSectionSave={onSectionSave}
          />
        </div>
      </div>
    </div>
  );
};

export default WorkspaceContent;
