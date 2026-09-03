import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import "../design/tokens.css";

const MAIN_TABS = [
  { id: "inspeccion", label: "Inspección de Ambiente", icon: FiClipboard },
  { id: "retiro", label: "Retiro de Equipos", icon: FiPackage },
];

// Antes "De Compras"/"Business Case"/"Independientes" eran pestañas que
// obligaban a recorrer 3 bandejas para saber que necesitaba decision.
// InspectionRequestsWorkspace ahora carga las 3 fuentes en una sola lista
// ordenada por urgencia; la fuente pasa a ser un filtro secundario dentro de
// esa bandeja (ver SOURCE_FILTERS ahi). Retiro nunca tuvo mas de una fuente
// real (todo F.ST-21 cuelga de la misma tabla `requests`), asi que no hay
// nada que colapsar ahi.

const RequestCreationPanel = ({ canCreateGeneralRequests, creationCards, onCreateAction }) => (
  <section className="st-scope" style={{ borderTop: "1px solid var(--st-border)", background: "linear-gradient(180deg, var(--st-surface) 0%, var(--st-bg) 100%)" }}>
    {/* Sin mx-auto max-w-7xl: DESIGN.md §16 lo prohibe para bandejas
        operativas, roba ancho lateral en desktop sin motivo. */}
    <div className="px-2 py-4 sm:px-4 lg:px-6">
      <div className="rounded-[var(--st-radius-lg)] border p-5 sm:p-6" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--st-text-faint)" }}>
              Nueva solicitud
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
              Crea solicitudes en un bloque separado
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--st-text-muted)" }}>
              La bandeja de gestión queda enfocada en expedientes activos y la creación se mantiene aparte para evitar cruces visuales.
            </p>
          </div>
          {!canCreateGeneralRequests ? (
            <div className="rounded-[var(--st-radius-md)] border px-4 py-3 text-sm" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)", color: "var(--st-warning)" }}>
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
              className="group min-w-0 rounded-[var(--st-radius-lg)] border p-4 text-left transition hover:-translate-y-0.5"
              style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}
            >
              <div className="inline-flex rounded-[var(--st-radius-md)] border p-2" style={{ borderColor: "var(--st-accent-soft)", background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }}>
                <card.Icon size={18} />
              </div>
              <p className="mt-4 break-words text-sm font-semibold" style={{ color: "var(--st-text)" }}>{card.label}</p>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--st-text-muted)" }}>{card.helper}</p>
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

  // Deep-link desde el cronograma tecnico y la cola de acciones de Inicio
  // (technicalSchedule.service.js SOURCE_CONFIG / actionQueue.service.js):
  // ?tab=inspeccion&subtab=independientes ya no selecciona una pestaña de
  // fuente (esas se colapsaron en InspectionRequestsWorkspace) -- ahora fija
  // el filtro de fuente inicial dentro de esa bandeja unica.
  const [searchParams] = useSearchParams();
  const initialMainTab = MAIN_TABS.some((t) => t.id === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "inspeccion";
  const initialSourceFilter = searchParams.get("subtab") || "all";

  const [mainTab, setMainTab] = useState(initialMainTab);
  const [mounted, setMounted] = useState(() => new Set([initialMainTab]));
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [permisosModalOpen, setPermisosModalOpen] = useState(false);
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [retiroModalOpen, setRetiroModalOpen] = useState(false);

  const switchMain = (id) => {
    setMainTab(id);
    setMounted((prev) => (prev.has(id) ? prev : new Set([...prev, id])));
  };

  const creationCards = useMemo(
    () =>
      [
        {
          id: "cliente",
          label: "Creación de cliente",
          helper: "Registro completo con consentimiento y documentos.",
          Icon: FiUserPlus,
        },
        {
          id: "permisos",
          label: "Permisos y vacaciones",
          helper: "Solicitud laboral con el flujo vigente de Talento Humano.",
          Icon: FiCalendar,
        },
        canCreatePersonnelRequest
          ? {
              id: "personal",
              label: "Solicitud de personal",
              helper: "Disponible para jefaturas técnicas con el flujo oficial.",
              Icon: FiUsers,
            }
          : null,
        canCreateGeneralRequests
          ? {
              id: "inspection",
              label: "Inspección de ambiente",
              helper: "Genera una F.ST-20 desde esta misma bandeja.",
              Icon: FiClipboard,
            }
          : null,
        canCreateGeneralRequests
          ? {
              id: "retiro",
              label: "Retiro de equipo",
              helper: "Genera una F.ST-21 sin salir del módulo técnico.",
              Icon: FiTruck,
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
    <main className={`${WORKSPACE_PAGE_CLASS} st-scope`} style={{ background: "var(--st-bg)" }}>
      <header style={{ borderBottom: "1px solid var(--st-border)", background: "linear-gradient(180deg, var(--st-surface) 0%, var(--st-bg) 100%)" }}>
        <div className="px-2 sm:px-4 lg:px-6">
          <div className="pt-5">
            <h1 className="text-xl font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)", letterSpacing: "-0.01em" }}>
              Solicitudes
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>
              Inspecciones de ambiente y retiros de equipos
            </p>
          </div>

          <div className="mt-5 flex gap-1 overflow-x-auto pb-1">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchMain(tab.id)}
                className="inline-flex items-center gap-2 rounded-t-[12px] px-4 py-2.5 text-sm font-medium transition-colors duration-150 active:scale-[0.97]"
                style={
                  mainTab === tab.id
                    ? { borderBottom: "1px solid var(--st-bg)", border: "1px solid var(--st-border)", background: "var(--st-bg)", color: "var(--st-text)" }
                    : { color: "var(--st-text-faint)" }
                }
              >
                <tab.icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col">
        {mounted.has("inspeccion") && (
          <div className={mainTab === "inspeccion" ? "flex flex-1 flex-col" : "hidden"}>
            <InspectionRequestsWorkspace initialSourceFilter={initialSourceFilter} />
          </div>
        )}

        {mounted.has("retiro") && (
          <div className={mainTab === "retiro" ? "mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8" : "hidden"}>
            <RetiroEquipos />
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
