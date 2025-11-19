// src/pages/modules/RequestsPage.jsx
import React, { useEffect, useMemo, useState, useCallback, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { motion } from "framer-motion";
import {
  FiEye,
  FiTrash2,
  FiFileText,
  FiLink,
  FiSearch,
  FiPlus,
} from "react-icons/fi";

import { useUI } from "../core/ui/UIContext";
import { useApi } from "../core/hooks/useApi";
import { useDebounce } from "../core/hooks/useDebounce";
import { useAuth } from "../core/auth/AuthContext";

import { getRequests, getRequestById, createRequest } from "../core/api/requestsApi";
import api from "../core/api"; // para endpoints no mapeados aún (cancel)

import Button from "../core/ui/components/Button";
import Input from "../core/ui/components/Input";
import Select from "../core/ui/components/Select";
import Card from "../core/ui/components/Card";
import Modal from "../core/ui/components/Modal";
import FileUploader from "../core/ui/components/FileUploader";

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

const StatusBadge = ({ status }) => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
      statusStyles[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    }`}
  >
    {STATUS_LABELS[status] || status || "—"}
  </span>
);

// ======= Página principal (equivalente al Dashboard Comercial) =======
const RequestsPage = () => {
  const { showToast, askConfirm, showLoader, hideLoader } = useUI();
  const { user } = useAuth();
  const role = (user?.role || "").toLowerCase();
  const canCreateRequests = role === "jefe_comercial";

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
    await fetchRequests();
  }, [fetchRequests]);

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
      await fetchRequests();
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
          await fetchRequests();
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

  // ======= UI =======
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      {/* Título + acciones */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Solicitudes</h1>

        {canCreateRequests ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={FiPlus} onClick={() => handleOpenCreate("inspection")}>
              Nueva inspección
            </Button>
            <Button variant="secondary" onClick={() => handleOpenCreate("purchase")}>
              Compra
            </Button>
            <Button variant="secondary" onClick={() => handleOpenCreate("retirement")}>
              Retiro
            </Button>
            <Button variant="secondary" onClick={() => handleOpenCreate("client")}>
              Cliente
            </Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Solo el Jefe Comercial puede registrar nuevas solicitudes.
          </p>
        )}
      </div>

      {canCreateRequests && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Total</p>
            <p className="text-2xl font-bold">{solicitudes?.length || 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Aprobadas</p>
            <p className="text-2xl font-bold">
              {solicitudes?.filter((s) => (s.status || "").toLowerCase() === "aprobado").length ||
                0}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Rechazadas</p>
            <p className="text-2xl font-bold">
              {solicitudes?.filter((s) => (s.status || "").toLowerCase() === "rechazado").length ||
                0}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Pendientes</p>
            <p className="text-2xl font-bold">
              {solicitudes?.filter((s) => (s.status || "").toLowerCase() === "pendiente").length ||
                0}
            </p>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative w-full md:max-w-sm">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por cliente, contacto, observación..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
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
      </Card>

      {/* Grid de tarjetas */}
      {loadingList ? (
        <div className="text-center py-20 text-gray-500">Cargando...</div>
      ) : filtered?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((req) => {
            const payload =
              typeof req.payload === "string" ? safeJSON(req.payload) : (req.payload || {});
            return (
              <div
                key={req.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3 hover:shadow-lg transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    Solicitud #{req.id}
                  </span>
                  <StatusBadge status={req.status} />
                </div>

                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Cliente:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {payload?.nombre_cliente || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Contacto:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                      {payload?.persona_contacto || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Fecha:</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => openDetail(req)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition"
                  >
                    <FiEye size={16} /> Ver
                  </button>

                  {canCreateRequests && ["pendiente", "en_revision"].includes(req.status) && (
                    <button
                      onClick={() => cancelRequest(req)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition"
                    >
                      <FiTrash2 size={16} /> Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          No se encontraron solicitudes.
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Tipo de solicitud"
              value={createModal.type}
              onChange={(e) => setCreateModal((m) => ({ ...m, type: e.target.value }))}
              options={[
                { value: "inspection", label: "Inspección" },
                { value: "purchase", label: "Compra" },
                { value: "retirement", label: "Retiro" },
                { value: "client", label: "Cliente" },
              ]}
            />
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

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl border border-gray-200 dark:border-gray-700">
                <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Detalle de Solicitud
                </Dialog.Title>

                {detail.loading ? (
                  <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <svg className="animate-spin h-6 w-6 mr-2 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Cargando detalle...
                  </div>
                ) : detail.error ? (
                  <p className="text-red-500">{detail.error}</p>
                ) : detail.data ? (
                  <>
                    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                      <p>
                        <span className="font-semibold">ID:</span> {detail.data.request?.id}
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="font-semibold">Estado:</span>
                        <StatusBadge status={detail.data.request?.status} />
                      </p>
                      <p>
                        <span className="font-semibold">Tipo de Solicitud:</span>{" "}
                        {detail.data.request?.type_name || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">Cliente:</span>{" "}
                        {detail.data.request?.payload?.nombre_cliente || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">Persona de contacto:</span>{" "}
                        {detail.data.request?.payload?.persona_contacto || "—"}
                      </p>
                      <p>
                        <span className="font-semibold">Fecha de creación:</span>{" "}
                        {detail.data.request?.created_at
                          ? new Date(detail.data.request.created_at).toLocaleString()
                          : "—"}
                      </p>
                    </div>

                    {detail.data.attachments?.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-md font-semibold mb-3">Archivos Adjuntos</h3>
                        <ul className="space-y-2">
                          {detail.data.attachments.map((file, idx) => (
                            <li
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                <FiFileText className="text-blue-500" />
                                <span>{file.title || file.filename}</span>
                              </div>
                              <a
                                href={file.drive_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-sm"
                              >
                                <FiLink /> Ver archivo
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p>No hay datos disponibles.</p>
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={closeDetail}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </motion.div>
  );
};

export default RequestsPage;
