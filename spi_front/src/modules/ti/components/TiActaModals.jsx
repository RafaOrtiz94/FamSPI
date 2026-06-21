import React, { useEffect, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import Modal from "../../../core/ui/components/Modal";
import { useUI } from "../../../core/ui/UIContext";
import { updateTiActa } from "../../../core/api/tiAssetsApi";

const fieldCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
const labelCls = "text-xs font-semibold text-slate-500 block mb-1";

export function TiActaEditModal({ open, acta, onClose, onSaved }) {
  const { showToast } = useUI();
  const [recipientNombre, setRecipientNombre] = useState("");
  const [recipientCedula, setRecipientCedula] = useState("");
  const [recipientCargo, setRecipientCargo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !acta) return;
    setRecipientNombre(acta.recipient_nombre || "");
    setRecipientCedula(acta.recipient_cedula || "");
    setRecipientCargo(acta.recipient_cargo || "");
    setNotes(acta.notes || "");
    setItems((acta.items || []).map((item) => ({
      id: item.id || null,
      item_type: item.item_type || "equipo",
      asset_id: item.asset_id ?? null,
      accessory_id: item.accessory_id ?? null,
      name: item.name || "",
      brand_model: item.brand_model || "",
      serial_imei: item.serial_imei || "",
      is_new: item.is_new,
      physical_condition: item.physical_condition ?? "",
      observations: item.observations || "",
    })));
  }, [open, acta]);

  const addItem = () => setItems((current) => [
    ...current,
    { id: null, item_type: "equipo", asset_id: null, accessory_id: null, name: "", brand_model: "", serial_imei: "", is_new: null, physical_condition: "", observations: "" },
  ]);

  const setItem = (index, key, value) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  const removeItem = (index) => setItems((current) => current.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!acta?.id) return;
    if (!recipientNombre.trim()) return showToast("Ingresa el nombre del colaborador", "warning");
    if (!recipientCedula.trim()) return showToast("Ingresa la cédula del colaborador", "warning");
    if (!recipientCargo.trim()) return showToast("Ingresa el cargo del colaborador", "warning");
    if (!items.length) return showToast("Agrega al menos un ítem", "warning");
    if (items.some((item) => !String(item.name || "").trim())) return showToast("Todos los ítems deben tener nombre", "warning");

    setSaving(true);
    try {
      await updateTiActa(acta.id, {
        recipient_nombre: recipientNombre.trim(),
        recipient_cedula: recipientCedula.trim(),
        recipient_cargo: recipientCargo.trim(),
        notes: notes.trim() || null,
        items: items.map((item) => ({
          item_type: item.item_type || "equipo",
          asset_id: item.asset_id,
          accessory_id: item.accessory_id,
          name: item.name.trim(),
          brand_model: item.brand_model?.trim() || null,
          serial_imei: item.serial_imei?.trim() || null,
          is_new: item.is_new === null || item.is_new === "" ? null : item.is_new === true || item.is_new === "true",
          physical_condition: item.physical_condition === "" ? null : Number(item.physical_condition),
          observations: item.observations?.trim() || null,
        })),
      });
      showToast("Acta TI actualizada correctamente", "success");
      await onSaved?.();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el acta TI", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title="Editar acta TI" maxWidth="max-w-4xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">TI</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${acta?.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{acta?.tipo}</span>
            {acta?.acta_code && <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono text-slate-500">{acta.acta_code}</span>}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Corrige cédula, cargo y los ítems documentales del acta TI. Si el acta ya fue firmada, el backend bloqueará la edición.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre completo *</label>
            <input value={recipientNombre} onChange={(e) => setRecipientNombre(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Cédula *</label>
            <input value={recipientCedula} onChange={(e) => setRecipientCedula(e.target.value)} className={`${fieldCls} font-mono`} />
          </div>
          <div>
            <label className={labelCls}>Cargo *</label>
            <input value={recipientCargo} onChange={(e) => setRecipientCargo(e.target.value)} className={fieldCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notas</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldCls} placeholder="Opcional..." />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ítems del acta</span>
            <button type="button" onClick={addItem} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97]">
              <span className="inline-flex items-center gap-1"><FiPlus size={12} /> Agregar ítem</span>
            </button>
          </div>

          {items.map((item, index) => (
            <div key={`${item.id || "nuevo"}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">Ítem {index + 1}</p>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(index)} className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 active:scale-[0.97]">
                    <FiX size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select value={item.item_type} onChange={(e) => setItem(index, "item_type", e.target.value)} className={fieldCls}>
                    <option value="equipo">Equipo</option>
                    <option value="accesorio">Accesorio</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Condición física (1-10)</label>
                  <input type="number" min="1" max="10" value={item.physical_condition} onChange={(e) => setItem(index, "physical_condition", e.target.value)} className={fieldCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Nombre *</label>
                  <input value={item.name} onChange={(e) => setItem(index, "name", e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Marca / Modelo</label>
                  <input value={item.brand_model} onChange={(e) => setItem(index, "brand_model", e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Serie / IMEI</label>
                  <input value={item.serial_imei} onChange={(e) => setItem(index, "serial_imei", e.target.value)} className={`${fieldCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Estado</label>
                  <select value={item.is_new === null ? "" : String(item.is_new)} onChange={(e) => setItem(index, "is_new", e.target.value)} className={fieldCls}>
                    <option value="">Sin definir</option>
                    <option value="true">Nuevo</option>
                    <option value="false">Usado</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Observaciones</label>
                  <input value={item.observations} onChange={(e) => setItem(index, "observations", e.target.value)} className={fieldCls} placeholder="Opcional..." />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} disabled={saving} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="cursor-pointer rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function TiWorkflowStartModal({ open, acta, users = [], submitting, onClose, onSubmit }) {
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => { if (open) setSelectedIds([]); }, [open]);

  const toggle = (id) => setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
  );

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[30] flex items-center justify-center bg-[#0F172A]/60">
      <div className="z-[40] w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.10)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[17px] font-semibold text-[#1F2937]">Iniciar firma FamSign</h2>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              {acta?.acta_code || `Acta #${acta?.id}`} — {acta?.tipo === "retiro" ? "Retiro" : "Entrega"} de activos TI
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors">
            <FiX size={16} />
          </button>
        </div>
        <p className="text-[12px] text-[#6B7280] mb-3">Selecciona los firmantes para este documento:</p>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {users.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No hay usuarios disponibles</p>}
          {users.map((u) => (
            <label key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 cursor-pointer hover:bg-slate-100 transition-colors">
              <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggle(u.id)} className="rounded" />
              <div>
                <p className="text-xs font-medium text-slate-800">{u.nombre} {u.apellido}</p>
                <p className="text-[10px] text-slate-400">{u.email}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} disabled={submitting} className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={() => onSubmit(selectedIds)} disabled={submitting || !selectedIds.length} className="cursor-pointer rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? "Iniciando..." : "Iniciar flujo"}
          </button>
        </div>
      </div>
    </div>
  );
}
