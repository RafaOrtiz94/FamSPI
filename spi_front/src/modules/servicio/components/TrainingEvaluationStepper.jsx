import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiPlus, FiTrash2 } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import {
  generateTrainingEvaluationPDF,
  generateTrainingSpecialistEvaluationPDF,
} from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";

const buildEmptyParticipant = (id) => ({
  id,
  full_name: "",
  role_title: "",
  email: "",
  score: "",
  comments: "",
  corrective_action: "",
});

const toScore = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
};

const TrainingEvaluationStepper = ({
  workflowContext = null,
  mode = "participant",
  onCompleted = null,
}) => {
  const isSpecialistMode = mode === "specialist";
  const { showToast } = useUI();
  const [clientName, setClientName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [specialistName, setSpecialistName] = useState("");
  const [evaluatorName, setEvaluatorName] = useState("");
  const [participants, setParticipants] = useState([buildEmptyParticipant(1)]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const validParticipants = useMemo(
    () => participants.filter((participant) => String(participant.full_name || "").trim()),
    [participants],
  );

  const updateParticipant = (id, patch = {}) => {
    setParticipants((prev) =>
      prev.map((participant) => (
        participant.id === id ? { ...participant, ...patch } : participant
      )),
    );
  };

  const addParticipant = () => {
    setParticipants((prev) => [...prev, buildEmptyParticipant(prev.length + 1)]);
  };

  const removeParticipant = (id) => {
    setParticipants((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((participant) => participant.id !== id);
    });
  };

  const handleSubmit = async () => {
    if (!workflowContext?.source_type || !workflowContext?.source_id) {
      showToast("Define source_type y source_id en el workflow antes de registrar evaluación", "error");
      return;
    }

    if (!validParticipants.length) {
      showToast("Debe registrar al menos un participante evaluado", "error");
      return;
    }

    const normalizedParticipants = validParticipants.map((participant) => {
      const normalized = {
        full_name: String(participant.full_name || "").trim(),
        role_title: String(participant.role_title || "").trim(),
        email: String(participant.email || "").trim(),
      };
      if (isSpecialistMode) {
        normalized.specialist_score = toScore(participant.score);
        normalized.comments = String(participant.comments || "").trim();
        normalized.corrective_action = String(participant.corrective_action || "").trim();
      } else {
        normalized.evaluation_score = toScore(participant.score);
        normalized.remarks = String(participant.comments || "").trim();
      }
      return normalized;
    });

    if (normalizedParticipants.some((participant) => !Number.isFinite(participant.evaluation_score ?? participant.specialist_score))) {
      showToast("Todos los participantes deben tener puntaje numérico entre 0 y 100", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        client_name: clientName || null,
        equipment_name: equipmentName || null,
        specialist_name: specialistName || null,
        evaluator_name: evaluatorName || null,
        participants: normalizedParticipants,
      };
      const response = isSpecialistMode
        ? await generateTrainingSpecialistEvaluationPDF(payload, workflowContext)
        : await generateTrainingEvaluationPDF(payload, workflowContext);
      setLastResult(response || null);
      if (response?.ok) {
        showToast(
          isSpecialistMode
            ? "Evaluación del especialista registrada"
            : "Evaluación de participantes registrada",
          "success",
        );
        if (typeof onCompleted === "function") onCompleted(response);
      } else {
        showToast(response?.message || "No se pudo registrar la evaluación", "error");
      }
    } catch (error) {
      showToast(error?.response?.data?.message || "Error registrando evaluación", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-base font-semibold text-slate-900">
          {isSpecialistMode ? "F.ST-08 · Evaluación del especialista" : "F.ST-06 · Evaluación de participantes"}
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          Registra puntajes para regla de aprobación (asistencia 100% + evaluación mínima 80%).
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
            value={specialistName}
            onChange={(event) => setSpecialistName(event.target.value)}
            placeholder="Especialista"
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <input
            value={evaluatorName}
            onChange={(event) => setEvaluatorName(event.target.value)}
            placeholder={isSpecialistMode ? "Evaluador del especialista" : "Evaluador"}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Participantes evaluados</h4>
          <Button size="sm" variant="secondary" icon={FiPlus} onClick={addParticipant}>
            Agregar
          </Button>
        </div>

        <div className="mt-3 space-y-3">
          {participants.map((participant) => (
            <div key={participant.id} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input
                  value={participant.full_name}
                  onChange={(event) => updateParticipant(participant.id, { full_name: event.target.value })}
                  placeholder="Nombre participante"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <input
                  value={participant.role_title}
                  onChange={(event) => updateParticipant(participant.id, { role_title: event.target.value })}
                  placeholder="Cargo"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <input
                  value={participant.email}
                  onChange={(event) => updateParticipant(participant.id, { email: event.target.value })}
                  placeholder="Correo electrónico"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={participant.score}
                  onChange={(event) => updateParticipant(participant.id, { score: event.target.value })}
                  placeholder="Puntaje (0-100)"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <textarea
                  value={participant.comments}
                  onChange={(event) => updateParticipant(participant.id, { comments: event.target.value })}
                  placeholder={isSpecialistMode ? "Comentarios de evaluación especialista" : "Observaciones"}
                  className="w-full rounded-lg border px-3 py-2 text-sm md:col-span-2"
                  rows={2}
                />
                {isSpecialistMode ? (
                  <textarea
                    value={participant.corrective_action}
                    onChange={(event) => updateParticipant(participant.id, { corrective_action: event.target.value })}
                    placeholder="Acción correctiva"
                    className="w-full rounded-lg border px-3 py-2 text-sm md:col-span-2"
                    rows={2}
                  />
                ) : null}
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="danger"
                  icon={FiTrash2}
                  onClick={() => removeParticipant(participant.id)}
                  disabled={participants.length <= 1}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-600">
            Registros válidos: {validParticipants.length}
          </p>
          <Button icon={FiCheckCircle} onClick={handleSubmit} loading={isSubmitting}>
            {isSpecialistMode ? "Registrar F.ST-08" : "Registrar F.ST-06"}
          </Button>
        </div>
      </Card>

      {lastResult?.ok ? (
        <Card className="border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">
            Documento generado y registrado en expediente.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            PDF: {lastResult?.pdfId || "N/D"} · Carpeta: {lastResult?.driveFolderId || "N/D"}
          </p>
        </Card>
      ) : null}
    </div>
  );
};

export default TrainingEvaluationStepper;
