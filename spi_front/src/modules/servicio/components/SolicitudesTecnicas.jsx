import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiFileText, FiRefreshCw, FiEye, FiX, FiFile, FiCalendar } from "react-icons/fi";
import { motion } from "framer-motion";
import { getRequests } from "../../../core/api/requestsApi";
import { useUI } from "../../../core/ui/useUI";

const TYPE_LABELS = {
  "F.ST-20": "Solicitud de inspección de ambiente",
  "F.ST-21": "Solicitud de retiro de equipo",
  "F.ST-22": "Registro de nuevo cliente",
  "F.ST-19": "Requerimiento de proceso de compra",
};
const getTypeLabel = (code, fallback) => TYPE_LABELS[code] || fallback || "Solicitud";

const normalizeRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result?.rows)) return payload.result.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
};

const SolicitudesTecnicas = ({ initialRequests = null }) => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState(() => normalizeRows(initialRequests));
  const [detail, setDetail] = useState({ open: false, data: null });

  const safeJSON = (txt) => {
    try {
      return JSON.parse(txt);
    } catch {
      return {};
    }
  };

  const fetchSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getRequests({ pageSize: 30 });
      setList(normalizeRows(response));
    } catch (err) {
      console.error(err);
      showToast("No se pudieron cargar las solicitudes técnicas", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  useEffect(() => {
    setList(normalizeRows(initialRequests));
  }, [initialRequests]);

  const solicitudes = useMemo(
    () =>
      list.map((s) => ({
        ...s,
        payload: typeof s.payload === "string" ? safeJSON(s.payload) : s.payload,
        type_title: getTypeLabel(s.type_code || s.code, s.type_title),
      })),
    [list]
  );

  const openDetail = (item) => {
    setDetail({ open: true, data: item });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
          <FiFileText className="text-blue-600" />
          Solicitudes Técnicas
        </h2>
        <button
          onClick={fetchSolicitudes}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-gray-400">Cargando solicitudes...</p>
      ) : solicitudes.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 py-12">
          <FiFileText className="text-4xl mb-2" />
          <p>No hay solicitudes técnicas registradas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {solicitudes.map((s) => (
            <motion.div
              key={s.id}
              whileHover={{ scale: 1.02 }}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-600 mb-1">
                    Solicitud #{s.id}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    {s.type_title}
                  </p>
                </div>
                <button
                  onClick={() => openDetail(s)}
                  className="rounded-lg border border-gray-200 p-2 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <FiEye />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Estado: <b className="capitalize">{s.status || "pendiente"}</b>
              </p>
              <p className="text-xs text-gray-500">
                Cliente: {s.payload?.nombre_cliente || "—"}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      <DetailModal detail={detail} onClose={() => setDetail({ open: false, data: null })} />
    </motion.div>
  );
};

export default SolicitudesTecnicas;

const DetailModal = ({ detail, onClose }) => {
  if (!detail.open || !detail.data) return null;
  const s = detail.data;
  const payload = s.payload || {};
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-800">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Solicitud #{s.id}</p>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {s.type_title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Cerrar"
          >
            <FiX />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-200">
            <p className="font-semibold mb-2 flex items-center gap-2">
              <FiCalendar /> Información
            </p>
            <p>Estado: {s.status || "pendiente"}</p>
            <p>
              Creado:{" "}
              {s.created_at ? new Date(s.created_at).toLocaleString("es-EC") : "—"}
            </p>
            <p>Solicitante: {s.requester_email || "—"}</p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-200">
            <p className="font-semibold mb-2 flex items-center gap-2">
              <FiFile /> Detalle del cliente
            </p>
            <p>Nombre: {payload.nombre_cliente || "—"}</p>
            <p>Contacto: {payload.persona_contacto || "—"}</p>
            <p>Teléfono: {payload.celular_contacto || payload.celular || "—"}</p>
            <p>Dirección: {payload.direccion_cliente || "—"}</p>
            <p>Observación: {payload.observaciones || payload.observacion || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
