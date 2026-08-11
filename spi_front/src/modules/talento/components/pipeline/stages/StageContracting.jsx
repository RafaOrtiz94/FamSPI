import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  uploadSalaryOffer,
  uploadContract,
  finalizeHiring,
} from "../../../../../core/api/hiringPipelineApi";
import { SectionTitle, ActionBar, AdvanceBtn } from "./_stageShared";
import {
  FiUpload, FiRefreshCw, FiFileText, FiExternalLink,
  FiInfo, FiCheck, FiUsers, FiArrowRight,
} from "react-icons/fi";

function UploadZone({ label, onFile, uploading, loadingLabel, accept = ".pdf,.doc,.docx" }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280] transition hover:border-[#2563EB] hover:text-[#2563EB] ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
      {uploading ? <FiRefreshCw size={15} className="animate-spin" /> : <FiUpload size={15} />}
      {uploading ? loadingLabel : label}
      <input type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} disabled={uploading} />
    </label>
  );
}

function FileLink({ url, name, onReplace, uploading, replaceLabel = "Reemplazar" }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={url} target="_blank" rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1F2937] transition hover:border-[#2563EB] hover:text-[#2563EB]">
        <FiFileText size={13} /> {name || "Ver archivo"} <FiExternalLink size={11} />
      </a>
      {onReplace && (
        <label className={`cursor-pointer text-xs text-[#6B7280] underline hover:text-[#2563EB] ${uploading ? "pointer-events-none opacity-50" : ""}`}>
          {replaceLabel}
          <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onReplace(f); e.target.value = ""; }} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

export default function StageContracting({ entry, stageResult, isHired, requestId, onEntryUpdate }) {
  const navigate = useNavigate();
  const contractData = stageResult?.data || {};

  const offerUploaded = Boolean(contractData.offer_drive_url);
  const contractUploaded = Boolean(contractData.contract_drive_url);

  const [uploadingOffer, setUploadingOffer] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [offerError, setOfferError] = useState(null);
  const [contractError, setContractError] = useState(null);

  async function refresh() {
    const res = await import("../../../../../core/api/hiringPipelineApi").then(m => m.getEntry(entry.id));
    if (res?.data) onEntryUpdate(res.data);
  }

  async function handleOfferUpload(file) {
    setUploadingOffer(true);
    setOfferError(null);
    try {
      await uploadSalaryOffer(entry.id, file);
      await refresh();
    } catch (err) {
      setOfferError(err?.response?.data?.message || "Error al subir la oferta. Intenta nuevamente.");
    } finally {
      setUploadingOffer(false);
    }
  }

  async function handleContractUpload(file) {
    setUploadingContract(true);
    setContractError(null);
    try {
      await uploadContract(entry.id, file);
      await refresh();
    } catch (err) {
      setContractError(err?.response?.data?.message || "Error al subir el contrato. Verifica que el perfil y documentos del postulante estén completos.");
    } finally {
      setUploadingContract(false);
    }
  }

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const response = await finalizeHiring(requestId, entry.id);
      const result = response?.data || {};
      if (result.matched_existing_user) {
        toast.success("Postulante contratado: se vinculó a la cuenta corporativa que ya tenía (no se creó una cuenta duplicada).", { duration: 6000 });
      } else if (result.pending_corporate_email) {
        toast.success("Postulante contratado. Aún falta asignarle su correo corporativo desde Usuarios para que pueda iniciar sesión.", { duration: 7000 });
      } else {
        toast.success("Postulante contratado correctamente");
      }
      await refresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || "No se pudo completar la contratación. Intenta nuevamente.");
    } finally {
      setFinalizing(false);
    }
  }

  function goToCollaborator() {
    const uid = entry?.collaborator_user_id;
    if (uid) {
      navigate(`/dashboard/talento-humano/colaboradores/${uid}`);
    } else {
      navigate("/dashboard/talento-humano/command-center/colaboradores");
    }
  }

  // ── Estado: contratado ────────────────────────────────────────────────────────
  if (isHired) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16A34A]">
            <FiCheck size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#15803D]">Contratación completada</p>
            <p className="mt-0.5 text-xs text-[#16A34A]">
              {entry?.applicant_name} ahora es parte del equipo. Su ficha de colaborador está lista para revisar y completar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={goToCollaborator}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] cursor-pointer"
          >
            <FiUsers size={15} /> Ir a ficha de colaborador <FiArrowRight size={14} />
          </button>
          {contractData.contract_drive_url && (
            <a href={contractData.contract_drive_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-medium text-[#1F2937] transition hover:border-[#2563EB] hover:text-[#2563EB]">
              <FiFileText size={13} /> Ver contrato firmado <FiExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Flujo de contratación ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      <div className="space-y-6 p-5">

        {/* Paso 1: Oferta salarial */}
        <div>
          <SectionTitle>1. Oferta salarial</SectionTitle>
          <p className="mb-3 text-xs text-[#6B7280]">
            Sube el documento de oferta salarial que se presentó al postulante.
          </p>

          {offerUploaded ? (
            <FileLink
              url={contractData.offer_drive_url}
              name={contractData.offer_file_name}
              onReplace={!isHired ? handleOfferUpload : undefined}
              uploading={uploadingOffer}
            />
          ) : (
            <UploadZone
              label="Subir oferta salarial (PDF o Word)"
              loadingLabel="Subiendo oferta..."
              onFile={handleOfferUpload}
              uploading={uploadingOffer}
            />
          )}

          {offerError && (
            <div className="mt-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-2.5 text-xs text-[#DC2626]">
              {offerError}
            </div>
          )}

          {offerUploaded && !contractUploaded && (
            <div className="mt-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-xs text-[#16A34A] font-medium flex items-center gap-2">
              <FiCheck size={12} /> Oferta subida. Ahora sube el contrato firmado para completar la contratación.
            </div>
          )}
        </div>

        {/* Paso 2: Contrato firmado — solo aparece tras subir la oferta */}
        {offerUploaded && (
          <div>
            <SectionTitle>2. Contrato firmado</SectionTitle>

            {!contractUploaded && (
              <div className="mb-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 flex items-start gap-2">
                <FiInfo size={14} className="mt-0.5 shrink-0 text-[#2563EB]" />
                <p className="text-xs text-[#1D4ED8]">
                  Al subir el contrato firmado, el postulante pasará automáticamente a ser colaborador.
                  Asegúrate de que el perfil y todos los documentos requeridos estén completos antes de subir.
                </p>
              </div>
            )}

            {contractUploaded ? (
              <FileLink
                url={contractData.contract_drive_url}
                name={contractData.contract_file_name}
                onReplace={handleContractUpload}
                uploading={uploadingContract}
              />
            ) : (
              <UploadZone
                label="Subir contrato firmado (PDF o Word)"
                loadingLabel="Procesando contratación..."
                onFile={handleContractUpload}
                uploading={uploadingContract}
              />
            )}

            {contractError && (
              <div className="mt-2 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-xs text-[#DC2626]">
                {contractError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón de finalización manual — fallback si auto-hire falló */}
      {contractUploaded && !isHired && (
        <ActionBar>
          <AdvanceBtn
            onClick={handleFinalize}
            saving={finalizing}
            label="Finalizar contratación"
          />
        </ActionBar>
      )}
    </div>
  );
}
