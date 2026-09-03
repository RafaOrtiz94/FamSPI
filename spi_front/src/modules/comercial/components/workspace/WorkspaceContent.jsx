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
 onSectionSave,
 sectionCompleteness = {}
}) => {
 const workspace = useBusinessCaseWorkspaceOptional();
 const resolvedSelectedSection = selectedSection ?? workspace?.selectedSection;
 const resolvedBusinessCase = businessCase ?? workspace?.businessCase;
 const resolvedGuidance = uiGuidance ?? workspace?.uiGuidance;
 const resolvedSelect = onSectionSelect ?? workspace?.setSelectedSection;
 const resolvedSave = onSectionSave ?? workspace?.onSectionSave;
 const resolvedCompleteness = sectionCompleteness ?? workspace?.sectionCompleteness ?? {};
 const observationData = resolvedGuidance?.observationData;

 return (
  <div className="min-w-0 space-y-5 lg:space-y-6">
 {/* Observed Case Banner - Shows when case is in OBSERVADO state */}
 <ObservedCaseBanner observationData={observationData} />

  <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:flex-row lg:gap-6">
 {/* Section Navigator - Left sidebar on desktop, Top on mobile */}
  <div className="w-full min-w-0 shrink-0 lg:w-[320px] xl:w-[340px]">
 <SectionNavigator
 selectedSection={resolvedSelectedSection}
 uiGuidance={resolvedGuidance}
 observationData={observationData}
 onSectionSelect={resolvedSelect}
 sectionCompleteness={resolvedCompleteness}
 />
 </div>

 {/* Section Content - Main area */}
  <div className="min-w-0 flex-1">
  <div className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5 lg:p-6">
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
