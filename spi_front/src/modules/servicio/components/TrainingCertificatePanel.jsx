import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiRefreshCw } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import {
  issueTrainingCertificate,
  deliverTrainingCertificate,
} from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";

const formatDate = (value) => {
  if (!value) return "N/D";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "N/D";
  return parsed.toLocaleString("es-EC");
};

const TrainingCertificatePanel = ({
  workflowContext = null,
  workflow = null,
  onRefresh = null,
}) => {
  const { showToast } = useUI();
  const [certificateNumber, setCertificateNumber] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [deliveryEvidence, setDeliveryEvidence] = useState("");
  const [selectedCertificateId, setSelectedCertificateId] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);

  const certificates = useMemo(
    () => (Array.isArray(workflow?.certificates) ? workflow.certificates : []),
    [workflow],
  );

  const certificateStatus = workflow?.event?.certificate_status || "pending";
  const trainingStatus = workflow?.event?.status || "draft";

  const handleIssue = async () => {
    if (!workflowContext?.source_type || !workflowContext?.source_id) {
      showToast("Define source_type y source_id para emitir certificado", "error");
      return;
    }
    setIsIssuing(true);
    try {
      const response = await issueTrainingCertificate(
        {
          certificate_number: certificateNumber || null,
          participant_name: participantName || null,
        },
        workflowContext,
      );
      if (response?.ok) {
        showToast("Certificado emitido correctamente", "success");
        if (typeof onRefresh === "function") onRefresh();
      } else {
        showToast(response?.message || "No se pudo emitir certificado", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Error emitiendo certificado", "error");
    } finally {
      setIsIssuing(false);
    }
  };

  const handleDeliver = async () => {
    if (!workflowContext?.source_type || !workflowContext?.source_id) {
      showToast("Define source_type y source_id para registrar entrega", "error");
      return;
    }
    setIsDelivering(true);
    try {
      const response = await deliverTrainingCertificate(
        {
          certificate_id: selectedCertificateId || null,
          delivery_evidence: deliveryEvidence || null,
        },
        workflowContext,
      );
      if (response?.ok) {
        showToast("Entrega de certificado registrada", "success");
        if (typeof onRefresh === "function") onRefresh();
      } else {
        showToast(response?.message || "No se pudo registrar entrega", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Error registrando entrega", "error");
    } finally {
      setIsDelivering(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Certificación de entrenamiento</h3>
            <p className="mt-1 text-xs text-slate-600">
              Estado entrenamiento: <strong>{trainingStatus}</strong> · Estado certificado: <strong>{certificateStatus}</strong>
            </p>
          </div>
          <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={onRefresh}>
            Recargar
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={certificateNumber}
            onChange={(event) => setCertificateNumber(event.target.value)}
            placeholder="Número de certificado"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={participantName}
            onChange={(event) => setParticipantName(event.target.value)}
            placeholder="Participante (opcional)"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3">
          <Button icon={FiCheckCircle} onClick={handleIssue} loading={isIssuing}>
            Emitir certificado (30 días para entrega)
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-slate-900">Entrega de certificado</h4>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <select
            value={selectedCertificateId}
            onChange={(event) => setSelectedCertificateId(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">Último certificado emitido</option>
            {certificates.map((certificate) => (
              <option key={certificate.id} value={certificate.id}>
                #{certificate.id} · {certificate.certificate_number || "SIN-NÚMERO"} · {certificate.status}
              </option>
            ))}
          </select>
          <input
            value={deliveryEvidence}
            onChange={(event) => setDeliveryEvidence(event.target.value)}
            placeholder="Evidencia de entrega (drive id, acta, observación)"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3">
          <Button variant="success" icon={FiCheckCircle} onClick={handleDeliver} loading={isDelivering}>
            Registrar entrega
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-slate-900">Historial de certificados</h4>
        {certificates.length === 0 ? (
          <p className="mt-2 text-xs text-slate-600">Aún no existen certificados emitidos.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {certificates.slice(0, 6).map((certificate) => (
              <div key={certificate.id} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-700">
                <p>
                  <strong>#{certificate.id}</strong> · {certificate.certificate_number || "SIN-NÚMERO"} · Estado: {certificate.status}
                </p>
                <p>Emitido: {formatDate(certificate.issued_at)} · Entregado: {formatDate(certificate.delivered_at)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default TrainingCertificatePanel;
