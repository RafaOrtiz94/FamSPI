import React, { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiLayers,
  FiShield,
  FiUploadCloud,
  FiUser,
} from "react-icons/fi";
import toast from "react-hot-toast";
import {
  addExternalAccess,
  listAuditDocuments,
  listAuditSections,
  listExternalAccess,
  revokeExternalAccess,
  updateAuditStatus,
  uploadAuditDocument,
} from "../../core/api/auditPrepApi";
import useAuditStatus from "../../core/hooks/useAuditStatus";
import { useAuth } from "../../core/auth/AuthContext";

const toBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const base64 = typeof result === "string" ? result.split(",")[1] || result : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const Badge = ({ active }) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
  >
    {active ? <FiCheckCircle /> : <FiClock />} {active ? "Modo auditoría activo" : "Inactivo"}
  </span>
);

const UploadZone = ({ disabled, onSelect, inputId }) => {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${dragOver ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const [file] = Array.from(e.dataTransfer.files || []);
        if (file) onSelect(file);
      }}
      onClick={() => {
        if (disabled) return;
        if (inputId) document.getElementById(inputId)?.click();
      }}
    >
      <FiUploadCloud className="text-2xl text-blue-500" />
      <p className="mt-2 text-sm text-slate-600">
        Arrastra el archivo o haz clic para seleccionar (PDF, DOCX, PNG/JPG)
      </p>
      <input
        id={inputId}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const [file] = e.target.files || [];
          if (file) onSelect(file);
        }}
      />
    </div>
  );
};

const ExternalAuditors = ({ grants, onAdd, onRevoke }) => {
  const [form, setForm] = useState({ email: "", display_name: "", expires_at: "" });

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FiUser /> Auditores externos (máx. 2 activos)
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="correo@auditor.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Nombre (opcional)"
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
        />
        <input
          type="date"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={form.expires_at}
          onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
        />
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        onClick={() => onAdd(form, () => setForm({ email: "", display_name: "", expires_at: "" }))}
      >
        Agregar acceso
      </button>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {grants.map((g) => (
          <div key={g.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <div>
              <p className="font-semibold text-slate-800">{g.email}</p>
              <p className="text-xs text-slate-500">
                {g.display_name || "Invitado"} · Vence: {g.expires_at ? new Date(g.expires_at).toLocaleDateString() : "Sin fecha"}
              </p>
            </div>
            {g.active ? (
              <button
                className="text-xs font-semibold text-red-600"
                onClick={() => onRevoke(g.id)}
              >
                Revocar
              </button>
            ) : (
              <span className="text-xs text-slate-400">Revocado</span>
            )}
          </div>
        ))}
        {!grants.length && (
          <div className="px-3 py-2 text-sm text-slate-500">Sin auditores externos activos.</div>
        )}
      </div>
    </div>
  );
};

export default function AuditPrepPage() {
  const { user } = useAuth();
  const { status, refresh: refreshStatus } = useAuditStatus();
  const [sections, setSections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const role = (user?.role || "").toLowerCase();
  const canAdmin = ["admin_ti", "jefe_ti", "gerencia", "ti"].includes(role);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sectionsRes, docsRes, grantsRes] = await Promise.all([
        listAuditSections(),
        listAuditDocuments(),
        canAdmin ? listExternalAccess() : Promise.resolve({ grants: [] }),
      ]);
      setSections(sectionsRes.sections || []);
      setDocuments(docsRes.documents || []);
      setGrants(grantsRes.grants || []);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo cargar el módulo de auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const grouped = useMemo(() => {
    const groups = {};
    sections.forEach((s) => {
      const key = s.area || "general";
      groups[key] = groups[key] || [];
      groups[key].push(s);
    });
    return groups;
  }, [sections]);

  const documentsBySection = useMemo(() => {
    const map = {};
    documents.forEach((d) => {
      map[d.section_code] = map[d.section_code] || [];
      map[d.section_code].push(d);
    });
    return map;
  }, [documents]);

  const handleToggle = async (nextMode) => {
    if (!canAdmin) return;
    setSaving(true);
    try {
      await updateAuditStatus({
        audit_mode: nextMode,
        audit_start_date: status?.audit_start_date,
        audit_end_date: status?.audit_end_date,
      });
      await refreshStatus();
      toast.success(`Modo auditoría ${nextMode ? "activado" : "desactivado"}`);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo actualizar el modo de auditoría");
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = async (field, value) => {
    if (!canAdmin) return;
    setSaving(true);
    try {
      await updateAuditStatus({
        audit_mode: status?.audit_mode,
        audit_start_date: field === "audit_start_date" ? value : status?.audit_start_date,
        audit_end_date: field === "audit_end_date" ? value : status?.audit_end_date,
      });
      await refreshStatus();
      toast.success("Ventana de auditoría actualizada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo guardar las fechas");
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (section, file) => {
    try {
      const base64 = await toBase64(file);
      await uploadAuditDocument({
        section_code: section.code,
        file: { name: file.name, mimeType: file.type, content: base64 },
      });
      toast.success("Documento cargado");
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Error cargando documento");
    }
  };

  const handleAddExternal = async (form, onReset) => {
    if (!form.email) return toast.error("Correo requerido");
    try {
      await addExternalAccess(form);
      toast.success("Acceso otorgado");
      onReset();
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "No se pudo agregar");
    }
  };

  const handleRevoke = async (id) => {
    try {
      await revokeExternalAccess(id);
      toast.success("Acceso revocado");
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error("No se pudo revocar el acceso");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const active = status?.active;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Módulo de Auditorías</h1>
          <p className="text-sm text-slate-500">
            Preparación documental centralizada en Drive. Acceso controlado por TI.
          </p>
        </div>
        <Badge active={!!active} />
      </div>

      {canAdmin && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 p-4 text-white shadow-lg sm:grid-cols-4">
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-300">Control de ventana</p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="flex flex-col text-slate-200">
                Inicio
                <input
                  type="date"
                  className="mt-1 rounded-lg border border-slate-500 bg-transparent px-3 py-2 text-white"
                  value={status?.audit_start_date?.slice(0, 10) || ""}
                  onChange={(e) => handleDateChange("audit_start_date", e.target.value)}
                  disabled={saving}
                />
              </label>
              <label className="flex flex-col text-slate-200">
                Fin
                <input
                  type="date"
                  className="mt-1 rounded-lg border border-slate-500 bg-transparent px-3 py-2 text-white"
                  value={status?.audit_end_date?.slice(0, 10) || ""}
                  onChange={(e) => handleDateChange("audit_end_date", e.target.value)}
                  disabled={saving}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3 text-sm sm:col-span-2 sm:items-end">
            <p className="flex items-center gap-2 text-slate-200">
              <FiShield /> Solo admin_ti / jefe_ti pueden activar el módulo
            </p>
            <button
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold shadow ${active ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
              onClick={() => handleToggle(!active)}
              disabled={saving}
            >
              {active ? "Desactivar auditoría" : "Activar auditoría"}
            </button>
          </div>
        </div>
      )}

      {!active && !canAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-700">
          <FiAlertCircle className="text-xl" /> El módulo se habilitará cuando TI active el modo auditoría.
        </div>
      )}

      {Object.entries(grouped).map(([area, areaSections]) => (
        <div key={area} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <FiLayers /> {area.replace("_", " ").toUpperCase()}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {areaSections.map((section) => (
              <div key={section.code} className="rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{section.title}</p>
                    <p className="text-xs text-slate-500">{section.description || ""}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {documentsBySection[section.code]?.[0]?.status || "Pendiente"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {(documentsBySection[section.code] || []).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="truncate font-semibold text-slate-700">{doc.name}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">{doc.status}</span>
                    </div>
                  ))}
                  <UploadZone
                    disabled={!active}
                    onSelect={(file) => handleUpload(section, file)}
                    inputId={`audit-upload-${section.code}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {canAdmin && (
        <ExternalAuditors grants={grants} onAdd={handleAddExternal} onRevoke={handleRevoke} />
      )}
    </div>
  );
}
