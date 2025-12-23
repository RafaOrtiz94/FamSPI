// src/modules/comercial/pages/Requests.jsx
import React, { useEffect, useState, useCallback, useMemo, Fragment, useRef } from "react";
import { motion } from "framer-motion";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiRefreshCw,
  FiFileText,
  FiLink,
  FiDownload,
  FiTrash2,
  FiEye,
} from "react-icons/fi";

import DashboardLayout from "../../../core/layout/DashboardLayout";
import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";
import {
  getRequests,
  getRequestById,
  cancelRequest,
} from "../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../core/api/filesApi";
import SearchBar from "../components/SearchBar";
import SolicitudesGrid from "../components/SolicitudesGrid";

const Requests = () => {
  const { showToast, confirm } = useUI();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState({
    open: false,
    loading: false,
    data: null,
    error: null,
  });

  const { data, loading, execute: fetchRequests } = useApi(getRequests, {
    errorMsg: "Error al cargar las solicitudes",
  });

  const fetchRef = useRef(fetchRequests);
  useEffect(() => {
    fetchRef.current = fetchRequests;
  }, [fetchRequests]);

  useEffect(() => {
    fetchRef.current({
      page: 1,
      pageSize: 20,
      mine: true,
      q: query,
      status: status === "all" ? undefined : status,
    });
  }, [query, status]);

  const safeJSON = (txt) => {
    try {
      return JSON.parse(txt);
    } catch {
      return {};
    }
  };

  const solicitudes = useMemo(
    () =>
      (data?.rows || data?.result?.rows || data || []).map((r) => ({
        ...r,
        payload: typeof r.payload === "string" ? safeJSON(r.payload) : r.payload,
      })),
    [data]
  );

  const handleView = async (req) => {
    setDetail({ open: true, loading: true, data: null, error: null });
    try {
      const request = await getRequestById(req.id);
      let docs = [];
      let files = [];
      try {
        docs = await getDocumentsByRequest(req.id);
      } catch {}
      try {
        files = await getFilesByRequest(req.id);
      } catch {}
      const parsed = {
        ...request,
        payload:
          typeof request.payload === "string"
            ? safeJSON(request.payload)
            : request.payload,
        documents: docs || [],
        attachments: files || [],
      };
      setDetail({ open: true, loading: false, data: parsed, error: null });
    } catch (err) {
      console.error(err);
      setDetail({
        open: true,
        loading: false,
        data: null,
        error: "Error cargando el detalle de la solicitud",
      });
    }
  };

  const handleCancel = async (req) => {
    const ok = await confirm(`¿Cancelar la solicitud #${req.id}?`);
    if (!ok) return;
    try {
      await cancelRequest(req.id);
      showToast(`Solicitud #${req.id} cancelada`, "success");
      await load();
    } catch (e) {
      console.error(e);
      showToast("No se pudo cancelar la solicitud", "error");
    }
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="p-6 space-y-6"
      >
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Solicitudes Comerciales
          </h1>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            <FiRefreshCw /> Actualizar
          </button>
        </div>

        {/* Buscador y filtros */}
        <SearchBar
          value={query}
          onChange={setQuery}
          status={status}
          setStatus={setStatus}
          onRefresh={load}
        />

        {/* Listado */}
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            Cargando...
          </div>
        ) : (
          <SolicitudesGrid
            items={solicitudes}
            onView={handleView}
            onCancel={handleCancel}
          />
        )}

        {/* Modal Detalle */}
        <Transition.Root show={detail.open} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() =>
              setDetail({ open: false, loading: false, data: null, error: null })
            }
          >
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
                <Dialog.Panel className="w-full max-w-2xl bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Detalle de Solicitud
                  </Dialog.Title>

                  {detail.loading ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-10">
                      Cargando detalle...
                    </p>
                  ) : detail.error ? (
                    <p className="text-red-500 text-center">{detail.error}</p>
                  ) : detail.data ? (
                    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                      <p>
                        <b>ID:</b> {detail.data.id}
                      </p>
                      <p>
                        <b>Estado:</b> {detail.data.status}
                      </p>
                      <p>
                        <b>Tipo:</b> {detail.data.type_name || "—"}
                      </p>
                      <p>
                        <b>Cliente:</b>{" "}
                        {detail.data.payload?.nombre_cliente || "—"}
                      </p>
                      <p>
                        <b>Persona de contacto:</b>{" "}
                        {detail.data.payload?.persona_contacto || "—"}
                      </p>
                      <p>
                        <b>Observación:</b>{" "}
                        {detail.data.payload?.observacion || "—"}
                      </p>

                      {/* Adjuntos */}
                      {(detail.data.documents?.length > 0 ||
                        detail.data.attachments?.length > 0) && (
                        <div className="mt-4 space-y-4">
                          {detail.data.documents?.length > 0 && (
                            <div>
                              <h4 className="font-semibold flex items-center gap-2 mb-2">
                                <FiDownload /> Documentos
                              </h4>
                              {detail.data.documents.map((d, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg"
                                >
                                  <span>{d.title || d.name}</span>
                                  <div className="flex items-center gap-2">
                                    {d.pdf_drive_link && (
                                      <a
                                        href={d.pdf_drive_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 text-sm flex items-center gap-1"
                                      >
                                        <FiFileText /> PDF
                                      </a>
                                    )}
                                    {d.drive_link && (
                                      <a
                                        href={d.drive_link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-blue-600 text-sm flex items-center gap-1"
                                      >
                                        <FiLink /> Ver
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {detail.data.attachments?.length > 0 && (
                            <div>
                              <h4 className="font-semibold flex items-center gap-2 mb-2">
                                <FiFileText /> Archivos adjuntos
                              </h4>
                              {detail.data.attachments.map((f, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg"
                                >
                                  <span>{f.title || f.filename}</span>
                                  <a
                                    href={f.drive_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 text-sm flex items-center gap-1"
                                  >
                                    <FiEye /> Ver
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center">
                      No hay información disponible.
                    </p>
                  )}

                  <div className="flex justify-end mt-6">
                    <button
                      onClick={() =>
                        setDetail({
                          open: false,
                          loading: false,
                          data: null,
                          error: null,
                        })
                      }
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      Cerrar
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
      </motion.div>
    </DashboardLayout>
  );
};

export default Requests;
