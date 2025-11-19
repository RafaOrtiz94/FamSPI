import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Tab } from "@headlessui/react";
import {
  FiTool,
  FiUsers,
  FiCalendar,
  FiSettings,
  FiFileText,
  FiRefreshCw,
  FiTrendingUp,
  FiClock,
  FiActivity,
} from "react-icons/fi";

import api from "../../../core/api";
import ExecutiveStatCard from "../../../core/ui/components/ExecutiveStatCard";
import { getMantenimientos } from "../../../core/api/mantenimientosApi";
import { getRequests } from "../../../core/api/requestsApi";
import { getPendingApprovals } from "../../../core/api/approvalsApi";
import Mantenimientos from "./Mantenimientos";
import Equipos from "./Equipos";
import Capacitaciones from "../../servicio/components/Capacitaciones";
import MantenimientosList from "../../servicio/components/MantenimientosList";
import SolicitudesTecnicas from "../../servicio/components/SolicitudesTecnicas";
import PendingApprovals from "../../servicio/components/PendingApprovals";

const fetchEquipos = async () => {
  const { data } = await api.get("/servicio/equipos");
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const fetchCapacitaciones = async () => {
  const { data } = await api.get("/servicio/capacitaciones");
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.result?.rows)) return data.result.rows;
  if (Array.isArray(data?.data?.rows)) return data.data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const fetchSolicitudesTecnicas = async () => {
  return getRequests({ pageSize: 30 });
};

const ServicioDashboard = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mantenimientos, setMantenimientos] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [approvals, setApprovals] = useState([]);

  const unwrapRows = useCallback((payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, []);

  const refreshSnapshots = useCallback(async () => {
    setLoadingSnapshots(true);
    const tasks = [
      { label: "mantenimientos", fn: () => getMantenimientos({ pageSize: 200 }), setter: setMantenimientos },
      { label: "equipos", fn: fetchEquipos, setter: setEquipos },
      { label: "capacitaciones", fn: fetchCapacitaciones, setter: setCapacitaciones },
      { label: "solicitudes", fn: fetchSolicitudesTecnicas, setter: setSolicitudes },
      { label: "aprobaciones", fn: getPendingApprovals, setter: setApprovals },
    ];

    for (const task of tasks) {
      try {
        const result = await task.fn();
        task.setter(unwrapRows(result));
      } catch (err) {
        console.warn(`ServicioDashboard snapshot error (${task.label}):`, err?.message || err);
        task.setter([]);
      }
    }
    setLoadingSnapshots(false);
  }, [unwrapRows]);

  useEffect(() => {
    refreshSnapshots();
  }, [refreshSnapshots]);

  const safeMantenimientos = useMemo(() => (Array.isArray(mantenimientos) ? mantenimientos : []), [mantenimientos]);
  const safeEquipos = useMemo(() => (Array.isArray(equipos) ? equipos : []), [equipos]);
  const safeCapacitaciones = useMemo(
    () => (Array.isArray(capacitaciones) ? capacitaciones : []),
    [capacitaciones]
  );
  const safeSolicitudes = useMemo(() => (Array.isArray(solicitudes) ? solicitudes : []), [solicitudes]);
  const safeApprovals = useMemo(() => (Array.isArray(approvals) ? approvals : []), [approvals]);

  const stats = useMemo(() => {
    const normalize = (value) => String(value || "").toLowerCase();
    const pendientes = safeMantenimientos.filter((m) =>
      ["pendiente", "pending"].includes(normalize(m.estado || m.status))
    )
      .length;
    const completados = safeMantenimientos.filter((m) =>
      ["aprobado", "approved", "cumplido", "done"].includes(normalize(m.estado || m.status))
    ).length;
    const equiposOperativos = safeEquipos.filter((e) =>
      ["operativo", "ok"].includes(normalize(e.estado))
    ).length;
    const solicitudesAbiertas = safeSolicitudes.filter(
      (s) => !["cerrado", "cancelado", "finalizado"].includes(normalize(s.status || s.estado))
    ).length;
    const proximasCapacitaciones = safeCapacitaciones.filter((c) =>
      ["programada", "en_curso"].includes(normalize(c.estado))
    ).length;

    return {
      pendientes,
      completados,
      equiposOperativos,
      solicitudesAbiertas,
      proximasCapacitaciones,
    };
  }, [capacitaciones, equipos, mantenimientos, solicitudes]);

  const quickActions = [
    {
      title: "Programar mantenimiento",
      description: "Registra nuevos mantenimientos preventivos o correctivos.",
      icon: <FiTool />,
      targetTab: 0,
    },
    {
      title: "Capacitaciones del equipo",
      description: "Da seguimiento al plan anual y nuevas formaciones.",
      icon: <FiUsers />,
      targetTab: 1,
    },
    {
      title: "Cronograma anual",
      description: "Visualiza el cumplimiento del plan de servicio.",
      icon: <FiCalendar />,
      targetTab: 2,
    },
    {
      title: "Inventario técnico",
      description: "Administra el estado actual de cada equipo.",
      icon: <FiSettings />,
      targetTab: 3,
    },
    {
      title: "Solicitudes técnicas",
      description: "Controla requerimientos pendientes del negocio.",
      icon: <FiFileText />,
      targetTab: 4,
    },
  ];

  const tabs = [
    {
      name: "Mantenimientos",
      icon: <FiTool />,
      component: (
        <Mantenimientos initialRows={safeMantenimientos} onRefresh={refreshSnapshots} />
      ),
    },
    {
      name: "Capacitaciones",
      icon: <FiUsers />,
      component: (
        <Capacitaciones initialItems={safeCapacitaciones} onRefresh={refreshSnapshots} />
      ),
    },
    {
      name: "Cronograma Anual",
      icon: <FiCalendar />,
      component: <MantenimientosList items={safeMantenimientos} loading={loadingSnapshots} />,
    },
    {
      name: "Equipos",
      icon: <FiSettings />,
      component: (
        <Equipos initialRows={safeEquipos} onRefresh={refreshSnapshots} />
      ),
    },
    {
      name: "Solicitudes Técnicas",
      icon: <FiFileText />,
      component: (
        <SolicitudesTecnicas initialRequests={safeSolicitudes} />
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 space-y-8 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 min-h-screen"
    >
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start gap-6">
        <div>
          <p className="text-sm uppercase font-semibold text-blue-600">Servicio Técnico</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Centro de Operaciones Técnicas
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl">
            Controla mantenimientos, inventario, capacitaciones y solicitudes desde un solo lugar.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={refreshSnapshots}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-200"
          >
            <FiRefreshCw className={loadingSnapshots ? "animate-spin" : ""} />
            Actualizar
          </button>
          <div className="text-right">
            <p className="text-xs text-gray-500">Última revisión</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {new Date().toLocaleString("es-EC")}
            </p>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <ExecutiveStatCard
          label="Mantenimientos activos"
          value={stats.pendientes}
          icon={<FiTool size={20} />}
          from="from-blue-600"
          to="to-blue-500"
        />
        <ExecutiveStatCard
          label="Mantenimientos completados"
          value={stats.completados}
          icon={<FiTrendingUp size={20} />}
          from="from-green-600"
          to="to-green-500"
        />
        <ExecutiveStatCard
          label="Equipos operativos"
          value={stats.equiposOperativos}
          icon={<FiActivity size={20} />}
          from="from-emerald-600"
          to="to-emerald-500"
        />
        <ExecutiveStatCard
          label="Solicitudes abiertas"
          value={stats.solicitudesAbiertas}
          icon={<FiClock size={20} />}
          from="from-amber-600"
          to="to-amber-500"
        />
      </section>

      {/* QUICK ACTIONS */}
      {/* Se eliminó el grid de acciones rápidas por solicitud del usuario */}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Notificaciones recientes
            </h3>
            <span className="text-xs rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
              {safeApprovals.length} pendientes
            </span>
          </div>
          {safeApprovals.length ? (
            <ul className="divide-y divide-gray-200 text-sm dark:divide-gray-800">
              {safeApprovals.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-start justify-between py-2">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      Solicitud #{a.id}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.type_title || a.type_code || "Pendiente"} • {a.requester_name || "Solicitante"}
                    </p>
                  </div>
                  <span className="text-[11px] rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                    Por aprobar
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No hay notificaciones pendientes.
            </p>
          )}
        </div>
      </section>

      <PendingApprovals onActionComplete={refreshSnapshots} />

    {/* TAB NAVIGATION */}
      <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">Módulos tácticos</p>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Operaciones de servicio</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Navega por los módulos esenciales para el día a día del equipo técnico.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            Vista actual: <span className="font-semibold text-gray-900 dark:text-white">{tabs[selectedIndex]?.name}</span>
          </div>
        </div>
        <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
          <Tab.List className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3 mb-4">
            {tabs.map((tab, i) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                    selected
                      ? "bg-blue-600 text-white shadow"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`
                }
              >
                {tab.icon}
                {tab.name}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels>
            {tabs.map((tab) => (
              <Tab.Panel key={tab.name} className="pt-2" unmount>
                {tab.component}
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      </section>

      {/* COMPLEMENTARY PANELS */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Próximos mantenimientos
          </h3>
          <ul className="space-y-3">
            {[...safeMantenimientos]
              .sort(
                (a, b) =>
                  new Date(a.fecha || a.created_at || 0) - new Date(b.fecha || b.created_at || 0)
              )
              .slice(0, 5)
              .map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FiTool className="text-blue-600" /> #{item.id} •{" "}
                      {item.equipo_nombre || `Equipo ${item.id_equipo}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      Responsable: {item.responsable || "Por asignar"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(item.fecha || item.created_at).toLocaleDateString("es-EC")}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">
                      {item.estado || item.status}
                    </span>
                  </div>
                </li>
              ))}
            {safeMantenimientos.length === 0 && (
              <li className="text-sm text-gray-500 dark:text-gray-400">No hay registros.</li>
            )}
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Solicitudes técnicas recientes
          </h3>
          <ul className="space-y-3">
            {[...safeSolicitudes]
              .sort(
                (a, b) =>
                  new Date(b.created_at || 0) - new Date(a.created_at || 0)
              )
              .slice(0, 5)
              .map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FiFileText className="text-blue-600" /> Solicitud #{item.id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.payload?.descripcion || item.type_title || "Requerimiento técnico"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("es-EC")
                        : "Sin fecha"}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 capitalize">
                      {item.status}
                    </span>
                  </div>
                </li>
              ))}
            {safeSolicitudes.length === 0 && (
              <li className="text-sm text-gray-500 dark:text-gray-400">No hay solicitudes.</li>
            )}
          </ul>
        </div>
      </section>
    </motion.div>
  );
};

export default ServicioDashboard;
