import React, { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiPlus, FiShield, FiRefreshCw, FiX } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import { updateTiActa } from "../../../core/api/tiAssetsApi";
import { validateSignerProfiles } from "../../../core/api/signatureWorkflowsApi";

const fieldCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
const labelCls = "text-xs font-semibold text-slate-500 block mb-1";

export const WORKFLOW_ROLE_OPTIONS = [
  { value: "colaborador_receptor", label: "Colaborador receptor" },
  { value: "ingeniero_ti", label: "Ingeniero de TICS" },
  { value: "responsable_activos", label: "Responsable de Activos Fijos" },
  { value: "talento_humano", label: "Talento Humano" },
  { value: "gerencia_general", label: "Gerencia General" },
  { value: "firmante", label: "Firmante" },
];

// Firmantes fijos del módulo TI — orden de firma
const TI_DEFAULT_SIGNERS = [
  { email: "rafael.ortiz@fam-project.com", role: "ingeniero_ti" },
  { email: "soledad.fiallos@fam-project.com", role: "responsable_activos" },
];

export function buildWorkflowSignerDraft(user = null, role = "firmante") {
  return {
    selectedUserId: user?.id ? String(user.id) : "",
    role,
    isRequired: true,
  };
}

// ── Modal edición de datos del receptor ──────────────────────────────────────

function _toDateInputValue(acta) {
  if (!acta) return "";
  if (acta.acta_year && acta.acta_month && acta.acta_day) {
    const y = acta.acta_year;
    const m = String(acta.acta_month).padStart(2, "0");
    const d = String(acta.acta_day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (acta.generated_at) return String(acta.generated_at).slice(0, 10);
  return "";
}

export function TiActaEditModal({ open, acta, onClose, onSaved }) {
  const { showToast } = useUI();
  const [recipientNombre, setRecipientNombre] = useState("");
  const [recipientCedula, setRecipientCedula] = useState("");
  const [recipientCargo, setRecipientCargo] = useState("");
  const [actaDate, setActaDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !acta) return;
    setRecipientNombre(acta.recipient_nombre || "");
    setRecipientCedula(acta.recipient_cedula || "");
    setRecipientCargo(acta.recipient_cargo || "");
    setActaDate(_toDateInputValue(acta));
  }, [open, acta]);

  const handleSave = async () => {
    if (!acta?.id) return;
    if (!recipientNombre.trim()) return showToast("Ingresa el nombre del colaborador", "warning");
    if (!recipientCedula.trim()) return showToast("Ingresa la cédula del colaborador", "warning");
    if (!recipientCargo.trim()) return showToast("Ingresa el cargo del colaborador", "warning");
    if (!actaDate) return showToast("Ingresa la fecha de entrega", "warning");

    setSaving(true);
    try {
      await updateTiActa(acta.id, {
        recipient_nombre: recipientNombre.trim(),
        recipient_cedula: recipientCedula.trim(),
        recipient_cargo: recipientCargo.trim(),
        acta_date: actaDate,
      });
      showToast("Datos del acta actualizados", "success");
      await onSaved?.();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el acta", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Editar datos del receptor" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">TI</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${acta?.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{acta?.tipo}</span>
            {acta?.acta_code && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono text-slate-500">{acta.acta_code}</span>}
          </div>
          <p className="text-xs text-slate-500">
            Corrige nombre, cédula, cargo y fecha de entrega. Los equipos asignados no se modifican.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Nombre completo *</label>
            <input value={recipientNombre} onChange={(e) => setRecipientNombre(e.target.value)} className={fieldCls} placeholder="Nombre del colaborador" />
          </div>
          <div>
            <label className={labelCls}>Cédula *</label>
            <input value={recipientCedula} onChange={(e) => setRecipientCedula(e.target.value)} className={`${fieldCls} font-mono`} placeholder="0000000000" />
          </div>
          <div>
            <label className={labelCls}>Cargo *</label>
            <input value={recipientCargo} onChange={(e) => setRecipientCargo(e.target.value)} className={fieldCls} placeholder="Cargo del colaborador" />
          </div>
          <div>
            <label className={labelCls}>Fecha de entrega *</label>
            <input type="date" value={actaDate} onChange={(e) => setActaDate(e.target.value)} className={fieldCls} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal inicio workflow FamSign (TI actas) ─────────────────────────────────

export function TiWorkflowStartModal({ open, acta, users = [], submitting, onClose, onSubmit }) {
  const { showToast } = useUI();
  const [signers, setSigners] = useState([buildWorkflowSignerDraft()]);
  const [profileWarnings, setProfileWarnings] = useState([]);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProfileWarnings([]);

    const drafts = [];

    // 1. Colaborador receptor (usuario al que se le asignó el equipo)
    if (acta?.recipient_user_id) {
      const recipient = users.find((u) => String(u.id) === String(acta.recipient_user_id));
      if (recipient) {
        drafts.push({ selectedUserId: String(recipient.id), role: "colaborador_receptor", isRequired: true });
      }
    }

    // 2. Firmantes fijos del módulo TI (Ingeniero TI + Responsable Activos)
    const usedIds = new Set(drafts.map((d) => d.selectedUserId));
    for (const fixed of TI_DEFAULT_SIGNERS) {
      const user = users.find((u) => u.email === fixed.email);
      if (user && !usedIds.has(String(user.id))) {
        drafts.push({ selectedUserId: String(user.id), role: fixed.role, isRequired: true });
        usedIds.add(String(user.id));
      }
    }

    setSigners(drafts.length > 0 ? drafts : [buildWorkflowSignerDraft()]);
  }, [open, acta, users]);

  const setSigner = (index, patch) => {
    setProfileWarnings([]);
    setSigners((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const addSigner = () => {
    setProfileWarnings([]);
    setSigners((current) => [...current, buildWorkflowSignerDraft()]);
  };

  const removeSigner = (index) => {
    setProfileWarnings([]);
    setSigners((current) => current.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!signers.length) {
      showToast("Agrega al menos un firmante", "warning");
      return;
    }

    const seenIds = new Set();
    let payloadSigners;
    try {
      payloadSigners = signers.map((signer, index) => {
        const user = users.find((u) => String(u.id) === String(signer.selectedUserId || ""));
        if (!user?.email) throw new Error(`Firmante ${index + 1}: selecciona un usuario válido`);
        if (seenIds.has(String(user.id))) throw new Error(`Firmante ${index + 1}: el usuario ya fue seleccionado`);
        seenIds.add(String(user.id));
        return {
          user_id: user.id,
          email: user.email,
          name: user.fullname || user.name || user.email,
          role: signer.role || "firmante",
          sequence_order: index + 1,
          is_required: signer.isRequired !== false,
        };
      });
    } catch (err) {
      showToast(err.message, "warning");
      return;
    }

    setValidating(true);
    setProfileWarnings([]);
    try {
      const userIds = payloadSigners.map((s) => s.user_id);
      const incomplete = await validateSignerProfiles(userIds);
      if (incomplete.length > 0) {
        setProfileWarnings(incomplete);
        return;
      }
    } catch {
      // Si el endpoint falla, continuar
    } finally {
      setValidating(false);
    }

    onSubmit?.(payloadSigners);
  };

  return (
    <Modal open={open} onClose={(submitting || validating) ? undefined : onClose} title="Iniciar firma FamSign" maxWidth="max-w-2xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">TI</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${acta?.tipo === "retiro" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
              {acta?.tipo === "retiro" ? "Devolución" : "Entrega"}
            </span>
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-mono text-slate-600">{acta?.acta_code || `#${acta?.id || ""}`}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Selecciona el orden de firma. El workflow solo se enviará a los usuarios elegidos aquí.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Firmantes</p>
              <p className="text-xs text-slate-500">El orden de la lista define la secuencia de firma.</p>
            </div>
            <button type="button" onClick={addSigner} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors active:scale-[0.97]">
              Agregar firmante
            </button>
          </div>

          {signers.map((signer, index) => (
            <div key={`${signer.selectedUserId || "new"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Firmante {index + 1}</p>
                <button type="button" onClick={() => removeSigner(index)} disabled={submitting || signers.length === 1}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                  Quitar
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelCls}>Usuario</span>
                  <select value={signer.selectedUserId} onChange={(e) => setSigner(index, { selectedUserId: e.target.value })} className={fieldCls} disabled={submitting}>
                    <option value="">Selecciona un usuario</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {(u.fullname || u.name || u.email)}{u.role ? ` · ${u.role}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Rol documental</span>
                  <select value={signer.role} onChange={(e) => setSigner(index, { role: e.target.value })} className={fieldCls} disabled={submitting}>
                    {WORKFLOW_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={signer.isRequired !== false} onChange={(e) => setSigner(index, { isRequired: e.target.checked })}
                  disabled={submitting} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200" />
                Firma obligatoria
              </label>
            </div>
          ))}
        </div>

        {profileWarnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <FiAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-amber-800">
                  Ficha incompleta — solicita a Talento Humano completar los datos antes de continuar
                </p>
                <ul className="mt-2 space-y-1.5">
                  {profileWarnings.map((w) => (
                    <li key={w.user_id} className="text-amber-700">
                      <span className="font-medium">{w.fullname || w.email}</span>
                      {" — faltan: "}
                      <span className="font-medium">{w.missing.join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={submitting || validating}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors active:scale-[0.97] disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || validating || profileWarnings.length > 0}
            className="cursor-pointer flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
            {validating ? <><FiRefreshCw size={14} className="animate-spin" /> Validando fichas...</>
              : submitting ? <><FiRefreshCw size={14} className="animate-spin" /> Iniciando...</>
              : <><FiShield size={14} /> Iniciar firma colectiva</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
