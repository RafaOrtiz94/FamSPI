import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiRefreshCw,
  FiFileText,
  FiX,
  FiMapPin,
  FiUsers,
  FiActivity,
  FiClock,
} from "react-icons/fi";
import { getRequests } from "../../../core/api/requestsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import SolicitudesGrid from "../comercial/components/SolicitudesGrid";

const normalizeStatus = (status) => {
  const value = String(status || "").toLowerCase();
  if (["aprobado", "approved"].includes(value)) return "approved";
  if (["rechazado", "rejected"].includes(value)) return "rejected";
  if (["acta_generada", "acta_generated"].includes(value)) return "acta_generated";
  if (["modificada", "modified"].includes(value)) return "modified";
  if (["en_revision", "in_review"].includes(value)) return "in_review";
  return "pending";
};

const statusStyles = (status) => {
  switch (normalizeStatus(status)) {
    case "approved":
      return {
        label: "Aprobada",
        badge: "bg-green-100 text-green-700 border-green-200",
        dot: "bg-green-500",
      };
    case "rejected":
      return {
        label: "Rechazada",
        badge: "bg-red-100 text-red-700 border-red-200",
        dot: "bg-red-500",
      };
    case "in_review":
      return {
        label: "En revisión",
        badge: "bg-blue-100 text-blue-700 border-blue-200",
        dot: "bg-blue-500",
      };
    case "acta_generated":
      return {
        label: "Acta generada",
        badge: "bg-purple-100 text-purple-700 border-purple-200",
        dot: "bg-purple-500",
      };
    default:
      return {
        label: "Pendiente",
        badge: "bg-amber-100 text-amber-700 border-amber-200",
        dot: "bg-amber-500",
      };
  }
};

const parsePayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch (err) {
      return {};
    }
  }
  return payload;
};

const SolicitudesTecnicas = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState({ open: false, data: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRequests({ pageSize: 50 });
      if (Array.isArray(data?.rows)) return setRequests(data.rows);
      if (Array.isArray(data?.result?.rows)) return setRequests(data.result.rows);
      if (Array.isArray(data?.data?.rows)) return setRequests(data.data.rows);
      if (Array.isArray(data)) return setRequests(data);
      setRequests([]);
    } catch (err) {
      console.warn("No se pudieron cargar solicitudes", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mapped = useMemo(
    () =>
      (requests || []).map((r) => ({
        ...r,
        status: normalizeStatus(r.status),
        payload: parsePayload(r.payload),
      })),
    [requests]
  );

  const openDetail = (item) => setDetail({ open: true, data: item });
  const closeDetail = () => setDetail({ open: false, data: null });

  const detailStyles = statusStyles(detail.data?.status);
  const detailPayload = detail.data?.payload || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-500">Gestión de solicitudes</p>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitudes técnicas</h1>
        </div>
        <Button variant="secondary" icon={FiRefreshCw} onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Solicitudes en curso</h2>
            <p className="text-sm text-gray-500">Revisa cada tarjeta y abre el detalle para gestionar.</p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Cargando...</div>
        ) : (
          <SolicitudesGrid items={mapped} onView={openDetail} />
        )}
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Crear o revisar solicitudes</h3>
          <p className="text-sm text-gray-600">
            Ingresa al flujo completo para generar nuevas solicitudes o aprobar las existentes.
          </p>
        </div>
        <a
          href="/requests"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          <FiFileText /> Ir a solicitudes
        </a>
      </Card>

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
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Solicitud #{detail.data?.id || "—"}
                      </p>
                      <Dialog.Title className="text-xl font-bold text-gray-900">
                        {detailPayload?.nombre_cliente || detailPayload?.cliente || detail.data?.type_title || "Detalle de solicitud"}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">{detail.data?.type_title || detail.data?.type_name || "Tipo de solicitud"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-50">
                        <span className={`absolute h-3 w-3 rounded-full ${detailStyles.dot}`} aria-hidden />
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${detailStyles.badge}`}>
                        {detailStyles.label}
                      </span>
                      <button
                        onClick={closeDetail}
                        className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                        aria-label="Cerrar"
                      >
                        <FiX />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <FiUsers /> Datos del solicitante
                      </div>
                      <p className="text-gray-600">Solicitante: {detail.data?.requester_email || "—"}</p>
                      <p className="text-gray-600">Contacto: {detailPayload?.persona_contacto || "—"}</p>
                      <p className="text-gray-600">Teléfono: {detailPayload?.celular_contacto || detailPayload?.celular || "—"}</p>
                      <p className="text-gray-600">Dirección: {detailPayload?.direccion_cliente || "—"}</p>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 space-y-2">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <FiActivity /> Estado y asignación
                      </div>
                      <p className="text-gray-600">Estado: {detailStyles.label}</p>
                      <p className="text-gray-600">Asignado a: {detail.data?.assigned_to_name || detailPayload?.asignado_a || "No asignado"}</p>
                      <p className="text-gray-600">
                        Creado: {detail.data?.created_at ? new Date(detail.data.created_at).toLocaleString("es-EC") : "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <FiMapPin /> Detalle de la solicitud
                      </div>
                      <p>Equipo principal: {detailPayload?.equipo_principal || detailPayload?.equipo || detailPayload?.producto || "—"}</p>
                      <p>Observaciones: {detailPayload?.observaciones || detailPayload?.observacion || "—"}</p>
                      <p>Ubicación cliente: {detailPayload?.direccion_cliente || "No especificada"}</p>
                      {detailPayload?.lat && detailPayload?.lng && (
                        <a
                          href={`https://www.google.com/maps?q=${detailPayload.lat},${detailPayload.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-blue-600 text-sm font-semibold"
                        >
                          <FiMapPin /> Ver en mapa
                        </a>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700 space-y-2 md:col-span-2">
                      <div className="flex items-center gap-2 text-gray-900 font-semibold">
                        <FiClock /> Historial
                      </div>
                      <p>
                        Última actualización: {detail.data?.updated_at ? new Date(detail.data.updated_at).toLocaleString("es-EC") : "No disponible"}
                      </p>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default SolicitudesTecnicas;
