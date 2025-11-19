import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiCheckCircle,
  FiEye,
  FiFileText,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import { motion } from "framer-motion";

import { useAuth } from "../../../core/auth/useAuth";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import {
  getPendingApprovals,
  approveRequest,
  rejectRequest,
} from "../../../core/api/approvalsApi";
import { getRequestById } from "../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../core/api/filesApi";

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const safeJSON = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const PendingApprovals = ({ onActionComplete }) => {
  const { role } = useAuth();
  const normalizedRole = (role || "").toLowerCase().replace(/[\s-]+/g, "_");
  const canManageApprovals = ["jefe_servicio_tecnico", "jefe_tecnico"].includes(
    normalizedRole
  );
  const { showToast, showLoader, hideLoader, askConfirm } = useUI();
  const {
    data,
    loading,
    execute: loadPending,
  } = useApi(getPendingApprovals, {
    errorMsg: "No se pudieron cargar las solicitudes pendientes",
  });

  const [detail, setDetail] = useState({
    open: false,
    loading: false,
    data: null,
    error: null,
  });
  const [blocked, setBlocked] = useState(false);

  const safeLoad = useCallback(async () => {
    try {
      await loadPending();
      setBlocked(false);
    } catch (err) {
      if (err?.response?.status === 403) {
        setBlocked(true);
      }
    }
  }, [loadPending]);

  useEffect(() => {
    safeLoad();
  }, [safeLoad]);

  const pending = useMemo(() => {
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data)) return data;
    return normalizeRows(data);
  }, [data]);

  const refreshAll = async () => {
    await safeLoad();
    onActionComplete?.();
  };

  const handleApprove = (req) => {
    if (!canManageApprovals) {
      showToast("Solo el jefe técnico puede aprobar solicitudes", "warning");
      return;
    }
    askConfirm(`¿Aprobar la solicitud #${req.id}?`, async () => {
      try {
        showLoader();
        await approveRequest(req.id);
        showToast(`Solicitud #${req.id} aprobada`, "success");
        await refreshAll();
      } catch (err) {
        console.error(err);
        showToast("No se pudo aprobar la solicitud", "error");
      } finally {
        hideLoader();
      }
    });
  };

  const handleReject = (req) => {
    if (!canManageApprovals) {
      showToast("Solo el jefe técnico puede rechazar solicitudes", "warning");
      return;
    }
    const note = window.prompt(
      `Motivo del rechazo para la solicitud #${req.id} (opcional):`,
      ""
    );
    if (note === null) return;

    askConfirm(`¿Rechazar la solicitud #${req.id}?`, async () => {
      try {
        showLoader();
        await rejectRequest(req.id, note || "");
        showToast(`Solicitud #${req.id} rechazada`, "warning");
        await refreshAll();
      } catch (err) {
        console.error(err);
        showToast("No se pudo rechazar la solicitud", "error");
      } finally {
        hideLoader();
      }
    });
  };

  const handleView = async (req) => {
    setDetail({ open: true, loading: true, data: null, error: null });
    try {
      const requestData = await getRequestById(req.id);
      const documents = await getDocumentsByRequest(req.id);
      const files = await getFilesByRequest(req.id);
      const parsed = {
        request: requestData?.request || requestData,
        documents: documents || [],
        files: files || [],
      };
      setDetail({ open: true, loading: false, data: parsed, error: null });
    } catch (err) {
      console.error(err);
      setDetail({
        open: true,
        loading: false,
        data: null,
        error: "No se pudo cargar la documentación",
      });
    }
  };

  return (
    <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
            Aprobaciones pendientes
          </p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Solicitudes en espera del jefe técnico
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
            Desde aquí puedes revisar la documentación, aprobar o rechazar cada
            solicitud sin abandonar el panel.
          </p>
          {!canManageApprovals && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
              Estás en modo lectura: solo el jefe de servicio técnico puede aprobar o rechazar.
            </p>
          )}
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Actualizar lista
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-10">
          Cargando solicitudes pendientes…
        </div>
      ) : blocked ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-10">
          No tienes permisos para revisar las aprobaciones pendientes.
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-10">
          No hay solicitudes pendientes por el momento.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pending.map((req) => (
            <motion.div
              key={req.id}
              className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 shadow-sm flex flex-col justify-between"
              whileHover={{ translateY: -2 }}
            >
              <div className="space-y-2">
                <p className="text-blue-600 dark:text-blue-400 font-semibold">
                  #{req.id} — {req.type_title || req.type_code}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Solicitado por:{" "}
                  <span className="font-semibold">
                    {req.requester_name || "—"}
                  </span>
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <FiFileText />
                  {formatDate(req.created_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => handleView(req)}
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <FiEye /> Ver detalle
                </button>
                {canManageApprovals ? (
                  <>
                    <button
                      onClick={() => handleApprove(req)}
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-green-100 text-green-700 text-sm flex items-center justify-center gap-2 hover:bg-green-200 transition"
                    >
                      <FiCheckCircle /> Aprobar
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-red-100 text-red-700 text-sm flex items-center justify-center gap-2 hover:bg-red-200 transition"
                    >
                      <FiXCircle /> Rechazar
                    </button>
                  </>
                ) : (
                  <div className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-dashed border-amber-400 text-amber-600 text-xs text-center bg-amber-50 dark:bg-amber-900/30">
                    Solo el jefe técnico puede aprobar o rechazar
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <RequestDetailModal detail={detail} onClose={() => setDetail({ open: false, loading: false, data: null, error: null })} />
    </section>
  );
};

const RequestDetailModal = ({ detail, onClose }) => {
  const payload = safeJSON(detail.data?.request?.payload);
  const documents = Array.isArray(detail.data?.documents) ? detail.data.documents : [];
  const files = Array.isArray(detail.data?.files) ? detail.data.files : [];

  return (
    <Transition.Root show={detail.open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2"
              enterTo="opacity-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <Dialog.Panel className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Dialog.Title className="text-2xl font-semibold text-gray-900 dark:text-white">
                      Detalle de solicitud
                    </Dialog.Title>
                    {detail.data?.request?.id && (
                      <p className="text-sm text-gray-500">
                        #{detail.data.request.id} —{" "}
                        {detail.data.request.type_title ||
                          detail.data.request.type ||
                          "Solicitud"}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                  >
                    Cerrar
                  </button>
                </div>

                {detail.loading ? (
                  <p className="text-center text-gray-500 py-10">
                    Cargando documentación…
                  </p>
                ) : detail.error ? (
                  <p className="text-center text-red-500 py-6">{detail.error}</p>
                ) : (
                  <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
                    <section>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Datos principales
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Solicitante</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {detail.data?.request?.requester_name ||
                              detail.data?.request?.requester_email ||
                              "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Estado actual</p>
                          <p className="font-semibold capitalize">
                            {detail.data?.request?.status || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Creada</p>
                          <p className="font-semibold">
                            {formatDate(detail.data?.request?.created_at)}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Información del formulario
                      </h4>
                      {Object.keys(payload).length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No hay información disponible.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          {Object.entries(payload).map(([key, value]) => (
                            <div
                              key={key}
                              className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700"
                            >
                              <p className="text-xs uppercase tracking-wide text-gray-500">
                                {key}
                              </p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value ?? "—")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Documentos generados
                      </h4>
                      {documents.length === 0 ? (
                        <p className="text-sm text-gray-500">Sin documentos.</p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {documents.map((doc) => (
                            <li
                              key={doc.id}
                              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-700"
                            >
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {doc.name || doc.title || `Documento ${doc.id}`}
                              </span>
                              {doc.drive_url || doc.url || doc.link ? (
                                <a
                                  href={doc.drive_url || doc.url || doc.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 text-sm hover:underline"
                                >
                                  Abrir
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Adjuntos del solicitante
                      </h4>
                      {files.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No hay archivos adjuntos.
                        </p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {files.map((file) => (
                            <li
                              key={file.id}
                              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-700"
                            >
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {file.filename || file.originalname || `Archivo ${file.id}`}
                              </span>
                              {file.url ? (
                                <a
                                  href={file.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 text-sm hover:underline"
                                >
                                  Descargar
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default PendingApprovals;
