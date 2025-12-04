import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiCheck, FiRefreshCw, FiX } from "react-icons/fi";
import DashboardLayout from "../../../core/layout/DashboardLayout";
import { useUI } from "../../../core/ui/useUI";
import { useApi } from "../../../core/hooks/useApi";
import { getClientRequestById, processClientRequest } from "../../../core/api/requestsApi";
import Button from "../../../core/ui/components/Button";

const ClientRequestReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUI();
  const { data, loading, execute: fetchRequest } = useApi(getClientRequestById, {
    errorMsg: "No se pudo cargar la solicitud",
  });
  const [processing, setProcessing] = useState(null);

  const load = useCallback(async () => {
    await fetchRequest(id);
  }, [fetchRequest, id]);

  useEffect(() => {
    load();
  }, [load]);

  const request = data || {};
  const payload = request.payload || request.data || {};

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
      <p className="text-sm text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
        {children || "—"}
      </p>
    </div>
  );

  const renderContact = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Contacto">
        {payload.contact_name || payload.contact_person || payload.client_name || "—"}
      </Field>
      <Field label="Correo">
        {payload.contact_email || payload.client_email || payload.email || "—"}
      </Field>
      <Field label="Teléfono">
        {payload.contact_phone || payload.phone || payload.telefono || "—"}
      </Field>
      <Field label="Dirección">
        {payload.address || payload.direccion || payload.client_address || "—"}
      </Field>
    </div>
  );

  const renderBusinessData = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Cliente">{request.commercial_name || payload.client_name}</Field>
      <Field label="RUC/Cédula">{request.ruc_cedula || payload.ruc || payload.cedula}</Field>
      <Field label="Tipo de cliente">{payload.client_type || payload.tipo_cliente}</Field>
      <Field label="Provincia">{payload.province || payload.provincia}</Field>
      <Field label="Ciudad">{payload.city || payload.ciudad}</Field>
      <Field label="Actividad">{payload.activity || payload.giro_negocio}</Field>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
              onClick={load}
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
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Datos del cliente</h2>
              {renderBusinessData()}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Contacto</h2>
              {renderContact()}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Información adicional</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Estado">{request.status}</Field>
                <Field label="Creado por">{request.created_by || payload.created_by}</Field>
                <Field label="Creado el">
                  {request.created_at ? new Date(request.created_at).toLocaleString() : "—"}
                </Field>
                <Field label="Notas">{payload.notes || payload.observaciones}</Field>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Resumen</h2>
            <div className="space-y-2 text-sm text-gray-800">
              <div className="flex justify-between">
                <span className="text-gray-500">Solicitante</span>
                <span>{request.created_by || payload.created_by || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                <span className="uppercase text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {(request.status || "pendiente").replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Documento</span>
                <span>{request.ruc_cedula || payload.ruc || payload.cedula || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Nombre</span>
                <span>{request.commercial_name || payload.client_name || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientRequestReview;
