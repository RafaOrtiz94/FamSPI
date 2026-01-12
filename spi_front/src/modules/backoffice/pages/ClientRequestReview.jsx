import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiRefreshCw, FiX } from "react-icons/fi";
import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";
import { getClientRequestById, processClientRequest } from "../../../core/api/requestsApi";
import Button from "../../../core/ui/components/Button";

const fieldLabels = {
  commercial_name: "Razón social",
  ruc_cedula: "RUC / Cédula",
  client_type: "Tipo de cliente",
  establishment_name: "Nombre del establecimiento",
  establishment_province: "Provincia de establecimiento",
  establishment_city: "Ciudad de establecimiento",
  establishment_address: "Dirección de establecimiento",
  establishment_reference: "Referencia de establecimiento",
  establishment_phone: "Teléfono del establecimiento",
  establishment_cellphone: "Celular del establecimiento",
  shipping_contact_name: "Contacto de entrega",
  shipping_address: "Dirección de entrega",
  shipping_city: "Ciudad de entrega",
  shipping_province: "Provincia de entrega",
  shipping_reference: "Referencia de entrega",
  shipping_phone: "Teléfono de entrega",
  shipping_cellphone: "Celular de entrega",
  client_email: "Correo del cliente",
  legal_rep_name: "Representante legal",
  legal_rep_position: "Cargo del representante",
  legal_rep_id_document: "Documento del representante",
  legal_rep_cellphone: "Celular del representante",
  legal_rep_email: "Correo del representante",
  operating_permit_status: "Permiso operativo",
  consent_capture_details: "Detalles del consentimiento",
  consent_recipient_email: "Correo receptor de consentimiento",
  consent_capture_method: "Método de consentimiento",
  lopdp_consent_method: "Método LOPDP",
  activity: "Actividad económica",
  nationality: "Nacionalidad",
  client_sector: "Sector del cliente",
  created_by: "Creado por",
  consent_history: "Historial de consentimiento",
};

const excludedFields = new Set([
  "payload",
  "data",
  "attachments",
  "created_at",
  "updated_at",
  "status",
  "client_id",
  "user_id",
  "id",
  "lopdp_token",
  "lopdp_consent_status",
  "drive_folder_id",
  "legal_rep_appointment_file_id",
  "ruc_file_id",
  "id_file_id",
  "consent_email_token_id",
  "approval_letter_file_id",
  "approval_status",
  "consent_history",
]);

const formatValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value, null, 0);
  return value.toString();
};

const ClientRequestReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUI();
  const { data, loading, execute: fetchRequest } = useApi(getClientRequestById, {
    errorMsg: "No se pudo cargar la solicitud",
    transformResponse: (response) => response,
  });
  const [processing, setProcessing] = useState(null);
  const fetchRequestRef = useRef(fetchRequest);

  useEffect(() => {
    fetchRequestRef.current = fetchRequest;
  }, [fetchRequest]);

  const refresh = () => fetchRequestRef.current(id);
  useEffect(() => {
    refresh();
  }, [id]);

  const requestDetail = data?.data || data?.result || data?.payload || data || {};
  const payload = requestDetail?.payload || requestDetail?.data || requestDetail;
  const attachments = Array.isArray(requestDetail.attachments) ? requestDetail.attachments : [];
  const normalizedFields = Object.entries(requestDetail)
    .filter(([key, value]) => !excludedFields.has(key) && value !== null && value !== undefined)
    .map(([key, value]) => ({ key, value }));

  const handleProcess = async (action) => {
    let reason;
    if (action === "reject") {
      reason = window.prompt("Motivo del rechazo");
      if (reason === null) return;
    }

    setProcessing(action);
    try {
      await processClientRequest(id, action, reason);
      showToast(action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada", "success");
      navigate("/dashboard/backoffice/client-requests");
    } catch (error) {
      console.error(error);
      showToast("No se pudo procesar la solicitud", "error");
    } finally {
      setProcessing(null);
    }
  };

  const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2 break-words">{children || "—"}</p>
    </div>
  );

  const renderContact = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Contacto">
        {requestDetail.shipping_contact_name ||
          payload.contact_name ||
          payload.contact_person ||
          "—"}
      </Field>
      <Field label="Correo">
        {requestDetail.shipping_email ||
          requestDetail.client_email ||
          payload.contact_email ||
          payload.client_email ||
          "—"}
      </Field>
      <Field label="Teléfono">
        {requestDetail.shipping_phone || payload.contact_phone || payload.phone || "—"}
      </Field>
      <Field label="Dirección">
        {requestDetail.shipping_address ||
          requestDetail.establishment_address ||
          payload.address ||
          payload.direccion ||
          payload.client_address ||
          "—"}
      </Field>
    </div>
  );

  const renderBusinessData = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Cliente">{requestDetail.commercial_name || payload.client_name || "—"}</Field>
      <Field label="RUC/Cédula">{requestDetail.ruc_cedula || payload.ruc || payload.cedula || "—"}</Field>
      <Field label="Tipo de cliente">{requestDetail.client_type || payload.client_type || "—"}</Field>
      <Field label="Provincia">
        {requestDetail.establishment_province || payload.province || payload.provincia || "—"}
      </Field>
      <Field label="Ciudad">
        {requestDetail.establishment_city || payload.city || payload.ciudad || "—"}
      </Field>
      <Field label="Actividad">
        {requestDetail.activity || payload.activity || payload.giro_negocio || "—"}
      </Field>
    </div>
  );

  const renderAttachments = () => {
    if (!attachments.length) return null;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Documentos adjuntos</h2>
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <a
              key={attachment.file_id || attachment.key || attachment.label}
              href={attachment.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700 hover:border-blue-200 hover:bg-white transition"
            >
              <span>{attachment.label || attachment.key}</span>
              <span className="text-xs text-blue-600">Ver</span>
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2"
          >
            <FiArrowLeft /> Volver
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Revisión de solicitud #{id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
          <Button
            variant="success"
            leftIcon={<FiCheck />}
            loading={processing === "approve"}
            onClick={() => handleProcess("approve")}
          >
            Aprobar
          </Button>
          <Button
            variant="danger"
            leftIcon={<FiX />}
            loading={processing === "reject"}
            onClick={() => handleProcess("reject")}
          >
            Rechazar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Datos del cliente</h2>
            {renderBusinessData()}
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Contacto y ubicación</h2>
            {renderContact()}
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Información adicional</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Estado">{requestDetail.status || requestDetail.approval_status || "—"}</Field>
              <Field label="Creado por">{requestDetail.created_by || payload.created_by || "—"}</Field>
              <Field label="Creado el">
                {requestDetail.created_at ? new Date(requestDetail.created_at).toLocaleString() : "—"}
              </Field>
              <Field label="Notas">{payload.notes || payload.observaciones || "—"}</Field>
            </div>
          </section>
        </div>
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
            <div className="space-y-2 text-sm text-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-500">Solicitante</span>
                <span>{requestDetail.created_by || payload.created_by || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                <span className="uppercase text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {(requestDetail.status || "pendiente").replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Documento</span>
                <span>{requestDetail.ruc_cedula || payload.ruc || payload.cedula || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nombre</span>
                <span>{requestDetail.commercial_name || payload.client_name || "—"}</span>
              </div>
            </div>
          </section>
          {renderAttachments()}
        </div>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Todos los campos registrados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {normalizedFields.map(({ key, value }) => (
            <div
              key={key}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm leading-snug text-gray-800"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {fieldLabels[key] || key.replace(/_/g, " ")}
              </p>
              <p className="mt-1 break-words">{formatValue(value)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default ClientRequestReview;
