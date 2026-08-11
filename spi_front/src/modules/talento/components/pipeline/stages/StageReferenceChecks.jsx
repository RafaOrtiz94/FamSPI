import React, { useMemo, useState } from "react";
import { advanceStage } from "../../../../../core/api/hiringPipelineApi";
import {
  SectionTitle,
  ActionBar,
  RejectBtn,
  AdvanceBtn,
  Textarea,
  DoneNotice,
  RejectedNotice,
} from "./_stageShared";

const STAGE_KEY = "verificacion_referencias";

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function buildInitialReviews(items = [], existing = []) {
  const existingMap = new Map(asList(existing).map((item) => [String(item.reference_key), item]));
  return items.map((item, index) => {
    const referenceKey = String(item?.id ?? index);
    const saved = existingMap.get(referenceKey);
    return {
      reference_key: referenceKey,
      approved: saved?.approved === true ? true : saved?.approved === false ? false : null,
      notes: saved?.notes || "",
    };
  });
}

function ReferenceReviewSection({ title, emptyMessage, items, reviews, onDecision, onNotes }) {
  return (
    <section className="space-y-3">
      <SectionTitle>{title}</SectionTitle>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
          {emptyMessage}
        </div>
      ) : (
        items.map((item, index) => {
          const review = reviews[index] || {};
          const approved = review.approved;

          return (
            <div key={`${title}-${review.reference_key || index}`} className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Nombre</p>
                  <p className="mt-0.5 text-sm text-[#1F2937] break-words">{item?.nombre || item?.nombre_contacto || "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Teléfono</p>
                  <p className="mt-0.5 text-sm text-[#1F2937] break-words">{item?.celular || item?.celular_contacto || "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    {title.includes("laborales") ? "Empresa" : "Ocupación"}
                  </p>
                  <p className="mt-0.5 text-sm text-[#1F2937] break-words">{item?.empresa || item?.ocupacion || "—"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    {title.includes("laborales") ? "Cargo del contacto" : "Tiempo de conocerlo"}
                  </p>
                  <p className="mt-0.5 text-sm text-[#1F2937] break-words">
                    {item?.cargo_contacto || item?.tiempo_conocerlo_anios || "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onDecision(index, true)}
                  className={`inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-95 cursor-pointer ${
                    approved === true
                      ? "border-[#16A34A] bg-[#DCFCE7] text-[#166534]"
                      : "border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#16A34A] hover:text-[#166534]"
                  }`}
                >
                  Aprobada
                </button>
                <button
                  type="button"
                  onClick={() => onDecision(index, false)}
                  className={`inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-95 cursor-pointer ${
                    approved === false
                      ? "border-[#DC2626] bg-[#FEE2E2] text-[#B91C1C]"
                      : "border-[#E5E7EB] bg-white text-[#1F2937] hover:border-[#DC2626] hover:text-[#B91C1C]"
                  }`}
                >
                  Rechazada
                </button>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Observaciones</label>
                <Textarea
                  value={review.notes || ""}
                  onChange={(e) => onNotes(index, e.target.value)}
                  rows={2}
                  placeholder="Qué se validó, quién atendió, alertas o confirmaciones."
                />
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

export default function StageReferenceChecks({ entry, stageResult, isCompleted, isRejected, saving, onUpdate, onReject, onReactivate }) {
  const existing = stageResult?.data || {};
  const personalReferences = asList(entry?.applicant_personal_references || entry?.applicant_snapshot?.personal_references);
  const workReferences = asList(entry?.applicant_work_references || entry?.applicant_snapshot?.work_references);

  const initialState = useMemo(() => ({
    personal_reviews: buildInitialReviews(personalReferences, existing.personal_reviews),
    work_reviews: buildInitialReviews(workReferences, existing.work_reviews),
    overall_notes: existing.overall_notes || "",
  }), [existing.overall_notes, existing.personal_reviews, existing.work_reviews, personalReferences, workReferences]);

  const [form, setForm] = useState(initialState);

  const allPersonalReviewed = form.personal_reviews.every((item) => item.approved !== null);
  const allWorkReviewed = form.work_reviews.every((item) => item.approved !== null);
  const canAdvance = allPersonalReviewed && allWorkReviewed;

  function updateReview(collectionKey, index, patch) {
    setForm((prev) => ({
      ...prev,
      [collectionKey]: prev[collectionKey].map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  }

  async function handleAdvance() {
    if (!canAdvance) return;

    const approvedPersonal = form.personal_reviews.filter((item) => item.approved === true).length;
    const approvedWork = form.work_reviews.filter((item) => item.approved === true).length;

    await onUpdate(() =>
      advanceStage(entry.id, STAGE_KEY, {
        data: {
          ...form,
          summary: {
            personal_total: form.personal_reviews.length,
            personal_approved: approvedPersonal,
            work_total: form.work_reviews.length,
            work_approved: approvedWork,
          },
        },
        observations: form.overall_notes || "Referencias verificadas por Talento Humano.",
        score: null,
      })
    );
  }

  return (
    <div className="flex flex-col">
      {isCompleted && <DoneNotice label="Referencias verificadas." />}
      {isRejected && <RejectedNotice onReactivate={() => onReactivate("Reactivación desde verificación de referencias")} saving={saving} />}

      {!isCompleted && !isRejected && (
        <>
          <div className="space-y-5 p-5">
            <ReferenceReviewSection
              title="Referencias personales"
              emptyMessage="El postulante no registra referencias personales en su expediente."
              items={personalReferences}
              reviews={form.personal_reviews}
              onDecision={(index, approved) => updateReview("personal_reviews", index, { approved })}
              onNotes={(index, notes) => updateReview("personal_reviews", index, { notes })}
            />

            <ReferenceReviewSection
              title="Referencias laborales"
              emptyMessage="El postulante no registra referencias laborales en su expediente."
              items={workReferences}
              reviews={form.work_reviews}
              onDecision={(index, approved) => updateReview("work_reviews", index, { approved })}
              onNotes={(index, notes) => updateReview("work_reviews", index, { notes })}
            />

            <div>
              <SectionTitle>Conclusión general</SectionTitle>
              <label className="mb-1 block text-xs font-semibold text-[#6B7280]">Notas finales</label>
              <Textarea
                value={form.overall_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, overall_notes: e.target.value }))}
                rows={3}
                placeholder="Resumen final de la validación de referencias."
              />
            </div>
          </div>

          <ActionBar>
            <RejectBtn onClick={onReject} disabled={saving} />
            <AdvanceBtn
              onClick={handleAdvance}
              saving={saving}
              disabled={!canAdvance}
              label="Referencias verificadas, continuar"
            />
          </ActionBar>
        </>
      )}

      {isCompleted && (
        <div className="space-y-4 px-5 pb-5">
          <SectionTitle>Resultado registrado</SectionTitle>
          <p className="text-sm text-[#374151] whitespace-pre-line">
            {existing.overall_notes || "Referencias verificadas por Talento Humano."}
          </p>
        </div>
      )}
    </div>
  );
}
