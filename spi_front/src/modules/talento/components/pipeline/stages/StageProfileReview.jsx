import React from "react";
import { advanceStage } from "../../../../../core/api/hiringPipelineApi";
import ApplicantIntakeSummary from "../../workspace/ApplicantIntakeSummary";
import {
  ActionBar, RejectBtn, AdvanceBtn,
  DoneNotice, RejectedNotice,
} from "./_stageShared";

function ProfileCard({ entry }) {
  const applicant = {
    ...(entry?.applicant_snapshot || {}),
    id: entry?.applicant_id,
    email: entry?.applicant_email || entry?.applicant_snapshot?.email,
    fullname: entry?.applicant_name || entry?.applicant_snapshot?.fullname,
    profile: entry?.applicant_profile || entry?.applicant_snapshot?.profile || {},
    documents: entry?.applicant_documents || entry?.applicant_snapshot?.documents || [],
    education: entry?.applicant_education || entry?.applicant_snapshot?.education || [],
    trainings: entry?.applicant_trainings || entry?.applicant_snapshot?.trainings || [],
    personal_references:
      entry?.applicant_personal_references || entry?.applicant_snapshot?.personal_references || [],
    work_experience:
      entry?.applicant_work_experience || entry?.applicant_snapshot?.work_experience || [],
    work_references:
      entry?.applicant_work_references || entry?.applicant_snapshot?.work_references || [],
  };

  return (
    <div className="p-5">
      <ApplicantIntakeSummary applicant={applicant} />
    </div>
  );
}

export default function StageProfileReview({ entry, stageResult, isCompleted, isRejected, saving, onUpdate, onReject, onReactivate }) {
  async function handleApprove() {
    await onUpdate(() =>
      advanceStage(entry.id, "revision_perfil", {
        data: { reviewed_at: new Date().toISOString() },
        observations: "Perfil revisado y aprobado para continuar",
        score: null,
      })
    );
  }

  return (
    <div className="flex flex-col">
      {isCompleted && <DoneNotice label="El perfil fue revisado y aprobado." />}
      {isRejected && <RejectedNotice onReactivate={() => onReactivate("Reactivación desde revisión de perfil")} saving={saving} />}

      <ProfileCard entry={entry} />

      {!isCompleted && !isRejected && (
        <ActionBar>
          <RejectBtn onClick={onReject} disabled={saving} />
          <AdvanceBtn onClick={handleApprove} saving={saving} label="Perfil aprobado, continuar" />
        </ActionBar>
      )}
    </div>
  );
}
