import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiChevronUp,
  FiClock,
  FiCpu,
  FiDownload,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { useUI } from "../../../core/ui/UIContext";
import { getUsers } from "../../../core/api/usersApi";
import {
  assignTiAsset,
  clearTiMaintenance,
  completeTiMaintenance,
  createTiAsset,
  createTiMaintenance,
  downloadTiMaintenanceReport,
  generateTiMaintenanceFuture,
  generateTiMaintenanceReport,
  getTiAssetAssignmentsHistory,
  getTiAssetHistory,
  listTiAssets,
  listTiMaintenance,
  listTiMaintenanceReports,
  refreshTiMaintenanceSchedule,
  requestTiMaintenanceDelivery,
  setTiMaintenanceCoordinationDate,
  updateTiAsset,
  updateTiAssetStatus,
} from "../../../core/api/tiAssetsApi";

const STATUS_LABELS = {
  unassigned: "Sin asignar",
  assigned: "Asignado",
  damaged: "Dañado",
  in_maintenance: "En mantenimiento",
  retired: "Dado de baja",
  available: "Disponible",
};

const STATUS_COLORS = {
  unassigned: "bg-slate-100 text-slate-600",
  assigned: "bg-blue-50 text-blue-700",
  damaged: "bg-red-50 text-red-700",
  in_maintenance: "bg-amber-50 text-amber-700",
  retired: "bg-slate-200 text-slate-500",
  available: "bg-green-50 text-green-700",
};

const MAINTENANCE_STATUS_LABELS = {
  pending: "Pendiente",
  completed: "Completado",
  overdue: "Vencido",
};

const EMPTY_FORM = {
  name: "",
  brand: "",
  model: "",
  serial_number: "",
  imei: "",
  purchase_date: "",
  characteristics: "",
  maintenance_frequency_months: 12,
};

const Label = ({ children, required }) => (
  <span className="block text-xs font-medium text-slate-500 mb-1">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </span>
);

const FieldInput = ({ label, required, ...props }) => (
  <div>
    <Label required={required}>{label}</Label>
    <input
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
      {...props}
    />
  </div>
);

const DepreciationBar = ({ pct, days }) => {
  if (pct === null || pct === undefined) return null;
  const color =
    pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-500">Depreciación acumulada</span>
        <span
          className={`text-xs font-semibold ${
            pct >= 90
              ? "text-red-600"
              : pct >= 60
              ? "text-amber-600"
              : "text-emerald-600"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {years > 0 ? `${years}a ` : ""}
        {months > 0 ? `${months}m` : days === 0 ? "Recién adquirido" : `${days % 30}d`}
        {" · "}
        {pct >= 100 ? "Totalmente depreciado" : `Residual ${(100 - pct).toFixed(1)}%`}
      </p>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      STATUS_COLORS[status] || "bg-slate-100 text-slate-600"
    }`}
  >
    {STATUS_LABELS[status] || status}
  </span>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-3">
    {Icon && <Icon size={14} className="text-slate-400" />}
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </span>
  </div>
);

const TIDeviceManagementPage = () => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState([]);
  const [users, setUsers] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [assignmentsHistory, setAssignmentsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [year] = useState(new Date().getFullYear());
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editFields, setEditFields] = useState({});
  const [assignUserId, setAssignUserId] = useState("");
  const [newStatus, setNewStatus] = useState("unassigned");
  const [coordinationDates, setCoordinationDates] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [showManualForm, setShowManualForm] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportPeriodType, setReportPeriodType] = useState("annual");
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [manualForm, setManualForm] = useState({
    asset_id: "",
    tipo: "Preventivo",
    fecha_programada: "",
    responsable: "",
    observaciones: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [assetsRows, usersRows, maintRows] = await Promise.all([
        listTiAssets(),
        getUsers(),
        listTiMaintenance({ year }),
      ]);
      setAssets(Array.isArray(assetsRows) ? assetsRows : []);
      setUsers(Array.isArray(usersRows) ? usersRows : []);
      const safeMaintenance = Array.isArray(maintRows) ? maintRows : [];
      setMaintenance(safeMaintenance);
      setCoordinationDates(
        safeMaintenance.reduce((acc, item) => {
          acc[item.id] = item.coordinated_withdrawal_date
            ? String(item.coordinated_withdrawal_date).slice(0, 10)
            : "";
          return acc;
        }, {})
      );
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cargar activos TI", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, year]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selected = useMemo(
    () => assets.find((a) => String(a.id) === String(selectedId || "")) || null,
    [assets, selectedId]
  );

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(q) ||
        (a.brand || "").toLowerCase().includes(q) ||
        (a.model || "").toLowerCase().includes(q) ||
        (a.serial_number || "").toLowerCase().includes(q) ||
        (a.assigned_to_name || "").toLowerCase().includes(q)
    );
  }, [assets, search]);

  const loadHistory = async (assetId) => {
    setHistoryLoading(true);
    try {
      const [rows, assignmentRows] = await Promise.all([
        getTiAssetHistory(assetId),
        getTiAssetAssignmentsHistory(assetId),
      ]);
      setHistory(rows);
      setAssignmentsHistory(assignmentRows);
    } catch (_e) {
      setHistory([]);
      setAssignmentsHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectAsset = (a) => {
    setSelectedId(a.id);
    setNewStatus(a.status || "unassigned");
    setAssignUserId(a.assigned_to_user_id ? String(a.assigned_to_user_id) : "");
    setEditFields({
      name: a.name || "",
      brand: a.brand || "",
      model: a.model || "",
      serial_number: a.serial_number || "",
      imei: a.imei || "",
      purchase_date: a.purchase_date ? String(a.purchase_date).slice(0, 10) : "",
      characteristics: a.characteristics || "",
      maintenance_frequency_months: a.maintenance_frequency_months || 12,
    });
    loadHistory(a.id);
  };

  const setField = (key) => (e) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const setEditField = (key) => (e) =>
    setEditFields((p) => ({ ...p, [key]: e.target.value }));

  const createAsset = async () => {
    if (!form.name.trim()) return showToast("El nombre es requerido", "warning");
    if (!form.serial_number.trim())
      return showToast("El número de serie es requerido", "warning");
    if (!form.purchase_date)
      return showToast("La fecha de compra es requerida", "warning");
    setSaving(true);
    try {
      await createTiAsset(form);
      showToast("Activo creado correctamente", "success");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo crear el activo", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveAsset = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTiAsset(selected.id, editFields);
      showToast("Activo actualizado", "success");
      await loadAll();
      loadHistory(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar", "error");
    } finally {
      setSaving(false);
    }
  };

  const doAssign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await assignTiAsset(selected.id, {
        assigned_to_user_id: assignUserId ? Number(assignUserId) : null,
      });
      showToast(assignUserId ? "Equipo asignado" : "Asignación liberada", "success");
      await loadAll();
      loadHistory(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar asignación", "error");
    } finally {
      setSaving(false);
    }
  };

  const doStatus = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateTiAssetStatus(selected.id, { status: newStatus });
      showToast("Estado actualizado", "success");
      await loadAll();
      loadHistory(selected.id);
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo cambiar estado", "error");
    } finally {
      setSaving(false);
    }
  };

  const generateSchedules = async () => {
    setSaving(true);
    try {
      const result = await generateTiMaintenanceFuture();
      const created = result?.created_count || 0;
      const existing = result?.skipped_existing || 0;
      showToast(
        created > 0
          ? `${created} nuevo${created !== 1 ? "s" : ""} registro${created !== 1 ? "s" : ""} generado${created !== 1 ? "s" : ""} para ${result?.assets || 0} equipos`
          : `Cronograma al día: ${existing} registro${existing !== 1 ? "s" : ""} existente${existing !== 1 ? "s" : ""}, sin cambios`,
        created > 0 ? "success" : "info"
      );
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo generar los cronogramas", "error");
    } finally {
      setSaving(false);
    }
  };

  const refreshSchedules = async () => {
    setSaving(true);
    try {
      const result = await refreshTiMaintenanceSchedule();
      const created = result?.created_count || 0;
      showToast(
        created > 0
          ? `Cronograma actualizado: ${created} nuevo${created !== 1 ? "s" : ""} registro${created !== 1 ? "s" : ""} agregado${created !== 1 ? "s" : ""}`
          : "Cronograma al día, sin cambios pendientes",
        created > 0 ? "success" : "info"
      );
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo actualizar el cronograma", "error");
    } finally {
      setSaving(false);
    }
  };

  const completeMaintenanceRow = async (id) => {
    setSaving(true);
    try {
      await completeTiMaintenance(id, {});
      showToast("Mantenimiento completado", "success");
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo completar el mantenimiento",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const requestMaintenanceDelivery = async (id) => {
    setSaving(true);
    try {
      const result = await requestTiMaintenanceDelivery(id);
      showToast(
        `Notificado al asignado: entrega del ${result?.delivery_from_date || "-"} al ${result?.delivery_to_date || "-"}`,
        "success"
      );
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo notificar la entrega del equipo",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const clearMaintenanceSchedule = async () => {
    setSaving(true);
    try {
      const result = await clearTiMaintenance();
      showToast(`Cronogramas eliminados: ${result?.deleted_count || 0}`, "success");
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudieron eliminar los cronogramas",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const saveCoordinationDate = async (id) => {
    const coordinated = String(coordinationDates[id] || "").trim();
    if (!coordinated) return showToast("Ingresa fecha de coordinación de retiro", "warning");
    setSaving(true);
    try {
      await setTiMaintenanceCoordinationDate(id, {
        coordinated_withdrawal_date: coordinated,
      });
      showToast("Fecha de coordinación guardada", "success");
      await loadAll();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo guardar la fecha de coordinación",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const rows = await listTiMaintenanceReports();
      setReports(Array.isArray(rows) ? rows : []);
    } catch (_e) {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const result = await generateTiMaintenanceReport(
        reportPeriodType === "monthly"
          ? { period_type: "monthly", year: reportYear, month: reportMonth }
          : { period_type: "annual", year: reportYear }
      );
      showToast(`Informe generado · SHA-256: ${String(result?.sha256 || "").slice(0, 16)}…`, "success");
      await loadReports();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo generar el informe", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const createManualMaintenance = async () => {
    if (!manualForm.asset_id || !manualForm.fecha_programada) {
      showToast("Selecciona equipo y fecha", "warning");
      return;
    }
    setSaving(true);
    try {
      await createTiMaintenance({
        asset_id: Number(manualForm.asset_id),
        planned_date: manualForm.fecha_programada,
        notes: [
          manualForm.tipo,
          manualForm.responsable ? `Responsable: ${manualForm.responsable}` : null,
          manualForm.observaciones,
        ]
          .filter(Boolean)
          .join(" | "),
      });
      showToast("Mantenimiento programado", "success");
      setManualForm({ asset_id: "", tipo: "Preventivo", fecha_programada: "", responsable: "", observaciones: "" });
      setShowManualForm(false);
      await loadAll();
    } catch (error) {
      showToast(error?.response?.data?.message || "No se pudo programar el mantenimiento", "error");
    } finally {
      setSaving(false);
    }
  };

  const filteredMaintenance = useMemo(() => {
    if (deviceFilter === "all") return maintenance;
    return maintenance.filter((m) => {
      const hay = String(m.asset_name || "").toLowerCase();
      if (deviceFilter === "computadora") return hay.includes("comput") || hay.includes("laptop") || hay.includes("pc");
      if (deviceFilter === "celular") return hay.includes("cel") || hay.includes("movil") || hay.includes("phone");
      return true;
    });
  }, [maintenance, deviceFilter]);

  const monthStart = useMemo(
    () => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1),
    [calendarMonth]
  );
  const calendarDays = useMemo(() => {
    const start = new Date(monthStart);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    const days = [];
    for (let i = 0; i < 42; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monthStart]);
  const maintenanceByDate = useMemo(() => {
    const map = {};
    maintenance.forEach((m) => {
      const key = String(m.planned_date || "").slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [maintenance]);

  const dep = selected
    ? {
        pct: selected.depreciation_pct,
        days: selected.depreciation_days,
      }
    : null;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Activos TI</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {assets.length} equipo{assets.length !== 1 ? "s" : ""} registrado
            {assets.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={loadAll}
            icon={FiRefreshCw}
          >
            Recargar
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={showCreate ? FiChevronUp : FiPlus}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancelar" : "Nuevo equipo"}
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-800 mb-4">Registrar nuevo equipo</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FieldInput
              label="Nombre del equipo"
              required
              placeholder="Ej: Laptop Dell"
              value={form.name}
              onChange={setField("name")}
            />
            <FieldInput
              label="Marca"
              placeholder="Ej: Dell, HP, Apple"
              value={form.brand}
              onChange={setField("brand")}
            />
            <FieldInput
              label="Modelo"
              placeholder="Ej: Latitude 5420"
              value={form.model}
              onChange={setField("model")}
            />
            <FieldInput
              label="Número de serie"
              required
              placeholder="Ej: SN-123456789"
              value={form.serial_number}
              onChange={setField("serial_number")}
            />
            <FieldInput
              label="IMEI (opcional)"
              placeholder="Solo para equipos móviles"
              value={form.imei}
              onChange={setField("imei")}
            />
            <div>
              <Label required>Fecha de compra</Label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                value={form.purchase_date}
                onChange={setField("purchase_date")}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <Label>Características</Label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                placeholder="RAM, disco, procesador, etc."
                value={form.characteristics}
                onChange={setField("characteristics")}
              />
            </div>
            <div>
              <Label>Frecuencia de mantenimiento (meses)</Label>
              <input
                type="number"
                min={1}
                max={24}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                value={form.maintenance_frequency_months}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    maintenance_frequency_months: Number(e.target.value || 12),
                  }))
                }
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="primary"
              icon={FiPlus}
              disabled={saving}
              onClick={createAsset}
            >
              Registrar equipo
            </Button>
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Asset List */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <FiSearch
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                placeholder="Buscar por nombre, serie o usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-1.5 max-h-[500px]">
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
            ) : filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FiCpu size={28} className="text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">
                  {search ? "Sin resultados" : "No hay equipos registrados"}
                </p>
              </div>
            ) : (
              filteredAssets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleSelectAsset(a)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    String(selectedId) === String(a.id)
                      ? "border-slate-300 bg-slate-50 shadow-sm"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {a.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {[a.brand, a.model].filter(Boolean).join(" · ") || "Sin especificar"}
                      </p>
                      {a.serial_number && (
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {a.serial_number}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {a.assigned_to_name || "Sin asignación"}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {a.depreciation_pct !== null && a.depreciation_pct !== undefined && (
                    <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          a.depreciation_pct >= 90
                            ? "bg-red-400"
                            : a.depreciation_pct >= 60
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.min(a.depreciation_pct, 100)}%` }}
                      />
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
              <FiCpu size={36} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">
                Selecciona un equipo para ver sus detalles
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {selected.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[selected.brand, selected.model].filter(Boolean).join(" · ") ||
                      "Sin especificar"}
                  </p>
                </div>
                <StatusBadge status={selected.status} />
              </div>

              {/* Depreciation */}
              {dep?.pct !== null && dep?.pct !== undefined && (
                <DepreciationBar pct={dep.pct} days={dep.days} />
              )}

              {/* Info section */}
              <div>
                <SectionTitle icon={FiCpu}>Información del equipo</SectionTitle>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldInput
                    label="Nombre"
                    required
                    value={editFields.name || ""}
                    onChange={setEditField("name")}
                  />
                  <FieldInput
                    label="Marca"
                    value={editFields.brand || ""}
                    onChange={setEditField("brand")}
                  />
                  <FieldInput
                    label="Modelo"
                    value={editFields.model || ""}
                    onChange={setEditField("model")}
                  />
                  <FieldInput
                    label="Número de serie"
                    required
                    value={editFields.serial_number || ""}
                    onChange={setEditField("serial_number")}
                  />
                  <FieldInput
                    label="IMEI (opcional)"
                    value={editFields.imei || ""}
                    onChange={setEditField("imei")}
                  />
                  <div>
                    <Label>Fecha de compra</Label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                      value={editFields.purchase_date || ""}
                      onChange={setEditField("purchase_date")}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldInput
                      label="Características"
                      placeholder="RAM, disco, procesador, etc."
                      value={editFields.characteristics || ""}
                      onChange={setEditField("characteristics")}
                    />
                  </div>
                  <div>
                    <Label>Frec. mantenimiento (meses)</Label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                      value={editFields.maintenance_frequency_months || 12}
                      onChange={(e) =>
                        setEditFields((p) => ({
                          ...p,
                          maintenance_frequency_months: Number(e.target.value || 12),
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={FiCheck}
                    disabled={saving}
                    onClick={saveAsset}
                  >
                    Guardar cambios
                  </Button>
                </div>
              </div>

              {/* Assignment */}
              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiUser}>Asignación</SectionTitle>
                <div className="flex gap-2">
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                  >
                    <option value="">Sin asignación</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullname || u.name || u.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={doAssign}
                  >
                    {assignUserId ? "Asignar" : "Liberar"}
                  </Button>
                </div>
              </div>

              {/* Status */}
              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiAlertCircle}>Estado del equipo</SectionTitle>
                <div className="flex gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:bg-white focus:outline-none transition-colors"
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={doStatus}
                  >
                    Actualizar
                  </Button>
                </div>
              </div>

              {/* History */}
              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiClock}>Historial de eventos</SectionTitle>
                <div className="max-h-48 overflow-auto rounded-xl border border-slate-100 bg-slate-50">
                  {historyLoading ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Cargando...
                    </p>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Sin eventos registrados
                    </p>
                  ) : (
                    history.map((h, i) => (
                      <div
                        key={h.id}
                        className={`px-3 py-2.5 text-xs ${
                          i < history.length - 1 ? "border-b border-slate-100" : ""
                        }`}
                      >
                        <p className="font-medium text-slate-700">{h.event_type}</p>
                        {h.notes && (
                          <p className="text-slate-500 mt-0.5">{h.notes}</p>
                        )}
                        <p className="text-slate-400 mt-0.5">
                          {new Date(h.created_at).toLocaleString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle icon={FiUser}>Historial de asignación</SectionTitle>
                <div className="max-h-56 overflow-auto rounded-xl border border-slate-100 bg-slate-50">
                  {historyLoading ? (
                    <p className="text-xs text-slate-400 text-center py-4">Cargando...</p>
                  ) : assignmentsHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Sin movimientos de asignación
                    </p>
                  ) : (
                    assignmentsHistory.map((a, i) => (
                      <div
                        key={a.id}
                        className={`px-3 py-2.5 text-xs ${i < assignmentsHistory.length - 1 ? "border-b border-slate-100" : ""}`}
                      >
                        <p className="font-medium text-slate-700">
                          {a.action === "unassign"
                            ? `Liberado por ${a.created_by_name || "usuario"}`
                            : `Asignado a ${a.assigned_to_name || "usuario"} por ${a.created_by_name || "usuario"}`}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          Antes: {a.previous_user_name || "Sin asignación"} · Ahora: {a.assigned_to_name || "Sin asignación"}
                        </p>
                        {a.reason ? <p className="text-slate-500 mt-0.5">Motivo: {a.reason}</p> : null}
                        <p className="text-slate-400 mt-0.5">
                          {new Date(a.created_at).toLocaleString("es-EC", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Maintenance Schedule */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FiCalendar size={15} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-800">Cronograma de mantenimiento</span>
            <span className="text-xs text-slate-400">
              ({filteredMaintenance.length} de {maintenance.length})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="primary" icon={FiCalendar} disabled={saving} onClick={generateSchedules}>
              Generar cronogramas
            </Button>
            <Button type="button" variant="secondary" icon={FiRefreshCw} disabled={saving} onClick={refreshSchedules}>
              Actualizar cronograma
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={showManualForm ? FiChevronUp : FiPlus}
              disabled={saving}
              onClick={() => setShowManualForm((v) => !v)}
            >
              {showManualForm ? "Cancelar" : "Programar manual"}
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={clearMaintenanceSchedule}>
              Eliminar todo
            </Button>
          </div>
        </div>

        {/* Manual maintenance form */}
        {showManualForm && (
          <div className="p-5 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              Programar mantenimiento individual
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label required>Equipo</Label>
                <select
                  value={manualForm.asset_id}
                  onChange={(e) => setManualForm((p) => ({ ...p, asset_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none transition-colors"
                >
                  <option value="">Selecciona equipo</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}{a.brand ? ` · ${a.brand}` : ""}{a.model ? ` ${a.model}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Tipo</Label>
                <select
                  value={manualForm.tipo}
                  onChange={(e) => setManualForm((p) => ({ ...p, tipo: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none transition-colors"
                >
                  <option value="Preventivo">Preventivo</option>
                  <option value="Correctivo">Correctivo</option>
                </select>
              </div>
              <div>
                <Label required>Fecha programada</Label>
                <input
                  type="date"
                  value={manualForm.fecha_programada}
                  onChange={(e) => setManualForm((p) => ({ ...p, fecha_programada: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <Label>Responsable</Label>
                <input
                  type="text"
                  placeholder="Nombre del responsable"
                  value={manualForm.responsable}
                  onChange={(e) => setManualForm((p) => ({ ...p, responsable: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <Label>Observaciones</Label>
                <input
                  type="text"
                  placeholder="Notas adicionales"
                  value={manualForm.observaciones}
                  onChange={(e) => setManualForm((p) => ({ ...p, observaciones: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="primary" icon={FiCheck} disabled={saving} onClick={createManualMaintenance}>
                Confirmar programación
              </Button>
            </div>
          </div>
        )}

        {/* Device type filter */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
          <span className="text-xs text-slate-400 mr-1">Filtrar:</span>
          {[
            { key: "all", label: "Todos" },
            { key: "computadora", label: "Computadoras" },
            { key: "celular", label: "Celulares" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setDeviceFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                deviceFilter === f.key
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {filteredMaintenance.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <FiCalendar size={28} className="text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">
                {maintenance.length === 0
                  ? `Sin cronogramas para ${year}. Usa "Generar cronogramas" para crearlos.`
                  : "Sin resultados para este filtro."}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-medium">Equipo</th>
                  <th className="px-4 py-3 text-left font-medium">Asignado a</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Cumple fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Coord. retiro</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha maxima</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaintenance.map((m) => {
                  const notesParts = String(m.notes || "").split("|").map((s) => s.trim());
                  const tipo = notesParts[0] || "Preventivo";
                  return (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{m.asset_name}</p>
                        {m.model && <p className="text-xs text-slate-400">{m.model}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{m.assigned_to_name || "Sin asignar"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          tipo === "Correctivo" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                        }`}>
                          {tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {new Date(m.planned_date).toLocaleDateString("es-EC", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                            value={coordinationDates[m.id] || ""}
                            onChange={(e) =>
                              setCoordinationDates((prev) => ({ ...prev, [m.id]: e.target.value }))
                            }
                          />
                          <Button type="button" variant="secondary" disabled={saving} onClick={() => saveCoordinationDate(m.id)}>
                            OK
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {m.max_due_date
                          ? new Date(m.max_due_date).toLocaleDateString("es-EC", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.status === "completed"
                              ? "bg-green-50 text-green-700"
                              : m.status === "overdue"
                              ? "bg-red-50 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {MAINTENANCE_STATUS_LABELS[m.status] || m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {m.status !== "completed" ? (
                          <div className="flex items-center gap-1.5">
                            <Button type="button" variant="secondary" disabled={saving} onClick={() => requestMaintenanceDelivery(m.id)}>
                              Solicitar entrega
                            </Button>
                            <Button type="button" variant="secondary" icon={FiCheck} disabled={saving} onClick={() => completeMaintenanceRow(m.id)}>
                              Completar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Completado</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-100 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Calendario mensual</h3>
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                Mes anterior
              </Button>
              <span className="text-sm text-slate-600 min-w-[140px] text-center">
                {monthStart.toLocaleDateString("es-EC", { month: "long", year: "numeric" })}
              </span>
              <Button type="button" variant="secondary" onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                Mes siguiente
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs text-slate-500 mb-2">
            {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((d) => (
              <div key={d} className="px-2 py-1 font-semibold">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const dayItems = maintenanceByDate[key] || [];
              const inMonth = d.getMonth() === monthStart.getMonth() && d.getFullYear() === monthStart.getFullYear();
              return (
                <div key={key} className={`min-h-[130px] rounded-xl border p-2 ${inMonth ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100"}`}>
                  <p className={`text-xs mb-1 ${inMonth ? "text-slate-700" : "text-slate-400"}`}>{d.getDate()}</p>
                  <div className="space-y-1.5">
                    {dayItems.slice(0, 2).map((item) => {
                      const notesParts = String(item.notes || "").split("|").map((s) => s.trim());
                      const tipo = notesParts[0] || "Preventivo";
                      const statusClass =
                        item.status === "completed"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : item.status === "overdue"
                          ? "bg-red-50 border-red-200 text-red-700"
                          : "bg-blue-50 border-blue-200 text-blue-700";
                      return (
                        <div key={item.id} className={`rounded-md border px-1.5 py-1 text-[11px] leading-tight ${statusClass}`}>
                          <p className="font-semibold truncate">{item.asset_name}</p>
                          <p className="truncate opacity-90">{item.model || "Sin modelo"} · {tipo}</p>
                          <p className="truncate opacity-90">Asignado: {item.assigned_to_name || "Sin asignar"}</p>
                          <p className="truncate opacity-90">Max: {item.max_due_date ? String(item.max_due_date).slice(0, 10) : "-"}</p>
                          <p className="truncate opacity-90">Retiro: {item.coordinated_withdrawal_date ? String(item.coordinated_withdrawal_date).slice(0, 10) : "Pendiente"}</p>
                        </div>
                      );
                    })}
                    {dayItems.length > 2 ? <div className="text-[11px] text-slate-500">+{dayItems.length - 2} mas</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reports */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FiFileText size={15} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-800">Informes de cronograma</span>
            <span className="text-xs text-slate-400">({reports.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={reportPeriodType}
              onChange={(e) => setReportPeriodType(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="annual">Anual</option>
              <option value="monthly">Mensual</option>
            </select>
            <input
              type="number"
              min={2020}
              max={2100}
              value={reportYear}
              onChange={(e) => setReportYear(Number(e.target.value || new Date().getFullYear()))}
              className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            />
            {reportPeriodType === "monthly" ? (
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(Number(e.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                ))}
              </select>
            ) : null}
            <Button
              type="button"
              variant="primary"
              icon={FiFileText}
              disabled={generatingReport}
              onClick={handleGenerateReport}
            >
              {generatingReport ? "Generando..." : "Generar informe"}
            </Button>
            <Button type="button" variant="secondary" icon={FiRefreshCw} onClick={loadReports}>
              Recargar
            </Button>
          </div>
        </div>

        {reportsLoading ? (
          <p className="text-sm text-slate-400 text-center py-8">Cargando informes...</p>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <FiFileText size={28} className="text-slate-200 mb-2" />
            <p className="text-sm text-slate-400">No hay informes generados. El sistema los genera automáticamente cada mes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-medium">Período</th>
                  <th className="px-4 py-3 text-left font-medium">Generado</th>
                  <th className="px-4 py-3 text-left font-medium">Por</th>
                  <th className="px-4 py-3 text-left font-medium">Equipos</th>
                  <th className="px-4 py-3 text-left font-medium">SHA-256</th>
                  <th className="px-4 py-3 text-left font-medium">Drive</th>
                  <th className="px-4 py-3 text-left font-medium">Descargar</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {String(r.period || "").match(/^\d{4}-\d{2}$/) ? `Mes ${r.period}` : `A�o ${r.period}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {new Date(r.generated_at).toLocaleString("es-EC", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.generated_by_name || "Sistema"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.assets_count ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                        title={r.sha256}
                        onClick={() => navigator.clipboard?.writeText(r.sha256)}
                      >
                        {String(r.sha256 || "").slice(0, 12)}…
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.drive_url ? (
                        <a
                          href={r.drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver en Drive
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">No disponible</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={String(r.period || "").match(/^\d{4}-\d{2}$/) ? downloadTiMaintenanceReport({ period_type: "monthly", year: Number(String(r.period).slice(0, 4)), month: Number(String(r.period).slice(5, 7)) }) : downloadTiMaintenanceReport({ period_type: "annual", year: Number(r.period) })}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
                      >
                        <FiDownload size={12} />
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TIDeviceManagementPage;


