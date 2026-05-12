import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiBox,
  FiCalendar,
  FiCheckCircle,
  FiCpu,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiTool,
} from "react-icons/fi";
import {
  getEquipmentAssets,
  getEquipmentMaintenanceSchedule,
  getEquipmentModels,
  getEquipmentStatuses,
} from "../../../core/api/equipmentManagementApi";

const tabs = [
  { id: "assets", label: "Activos", icon: FiBox },
  { id: "models", label: "Modelos", icon: FiCpu },
  { id: "schedule", label: "Cronograma", icon: FiCalendar },
];

const colorClasses = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const statusClass = (token) => colorClasses[token] || colorClasses.slate;

const formatDate = (value) => {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-EC", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
};

const LoadingState = () => (
  <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
      <FiRefreshCw className="h-5 w-5 animate-spin text-blue-600" />
      Cargando gestion de equipos
    </div>
  </div>
);

const EmptyState = ({ title, detail, icon: Icon = FiBox }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center">
    <Icon className="mb-3 h-8 w-8 text-slate-400" />
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="mt-1 max-w-md text-sm text-slate-500">{detail}</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
    <div className="flex items-start gap-3">
      <FiAlertTriangle className="mt-0.5 h-5 w-5 text-rose-700" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-rose-900">No se pudo cargar equipos</h3>
        <p className="mt-1 text-sm text-rose-700">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-2xl border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
      >
        Reintentar
      </button>
    </div>
  </div>
);

const Metric = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const EquipmentWorkspace = () => {
  const [activeTab, setActiveTab] = useState("assets");
  const [assets, setAssets] = useState([]);
  const [models, setModels] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statusRows, modelRows, assetRows, scheduleRows] = await Promise.all([
        getEquipmentStatuses(),
        getEquipmentModels(),
        getEquipmentAssets(),
        getEquipmentMaintenanceSchedule(),
      ]);
      setStatuses(statusRows);
      setModels(modelRows);
      setAssets(assetRows);
      setSchedule(scheduleRows);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Error inesperado al consultar el modulo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusByCode = useMemo(() => {
    return statuses.reduce((acc, status) => {
      acc[status.code] = status;
      return acc;
    }, {});
  }, [statuses]);

  const filteredAssets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesStatus = !statusFilter || asset.current_status === statusFilter;
      const matchesAvailability =
        !availabilityFilter ||
        (availabilityFilter === "available" && asset.is_available_for_negotiation) ||
        (availabilityFilter === "installed" && asset.current_status === "installed_client") ||
        (availabilityFilter === "service" && asset.lifecycle_group === "service");
      const text = [
        asset.serial_number,
        asset.internal_code,
        asset.asset_tag,
        asset.model_name,
        asset.manufacturer,
        asset.model,
        asset.category,
        asset.current_location,
        asset.status_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && matchesAvailability && (!term || text.includes(term));
    });
  }, [assets, availabilityFilter, query, statusFilter]);

  const filteredModels = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return models;
    return models.filter((model) =>
      [model.name, model.manufacturer, model.model, model.category, model.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [models, query]);

  const filteredSchedule = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return schedule;
    return schedule.filter((item) =>
      [item.procedure_name, item.model_name, item.manufacturer, item.model, item.serial_number, item.current_location]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [query, schedule]);

  const metrics = useMemo(() => {
    const available = assets.filter((asset) => asset.is_available_for_negotiation).length;
    const installed = assets.filter((asset) => asset.current_status === "installed_client").length;
    const service = assets.filter((asset) => asset.lifecycle_group === "service").length;
    return { available, installed, service };
  }, [assets]);

  const renderAssets = () => {
    if (!filteredAssets.length) {
      return (
        <EmptyState
          title="No hay activos con estos filtros"
          detail="Ajusta la busqueda o el estado para revisar equipos en almacenamiento, listos, reservados, instalados o en servicio."
          icon={FiFilter}
        />
      );
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Activo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Modelo</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Estado</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Ubicacion</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Negociacion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => {
                const status = statusByCode[asset.current_status] || asset;
                return (
                  <tr key={asset.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-950">{asset.serial_number || "Serial pendiente"}</p>
                      <p className="text-xs text-slate-500">{asset.internal_code || asset.asset_tag || `ID ${asset.id}`}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{asset.model_name}</p>
                      <p className="text-xs text-slate-500">{[asset.manufacturer, asset.model, asset.category].filter(Boolean).join(" / ")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass(status.color_token)}`}>
                        {asset.status_label || status.label || asset.current_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{asset.current_location || "Sin ubicacion"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {asset.negotiated_by_module ? `${asset.negotiated_by_module} #${asset.negotiation_reference_id || ""}` : "Sin reserva"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderModels = () => {
    if (!filteredModels.length) {
      return (
        <EmptyState
          title="No hay modelos con estos filtros"
          detail="Los modelos son la referencia tecnica compartida por negociaciones, business case, consumibles y activos."
          icon={FiCpu}
        />
      );
    }

    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredModels.map((model) => (
          <article key={model.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-slate-500">{model.category || "Sin categoria"}</p>
                <h3 className="mt-1 truncate text-base font-semibold text-slate-950">{model.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{[model.manufacturer, model.model].filter(Boolean).join(" / ") || "Sin fabricante/modelo"}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {model.available_count || 0} disponibles
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{model.asset_count || 0}</p>
                <p className="text-xs text-slate-500">Activos</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{model.installed_count || 0}</p>
                <p className="text-xs text-slate-500">En cliente</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-lg font-semibold text-slate-950">{model.procedure_count || 0}</p>
                <p className="text-xs text-slate-500">Procedimientos</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderSchedule = () => {
    if (!filteredSchedule.length) {
      return (
        <EmptyState
          title="No hay mantenimientos programados"
          detail="El cronograma se genera automaticamente al instalar un activo que tenga procedimientos preventivos activos con intervalo."
          icon={FiCalendar}
        />
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {filteredSchedule.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{item.procedure_name}</p>
                <p className="text-sm text-slate-600">
                  {[item.model_name, item.manufacturer, item.model, item.serial_number].filter(Boolean).join(" / ")}
                </p>
                <p className="text-xs text-slate-500">{item.current_location || "Sin ubicacion registrada"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {item.status}
                </span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(item.scheduled_for)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="WORKSPACE_PAGE_CLASS flex min-w-0 flex-col gap-5 bg-slate-50 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Gestion integral</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950 md:text-3xl">Equipos</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Modelos tecnicos, activos con serial, etiquetas de estado y cronograma automatico de mantenimiento.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        >
          <FiRefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Actualizar
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Modelos" value={models.length} icon={FiCpu} />
        <Metric label="Activos" value={assets.length} icon={FiBox} />
        <Metric label="Disponibles" value={metrics.available} icon={FiCheckCircle} />
        <Metric label="En servicio" value={metrics.service} icon={FiTool} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    isActive ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <label className="relative block min-w-[240px]">
              <span className="sr-only">Buscar equipos</span>
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                placeholder="Buscar modelo, serial o ubicacion"
              />
            </label>

            {activeTab === "assets" ? (
              <>
                <label className="sr-only" htmlFor="equipment-status-filter">Estado</label>
                <select
                  id="equipment-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Todos los estados</option>
                  {statuses.map((status) => (
                    <option key={status.code} value={status.code}>{status.label}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="equipment-availability-filter">Disponibilidad</label>
                <select
                  id="equipment-availability-filter"
                  value={availabilityFilter}
                  onChange={(event) => setAvailabilityFilter(event.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Toda disponibilidad</option>
                  <option value="available">Disponible para negociar</option>
                  <option value="installed">En cliente</option>
                  <option value="service">En servicio</option>
                </select>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={load} /> : null}
      {!loading && !error && activeTab === "assets" ? renderAssets() : null}
      {!loading && !error && activeTab === "models" ? renderModels() : null}
      {!loading && !error && activeTab === "schedule" ? renderSchedule() : null}
    </main>
  );
};

export default EquipmentWorkspace;
