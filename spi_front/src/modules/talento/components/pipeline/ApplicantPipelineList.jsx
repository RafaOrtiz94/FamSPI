import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  FiCheck,
  FiClock,
  FiFileText,
  FiExternalLink,
  FiPlay,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { getApplicantById } from "../../../../core/api/applicantsApi";

const STAGE_LABELS = {
  revision_perfil: "Revision del perfil",
  verificacion_referencias: "Verificacion de referencias",
  primera_entrevista: "Primera entrevista",
  prueba_habilidades: "Prueba de habilidades",
  evaluacion_psicologica: "Evaluacion psicologica",
  entrevista_gerencia: "Entrevista con gerencia",
  oferta_contratacion: "Oferta y contratacion",
  completado: "Proceso completado",
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const formatApplicationDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

const resolveApplicantDocument = (applicant, docType) =>
  (Array.isArray(applicant?.documents) ? applicant.documents : []).find(
    (document) => String(document?.doc_type || "").trim().toUpperCase() === docType,
  );

function StatusBadge({ status }) {
  if (status === "contratado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-semibold text-[#16A34A]">
        <FiCheck size={10} /> Contratado
      </span>
    );
  }
  if (status === "rechazado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
        <FiX size={10} /> Rechazado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
      <FiClock size={10} /> En evaluacion
    </span>
  );
}

function SummaryBadge({ icon: Icon, label, value, tone = "neutral" }) {
  const toneClassName = {
    neutral: "bg-[#F3F4F6] text-[#1F2937]",
    blue: "bg-[#DBEAFE] text-[#1D4ED8]",
    green: "bg-[#DCFCE7] text-[#166534]",
  };

  return (
    <div className={`flex min-h-[44px] items-center gap-2 rounded-2xl px-3 py-2 ${toneClassName[tone] || toneClassName.neutral}`}>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80">
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-none opacity-80">{label}</p>
        <p className="mt-1 text-sm font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}

function ApplicantRow({
  applicant,
  entry,
  isSelected,
  onSelect,
  onStart,
  onApplicantSelect,
  starting,
  isLinked,
  onOpenDocument,
  documentLoadingKey,
}) {
  const hasEntry = Boolean(entry);
  const name = applicant.fullname || applicant.email || `Postulante #${applicant.id}`;
  const cargo = applicant.profile?.laboral?.cargo || "";
  const email = applicant.email || "";
  const applicationDate = formatApplicationDate(applicant.created_at || applicant.application_date);
  const cvDocument = resolveApplicantDocument(applicant, "HOJA_VIDA");
  const motivationDocument = resolveApplicantDocument(applicant, "CARTA_MOTIVACION");
  const currentStageLabel = STAGE_LABELS[entry?.current_stage] || entry?.current_stage || "";
  const rejectionStageLabel = STAGE_LABELS[entry?.rejection_stage] || entry?.rejection_stage || "";

  return (
    <div
      className={`flex min-w-0 items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
        isSelected ? "bg-[#EFF6FF]" : "bg-white hover:bg-[#F9FAFB]"
      }`}
      onClick={() => onApplicantSelect?.(applicant)}
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280]">
        <FiUser size={14} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#1F2937]">{name}</p>
          {isLinked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-semibold text-[#166534]">
              <FiCheck size={10} />
              Seleccionado
            </span>
          ) : null}
          {hasEntry ? <StatusBadge status={entry.status} /> : null}
        </div>

        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {cargo ? <p className="truncate text-[12px] text-[#6B7280]">{cargo}</p> : null}
          {email ? <p className="truncate text-[12px] text-[#6B7280]">{email}</p> : null}
          {applicationDate ? (
            <p className="truncate text-[12px] text-[#6B7280]">
              Fecha de postulacion: {applicationDate}
            </p>
          ) : null}
          {entry?.status === "en_evaluacion" && currentStageLabel ? (
            <p className="truncate text-[12px] text-[#6B7280]">{currentStageLabel}</p>
          ) : null}
          {entry?.status === "rechazado" && rejectionStageLabel ? (
            <p className="truncate text-[12px] text-[#6B7280]">Rechazado en {rejectionStageLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (cvDocument?.drive_url) {
                window.open(cvDocument.drive_url, "_blank", "noopener,noreferrer");
                return;
              }
              onOpenDocument?.(applicant, "HOJA_VIDA");
            }}
            title={cvDocument?.drive_url ? "Ver CV" : "CV no disponible"}
            disabled={documentLoadingKey === `${String(applicant.id)}:HOJA_VIDA`}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 ${
              cvDocument?.drive_url
                ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] hover:border-[#2563EB] hover:bg-white cursor-pointer"
                : "border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] hover:border-[#2563EB] hover:bg-white cursor-pointer"
            }`}
          >
            {documentLoadingKey === `${String(applicant.id)}:HOJA_VIDA` ? (
              <FiRefreshCw size={14} className="animate-spin" />
            ) : (
              <FiFileText size={14} />
            )}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (motivationDocument?.drive_url) {
                window.open(motivationDocument.drive_url, "_blank", "noopener,noreferrer");
                return;
              }
              onOpenDocument?.(applicant, "CARTA_MOTIVACION");
            }}
            title={motivationDocument?.drive_url ? "Ver carta de motivacion" : "Carta de motivacion no disponible"}
            disabled={documentLoadingKey === `${String(applicant.id)}:CARTA_MOTIVACION`}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 ${
              motivationDocument?.drive_url
                ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] hover:border-[#2563EB] hover:bg-white cursor-pointer"
                : "border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] hover:border-[#2563EB] hover:bg-white cursor-pointer"
            }`}
          >
            {documentLoadingKey === `${String(applicant.id)}:CARTA_MOTIVACION` ? (
              <FiRefreshCw size={14} className="animate-spin" />
            ) : (
              <FiExternalLink size={14} />
            )}
          </button>
        </div>
        {hasEntry ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(entry);
            }}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] font-semibold text-[#1F2937] transition hover:border-[#2563EB] hover:text-[#2563EB] active:scale-[0.97] cursor-pointer"
          >
            Abrir pipeline
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onStart(applicant);
            }}
            disabled={starting}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 text-[11px] font-semibold text-[#1F2937] transition hover:border-[#2563EB] hover:text-[#2563EB] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 cursor-pointer"
          >
            {starting ? <FiRefreshCw size={10} className="animate-spin" /> : <FiPlay size={10} />}
            Iniciar evaluacion
          </button>
        )}
      </div>
    </div>
  );
}

export default function ApplicantPipelineList({
  applicants,
  entries,
  selectedEntryId,
  selectedApplicantId,
  linkedApplicantId,
  onSelect,
  onStart,
  onApplicantSelect,
  startingId,
}) {
  const [localQuery, setLocalQuery] = useState("");
  const listContainerRef = useRef(null);
  const [documentLoadingKey, setDocumentLoadingKey] = useState("");

  const entriesByApplicantId = useMemo(
    () =>
      entries.reduce((acc, item) => {
        acc[String(item.applicant_id)] = item;
        return acc;
      }, {}),
    [entries],
  );

  const filteredApplicants = useMemo(() => {
    const normalizedQuery = normalizeText(localQuery);
    if (!normalizedQuery) return applicants;

    return applicants.filter((applicant) => {
      const entry = entriesByApplicantId[String(applicant.id)];
      const haystack = [
        applicant.fullname,
        applicant.email,
        applicant.profile?.laboral?.cargo,
        entry?.current_stage,
        STAGE_LABELS[entry?.current_stage],
        entry?.status,
      ]
        .map(normalizeText)
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [applicants, entriesByApplicantId, localQuery]);

  const stableApplicants = useMemo(
    () =>
      [...filteredApplicants].sort((left, right) => {
        const leftDate = new Date(left?.created_at || left?.application_date || 0).getTime();
        const rightDate = new Date(right?.created_at || right?.application_date || 0).getTime();
        if (leftDate !== rightDate) return rightDate - leftDate;
        return String(left?.fullname || left?.email || "").localeCompare(
          String(right?.fullname || right?.email || ""),
          "es",
        );
      }),
    [filteredApplicants],
  );

  const summary = useMemo(() => {
    const total = applicants.length;
    const filtered = filteredApplicants.length;
    const inEvaluation = applicants.filter((applicant) => entriesByApplicantId[String(applicant.id)]).length;
    const linked = applicants.filter(
      (applicant) => String(linkedApplicantId || "") === String(applicant.id),
    ).length;

    return { total, filtered, inEvaluation, linked };
  }, [applicants, entriesByApplicantId, filteredApplicants.length, linkedApplicantId]);

  useEffect(() => {
    if (!listContainerRef.current || !selectedApplicantId) return;
    const target = listContainerRef.current.querySelector(`[data-applicant-id="${String(selectedApplicantId)}"]`);
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedApplicantId, stableApplicants.length]);

  const handleOpenDocument = async (applicant, docType) => {
    if (!applicant?.id) return;
    const loadingKey = `${String(applicant.id)}:${docType}`;
    try {
      setDocumentLoadingKey(loadingKey);
      const response = await getApplicantById(applicant.id);
      const fullApplicant = response?.data || response || applicant;
      const document = resolveApplicantDocument(fullApplicant, docType);
      if (!document?.drive_url) {
        toast.error(
          docType === "HOJA_VIDA"
            ? "Este postulante no tiene CV cargado."
            : "Este postulante no tiene carta de motivacion cargada.",
        );
        return;
      }
      window.open(document.drive_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error?.response?.data?.message || "No se pudo abrir el documento del postulante.");
    } finally {
      setDocumentLoadingKey("");
    }
  };

  if (!applicants.length) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <FiUser size={32} className="mb-3 text-[#D1D5DB]" />
        <p className="text-sm font-medium text-[#6B7280]">Sin postulantes vinculados</p>
        <p className="mt-1 text-xs text-[#9CA3AF]">Este expediente aun no tiene postulantes asignados.</p>
      </div>
    );
  }

  return (
    <div ref={listContainerRef} className="flex flex-col">
      <div className="border-b border-[#E5E7EB] px-4 py-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryBadge icon={FiUsers} label="Postulantes visibles" value={summary.filtered} />
          <SummaryBadge icon={FiClock} tone="blue" label="En evaluacion" value={summary.inEvaluation} />
          <SummaryBadge icon={FiCheck} tone="green" label="Seleccionado" value={summary.linked} />
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <span className="sr-only">Buscar postulante</span>
            <FiSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]"
            />
            <input
              type="search"
              value={localQuery}
              onChange={(event) => setLocalQuery(event.target.value)}
              placeholder="Buscar por nombre, correo, cargo o etapa"
              className="min-h-[40px] w-full rounded-xl border border-[#D1D5DB] bg-white py-2 pl-10 pr-3 text-sm text-[#1F2937] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#0EA5E9]/20"
            />
          </label>

          <p className="text-xs text-[#6B7280]">
            Mostrando {summary.filtered} de {summary.total} postulantes asociados al expediente.
          </p>
        </div>
      </div>

      {filteredApplicants.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
          <FiSearch size={28} className="mb-3 text-[#D1D5DB]" />
          <p className="text-sm font-medium text-[#1F2937]">No hay coincidencias con ese filtro</p>
          <p className="mt-1 max-w-md text-xs text-[#6B7280]">
            Ajusta la busqueda para volver a ver los postulantes del expediente.
          </p>
        </div>
      ) : (
        <div className="pb-2">
          {stableApplicants.map((applicant) => {
            const entry = entriesByApplicantId[String(applicant.id)];
            return (
              <div key={applicant.id} data-applicant-id={String(applicant.id)} className="border-t border-[#E5E7EB]">
                <ApplicantRow
                  applicant={applicant}
                  entry={entry}
                  isSelected={
                    String(selectedApplicantId || "") === String(applicant.id) ||
                    (entry && String(entry.id) === String(selectedEntryId))
                  }
                  onSelect={onSelect}
                  onStart={onStart}
                  onApplicantSelect={onApplicantSelect}
                  starting={String(startingId) === String(applicant.id)}
                  isLinked={String(linkedApplicantId || "") === String(applicant.id)}
                  onOpenDocument={handleOpenDocument}
                  documentLoadingKey={documentLoadingKey}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
