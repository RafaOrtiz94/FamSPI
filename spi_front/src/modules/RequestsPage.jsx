// src/pages/modules/RequestsPage.jsx
import React, { useEffect, useMemo, useState, useCallback, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { motion } from "framer-motion";
import { FiFileText, FiLink, FiSearch, FiPlus } from "react-icons/fi";

import { useUI } from "../core/ui/UIContext";
import { useApi } from "../core/hooks/useApi";
import { useDebounce } from "../core/hooks/useDebounce";
import { useAuth } from "../core/auth/AuthContext";

import { getRequests, getRequestById, createRequest } from "../core/api/requestsApi";
import api from "../core/api"; // para endpoints no mapeados aún (cancel)
import PermisoVacacionModal from "./shared/solicitudes/modals/PermisoVacacionModal";

import Button from "../core/ui/components/Button";
import Input from "../core/ui/components/Input";
import Select from "../core/ui/components/Select";
import Card from "../core/ui/components/Card";
import Modal from "../core/ui/components/Modal";
import FileUploader from "../core/ui/components/FileUploader";
import SolicitudesGrid from "./comercial/components/SolicitudesGrid";
import { AprobacionPermisosView } from "./shared/solicitudes";
import PermisosStatusWidget from "./shared/solicitudes/components/PermisosStatusWidget";
import PurchaseHandoffWidget from "./comercial/components/PurchaseHandoffWidget";
import EquipmentPurchaseWidget from "./comercial/components/EquipmentPurchaseWidget";
import ClientRequestManagement from "./comercial/components/ClientRequestManagement";

// ======= Utilidades locales =======
const statusStyles = {
  aprobado: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  rechazado: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  en_revision: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  cancelado: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const STATUS_LABELS = {
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  pendiente: "Pendiente",
  en_revision: "En revisión",
  cancelado: "Cancelado",
};

const STATUS_DOTS = {
  aprobado: "bg-green-500",
  rechazado: "bg-red-500",
  pendiente: "bg-amber-500",
  en_revision: "bg-blue-500",
  cancelado: "bg-gray-400",
  acta_generada: "bg-purple-500",
  in_review: "bg-blue-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  pending: "bg-amber-500",
};

const REQUEST_TYPE_LABELS = {
  inspection: "Inspección de ambiente",
  purchase: "Proceso de compra",
  retirement: "Retiro de equipo",
  client: "Nuevo cliente",
};

const StatusBadge = ({ status }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      statusStyles[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    }`}
  >
    {STATUS_LABELS[status] || status || "—"}
  </span>
);

const DetailSection = ({ title, children }) => (
  <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-900/40">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
    <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">{children}</div>
  </section>
);

// ======= Página principal (equivalente al Dashboard Comercial) =======
const RequestsPage = () => {
  const { showToast, askConfirm, showLoader, hideLoader } = useUI();
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const canCreateRequests = role === "jefe_comercial";
  const canViewAllRequests = ["jefe_comercial", "administrador", "admin", "gerencia", "gerente"].includes(role);
  const defaultRequestParams = useMemo(
    () => (canViewAllRequests ? { pageSize: 30 } : { mine: true, pageSize: 30 }),
    [canViewAllRequests]
  );
  const [showClientManager, setShowClientManager] = useState(false);

  // Estado UI
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Listado
  const {
    data: listData,
    loading: loadingList,
    execute: fetchRequests,
  } = useApi(getRequests, {
    globalLoader: true,
    errorMsg: "Error al cargar las solicitudes.",
  });

  // Detalle
  const [detail, setDetail] = useState({ open: false, loading: false, data: null, error: null });

  // Permisos y vacaciones
  const [vacationModal, setVacationModal] = useState(false);

  // Crear
  const [createModal, setCreateModal] = useState({ open: false, type: "inspection" });
  const [submitting, setSubmitting] = useState(false);
  const [formPayload, setFormPayload] = useState({
    // campos dinámicos según plantilla
    nombre_cliente: "",
    persona_contacto: "",
    observacion: "",
    files: [],
  });

  // ======= Cargar inicialmente =======
  const load = useCallback(async () => {
    try {
      await fetchRequests(defaultRequestParams);
    } catch (err) {
      if (err?.response?.status === 403) {
        showToast("Mostrando solo tus solicitudes por permisos de acceso.", "warning");
        await fetchRequests({ ...defaultRequestParams, mine: true });
      }
    }
  }, [fetchRequests, defaultRequestParams, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // ======= Filtro =======
  const debounced = useDebounce(query, 350);
  const solicitudes = listData?.rows || listData?.result?.rows || listData || [];

  const filtered = useMemo(() => {
    const q = (debounced || "").trim().toLowerCase();
    return (solicitudes || []).filter((s) => {
      const payload = typeof s.payload === "string" ? safeJSON(s.payload) : (s.payload || {});
      const status = (s.status || "").toLowerCase();
      const matchesText =
        !q ||
        [s.id, payload?.nombre_cliente, payload?.persona_contacto, payload?.observacion]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [solicitudes, debounced, statusFilter]);

  // ======= Helpers =======
  function safeJSON(text) {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  // ======= Crear solicitud =======
  const handleOpenCreate = (type) => {
    if (!canCreateRequests) {
      showToast("Solo el Jefe Comercial puede crear solicitudes.", "error");
      return;
    }
    setFormPayload({ nombre_cliente: "", persona_contacto: "", observacion: "", files: [] });
    setCreateModal({ open: true, type });
  };
  const handleCloseCreate = () => setCreateModal({ open: false, type: "inspection" });

  const submitCreate = async (e) => {
    e?.preventDefault?.();

    if (!canCreateRequests) {
      showToast("No tienes permisos para crear solicitudes.", "error");
      return;
    }

    if (!createModal.type) {
      showToast("Selecciona un tipo de solicitud desde los accesos rápidos.", "warning");
      return;
    }

    if (!formPayload || Object.keys(formPayload).length === 0) {
      showToast("Completa los campos antes de enviar.", "warning");
      return;
    }

    // Mapeo request_type_id según tipo
    let request_type_id = 1;
    switch (createModal.type) {
      case "inspection":
        request_type_id = 1;
        break;
      case "purchase":
        request_type_id = 2;
        break;
      case "retirement":
        request_type_id = 3;
        break;
      case "client":
        request_type_id = 7;
        break;
      default:
        request_type_id = 1;
    }

    try {
      setSubmitting(true);
      showLoader();

      const { files = [], ...payload } = formPayload;
      await createRequest({ request_type_id, payload, files });
      showToast("Solicitud enviada correctamente ✅", "success");
      await fetchRequests(defaultRequestParams);
      handleCloseCreate();
    } catch (err) {
      console.error("❌ Error creando solicitud:", err);
      showToast("Error al enviar la solicitud.", "error");
    } finally {
      hideLoader();
      setSubmitting(false);
    }
  };

  // ======= Ver detalle =======
  const openDetail = async (req) => {
    if (!req?.id) return;
    setDetail({ open: true, loading: true, data: null, error: null });
    try {
      const data = await getRequestById(req.id); // /api/v1/requests/:id
      const parsed = {
        ...data,
        request: {
          ...(data.request || {}),
          payload:
            typeof data.request?.payload === "string"
              ? safeJSON(data.request.payload)
              : data.request?.payload,
        },
      };
      setDetail({ open: true, loading: false, data: parsed, error: null });
    } catch (err) {
      console.error("❌ Error detalle:", err);
      setDetail({ open: true, loading: false, data: null, error: "No se pudo cargar el detalle." });
      showToast("Error al obtener detalle de la solicitud.", "error");
    }
  };
  const closeDetail = () => setDetail({ open: false, loading: false, data: null, error: null });

  // ======= Cancelar solicitud =======
  const cancelRequest = async (req) => {
    if (!req?.id) return;
    askConfirm(`¿Deseas cancelar la solicitud #${req.id}?`, async () => {
      try {
        showLoader();
        const { data } = await api.post(`/requests/${req.id}/cancel`);
        if (data?.ok || data?.success) {
          showToast(`Solicitud #${req.id} cancelada ✅`, "success");
          await fetchRequests(defaultRequestParams);
        } else {
          showToast("No se pudo cancelar la solicitud.", "error");
        }
      } catch (err) {
        console.error("❌ Error al cancelar:", err);
        showToast("Error al cancelar la solicitud.", "error");
      } finally {
        hideLoader();
      }
    });
  };

  const detailRequest = detail.data?.request || {};
  const detailPayload = detailRequest.payload || {};
  const detailEquipmentList = Array.isArray(detailPayload?.equipos)
    ? detailPayload.equipos
    : Array.isArray(detailPayload?.items)
    ? detailPayload.items
    : Array.isArray(detailPayload?.equipment_list)
    ? detailPayload.equipment_list
    : [];
  const detailStatusKey = (detailRequest.status || "").toLowerCase();
  const detailDot = STATUS_DOTS[detailStatusKey] || STATUS_DOTS.pending;
  const detailCreatedAt = detailRequest.created_at
    ? new Date(detailRequest.created_at).toLocaleString()
    : "—";
  const detailAssignedTo =
    detailRequest.assigned_to_name ||
    detailRequest.assigned_to ||
    detailPayload.asignado_a ||
    detailPayload.assigned_to ||
    "No asignado";
  const canCancelDetail =
    detailStatusKey === "acta_generated" ||
    detailStatusKey === "acta_generada" ||
    ["pendiente", "pending", "en_revision", "in_review"].includes(detailStatusKey);

  // ======= UI =======
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Encabezado compacto */}
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitudes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Solicitudes de cliente, compras y flujos en curso se gestionan desde esta sección.
        </p>
      </div>

      {/* Accesos compactos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Solicitudes de Cliente</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">Gestiona tus solicitudes</p>
          </div>
          <Button
            size="sm"
            className="text-xs"
            onClick={() => setShowClientManager((prev) => !prev)}
          >
            {showClientManager ? "Ocultar" : "Abrir"}
          </Button>
        </Card>

        <Card className="flex items-center justify-between">
          <PurchaseHandoffWidget />
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Permisos y Vacaciones</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Solicita permisos por hora o tus vacaciones con aprobación en dos etapas
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setVacationModal(true)}>
            Abrir
          </Button>
        </Card>

        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Accesos rápidos</p>
            <p className="text-sm text-gray-800 dark:text-gray-200">Registrar nuevas solicitudes</p>
          </div>
          {canCreateRequests ? (
            <div className="flex flex-col gap-2 text-xs text-right">
              <Button size="sm" variant="primary" icon={FiPlus} onClick={() => handleOpenCreate("inspection")}>
                Inspección
              </Button>
              <div className="grid grid-cols-3 gap-1">
                <Button size="xs" variant="secondary" onClick={() => handleOpenCreate("purchase")}>Compra</Button>
                <Button size="xs" variant="secondary" onClick={() => handleOpenCreate("retirement")}>Retiro</Button>
                <Button size="xs" variant="secondary" onClick={() => handleOpenCreate("client")}>Cliente</Button>
              </div>
            </div>
          ) : (
            <p className="w-36 text-right text-xs text-gray-500">
              Solo el Jefe Comercial puede registrar solicitudes directas.
            </p>
          )}
        </Card>
      </div>

      <div className="mb-6">
        <PermisosStatusWidget />
      </div>

      <div className="mb-6">
        <EquipmentPurchaseWidget showCreation={false} />
      </div>

      {canViewAllRequests && (
        <Card className="mb-6 p-4" id="permisos-aprobacion">
          <AprobacionPermisosView />
        </Card>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <div className="relative w-full md:max-w-sm">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por cliente, contacto, observación..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-800 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <Select
              label=""
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "Todos" },
                { value: "pendiente", label: "Pendiente" },
                { value: "en_revision", label: "En revisión" },
                { value: "aprobado", label: "Aprobado" },
                { value: "rechazado", label: "Rechazado" },
                { value: "cancelado", label: "Cancelado" },
              ]}
              className="md:w-48"
            />
          </div>

          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-100">{solicitudes?.length || 0}</p>
              <p>Total</p>
            </div>
            <div>
              <p className="font-semibold text-green-600 dark:text-green-400">
                {solicitudes?.filter((s) => (s.status || "").toLowerCase() === "aprobado").length || 0}
              </p>
              <p>Aprobadas</p>
            </div>
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                {solicitudes?.filter((s) => (s.status || "").toLowerCase() === "pendiente").length || 0}
              </p>
              <p>Pendientes</p>
            </div>
          </div>
        </div>
      </Card>

      <PermisoVacacionModal
        open={vacationModal}
        onClose={() => setVacationModal(false)}
        onSuccess={load}
      />

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Solicitudes en curso</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Usa la barra de búsqueda y la paginación para revisar rápidamente cada tarjeta.
            </p>
          </div>
        </div>

        {loadingList ? (
          <div className="py-10 text-center text-gray-500">Cargando...</div>
        ) : (
          <SolicitudesGrid items={filtered || []} onView={openDetail} onCancel={cancelRequest} />
        )}
      </Card>

      {showClientManager && (
        <Card className="mb-6">
          <ClientRequestManagement />
        </Card>
      )}

      {/* ===== Modal de creación ===== */}
      <Modal open={createModal.open} onClose={handleCloseCreate} title="Nueva Solicitud" maxWidth="max-w-2xl">
        <div className="relative">
          {submitting && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/85 dark:bg-gray-900/80 backdrop-blur-sm rounded-2xl">
              <div className="w-full bg-blue-100 dark:bg-blue-900/40 h-2 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-blue-600 animate-pulse rounded-full"></div>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Enviando solicitud...
              </p>
            </div>
          )}
          <form
            onSubmit={submitCreate}
            className={`space-y-4 ${submitting ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-300">
                  Tipo seleccionado
                </p>
                <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  {REQUEST_TYPE_LABELS[createModal.type] || "—"}
                </p>
                <p className="text-xs text-blue-800/80 dark:text-blue-200/80">
                  Cierra este modal y usa los accesos rápidos para elegir otro flujo.
                </p>
              </div>
              <Input
                label="Nombre del Cliente"
                value={formPayload.nombre_cliente}
                onChange={(e) => setFormPayload((p) => ({ ...p, nombre_cliente: e.target.value }))}
                placeholder="ACME S.A."
              />
              <Input
                label="Persona de contacto"
                value={formPayload.persona_contacto}
                onChange={(e) => setFormPayload((p) => ({ ...p, persona_contacto: e.target.value }))}
                placeholder="Juan Pérez"
              />
              <Input
                label="Observación"
                value={formPayload.observacion}
                onChange={(e) => setFormPayload((p) => ({ ...p, observacion: e.target.value }))}
                placeholder="Detalles breves…"
              />
            </div>

          <div className="mt-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Adjuntos (opcional)
            </label>
            <FileUploader
              multiple
              onFilesSelected={(files) =>
                setFormPayload((prev) => ({
                  ...prev,
                  files: [...(prev.files || []), ...files],
                }))
              }
              helper="Puedes seleccionar varias imágenes o PDFs"
            />

            {formPayload.files?.length > 0 && (
              <ul className="mt-3 space-y-2">
                {formPayload.files.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span className="truncate text-gray-700 dark:text-gray-200">
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setFormPayload((prev) => {
                          const next = [...(prev.files || [])];
                          next.splice(idx, 1);
                          return { ...prev, files: next };
                        })
                      }
                      className="text-red-500 text-xs font-semibold hover:underline"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleCloseCreate}>
              Cancelar
            </Button>
            <Button type="submit">Enviar</Button>
          </div>
          </form>
        </div>
      </Modal>

      {/* ===== Modal de detalle ===== */}
      <Transition.Root show={detail.open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeDetail}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Solicitud #{detailRequest?.id || "—"}
                      </p>
                      <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                        {detailPayload?.nombre_cliente || detailRequest?.type_name || "Detalle de Solicitud"}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {detailRequest?.type_name || detailRequest?.type_title || "Tipo de solicitud"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-900/50">
                        <span className={`absolute h-3 w-3 rounded-full ${detailDot}`} aria-hidden />
                      </span>
                      <StatusBadge status={detailRequest?.status} />
                      <button
                        type="button"
                        onClick={closeDetail}
                        className="rounded-full border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                        aria-label="Cerrar"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {detail.loading ? (
                    <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                      <svg className="mr-2 h-6 w-6 animate-spin text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                      </svg>
                      Cargando detalle...
                    </div>
                  ) : detail.error ? (
                    <p className="text-red-500">{detail.error}</p>
                  ) : detail.data ? (
                    <>
                      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <DetailSection title="Estado y fecha">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={detailRequest?.status} />
                            <span className="text-xs text-gray-500 dark:text-gray-400">{detailCreatedAt}</span>
                          </div>
                        </DetailSection>
                        <DetailSection title="Asignación">
                          <p className="font-semibold text-gray-900 dark:text-white">{detailAssignedTo}</p>
                          {detailPayload?.persona_contacto && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">Contacto: {detailPayload.persona_contacto}</p>
                          )}
                        </DetailSection>
                      </div>

                      <div className="space-y-3">
                        <DetailSection title="Datos del solicitante">
                          <p>
                            <span className="font-semibold">Cliente:</span> {detailPayload?.nombre_cliente || "—"}
                          </p>
                          {detailPayload?.correo && (
                            <p>
                              <span className="font-semibold">Correo:</span> {detailPayload.correo}
                            </p>
                          )}
                          {detailPayload?.telefono && (
                            <p>
                              <span className="font-semibold">Teléfono:</span> {detailPayload.telefono}
                            </p>
                          )}
                          {detailPayload?.observacion && (
                            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                              {detailPayload.observacion}
                            </p>
                          )}
                        </DetailSection>

                        <DetailSection title="Equipos solicitados">
                          {detailEquipmentList.length ? (
                            <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-700">
                              {detailEquipmentList.map((eq, idx) => (
                                <li key={idx} className="py-2">
                                  <p className="font-semibold text-gray-900 dark:text-white">{eq?.nombre || eq?.equipo || eq?.descripcion || `Equipo ${idx + 1}`}</p>
                                  {eq?.cantidad && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Cantidad: {eq.cantidad}</p>
                                  )}
                                  {eq?.detalle && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{eq.detalle}</p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-500 dark:text-gray-400">No hay equipos adicionales registrados.</p>
                          )}
                        </DetailSection>

                        {(detailPayload?.proveedor || detailPayload?.provider || detailPayload?.supplier) && (
                          <DetailSection title="Información del proveedor">
                            <p>{detailPayload.proveedor || detailPayload.provider || detailPayload.supplier}</p>
                            {detailPayload?.proveedor_contacto && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">Contacto: {detailPayload.proveedor_contacto}</p>
                            )}
                          </DetailSection>
                        )}

                        {detail.data.attachments?.length > 0 && (
                          <DetailSection title="Documentos adjuntos">
                            <ul className="space-y-2">
                              {detail.data.attachments.map((file, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
                                >
                                  <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <FiFileText className="text-blue-500" />
                                    <span>{file.title || file.filename}</span>
                                  </div>
                                  <a
                                    href={file.drive_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-blue-600 transition hover:underline dark:text-blue-400"
                                  >
                                    <FiLink /> Ver archivo
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </DetailSection>
                        )}
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
                        {canCancelDetail && (
                          <Button variant="secondary" type="button" onClick={() => cancelRequest(detailRequest)}>
                            Cancelar solicitud
                          </Button>
                        )}
                        <Button type="button" onClick={closeDetail} variant="primary">
                          Cerrar
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p>No hay datos disponibles.</p>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </motion.div>
  );
};

export default RequestsPage;
