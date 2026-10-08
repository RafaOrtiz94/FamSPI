import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { generateTrainingCoordinationPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import FirmaDigital from "./FirmaDigital";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import "../design/tokens.css";

const STEPS = [
  { id: "orden", title: "Datos de la Orden", description: "Información básica de la orden de entrenamiento" },
  { id: "planificacion", title: "Planificación del Entrenamiento", description: "Fechas, duración y recursos del entrenamiento" },
  { id: "observaciones", title: "Observaciones", description: "Comentarios adicionales sobre el entrenamiento" },
  { id: "certificacion", title: "Certificación y Firma", description: "Firma digital de compromiso" },
];

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };
const labelClass = "mb-1 block text-sm font-medium";
const labelStyle = { color: "var(--st-text-muted)" };

const EntrenamientoStepper = ({ workflowContext: workflowContextProp = null, onCompleted = null, hideHeader = false }) => {
  const [searchParams] = useSearchParams();
  const queryWorkflowContext = {
    source_type: searchParams.get("source_type") || undefined,
    source_id: searchParams.get("source_id") || undefined,
    request_id: searchParams.get("request_id") || undefined,
  };
  const workflowContext = workflowContextProp || queryWorkflowContext;
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const { showToast } = useUI();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      Fecha_Inicio: new Date().toISOString().split("T")[0],
      Fecha_final: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      Dias: 5,
      Horas: 8,
      Num_P: 1,
      Obs_1: "",
      Obs_2: "",
      Obs_3: "",
      Obs_4: "",
    },
  });

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };
  const prevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };
  const goToStep = (stepIndex) => {
    if (stepIndex <= Math.max(...completedSteps) + 1) setCurrentStep(stepIndex);
  };

  const handleSignatureCapture = (signatureData) => {
    setValue("Firma_af_image", signatureData);
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);

      if (!data.Firma_af_image || data.Firma_af_image.length < 10) {
        showToast("Debe firmar digitalmente antes de completar el registro", "error");
        setIsGeneratingPDF(false);
        return;
      }

      const fechaInicio = new Date(data.Fecha_Inicio);
      const fechaFinal = new Date(data.Fecha_final);
      if (fechaFinal < fechaInicio) {
        showToast("La fecha de finalización debe ser igual o posterior a la fecha de inicio", "error");
        setIsGeneratingPDF(false);
        return;
      }

      if (data.Dias <= 0 || data.Horas <= 0 || data.Num_P < 1) {
        showToast("Los valores de duración deben ser mayores a cero y al menos 1 profesional", "error");
        setIsGeneratingPDF(false);
        return;
      }

      const pdfData = {
        ORDNumero: data.ORDNumero,
        ORDCliente: data.ORDCliente,
        ORDEquipo: data.ORDEquipo,
        ORDSerie: data.ORDSerie,
        ORDResponsable: data.ORDResponsable,
        Fecha_Inicio: data.Fecha_Inicio,
        Fecha_final: data.Fecha_final,
        Dias: data.Dias,
        Horas: data.Horas,
        Num_P: data.Num_P,
        Obs_1: data.Obs_1 || "",
        Obs_2: data.Obs_2 || "",
        Obs_3: data.Obs_3 || "",
        Obs_4: data.Obs_4 || "",
        Firma_af_image: data.Firma_af_image,
      };

      const result = await generateTrainingCoordinationPDF(pdfData, workflowContext);

      if (result.ok) {
        setIsCompleted(true);
        setCompletionData(result);
        if (typeof onCompleted === "function") onCompleted(result);
        showToast(`Coordinación registrada: ${result.ordenNumero} - ${result.cliente}`, "success");
      } else {
        showToast(result.message || "Error al procesar la coordinación", "error");
      }
    } catch (error) {
      console.error("Error processing training coordination:", error);
      showToast(error.response?.data?.message || "Error al procesar la coordinación de entrenamiento", "error");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="mb-8 flex items-center justify-center">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <button
            onClick={() => goToStep(index)}
            disabled={index > Math.max(...completedSteps) + 1}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors"
            style={
              index === currentStep
                ? { background: "var(--st-accent)", borderColor: "var(--st-accent)", color: "#fff" }
                : completedSteps.has(index)
                  ? { background: "var(--st-success)", borderColor: "var(--st-success)", color: "#fff" }
                  : index <= Math.max(...completedSteps, 0) + 1
                    ? { borderColor: "var(--st-border)", color: "var(--st-text-muted)" }
                    : { borderColor: "var(--st-border)", color: "var(--st-text-faint)", cursor: "not-allowed" }
            }
          >
            {completedSteps.has(index) ? <FiCheckCircle className="h-5 w-5" /> : <span className="text-sm font-medium">{index + 1}</span>}
          </button>
          {index < STEPS.length - 1 && (
            <div className="mx-4 h-0.5 flex-1" style={{ background: completedSteps.has(index) ? "var(--st-success)" : "var(--st-border)" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const StepHeader = ({ title, description }) => (
    <div className="text-center">
      <h3 className="text-lg font-semibold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>{title}</h3>
      <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{description}</p>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <StepHeader title="Datos de la Orden" description="Información básica de la orden de coordinación de entrenamiento" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} style={labelStyle}>Número de Orden *</label>
                <input type="text" placeholder="ORD-2025-001" {...register("ORDNumero", { required: "El número de orden es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.ORDNumero && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDNumero.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Cliente *</label>
                <input type="text" placeholder="Nombre del cliente" {...register("ORDCliente", { required: "El cliente es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.ORDCliente && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDCliente.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} style={labelStyle}>Equipo *</label>
                <input type="text" placeholder="Equipo a capacitar" {...register("ORDEquipo", { required: "El equipo es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.ORDEquipo && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDEquipo.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Serie</label>
                <input type="text" placeholder="Número de serie (opcional)" {...register("ORDSerie")} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Responsable</label>
                <input type="text" placeholder="Responsable Famproject" {...register("ORDResponsable")} className={inputClass} style={inputStyle} />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <StepHeader title="Planificación del Entrenamiento" description="Fechas, duración y recursos del entrenamiento" />
            <ServicioCard className="p-4">
              <h4 className="mb-4 font-medium" style={{ color: "var(--st-text)" }}>Fechas del Entrenamiento</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} style={labelStyle}>Fecha Inicio *</label>
                  <input type="date" {...register("Fecha_Inicio", { required: "La fecha de inicio es obligatoria" })} className={inputClass} style={inputStyle} />
                  {errors.Fecha_Inicio && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Fecha_Inicio.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Fecha Finalización *</label>
                  <input type="date" {...register("Fecha_final", { required: "La fecha de finalización es obligatoria" })} className={inputClass} style={inputStyle} />
                  {errors.Fecha_final && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Fecha_final.message}</p>}
                </div>
              </div>
            </ServicioCard>

            <ServicioCard className="p-4">
              <h4 className="mb-4 font-medium" style={{ color: "var(--st-text)" }}>Duración del Entrenamiento</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className={labelClass} style={labelStyle}>Nº de Días *</label>
                  <input type="number" min="1" {...register("Dias", { required: "Los días son obligatorios", min: { value: 1, message: "Debe ser al menos 1 día" } })} className={inputClass} style={inputStyle} />
                  {errors.Dias && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Dias.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Nº Horas Diarias *</label>
                  <input type="number" min="1" {...register("Horas", { required: "Las horas son obligatorias", min: { value: 1, message: "Debe ser al menos 1 hora" } })} className={inputClass} style={inputStyle} />
                  {errors.Horas && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Horas.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Nº Profesionales *</label>
                  <input type="number" min="1" {...register("Num_P", { required: "El número de profesionales es obligatorio", min: { value: 1, message: "Debe ser al menos 1 profesional" } })} className={inputClass} style={inputStyle} />
                  {errors.Num_P && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Num_P.message}</p>}
                </div>
              </div>
            </ServicioCard>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <StepHeader title="Observaciones" description="Comentarios adicionales sobre el entrenamiento" />
            <ServicioCard className="p-4">
              <div className="space-y-4">
                <div>
                  <label className={labelClass} style={labelStyle}>Observación 1</label>
                  <textarea rows="2" placeholder="Comentarios adicionales, ajustes de agenda, limitaciones del cliente..." {...register("Obs_1")} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Observación 2</label>
                  <textarea rows="2" placeholder="Observaciones logísticas, reprogramaciones..." {...register("Obs_2")} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Observación 3</label>
                  <textarea rows="2" placeholder="Comentarios adicionales..." {...register("Obs_3")} className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Observación 4</label>
                  <textarea rows="2" placeholder="Comentarios finales..." {...register("Obs_4")} className={inputClass} style={inputStyle} />
                </div>
              </div>
            </ServicioCard>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <StepHeader title="Certificación y Firma" description="Firma digital de compromiso para la coordinación del entrenamiento" />
            <ServicioCard className="p-4">
              <h4 className="mb-4 font-medium" style={{ color: "var(--st-text)" }}>Firma Famproject</h4>
              <div onClick={(e) => e.preventDefault()}>
                <FirmaDigital onSignatureCapture={handleSignatureCapture} />
              </div>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-accent-soft)", background: "var(--st-accent-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-accent-strong)" }}>Certificación</h4>
              <p className="text-sm" style={{ color: "var(--st-accent-strong)" }}>
                "Con la presente certifico que: He coordinado las fechas del entrenamiento según lo solicitado. El entrenamiento se encuentra programado y confirmado según las especificaciones acordadas."
              </p>
            </ServicioCard>
          </div>
        );

      default:
        return null;
    }
  };

  if (isCompleted && completionData) {
    return (
      <div className="st-scope mx-auto max-w-4xl p-6">
        {!hideHeader && (
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--st-success-soft)" }}>
              <FiCheckCircle className="h-8 w-8" style={{ color: "var(--st-success)" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>¡Coordinación Completada!</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>La coordinación de entrenamiento ha sido registrada correctamente</p>
          </div>
        )}

        <ServicioCard className="mb-6 p-6">
          <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--st-text)" }}>Resumen de la Coordinación</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Estado del Proceso</label>
                <div className="mt-1"><ServicioBadge tone="success">Completado</ServicioBadge></div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Orden de Entrenamiento</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{completionData.ordenNumero}</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Cliente</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{completionData.cliente}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Archivo Generado</label>
                <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                  PDF de coordinación guardado en Drive
                </div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Ubicación en Drive</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Servicio Técnico / Entrenamiento / [ORDNumero]-[Cliente]-[Fecha]</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>ID de Carpeta</label>
                <p className="mt-1 break-all font-mono text-xs" style={{ color: "var(--st-text-faint)" }}>{completionData.driveFolderId}</p>
              </div>
            </div>
          </div>
        </ServicioCard>

        <div className="flex justify-center">
          <Button
            onClick={() => {
              setIsCompleted(false);
              setCompletionData(null);
              reset();
              setCurrentStep(0);
              setCompletedSteps(new Set());
            }}
            icon={FiUpload}
          >
            Nueva Coordinación de Entrenamiento
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="st-scope mx-auto max-w-4xl p-6">
      {!hideHeader && (
        <div className="mb-8">
          <h1 className="text-center text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Coordinación de la Fecha de Entrenamiento</h1>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--st-text-muted)" }}>Formulario F.ST-04 - V03 - Planificación de entrenamientos</p>
        </div>
      )}

      {renderStepIndicator()}

      <form onSubmit={handleSubmit(onSubmit)}>
        <ServicioCard className="mb-6 p-6">{renderStepContent()}</ServicioCard>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={prevStep} disabled={currentStep === 0} icon={FiChevronLeft}>Anterior</Button>
          <div className="text-sm" style={{ color: "var(--st-text-muted)" }}>Paso {currentStep + 1} de {STEPS.length}</div>
          {currentStep === STEPS.length - 1 ? (
            <Button type="submit" disabled={isGeneratingPDF} icon={FiCheckCircle}>{isGeneratingPDF ? "Procesando..." : "Completar Coordinación"}</Button>
          ) : (
            <Button type="button" onClick={nextStep} icon={FiChevronRight}>Siguiente</Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default EntrenamientoStepper;
