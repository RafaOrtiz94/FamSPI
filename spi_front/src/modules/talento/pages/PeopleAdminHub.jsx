import React, { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiArrowRight,
  FiCompass,
  FiLayers,
  FiSettings,
  FiShield,
  FiUsers,
} from "react-icons/fi";

import Usuarios from "./Usuarios";
import Departamentos from "./Departamentos";

const ADMIN_TABS = [
  {
    key: "usuarios",
    label: "Usuarios",
    description:
      "Gestiona accesos, roles, estado operativo y asignacion departamental en una sola consola.",
    shortDescription: "Control de accesos internos",
    icon: FiUsers,
    accent: "from-blue-600 via-cyan-600 to-sky-500",
    softAccent: "bg-blue-50 text-blue-700 border-blue-100",
    bullets: ["Alta y edicion manual", "Control de estado", "Asignacion de rol y area"],
  },
  {
    key: "departamentos",
    label: "Departamentos",
    description:
      "Administra la estructura organizacional activa y mantiene consistencia para asignaciones internas.",
    shortDescription: "Estructura organizacional",
    icon: FiSettings,
    accent: "from-slate-800 via-slate-700 to-slate-600",
    softAccent: "bg-slate-100 text-slate-700 border-slate-200",
    bullets: ["Catalogo operativo", "Estado activo o inactivo", "Base para asignacion de usuarios"],
  },
];

const normalizeTab = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ADMIN_TABS.some((tab) => tab.key === normalized) ? normalized : "usuarios";
};

const PeopleAdminHub = ({ initialTab = "usuarios" }) => {
  const normalizedInitialTab = useMemo(() => normalizeTab(initialTab), [initialTab]);
  const [activeTab, setActiveTab] = useState(normalizedInitialTab);

  useEffect(() => {
    setActiveTab(normalizedInitialTab);
  }, [normalizedInitialTab]);

  const currentTab = ADMIN_TABS.find((tab) => tab.key === activeTab) || ADMIN_TABS[0];
  const CurrentIcon = currentTab.icon;

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.10),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_45%,_#f8fafc_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="relative overflow-hidden rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur xl:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.16),_transparent_60%)] lg:block" />

          <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                <FiShield className="text-sm" />
                Gestion Administrativa Segura
              </div>

              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  Usuarios y Departamentos
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Consola unificada para administrar identidades internas y estructura organizacional.
                  Esta vista concentra las tareas operativas de Talento Humano y TI con foco en claridad,
                  control y velocidad de uso.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-2 inline-flex rounded-2xl bg-blue-100 p-2 text-blue-700">
                    <FiUsers />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Identidades internas</p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    Roles, correo, estado operativo y trazabilidad basica del acceso.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-2 inline-flex rounded-2xl bg-cyan-100 p-2 text-cyan-700">
                    <FiLayers />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Estructura activa</p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    Departamentos disponibles para asignacion y organizacion interna.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="mb-2 inline-flex rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                    <FiActivity />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Operacion continua</p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">
                    Trabajo optimizado para escritorio y adaptable a tablet o movil.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative w-full max-w-md rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_50px_rgba(15,23,42,0.28)]">
              <div className={`absolute inset-x-0 top-0 h-1 rounded-t-[28px] bg-gradient-to-r ${currentTab.accent}`} />
              <div className="flex items-start gap-4">
                <div className={`inline-flex rounded-2xl border p-3 ${currentTab.softAccent}`}>
                  <CurrentIcon className="text-lg" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Vista activa</p>
                  <h2 className="text-xl font-bold">{currentTab.label}</h2>
                  <p className="text-sm leading-6 text-slate-300">{currentTab.shortDescription}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">{currentTab.description}</p>

              <div className="mt-5 space-y-2">
                {currentTab.bullets.map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                    <FiArrowRight className="text-cyan-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/88 p-3 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 px-2 text-sm text-slate-500">
              <div className="inline-flex rounded-2xl bg-slate-100 p-2 text-slate-700">
                <FiCompass />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Navegacion operativa</p>
                <p className="text-xs leading-5 text-slate-500">
                  Cambia entre identidades y estructura sin salir del mismo espacio administrativo.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-2">
              {ADMIN_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`group flex w-full items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition-all lg:min-w-[280px] ${
                      isActive
                        ? "border-transparent bg-slate-950 text-white shadow-[0_20px_45px_rgba(15,23,42,0.24)]"
                        : "border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div
                      className={`inline-flex rounded-2xl p-3 ${
                        isActive ? "bg-white/10 text-cyan-300" : "bg-white text-slate-600"
                      }`}
                    >
                      <Icon className="text-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm font-bold ${isActive ? "text-white" : "text-slate-900"}`}>
                          {tab.label}
                        </p>
                        <FiArrowRight className={`${isActive ? "text-cyan-300" : "text-slate-400"}`} />
                      </div>
                      <p className={`mt-1 text-xs leading-5 ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                        {tab.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section>{activeTab === "usuarios" ? <Usuarios /> : <Departamentos />}</section>
      </div>
    </div>
  );
};

export default PeopleAdminHub;
