import React, { useMemo, useState } from "react";
import {
  FiCalendar,
  FiClipboard,
  FiPackage,
  FiTruck,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";
import { WORKSPACE_PAGE_CLASS } from "../../../core/ui/workspaceLayout";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import Modal from "../../../core/ui/components/Modal";
import PermisoVacacionModal from "../../shared/solicitudes/modals/PermisoVacacionModal";
import PersonnelRequestForm from "../../../core/ui/widgets/PersonnelRequestForm";
import CreateRequestModal from "../../comercial/components/CreateRequestModal";
import NewClientRequestForm from "../../comercial/components/NewClientRequestForm";
import { createRequest } from "../../../core/api/requestsApi";
import { hasAnyRole, normalizeRoles } from "../../shared/purchases-workspace/purchaseRoleGroups";
import RetiroEquipos from "./RetiroEquipos";
import InspectionRequestsWorkspace from "../components/solicitudes/InspectionRequestsWorkspace";

const MAIN_TABS = [
  { id: "inspeccion", label: "Inspección de Ambiente", icon: FiClipboard },
  { id: "retiro", label: "Retiro de Equipos", icon: FiPackage },
];

const SUB_TABS = {
  inspeccion: [
    { id: "independientes", label: "Independientes" },
    { id: "bc", label: "Business Case" },
    { id: "compras", label: "De Compras" },
  ],
  retiro: [
    { id: "compras", label: "De Compras" },
    { id: "independientes", label: "Independientes" },
  ],
};

const RetiroIndependientesEmpty = () => (
  <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[16px] border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="rounded-full border border-slate-200 bg-slate-50 p-3.5">
        <FiPackage size={22} className="text-slate-300" />
      </div>
      <p className="mt-4 text-sm font-medium text-slate-700">Sin solicitudes de retiro independientes</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        Las solicitudes de retiro creadas directamente aparecerán aquí.
      </p>
    </div>
  </div>
);

const RequestCreationPanel = ({ canCreateGeneralRequests, creationCards, onCreateAction }) => (
  <section className="border-t border-slate-200 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)]">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Nueva solicitud
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              Crea solicitudes en un bloque separado
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              La bandeja de gestión queda enfocada en expedientes activos y la creación se mantiene aparte para evitar cruces visuales.
            </p>
          </div>
          {!canCreateGeneralRequests ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Las solicitudes F.ST-20 y F.ST-21 se muestran solo para roles con permiso real de creación.
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {creationCards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onCreateAction(card.id)}
              className="group min-w-0 rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
            >
              <div className={`inline-flex rounded-2xl border px-3 py-2 ${card.accent}`}>
                <card.Icon size={18} />
              </div>
              <p className="mt-4 break-words text-sm font-semibold text-slate-900">{card.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{card.helper}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const SolicitudesWorkspace = () => {
  const { user } = useAuth();
  const { showToast, showLoader, hideLoader } = useUI();
  const userRoles = useMemo(() => normalizeRoles(user), [user]);
  const canCreateGeneralRequests = useMemo(
    () => hasAnyRole(userRoles, ["comercial", "backoffice", "jefe_comercial"]),
    [userRoles],
  );
  const canCreatePersonnelRequest = useMemo(
    () => hasAnyRole(userRoles, ["jefe_tecnico", "jefe_servicio"]),
    [userRoles],
  );

  const [mainTab, setMainTab] = useState("inspeccion");
  const [subTabs, setSubTabs] = useState({ inspeccion: "bc", retiro: "compras" });
  const [mounted, setMounted] = useState(() => new Set(["inspeccion:bc"]));
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [permisosModalOpen, setPermisosModalOpen] = useState(false);
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [retiroModalOpen, setRetiroModalOpen] = useState(false);

  const activeSubTab = subTabs[mainTab];
  const tabKey = `${mainTab}:${activeSubTab}`;

  const mount = (key) =>
    setMounted((prev) => (prev.has(key) ? prev : new Set([...prev, key])));

  const switchMain = (id) => {
    setMainTab(id);
    mount(`${id}:${subTabs[id]}`);
  };

  const switchSub = (id) => {
    setSubTabs((prev) => ({ ...prev, [mainTab]: id }));
    mount(`${mainTab}:${id}`);
  };

  const creationCards = useMemo(
    () =>
      [
        {
          id: "cliente",
          label: "Creación de cliente",
          helper: "Registro completo con consentimiento y documentos.",
          Icon: FiUserPlus,
          accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
        },
        {
          id: "permisos",
          label: "Permisos y vacaciones",
          helper: "Solicitud laboral con el flujo vigente de Talento Humano.",
          Icon: FiCalendar,
          accent: "border-orange-200 bg-orange-50 text-orange-700",
        },
        canCreatePersonnelRequest
          ? {
              id: "personal",
              label: "Solicitud de personal",
              helper: "Disponible para jefaturas técnicas con el flujo oficial.",
              Icon: FiUsers,
              accent: "border-teal-200 bg-teal-50 text-teal-700",
            }
          : null,
        canCreateGeneralRequests
          ? {
              id: "inspection",
              label: "Inspección de ambiente",
              helper: "Genera una F.ST-20 desde esta misma bandeja.",
              Icon: FiClipboard,
              accent: "border-blue-200 bg-blue-50 text-blue-700",
            }
          : null,
        canCreateGeneralRequests
          ? {
              id: "retiro",
              label: "Retiro de equipo",
              helper: "Genera una F.ST-21 sin salir del módulo técnico.",
              Icon: FiTruck,
              accent: "border-amber-200 bg-amber-50 text-amber-700",
            }
          : null,
      ].filter(Boolean),
    [canCreateGeneralRequests, canCreatePersonnelRequest],
  );

  const handleCreateAction = (actionId) => {
    switch (actionId) {
      case "cliente":
        setNewClientModalOpen(true);
        break;
      case "permisos":
        setPermisosModalOpen(true);
        break;
      case "personal":
        setPersonnelModalOpen(true);
        break;
      case "inspection":
        setInspectionModalOpen(true);
        break;
      case "retiro":
        setRetiroModalOpen(true);
        break;
      default:
        break;
    }
  };

  const submitGeneralRequest = async (typeId, data, successMessage, close) => {
    try {
      showLoader();
      const { request_type_id, payload: rawPayload, files = [] } = data || {};
      const payload = rawPayload && typeof rawPayload === "object" ? { ...rawPayload } : {};
      if (payload.observacion && !payload.observaciones) payload.observaciones = payload.observacion;
      delete payload.observacion;
      await createRequest({ request_type_id: request_type_id || typeId, payload, files });
      showToast(successMessage, "success");
      close();
    } catch (error) {
      showToast(
        error?.response?.data?.message || "No se pudo enviar la solicitud. Verifica tu conexión.",
        "error",
      );
    } finally {
      hideLoader();
    }
  };

  return (
    <main className={`${WORKSPACE_PAGE_CLASS} bg-slate-50`}>
      {/* Naval Slate header */}
      <header className="border-b border-slate-200 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="pt-5">
            <h1 className="text-xl font-semibold text-slate-900" style={{ letterSpacing: "-0.01em" }}>
              Solicitudes
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Inspecciones de ambiente y retiros de equipos
            </p>
          </div>

          {/* Main tabs — flush to header bottom */}
          <div className="mt-5 flex gap-1 overflow-x-auto pb-1">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchMain(tab.id)}
                className={`inline-flex items-center gap-2 rounded-t-[12px] px-4 py-2.5 text-sm font-medium transition-colors duration-150 active:scale-[0.97] ${
                  mainTab === tab.id
                    ? "border border-b-0 border-slate-200 bg-slate-50 text-slate-900"
                    : "text-slate-500 hover:bg-white hover:text-slate-900"
                }`}
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Sub-tab strip */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto">
            {SUB_TABS[mainTab].map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => switchSub(sub.id)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-150 ${
                  activeSubTab === sub.id
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="hidden">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Creación de solicitudes
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  Registra nuevas solicitudes sin salir del workspace
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Aquí puedes iniciar los formularios que sí tienen flujo real en el sistema y mantener la misma
                  coherencia visual del módulo de servicio.
                </p>
              </div>
              {!canCreateGeneralRequests ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Las solicitudes F.ST-20 y F.ST-21 se muestran solo para roles con permiso real de creación.
                </div>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {creationCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCreateAction(card.id)}
                  className="group rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                >
                  <div className={`inline-flex rounded-2xl border px-3 py-2 ${card.accent}`}>
                    <card.Icon size={18} />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-900">{card.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{card.helper}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="flex flex-1 flex-col">
        {mounted.has("inspeccion:bc") && (
          <div className={tabKey === "inspeccion:bc" ? "flex flex-1 flex-col" : "hidden"}>
            <InspectionRequestsWorkspace source="bc" />
          </div>
        )}

        {mounted.has("inspeccion:compras") && (
          <div className={tabKey === "inspeccion:compras" ? "flex flex-1 flex-col" : "hidden"}>
            <InspectionRequestsWorkspace source="compras" />
          </div>
        )}

        {mounted.has("inspeccion:independientes") && (
          <div className={tabKey === "inspeccion:independientes" ? "flex flex-1 flex-col" : "hidden"}>
            <InspectionRequestsWorkspace source="independientes" />
          </div>
        )}

        {mounted.has("retiro:compras") && (
          <div className={tabKey === "retiro:compras" ? "mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8" : "hidden"}>
            <RetiroEquipos />
          </div>
        )}

        {mounted.has("retiro:independientes") && (
          <div className={tabKey === "retiro:independientes" ? "" : "hidden"}>
            <RetiroIndependientesEmpty />
          </div>
        )}
      </div>

      <RequestCreationPanel
        canCreateGeneralRequests={canCreateGeneralRequests}
        creationCards={creationCards}
        onCreateAction={handleCreateAction}
      />

      <Modal
        open={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        title="Solicitud de creación de cliente"
        maxWidth="max-w-6xl"
      >
        <NewClientRequestForm
          showIntro={false}
          onCancel={() => setNewClientModalOpen(false)}
          onSuccess={() => setNewClientModalOpen(false)}
        />
      </Modal>

      <PermisoVacacionModal
        open={permisosModalOpen}
        onClose={() => setPermisosModalOpen(false)}
        onSuccess={() => setPermisosModalOpen(false)}
      />

      {personnelModalOpen && (
        <PersonnelRequestForm
          onClose={() => setPersonnelModalOpen(false)}
          onSuccess={() => setPersonnelModalOpen(false)}
        />
      )}

      <CreateRequestModal
        open={inspectionModalOpen}
        onClose={() => setInspectionModalOpen(false)}
        onSubmit={(data) =>
          submitGeneralRequest(
            "F.ST-20",
            data,
            "Solicitud de inspección de ambiente enviada correctamente",
            () => setInspectionModalOpen(false),
          )
        }
        presetType="inspection"
      />

      <CreateRequestModal
        open={retiroModalOpen}
        onClose={() => setRetiroModalOpen(false)}
        onSubmit={(data) =>
          submitGeneralRequest(
            "F.ST-21",
            data,
            "Solicitud de retiro de equipo enviada correctamente",
            () => setRetiroModalOpen(false),
          )
        }
        presetType="retiro"
      />
    </main>
  );
};

export default SolicitudesWorkspace;
