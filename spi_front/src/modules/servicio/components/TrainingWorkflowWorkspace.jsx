import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { getTrainingWorkflow } from "../../../core/api/servicioApi";
import EntrenamientoStepper from "./EntrenamientoStepper";
import AsistenciaStepper from "./AsistenciaStepper";
import TrainingEvaluationStepper from "./TrainingEvaluationStepper";
import TrainingConformityStepper from "./TrainingConformityStepper";
import TrainingCertificatePanel from "./TrainingCertificatePanel";
import WorkflowTimeline from "./WorkflowTimeline";
import WorkflowDocumentsPanel from "./WorkflowDocumentsPanel";

const STAGES = [
  { key: "coordination", label: "Coordinación (F.ST-04)" },
  { key: "attendance", label: "Asistencia (F.ST-05)" },
  { key: "evaluation", label: "Evaluación participante (F.ST-06)" },
  { key: "specialist", label: "Evaluación especialista (F.ST-08)" },
  { key: "conformity", label: "Conformidad final (F.ST-12)" },
  { key: "certificate", label: "Certificado" },
];

const TrainingWorkflowWorkspace = () => {
  const [searchParams] = useSearchParams();
  const [sourceType, setSourceType] = useState(searchParams.get("source_type") || "manual");
  const [sourceId, setSourceId] = useState(searchParams.get("source_id") || "");
  const [requestId, setRequestId] = useState(searchParams.get("request_id") || "");
  const [activeStage, setActiveStage] = useState("coordination");
  const [workflow, setWorkflow] = useState(null);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [workflowError, setWorkflowError] = useState("");

  const workflowContext = useMemo(
    () => ({
      source_type: sourceType || undefined,
      source_id: sourceId || undefined,
      request_id: requestId || undefined,
    }),
    [sourceType, sourceId, requestId],
  );

  const refreshWorkflow = async () => {
    if (!sourceType || !sourceId) return;
    setLoadingWorkflow(true);
    setWorkflowError("");
    try {
      const detail = await getTrainingWorkflow({
        source_type: sourceType,
        source_id: sourceId,
      });
      setWorkflow(detail || null);
    } catch (error) {
      const status = error?.response?.status;
      if (status !== 404) {
        setWorkflowError(error?.response?.data?.error || error?.message || "No se pudo consultar el workflow");
      } else {
        setWorkflow(null);
      }
    } finally {
      setLoadingWorkflow(false);
    }
  };

  useEffect(() => {
    refreshWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 p-3">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Workflow ST-01-01</p>
            <h3 className="text-lg font-semibold text-slate-900">Entrenamiento técnico y aplicaciones</h3>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="manual">manual</option>
              <option value="public_purchase">public_purchase</option>
              <option value="private_purchase">private_purchase</option>
              <option value="business_case">business_case</option>
              <option value="commercial_request">commercial_request</option>
              <option value="maintenance_case">maintenance_case</option>
              <option value="corrective_case">corrective_case</option>
              <option value="external_case">external_case</option>
            </select>
            <input
              value={sourceId}
              onChange={(event) => setSourceId(event.target.value)}
              placeholder="source_id"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              placeholder="request_id (opcional)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <Button variant="secondary" onClick={refreshWorkflow} loading={loadingWorkflow}>
              Sincronizar
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            Estado: {workflow?.event?.status || "sin iniciar"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            Etapa: {workflow?.event?.stage || "coordination"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            Asistencia: {workflow?.event?.attendance_percent ?? 0}%
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            Evaluación: {workflow?.event?.evaluation_percent ?? 0}%
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
            Certificado: {workflow?.event?.certificate_status || "pending"}
          </span>
        </div>
        {workflowError ? <p className="mt-2 text-xs text-rose-700">{workflowError}</p> : null}
      </Card>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          {STAGES.map((stage) => (
            <button
              key={stage.key}
              type="button"
              onClick={() => setActiveStage(stage.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                activeStage === stage.key
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </Card>

      {activeStage === "coordination" ? (
        <EntrenamientoStepper
          workflowContext={workflowContext}
          onCompleted={refreshWorkflow}
          hideHeader
        />
      ) : null}
      {activeStage === "attendance" ? (
        <AsistenciaStepper
          workflowContext={workflowContext}
          onCompleted={refreshWorkflow}
          hideHeader
        />
      ) : null}
      {activeStage === "evaluation" ? (
        <TrainingEvaluationStepper
          workflowContext={workflowContext}
          mode="participant"
          onCompleted={refreshWorkflow}
        />
      ) : null}
      {activeStage === "specialist" ? (
        <TrainingEvaluationStepper
          workflowContext={workflowContext}
          mode="specialist"
          onCompleted={refreshWorkflow}
        />
      ) : null}
      {activeStage === "conformity" ? (
        <TrainingConformityStepper
          workflowContext={workflowContext}
          onCompleted={refreshWorkflow}
        />
      ) : null}
      {activeStage === "certificate" ? (
        <TrainingCertificatePanel
          workflowContext={workflowContext}
          workflow={workflow}
          onRefresh={refreshWorkflow}
        />
      ) : null}

      {sourceType && sourceId ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <WorkflowTimeline sourceType={sourceType} sourceId={sourceId} />
          <WorkflowDocumentsPanel sourceType={sourceType} sourceId={sourceId} />
        </div>
      ) : null}
    </div>
  );
};

export default TrainingWorkflowWorkspace;
