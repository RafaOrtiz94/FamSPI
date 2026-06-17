import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle, FiBarChart2, FiCalendar, FiCheck, FiChevronDown,
  FiChevronRight, FiChevronUp, FiCpu, FiDownload, FiFileText,
  FiPackage, FiPlus, FiRefreshCw, FiSearch, FiUploadCloud, FiX,
} from "react-icons/fi";
import { useUI } from "../../../core/ui/UIContext";
import { getUsers } from "../../../core/api/usersApi";
import {
  listCollabCatalog, createCollabCatalogItem,
  listCollabDeliveries,
  withdrawCollabDelivery,
  listCollabActasByDelivery, getCollabActaPdf,
  uploadCollabSignedActa, listCollabRenewals, completeCollabRenewal,
  listCollabDeliveryEvents,
  listCollabSessions, createCollabSession, getCollabSession,
  createCollabTiSession,
} from "../../../core/api/collabDeliveriesApi";
import { listTiAssets, createTiAsset } from "../../../core/api/tiAssetsApi";

// ── Constantes ────────────────────────────────────────────────────────────────

const COLLAB_CATEGORIES = ["ropa", "herramienta", "logistica"];
const CATEGORY_LABELS = {
  ropa: "Ropa de trabajo", herramienta: "Herramientas de trabajo",
  logistica: "Logística", ti: "Herramientas de comunicación",
};
const CATEGORY_COLORS = {
  ropa:        "bg-slate-100 text-slate-600 border-slate-200",
  herramienta: "bg-amber-50 text-amber-700 border-amber-100",
  logistica:   "bg-blue-100 text-blue-700 border-blue-200",
  ti:          "bg-violet-50 text-violet-700 border-violet-200",
};
const STATUS_COLORS = {
  entregado: "bg-green-50 text-green-700",
  retirado:  "bg-slate-100 text-slate-500",
  perdido:   "bg-red-50 text-red-700",
  dañado:    "bg-amber-50 text-amber-700",
};
const TI_STATUS_LABELS = {
  disponible: "Disponible", asignado: "Asignado", mantenimiento: "Mantenimiento",
  baja: "Dado de baja", extraviado: "Extraviado",
};
const TI_STATUS_COLORS = {
  disponible:    "bg-green-50 text-green-700",
  asignado:      "bg-blue-50 text-blue-700",
  mantenimiento: "bg-amber-50 text-amber-700",
  baja:          "bg-red-50 text-red-600",
  extraviado:    "bg-red-100 text-red-800",
};

// ── Micro-componentes ─────────────────────────────────────────────────────────

const Badge = ({ className, children }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}>{children}</span>
);

const CategoryBadge = ({ category }) => (
  <Badge className={CATEGORY_COLORS[category] || "bg-slate-100 text-slate-600 border-slate-200"}>
    {CATEGORY_LABELS[category] || category}
  </Badge>
);

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] || "bg-slate-100 text-slate-600"}`}>
    {status}
  </span>
);

const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold text-slate-400 mb-3">{children}</p>
);

const EmptyState = ({ icon: Icon, message }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <Icon size={28} className="text-slate-200 mb-2" />
    <p className="text-sm text-slate-400">{message}</p>
  </div>
);

const RenewalBadge = ({ date }) => {
  if (!date) return null;
  const days = Math.ceil((new Date(date) - new Date()) / 86400000);
  const color = days < 0 ? "bg-red-50 text-red-700" : days <= 30 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      <FiCalendar size={9} />
      {days < 0 ? `Vencida ${Math.abs(days)}d` : days === 0 ? "Vence hoy" : `${days}d`}
    </span>
  );
};

const fieldCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none";
const labelCls = "text-xs font-semibold text-slate-500 block mb-1";

// ── Modal crear sesión (multi-paso) ───────────────────────────────────────────

const EMPTY_ITEM = { catalog_item_id: "", serial_number: "", physical_condition: "", observations: "", renewal_date: "", attributes: {} };

function SessionModal({ catalog, users, tiAssets, onSave, onClose }) {
  const { showToast } = useUI();
  const [step, setStep]           = useState(1); // 1=tipo, 2=colaborador, 3=ítems
  const [sessionType, setType]    = useState(""); // ropa|herramienta|logistica|ti
  const [userId, setUserId]       = useState("");
  const [sessionDate, setDate]    = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo]           = useState("entrega");
  const [notes, setNotes]         = useState("");
  const [items, setItems]         = useState([{ ...EMPTY_ITEM }]);
  const [tiSelected, setTiSel]    = useState([]); // asset ids for TI session
  const [tiSearch, setTiSearch]   = useState("");
  const [saving, setSaving]       = useState(false);

  const isTi = sessionType === "ti";
  const catCatalog = useMemo(() => catalog.filter((c) => c.category === sessionType && c.active !== false), [catalog, sessionType]);

  const addItem = () => setItems((p) => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const setItem = (i, key, val) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, [key]: val } : it));
  const setAttr = (i, key, val) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, attributes: { ...it.attributes, [key]: val } } : it));

  const toggleTi = (id) => setTiSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const filteredTi = useMemo(() => {
    const q = tiSearch.toLowerCase();
    return tiAssets.filter((a) =>
      (a.nombre || a.name || "").toLowerCase().includes(q) ||
      (a.marca || "").toLowerCase().includes(q) ||
      (a.numero_serie || "").toLowerCase().includes(q) ||
      (a.codigo || "").toLowerCase().includes(q),
    ).slice(0, 50);
  }, [tiAssets, tiSearch]);

  const validate = () => {
    if (!sessionType) return "Selecciona tipo de sesión";
    if (!userId) return "Selecciona colaborador";
    if (isTi) { if (!tiSelected.length) return "Selecciona al menos un activo TI"; }
    else {
      for (const [i, it] of items.entries()) {
        if (!it.catalog_item_id) return `Ítem ${i + 1}: selecciona del catálogo`;
        const cat = catalog.find((c) => String(c.id) === String(it.catalog_item_id));
        if (cat?.requires_serial && !it.serial_number.trim()) return `Ítem ${i + 1}: requiere número de serie`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) return showToast(err, "warning");
    setSaving(true);
    try {
      let result;
      if (isTi) {
        result = await createCollabTiSession({
          user_id: Number(userId), session_date: sessionDate, tipo, notes: notes || null,
          asset_ids: tiSelected,
        });
      } else {
        result = await createCollabSession({
          user_id: Number(userId), category: sessionType, session_date: sessionDate, tipo, notes: notes || null,
          items: items.map((it) => ({
            catalog_item_id: Number(it.catalog_item_id),
            serial_number: it.serial_number || null,
            physical_condition: it.physical_condition ? Number(it.physical_condition) : null,
            observations: it.observations || null,
            renewal_date: it.renewal_date || null,
            attributes: it.attributes || {},
          })),
        });
      }
      showToast("Sesión creada correctamente", "success");
      onSave(result);
    } catch (e) {
      showToast(e?.response?.data?.message || "Error al crear la sesión", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-base font-semibold text-slate-900">Nueva sesión de entrega</p>
            <p className="text-xs text-slate-400 mt-0.5">Paso {step} de 3 — {step === 1 ? "Tipo de sesión" : step === 2 ? "Colaborador y fecha" : "Ítems a entregar"}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <FiX size={16} />
          </button>
        </div>

        {/* Indicador de pasos */}
        <div className="flex px-6 pt-4 gap-2 shrink-0">
          {[1,2,3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${step > s ? "bg-green-500 border-green-500 text-white" : step === s ? "border-blue-600 text-blue-600" : "border-slate-200 text-slate-400"}`}>
                {step > s ? <FiCheck size={12} /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-green-400" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-5">

          {/* Paso 1: Tipo */}
          {step === 1 && (
            <div className="space-y-3">
              <SectionLabel>¿Qué tipo de entrega es esta sesión?</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "ropa",        icon: FiPackage,  desc: "Uniformes, EPP, calzado de seguridad" },
                  { key: "herramienta", icon: FiPackage,  desc: "Herramientas manuales y eléctricas" },
                  { key: "logistica",   icon: FiPackage,  desc: "Mochilas, candados, accesorios" },
                  { key: "ti",          icon: FiCpu,      desc: "Celulares, laptops, tablets, equipos TI" },
                ].map(({ key, icon: Icon, desc }) => (
                  <button key={key} type="button" onClick={() => setType(key)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${sessionType === key ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <Icon size={18} className={sessionType === key ? "text-blue-600 mb-2" : "text-slate-400 mb-2"} />
                    <p className={`text-sm font-semibold ${sessionType === key ? "text-blue-700" : "text-slate-800"}`}>{CATEGORY_LABELS[key]}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <label className={labelCls}>Tipo de operación</label>
                <div className="flex gap-3">
                  {["entrega","retiro"].map((t) => (
                    <label key={t} className={`flex items-center gap-2 cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${tipo === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
                      <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} className="sr-only" />
                      {t === "entrega" ? "Entrega" : "Retiro"}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Paso 2: Colaborador y fecha */}
          {step === 2 && (
            <div className="space-y-4">
              <SectionLabel>Datos del colaborador y fecha</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Colaborador *</label>
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} className={fieldCls}>
                    <option value="">Selecciona...</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Fecha de {tipo}</label>
                  <input type="date" value={sessionDate} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Notas de sesión</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional..." className={fieldCls} />
                </div>
              </div>
            </div>
          )}

          {/* Paso 3: Ítems collab */}
          {step === 3 && !isTi && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Ítems a incluir en la sesión</SectionLabel>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                  <FiPlus size={12} /> Agregar ítem
                </button>
              </div>
              {items.map((it, i) => {
                const sel = catCatalog.find((c) => String(c.id) === String(it.catalog_item_id));
                const attrKeys = sel?.attribute_schema ? Object.keys(sel.attribute_schema) : [];
                return (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-slate-500">Ítem {i + 1}</p>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="rounded-lg p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <FiX size={12} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Ítem del catálogo *</label>
                        <select value={it.catalog_item_id} onChange={(e) => setItem(i, "catalog_item_id", e.target.value)} className={fieldCls}>
                          <option value="">Selecciona...</option>
                          {catCatalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {sel?.requires_serial && (
                        <div>
                          <label className={labelCls}>N° de serie *</label>
                          <input type="text" value={it.serial_number} onChange={(e) => setItem(i, "serial_number", e.target.value)} placeholder="Ej: SN-ABC123" className={fieldCls} />
                        </div>
                      )}
                      {sel?.requires_condition && (
                        <div>
                          <label className={labelCls}>Condición (1-10)</label>
                          <input type="number" min="1" max="10" value={it.physical_condition} onChange={(e) => setItem(i, "physical_condition", e.target.value)} className={fieldCls} />
                        </div>
                      )}
                      {attrKeys.map((key) => (
                        <div key={key}>
                          <label className={labelCls}>{key.replace(/_/g, " ")}</label>
                          <input type="text" value={it.attributes[key] || ""} onChange={(e) => setAttr(i, key, e.target.value)} className={fieldCls} />
                        </div>
                      ))}
                      <div>
                        <label className={labelCls}>Fecha de renovación</label>
                        <input type="date" value={it.renewal_date} onChange={(e) => setItem(i, "renewal_date", e.target.value)} className={fieldCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Observaciones</label>
                        <input type="text" value={it.observations} onChange={(e) => setItem(i, "observations", e.target.value)} placeholder="Opcional..." className={fieldCls} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                Se generará <span className="font-semibold text-slate-700">una sola acta</span> con todos estos ítems para la categoría <span className="font-semibold text-slate-700">{CATEGORY_LABELS[sessionType]}</span>.
              </div>
            </div>
          )}

          {/* Paso 3: Activos TI */}
          {step === 3 && isTi && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <SectionLabel>Selecciona los activos TI a entregar</SectionLabel>
                <span className="text-xs font-semibold text-blue-600">{tiSelected.length} seleccionado{tiSelected.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="relative">
                <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm focus:border-slate-400 focus:bg-white focus:outline-none"
                  placeholder="Buscar por nombre, marca, serie, código..." value={tiSearch} onChange={(e) => setTiSearch(e.target.value)} />
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden max-h-64 overflow-y-auto">
                {filteredTi.length === 0 ? (
                  <p className="text-xs text-slate-400 p-4 text-center">Sin activos disponibles</p>
                ) : filteredTi.map((a) => {
                  const isSelected = tiSelected.includes(a.id);
                  const isAvailable = a.status === "disponible";
                  return (
                    <label key={a.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${isSelected ? "bg-blue-50" : isAvailable ? "hover:bg-slate-50" : "opacity-50 cursor-not-allowed"}`}>
                      <input type="checkbox" checked={isSelected} disabled={!isAvailable && !isSelected}
                        onChange={() => isAvailable || isSelected ? toggleTi(a.id) : null} className="rounded" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.nombre || a.name}</p>
                        <p className="text-xs text-slate-500">{a.marca} {a.modelo} · {a.numero_serie || a.codigo}</p>
                      </div>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${TI_STATUS_COLORS[a.status] || "bg-slate-100 text-slate-500"}`}>
                        {TI_STATUS_LABELS[a.status] || a.status}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                Se generará <span className="font-semibold text-slate-700">una acta de herramientas de comunicación</span> cubriendo todos los activos seleccionados.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button type="button" onClick={() => step > 1 ? setStep((s) => s - 1) : onClose()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            {step === 1 ? "Cancelar" : "Atrás"}
          </button>
          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button type="button"
                onClick={() => {
                  if (step === 1 && !sessionType) return showToast("Selecciona un tipo de sesión", "warning");
                  if (step === 2 && !userId) return showToast("Selecciona un colaborador", "warning");
                  setStep((s) => s + 1);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]">
                Siguiente <FiChevronRight size={14} />
              </button>
            ) : (
              <button type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors active:scale-[0.97]">
                <FiCheck size={14} /> {saving ? "Creando..." : "Crear sesión y acta"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detalle de sesión ─────────────────────────────────────────────────────────

function SessionDetail({ sessionId, onClose }) {
  const { showToast } = useUI();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    setLoading(true);
    getCollabSession(sessionId)
      .then(setData)
      .catch(() => showToast("No se pudo cargar la sesión", "error"))
      .finally(() => setLoading(false));
  }, [sessionId, showToast]);

  const handleDownload = async (actaId) => {
    try {
      const res = await getCollabActaPdf(actaId);
      if (res?.drive_url) window.open(res.drive_url, "_blank");
      else showToast(res?.message || "Template no disponible aún", "info");
    } catch { showToast("No disponible", "info"); }
  };

  const handleUpload = async (actaId, file) => {
    setUploading(actaId);
    try {
      await uploadCollabSignedActa(actaId, file);
      showToast("Acta firmada subida", "success");
      const updated = await getCollabSession(sessionId);
      setData(updated);
    } catch (e) {
      showToast(e?.response?.data?.message || "Error al subir el acta", "error");
    } finally { setUploading(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><FiRefreshCw size={20} className="animate-spin text-slate-400" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Header sesión */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CategoryBadge category={data.category} />
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${data.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{data.tipo}</span>
          </div>
          <p className="text-base font-semibold text-slate-900 mt-1">{data.collaborator_name}</p>
          <p className="text-xs text-slate-500">{data.session_date?.slice(0, 10)} · {data.delivery_count} ítem{data.delivery_count !== 1 ? "s" : ""}</p>
          {data.notes && <p className="text-xs text-slate-500 italic mt-0.5">{data.notes}</p>}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 transition-colors">
            <FiX size={16} />
          </button>
        )}
      </div>

      {/* Ítems */}
      <div className="border-t border-slate-100 pt-4">
        <SectionLabel>Ítems de la sesión ({data.deliveries?.length || 0})</SectionLabel>
        <div className="space-y-2">
          {(data.deliveries || []).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{d.item_name}</p>
                {d.serial_number && <p className="text-xs font-mono text-slate-400">{d.serial_number}</p>}
                {d.renewal_date && <RenewalBadge date={d.renewal_date} />}
              </div>
              <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${STATUS_COLORS[d.status] || "bg-slate-100 text-slate-600"}`}>{d.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actas */}
      <div className="border-t border-slate-100 pt-4">
        <SectionLabel>Actas ({data.actas?.length || 0})</SectionLabel>
        {!data.actas?.length ? (
          <p className="text-xs text-slate-400 py-2 text-center">Sin actas</p>
        ) : (
          <div className="space-y-2">
            {data.actas.map((acta) => (
              <div key={acta.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${acta.tipo === "entrega" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{acta.tipo}</span>
                    <span className="text-xs font-mono text-slate-500">{acta.acta_code}</span>
                    {acta.is_complete
                      ? <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700"><FiCheck size={9} /> Firmada</span>
                      : <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Pendiente</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(acta.generated_at).toLocaleDateString("es-EC")} · {acta.items?.length || 0} ítems</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => handleDownload(acta.id)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50 transition-colors">
                    <FiDownload size={10} /> PDF
                  </button>
                  {!acta.is_complete && (
                    <label className="cursor-pointer">
                      <span className={`flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100 transition-colors ${uploading === acta.id ? "opacity-50 cursor-wait" : ""}`}>
                        {uploading === acta.id ? <FiRefreshCw size={10} className="animate-spin" /> : <FiUploadCloud size={10} />} Subir firmada
                      </span>
                      <input type="file" accept=".pdf" className="hidden" disabled={uploading !== null}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(acta.id, f); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab Activos TI ────────────────────────────────────────────────────────────

function TiAssetsTab({ tiAssets, users, onRefresh }) {
  const { showToast } = useUI();
  const [search, setSearch]         = useState("");
  const [statusF, setStatusF]       = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedAsset, setSelected] = useState(null);
  const [creating, setCreating]     = useState(false);
  const [form, setForm] = useState({
    nombre: "", marca: "", modelo: "", numero_serie: "", tipo_activo: "",
    valor_adquisicion: "", fecha_adquisicion: new Date().toISOString().slice(0, 10),
    estado: "disponible", ubicacion: "",
  });

  const setF = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tiAssets.filter((a) =>
      (!statusF || a.status === statusF || a.estado === statusF) &&
      (!q || (a.nombre || a.name || "").toLowerCase().includes(q) ||
        (a.marca || "").toLowerCase().includes(q) ||
        (a.numero_serie || "").toLowerCase().includes(q) ||
        (a.tipo_activo || a.tipo || "").toLowerCase().includes(q)),
    );
  }, [tiAssets, search, statusF]);

  const handleCreate = async () => {
    if (!form.nombre.trim()) return showToast("El nombre es requerido", "warning");
    setCreating(true);
    try {
      await createTiAsset(form);
      showToast("Activo TI creado", "success");
      setShowCreate(false);
      setForm({ nombre: "", marca: "", modelo: "", numero_serie: "", tipo_activo: "", valor_adquisicion: "", fecha_adquisicion: new Date().toISOString().slice(0, 10), estado: "disponible", ubicacion: "" });
      onRefresh();
    } catch (e) { showToast(e?.response?.data?.message || "Error al crear activo", "error"); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-4">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            placeholder="Buscar activo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 focus:outline-none">
          <option value="">Todos los estados</option>
          {Object.entries(TI_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button type="button" onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
          {showCreate ? <FiChevronUp size={14} /> : <FiPlus size={14} />} Nuevo activo
        </button>
      </div>

      {/* Formulario crear activo */}
      {showCreate && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Crear activo TI</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nombre *</label>
              <input type="text" value={form.nombre} onChange={setF("nombre")} placeholder="Ej: Laptop Dell" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <input type="text" value={form.tipo_activo} onChange={setF("tipo_activo")} placeholder="laptop, celular, tablet..." className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Marca</label>
              <input type="text" value={form.marca} onChange={setF("marca")} placeholder="Dell, Apple, Samsung..." className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Modelo</label>
              <input type="text" value={form.modelo} onChange={setF("modelo")} placeholder="Ej: Latitude 5520" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>N° de serie</label>
              <input type="text" value={form.numero_serie} onChange={setF("numero_serie")} placeholder="Ej: SN-12345" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Valor adquisición</label>
              <input type="number" value={form.valor_adquisicion} onChange={setF("valor_adquisicion")} placeholder="0.00" className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha adquisición</label>
              <input type="date" value={form.fecha_adquisicion} onChange={setF("fecha_adquisicion")} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Ubicación</label>
              <input type="text" value={form.ubicacion} onChange={setF("ubicacion")} placeholder="Bodega, oficina..." className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Estado inicial</label>
              <select value={form.estado} onChange={setF("estado")} className={fieldCls}>
                {Object.entries(TI_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
            <button type="button" onClick={handleCreate} disabled={creating}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <FiCheck size={14} /> {creating ? "Guardando..." : "Crear activo"}
            </button>
          </div>
        </div>
      )}

      {/* Grid de activos */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Lista */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-auto max-h-[520px]">
          {filtered.length === 0 ? (
            <EmptyState icon={FiCpu} message="Sin activos TI registrados" />
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <button key={a.id} type="button" onClick={() => setSelected(selectedAsset?.id === a.id ? null : a)}
                  className={`w-full px-4 py-3 text-left transition-colors ${selectedAsset?.id === a.id ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{a.nombre || a.name}</p>
                      <p className="text-xs text-slate-500 truncate">{a.marca} {a.modelo}</p>
                      {a.numero_serie && <p className="text-xs font-mono text-slate-400">{a.numero_serie}</p>}
                    </div>
                    <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${TI_STATUS_COLORS[a.status || a.estado] || "bg-slate-100 text-slate-500"}`}>
                      {TI_STATUS_LABELS[a.status || a.estado] || a.status || a.estado}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle activo seleccionado */}
        <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
          {!selectedAsset ? (
            <EmptyState icon={FiCpu} message="Selecciona un activo para ver los detalles" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{selectedAsset.nombre || selectedAsset.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedAsset.marca} {selectedAsset.modelo} · {selectedAsset.tipo_activo || selectedAsset.tipo}</p>
                </div>
                <span className={`text-xs font-semibold rounded-full px-3 py-1 shrink-0 ${TI_STATUS_COLORS[selectedAsset.status || selectedAsset.estado] || "bg-slate-100 text-slate-500"}`}>
                  {TI_STATUS_LABELS[selectedAsset.status || selectedAsset.estado] || selectedAsset.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {selectedAsset.numero_serie && <div><p className="text-xs text-slate-400">N° de serie</p><p className="font-mono text-slate-800">{selectedAsset.numero_serie}</p></div>}
                {selectedAsset.codigo && <div><p className="text-xs text-slate-400">Código</p><p className="font-mono text-slate-800">{selectedAsset.codigo}</p></div>}
                {selectedAsset.valor_adquisicion && <div><p className="text-xs text-slate-400">Valor</p><p className="text-slate-800">${Number(selectedAsset.valor_adquisicion).toLocaleString("es-EC", { minimumFractionDigits: 2 })}</p></div>}
                {selectedAsset.fecha_adquisicion && <div><p className="text-xs text-slate-400">Adquisición</p><p className="text-slate-800">{selectedAsset.fecha_adquisicion?.slice(0, 10)}</p></div>}
                {selectedAsset.ubicacion && <div><p className="text-xs text-slate-400">Ubicación</p><p className="text-slate-800">{selectedAsset.ubicacion}</p></div>}
                {selectedAsset.assigned_to_name && <div><p className="text-xs text-slate-400">Asignado a</p><p className="text-slate-800">{selectedAsset.assigned_to_name}</p></div>}
              </div>
              {(selectedAsset.status === "disponible" || selectedAsset.estado === "disponible") && (
                <button type="button" onClick={() => setShowAssign(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]">
                  <FiFileText size={14} /> Crear sesión de entrega TI
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal asignación rápida TI desde activo seleccionado */}
      {showAssign && selectedAsset && (
        <QuickTiAssignModal
          asset={selectedAsset}
          users={users}
          onSave={() => { setShowAssign(false); setSelected(null); onRefresh(); }}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}

// ── Modal asignación TI rápida (desde detalle de activo) ─────────────────────

function QuickTiAssignModal({ asset, users, onSave, onClose }) {
  const { showToast } = useUI();
  const [userId, setUserId] = useState("");
  const [notes, setNotes]   = useState("");
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!userId) return showToast("Selecciona un colaborador", "warning");
    setSaving(true);
    try {
      await createCollabTiSession({
        user_id: Number(userId), session_date: date, tipo: "entrega",
        notes: notes || null, asset_ids: [asset.id],
      });
      showToast("Activo asignado y acta generada", "success");
      onSave();
    } catch (e) { showToast(e?.response?.data?.message || "Error al asignar", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-900">Asignar {asset.nombre || asset.name}</p>
          <button type="button" onClick={onClose} className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 transition-colors"><FiX size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Colaborador *</label>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={fieldCls}>
              <option value="">Selecciona...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullname || u.name || u.email}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Fecha de entrega</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional..." className={fieldCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <FiCheck size={14} /> {saving ? "Asignando..." : "Asignar y crear acta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

const CollabDeliveriesFinancieroPage = () => {
  const { showToast } = useUI();

  const [loading, setLoading]   = useState(false);
  const [catalog, setCatalog]   = useState([]);
  const [users, setUsers]       = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [tiAssets, setTiAssets] = useState([]);

  const [activeTab, setActiveTab]     = useState("sesiones");
  const [showModal, setShowModal]     = useState(false);
  const [selectedSession, setSession] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, usr, ren, sess, ti] = await Promise.all([
        listCollabCatalog(),
        getUsers(),
        listCollabRenewals({ dueDays: 60 }),
        listCollabSessions(),
        listTiAssets(),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setUsers(Array.isArray(usr) ? usr : []);
      setRenewals(Array.isArray(ren) ? ren : []);
      setSessions(Array.isArray(sess) ? sess : []);
      setTiAssets(Array.isArray(ti) ? ti : []);
    } catch {
      showToast("No se pudo cargar la información", "error");
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const stats = useMemo(() => {
    const activas   = sessions.filter((s) => s.delivery_count > 0).length;
    const sinFirma  = sessions.reduce((a, s) => a + Number(s.actas_pending || 0), 0);
    const renovVenc = renewals.filter((r) => new Date(r.scheduled_date) < new Date()).length;
    const renovProx = renewals.filter((r) => { const d = Math.ceil((new Date(r.scheduled_date) - new Date()) / 86400000); return d >= 0 && d <= 30; }).length;
    return { activas, sinFirma, renovVenc, renovProx, totalTi: tiAssets.length };
  }, [sessions, renewals, tiAssets]);

  const handleCompleteRenewal = async (id, status) => {
    try {
      await completeCollabRenewal(id, { status });
      showToast(status === "completed" ? "Renovación completada" : "Cancelada", "success");
      await loadAll();
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
  };

  const [newCatForm, setNewCatForm] = useState({ category: "ropa", name: "", description: "", requires_serial: false, requires_condition: false });
  const [savingCat, setSavingCat] = useState(false);
  const handleSaveCatalog = async () => {
    if (!newCatForm.name.trim()) return showToast("El nombre es requerido", "warning");
    setSavingCat(true);
    try {
      await createCollabCatalogItem(newCatForm);
      showToast("Ítem agregado al catálogo", "success");
      setNewCatForm({ category: "ropa", name: "", description: "", requires_serial: false, requires_condition: false });
      const updated = await listCollabCatalog();
      setCatalog(Array.isArray(updated) ? updated : []);
    } catch (e) { showToast(e?.response?.data?.message || "Error", "error"); }
    finally { setSavingCat(false); }
  };

  const TABS = [
    { key: "sesiones",     label: "Sesiones",        icon: FiFileText },
    { key: "ti",           label: "Activos TI",       icon: FiCpu },
    { key: "renovaciones", label: "Renovaciones",     icon: FiCalendar, badge: stats.renovVenc },
    { key: "catalogo",     label: "Catálogo",         icon: FiBarChart2 },
  ];

  return (
    <div className="flex min-w-0 flex-col space-y-5 p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Entregas a Colaboradores</h1>
          <p className="text-xs text-slate-500 mt-0.5">Ropa · Herramientas · Logística · Activos TI</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={loadAll} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
          <button type="button" onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors active:scale-[0.97]">
            <FiPlus size={14} /> Nueva sesión
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="flex flex-wrap sm:flex-nowrap sm:divide-x divide-slate-100">
          {[
            { label: "Sesiones",         value: loading ? "—" : sessions.length,    color: "text-slate-800" },
            { label: "Actas pendientes", value: loading ? "—" : stats.sinFirma,     color: stats.sinFirma > 0 ? "text-amber-600" : "text-slate-800" },
            { label: "Renov. vencidas",  value: loading ? "—" : stats.renovVenc,    color: stats.renovVenc > 0 ? "text-red-600" : "text-slate-800" },
            { label: "Renov. próximas",  value: loading ? "—" : stats.renovProx,    color: "text-slate-800" },
            { label: "Activos TI",       value: loading ? "—" : stats.totalTi,      color: "text-slate-800" },
          ].map((k, i) => (
            <div key={k.label} className={`flex-1 min-w-[50%] sm:min-w-0 px-4 py-3 ${i > 0 && i % 2 === 0 ? "border-t border-slate-100 sm:border-t-0" : i === 1 ? "border-l border-slate-100 sm:border-l-0" : ""}`}>
              {(k.color.includes("amber") || k.color.includes("red")) && <FiAlertTriangle size={12} className={`${k.color} mb-0.5`} />}
              <p className="text-xs text-slate-400">{k.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button key={key} type="button" onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            <Icon size={14} /> {label}
            {badge > 0 && <span className="ml-1 rounded-full bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5">{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Tab: Sesiones ────────────────────────────────────────────────────── */}
      {activeTab === "sesiones" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Lista de sesiones */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500">Historial de sesiones</p>
              <span className="text-xs text-slate-400">{sessions.length}</span>
            </div>
            <div className="flex-1 overflow-auto max-h-[560px]">
              {loading ? (
                <div className="flex items-center justify-center h-32"><FiRefreshCw size={18} className="animate-spin text-slate-300" /></div>
              ) : sessions.length === 0 ? (
                <EmptyState icon={FiFileText} message="Sin sesiones registradas" />
              ) : sessions.map((s) => (
                <button key={s.id} type="button" onClick={() => setSession(selectedSession?.id === s.id ? null : s)}
                  className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-0 transition-colors ${selectedSession?.id === s.id ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <CategoryBadge category={s.category} />
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.tipo === "entrega" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>{s.tipo}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">{s.collaborator_name}</p>
                      <p className="text-xs text-slate-400">{s.session_date?.slice(0, 10)} · {s.delivery_count} ítem{s.delivery_count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {s.actas_pending > 0 && (
                        <span className="rounded-full bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">{s.actas_pending} pendiente</span>
                      )}
                      <FiChevronRight size={14} className="text-slate-300" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detalle sesión */}
          <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5 overflow-auto max-h-[640px]">
            {!selectedSession ? (
              <EmptyState icon={FiFileText} message="Selecciona una sesión para ver los detalles" />
            ) : (
              <SessionDetail sessionId={selectedSession.id} onClose={() => setSession(null)} />
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Activos TI ──────────────────────────────────────────────────── */}
      {activeTab === "ti" && (
        <TiAssetsTab tiAssets={tiAssets} users={users} onRefresh={loadAll} />
      )}

      {/* ── Tab: Renovaciones ────────────────────────────────────────────────── */}
      {activeTab === "renovaciones" && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-5">
          <SectionLabel>Renovaciones próximas y vencidas (60 días)</SectionLabel>
          {renewals.length === 0 ? (
            <EmptyState icon={FiCalendar} message="Sin renovaciones próximas" />
          ) : (
            <div className="space-y-2">
              {renewals.map((r) => {
                const days = Math.ceil((new Date(r.scheduled_date) - new Date()) / 86400000);
                const color = days < 0 ? "border-red-100 bg-red-50" : days <= 7 ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-slate-50";
                return (
                  <div key={r.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${color}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.item_name} — {r.collaborator_name}</p>
                      <div className="flex items-center gap-2 mt-0.5"><CategoryBadge category={r.category} /></div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <RenewalBadge date={r.scheduled_date} />
                      <button type="button" onClick={() => handleCompleteRenewal(r.id, "completed")}
                        className="flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700 hover:bg-green-100 transition-colors">
                        <FiCheck size={10} /> Completar
                      </button>
                      <button type="button" onClick={() => handleCompleteRenewal(r.id, "cancelled")}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors">
                        <FiX size={10} /> Cancelar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Catálogo ────────────────────────────────────────────────────── */}
      {activeTab === "catalogo" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Agregar ítem al catálogo</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select value={newCatForm.category} onChange={(e) => setNewCatForm((p) => ({ ...p, category: e.target.value }))} className={fieldCls}>
                {COLLAB_CATEGORIES.map((v) => <option key={v} value={v}>{CATEGORY_LABELS[v]}</option>)}
              </select>
              <input value={newCatForm.name} onChange={(e) => setNewCatForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nombre del ítem *" className={fieldCls} />
              <input value={newCatForm.description} onChange={(e) => setNewCatForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descripción" className={fieldCls} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={newCatForm.requires_serial} onChange={(e) => setNewCatForm((p) => ({ ...p, requires_serial: e.target.checked }))} className="rounded" />
                Requiere N° de serie
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={newCatForm.requires_condition} onChange={(e) => setNewCatForm((p) => ({ ...p, requires_condition: e.target.checked }))} className="rounded" />
                Requiere condición (1-10)
              </label>
              <button type="button" onClick={handleSaveCatalog} disabled={savingCat}
                className="ml-auto flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                <FiPlus size={14} /> {savingCat ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {COLLAB_CATEGORIES.map((cat) => (
              <div key={cat} className="rounded-xl border border-slate-200 bg-white p-4">
                <CategoryBadge category={cat} />
                <div className="mt-3 space-y-1.5">
                  {catalog.filter((c) => c.category === cat).map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700 truncate">{c.name}</span>
                      <div className="flex gap-1 shrink-0">
                        {c.requires_serial    && <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1">serie</span>}
                        {c.requires_condition && <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1">cond.</span>}
                      </div>
                    </div>
                  ))}
                  {!catalog.filter((c) => c.category === cat).length && <p className="text-xs text-slate-400">Sin ítems</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal nueva sesión */}
      {showModal && (
        <SessionModal
          catalog={catalog} users={users} tiAssets={tiAssets}
          onSave={() => { setShowModal(false); loadAll(); }}
          onClose={() => setShowModal(false)}
        />
      )}

    </div>
  );
};

export default CollabDeliveriesFinancieroPage;
