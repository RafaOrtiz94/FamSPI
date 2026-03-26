import React from "react";

const summarySlots = Array.from({ length: 4 }, (_, index) => index);

export const WorkspaceHeaderSectionSkeleton = () => (
  <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="animate-pulse space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-28 rounded-full bg-stone-200" />
          <div className="h-7 w-64 max-w-full rounded-lg bg-stone-200" />
          <div className="h-4 w-80 max-w-full rounded-full bg-stone-200" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="h-8 w-28 rounded-full bg-stone-200" />
          <div className="h-8 w-24 rounded-full bg-stone-200" />
          <div className="h-8 w-32 rounded-full bg-stone-200" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="h-7 w-24 rounded-full bg-stone-200" />
        <div className="h-7 w-28 rounded-full bg-stone-200" />
        <div className="h-7 w-20 rounded-full bg-stone-200" />
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-stone-200" />
          <div className="h-5 w-28 rounded-md bg-stone-200" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-stone-200" />
          <div className="h-5 w-36 rounded-md bg-stone-200" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-stone-200" />
          <div className="h-5 w-48 max-w-full rounded-md bg-stone-200" />
        </div>
      </div>
    </div>
  </div>
);

export const SummaryStripSkeleton = () => (
  <div className="-mx-3 flex w-full overflow-x-auto px-3 py-1">
    <div className="flex w-full min-w-full gap-3">
      {summarySlots.map((slot) => (
        <div
          key={`summary-skeleton-${slot}`}
          className="animate-pulse flex min-w-[190px] max-w-[280px] flex-1 flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="h-3 w-24 rounded-full bg-stone-200" />
            <div className="h-2 w-2 rounded-full bg-stone-200" />
          </div>
          <div className="h-8 w-20 rounded-md bg-stone-200" />
          <div className="h-3 w-28 rounded-full bg-stone-200" />
        </div>
      ))}
    </div>
  </div>
);

export const JourneyPanelSkeleton = () => (
  <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-900/5">
    <div className="animate-pulse space-y-4">
      <div className="h-5 w-56 rounded-md bg-stone-200" />
      <div className="h-4 w-full rounded-full bg-stone-200" />
      <div className="h-4 w-10/12 rounded-full bg-stone-200" />
      <div className="h-40 rounded-2xl bg-stone-200" />
    </div>
  </div>
);

const CommandCenterSkeleton = ({
  showHeader = true,
  showSummary = true,
  showJourney = true,
}) => {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Cargando command center">
      {showHeader && <WorkspaceHeaderSectionSkeleton />}
      {showSummary && <SummaryStripSkeleton />}
      {showJourney && <JourneyPanelSkeleton />}
    </div>
  );
};

export default CommandCenterSkeleton;
