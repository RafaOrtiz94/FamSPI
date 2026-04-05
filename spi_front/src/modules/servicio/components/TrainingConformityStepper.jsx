import React, { useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { generateTrainingConformityPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";

const parseActionLines = (textValue) =>
  String(textValue || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const TrainingConformityStepper = ({ workflowContext = null, onCompleted = null }) => {
  const { showToast } = useUI();
  const [clientName, setClientName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [clientSignerName, setClientSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [isConformant, setIsConformant] = useState(true);
  const [notes, setNotes] = useState("");
  const [actionsText, setActionsText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleSubmit = async () => {
    if (!workflowContext?.source_type || !workflowContext?.source_id) {
      showToast("Define source_type y source_id en el workflow antes de registrar conformidad", "error");
      return;
    }
    if (!clientSignerName.trim()) {
      showToast("El nombre del firmante del cliente es obligatorio", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        client_name: clientName || null,
        equipment_name: equipmentName || null,
        client_signer_name: clientSignerName.trim(),
        signer_role: signerRole.trim() || null,
        is_conformant: isConformant,
        notes: notes.trim() || null,
        pending_actions: parseActionLines(actionsText),
      };
      const response = await generateTrainingConformityPDF(payload, workflowContext);
      setLastResult(response || null);
      if (response?.ok) {
        showToast("Conformidad final registrada (F.ST-12)", "success");
        if (typeof onCompleted === "function") onCompleted(response);
      } else {
        showToast(response?.message || "No se pudo registrar F.ST-12", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Error registrando conformidad", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-base font-semibold text-slate-900">F.ST-12 · Conformidad final</h3>
        <p className="mt-1 text-xs text-slate-600">
          Define resultado conforme/no conforme y acciones pendientes antes del certificado.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Cliente"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={equipmentName}
            onChange={(event) => setEquipmentName(event.target.value)}
            placeholder="Equipo"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={clientSignerName}
            onChange={(event) => setClientSignerName(event.target.value)}
            placeholder="Nombre firmante cliente *"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={signerRole}
            onChange={(event) => setSignerRole(event.target.value)}
            placeholder="Cargo firmante"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={isConformant ? "yes" : "no"}
            onChange={(event) => setIsConformant(event.target.value === "yes")}
            className="w-full rounded-lg border px-3 py-2 text-sm md:col-span-2"
          >
            <option value="yes">Conforme</option>
            <option value="no">No conforme</option>
          </select>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observaciones de conformidad"
            className="w-full rounded-lg border px-3 py-2 text-sm md:col-span-2"
            rows={3}
          />
          <textarea
            value={actionsText}
            onChange={(event) => setActionsText(event.target.value)}
            placeholder="Acciones pendientes (una por línea)"
            className="w-full rounded-lg border px-3 py-2 text-sm md:col-span-2"
            rows={3}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button icon={FiCheckCircle} onClick={handleSubmit} loading={isSubmitting}>
            Registrar F.ST-12
          </Button>
        </div>
      </Card>

      {lastResult?.ok ? (
        <Card className="border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">
            Conformidad registrada en expediente.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            PDF: {lastResult?.pdfId || "N/D"} · Carpeta: {lastResult?.driveFolderId || "N/D"}
          </p>
        </Card>
      ) : null}
    </div>
  );
};

export default TrainingConformityStepper;
