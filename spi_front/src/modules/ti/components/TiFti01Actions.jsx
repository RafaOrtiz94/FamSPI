import React, { useState } from "react";
import { FiDownload, FiEdit3, FiRefreshCw } from "react-icons/fi";
import { downloadTiFti01, startTiFti01SignatureWorkflow } from "../../../core/api/tiAssetsApi";
import { getSignerCandidates } from "../../../core/api/usersApi";
import { useUI } from "../../../core/ui/UIContext";
import Modal from "../../../core/ui/components/Modal";

// F.TI-01 (Cronograma de mantenimiento de equipos tecnologicos): descarga del formato lleno y, para TI,
// envio a firma (elabora y aprueba, en cualquier orden) por el motor de firma documental.
const buttonClass = "flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97] disabled:opacity-60 cursor-pointer";

const TiFti01Actions = ({ year, canSign = false, className = "" }) => {
  const { showToast } = useUI();
  const [downloading, setDownloading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [preparedBy, setPreparedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [sending, setSending] = useState(false);
  const safeYear = Number(year) || new Date().getFullYear();

  const download = async () => {
    try {
      setDownloading(true);
      await downloadTiFti01(safeYear);
    } catch (error) {
      showToast?.("No se pudo generar el F.TI-01", "error");
    } finally {
      setDownloading(false);
    }
  };

  const openSignModal = async () => {
    setModalOpen(true);
    if (candidates.length) return;
    setLoadingCandidates(true);
    try {
      const users = await getSignerCandidates();
      setCandidates(Array.isArray(users) ? users : []);
    } catch (error) {
      showToast?.(error?.response?.data?.message || "No se pudo cargar el directorio de usuarios", "error");
    } finally {
      setLoadingCandidates(false);
    }
  };

  const send = async () => {
    if (!preparedBy || !approvedBy || preparedBy === approvedBy) {
      showToast?.("Seleccione quién elabora y quién aprueba (dos personas distintas)", "warning");
      return;
    }
    try {
      setSending(true);
      await startTiFti01SignatureWorkflow({ year: safeYear, prepared_by_user_id: Number(preparedBy), approved_by_user_id: Number(approvedBy) });
      showToast?.("F.TI-01 enviado a firma. Cada firmante lo verá en sus firmas pendientes.", "success");
      setModalOpen(false);
    } catch (error) {
      showToast?.(error?.response?.data?.message || "No se pudo enviar el F.TI-01 a firma", "error");
    } finally {
      setSending(false);
    }
  };

  const signerSelect = (label, value, onChange) => (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={loadingCandidates || sending}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:border-slate-400"
      >
        <option value="">{loadingCandidates ? "Cargando…" : "Selecciona un usuario"}</option>
        {candidates.map((user) => <option key={user.id} value={user.id}>{user.fullname || user.name || user.email}</option>)}
      </select>
    </label>
  );

  return (
    <div className={className || "flex flex-wrap gap-2"}>
      <button type="button" onClick={download} disabled={downloading} className={`${buttonClass} border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100`}>
        {downloading ? <FiRefreshCw size={13} className="animate-spin" /> : <FiDownload size={13} />}
        {downloading ? "Generando…" : "Descargar F.TI-01"}
      </button>
      {canSign && (
        <button type="button" onClick={openSignModal} className={`${buttonClass} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
          <FiEdit3 size={13} /> Enviar F.TI-01 a firma
        </button>
      )}
      <Modal open={modalOpen} onClose={() => !sending && setModalOpen(false)} title={`Enviar F.TI-01 ${safeYear} a firma`}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Firman quien elabora y quien aprueba, en cualquier orden. Sus nombres quedan en el bloque de firmas y cada firma se ubica sobre su nombre.
          </p>
          {signerSelect("Elaborado por", preparedBy, setPreparedBy)}
          {signerSelect("Aprobado por", approvedBy, setApprovedBy)}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} disabled={sending} className={`${buttonClass} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
              Cancelar
            </button>
            <button type="button" onClick={send} disabled={sending} className={`${buttonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}>
              {sending ? <FiRefreshCw size={13} className="animate-spin" /> : <FiEdit3 size={13} />}
              {sending ? "Enviando…" : "Enviar a firma"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TiFti01Actions;
