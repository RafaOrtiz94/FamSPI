import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload, FiAlertTriangle } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { generateDisinfectionPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import "../design/tokens.css";

const STEPS = [
  { id: "identification", title: "Identificación del Servicio", description: "Datos básicos del equipo y responsable" },
  { id: "epp", title: "Paso 1 - Seguridad Personal", description: "Colocación de EPP" },
  { id: "peo_separation", title: "Paso 2 - Partes Eléctricas y Ópticas", description: "Separación de componentes sensibles" },
  { id: "dry_cleaning", title: "Paso 3 - Limpieza en Seco", description: "Eliminación de polvo y residuos" },
  { id: "critical_procedures", title: "Pasos 4-7 - Procedimientos Críticos", description: "Enjuague, remoción y limpieza química" },
  { id: "drying_transfer", title: "Pasos 8-9 - Secado y Traslado", description: "Secado completo y traslado del equipo" },
  { id: "electrical_verification", title: "Paso 10 - Verificación Eléctrica", description: "Verificación de conexiones eléctricas" },
  { id: "documentation", title: "Pasos 11-12 - Documentación", description: "Registro del formato y certificados" },
  { id: "certification", title: "Certificación y Evidencia", description: "Firma digital y adjuntos fotográficos" },
];

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };
const labelClass = "mb-1 block text-sm font-medium";
const labelStyle = { color: "var(--st-text-muted)" };

const DesinfeccionStepper = () => {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const { showToast } = useUI();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fecha: new Date().toISOString().split("T")[0],
      chk_ductos: false,
      chk_cortopunzantes: false,
      chk_limpieza_cloro: false,
      chk_secado_cloro: false,
    },
  });

  const fileInputRef = useRef(null);
  const workflowContext = {
    source_type: searchParams.get("source_type") || undefined,
    source_id: searchParams.get("source_id") || undefined,
    request_id: searchParams.get("request_id") || undefined,
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex) => {
    if (stepIndex <= Math.max(...completedSteps) + 1) {
      setCurrentStep(stepIndex);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({ name: file.name, type: file.type, data: reader.result, size: file.size });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }),
    );

    setValue("adjunto_evidencia", processedFiles);
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);

      if (!data.adjunto_evidencia || data.adjunto_evidencia.length === 0) {
        showToast("Debe adjuntar al menos una evidencia fotográfica del proceso de desinfección", "error");
        setIsGeneratingPDF(false);
        return;
      }

      if (!data.firma_ing_SC || data.firma_ing_SC.length < 10) {
        showToast("Debe firmar digitalmente el registro antes de completarlo", "error");
        setIsGeneratingPDF(false);
        return;
      }

      const criticalSteps = [
        "chk_general", "chk_PEO", "chk_PEO_1", "chk_OP_1",
        "chk_en", "chk_CP", "chk_lim", "chk_cloro",
        "chk_PS", "chk_tras", "chk_CVITE",
        "chk_DFD", "chk_CD",
      ];

      const missingSteps = criticalSteps.filter((step) => !data[step]);
      if (missingSteps.length > 0) {
        showToast(`Faltan completar ${missingSteps.length} paso(s) obligatorio(s) del proceso de desinfección`, "error");
        setIsGeneratingPDF(false);
        return;
      }

      const pdfData = {
        fecha: data.fecha,
        equipo: data.equipo,
        parte_repuesto: data.parte_repuesto || "",
        serie: data.serie,
        responsable: data.responsable,
        chk_general: data.chk_general || false,
        chk_PEO: data.chk_PEO || false,
        chk_PEO_1: data.chk_PEO_1 || false,
        chk_OP_1: data.chk_OP_1 || false,
        chk_en: data.chk_en || false,
        chk_en_op: data.chk_en_op || false,
        chk_CP: data.chk_CP || false,
        chk_CP_op: data.chk_CP_op || false,
        chk_lim: data.chk_lim || false,
        chk_cloro: data.chk_cloro || false,
        chk_OP_cloro: data.chk_OP_cloro || false,
        chk_PS: data.chk_PS || false,
        chk_PS_peo: data.chk_PS_peo || false,
        chk_PS_op: data.chk_PS_op || false,
        chk_tras: data.chk_tras || false,
        chk_tras_peo: data.chk_tras_peo || false,
        chk_tras_op: data.chk_tras_op || false,
        chk_CVITE: data.chk_CVITE || false,
        chk_DFD: data.chk_DFD || false,
        chk_DFD_peo: data.chk_DFD_peo || false,
        chk_DFD_o: data.chk_DFD_o || false,
        chk_CD: data.chk_CD || false,
        chk_CD_peo: data.chk_CD_peo || false,
        chk_CD_op: data.chk_CD_op || false,
        firma_ing_SC: "FIRMA_ELECTRONICA_AVANZADA_PENDIENTE",
        adjunto_evidencia: data.adjunto_evidencia,
      };

      const result = await generateDisinfectionPDF(pdfData, workflowContext);

      if (result.ok) {
        setIsCompleted(true);
        setCompletionData(result);
        showToast("PDF generado exitosamente. Próximamente: Firma electrónica avanzada.", "success");
      } else {
        showToast(result.message || "Error al procesar el registro", "error");
      }
    } catch (error) {
      console.error("Error processing disinfection:", error);
      showToast(error.response?.data?.message || "Error al procesar la desinfección", "error");
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
            disabled={index > Math.max(...completedSteps, 0) + 1}
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
            <StepHeader title="Identificación del Servicio" description="Complete los datos básicos del equipo que será desinfectado" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} style={labelStyle}>Fecha *</label>
                <input type="date" {...register("fecha", { required: "La fecha es obligatoria" })} className={inputClass} style={inputStyle} />
                {errors.fecha && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.fecha.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Responsable *</label>
                <input type="text" placeholder="Nombre del técnico responsable" {...register("responsable", { required: "El responsable es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.responsable && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.responsable.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} style={labelStyle}>Equipo *</label>
                <input type="text" placeholder="Nombre o descripción del equipo" {...register("equipo", { required: "El equipo es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.equipo && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.equipo.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Parte/Repuesto</label>
                <input type="text" placeholder="Parte o repuesto específico (opcional)" {...register("parte_repuesto")} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Serie *</label>
                <input type="text" placeholder="Número de serie único" {...register("serie", { required: "La serie es obligatoria" })} className={inputClass} style={inputStyle} />
                {errors.serie && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.serie.message}</p>}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <StepHeader title="Paso 1 - Seguridad Personal" description="Colocación de Equipos de Protección Personal (EPP)" />
            <ServicioCard className="p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" {...register("chk_general")} className="mt-1" />
                <div>
                  <p className="font-medium" style={{ color: "var(--st-text)" }}>Colóquese una bata de laboratorio, gafas de seguridad y guantes</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Confirmación de EPP completo antes de iniciar cualquier procedimiento.</p>
                </div>
              </div>
            </ServicioCard>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <StepHeader title="Paso 2 - Partes Eléctricas y Ópticas" description="Separación de componentes sensibles" />
            <ServicioCard className="p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" {...register("chk_PEO")} className="mt-1" />
                <div>
                  <p className="font-medium" style={{ color: "var(--st-text)" }}>Seleccione los componentes ópticos, electrónicos o sensibles para tratamiento por separado</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>
                    <strong>NO aplicarles cloro</strong> - Estos componentes requieren tratamiento especial.
                  </p>
                </div>
              </div>
            </ServicioCard>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <StepHeader title="Paso 3 - Limpieza en Seco" description="Eliminación de polvo y residuos secos" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Partes Eléctricas/Ópticas</h4>
                <div className="flex items-start gap-3">
                  <input type="checkbox" {...register("chk_PEO_1")} className="mt-1" />
                  <div>
                    <p className="font-medium" style={{ color: "var(--st-text)" }}>Elimine polvo, salpicaduras o residuos secos</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Limpieza cuidadosa de componentes sensibles.</p>
                  </div>
                </div>
              </ServicioCard>
              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</h4>
                <div className="flex items-start gap-3">
                  <input type="checkbox" {...register("chk_OP_1")} className="mt-1" />
                  <div>
                    <p className="font-medium" style={{ color: "var(--st-text)" }}>Elimine polvo, salpicaduras o residuos secos</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Limpieza general de componentes no sensibles.</p>
                  </div>
                </div>
              </ServicioCard>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <StepHeader title="Pasos 4-7 - Procedimientos Críticos" description="Enjuague, remoción y limpieza química" />
            <div className="grid grid-cols-1 gap-4">
              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Paso 4 - Enjuague de ductos hidráulicos</h4>
                <p className="mb-3 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  Enjuagar todos los ductos hidráulicos antes de desensamblar, asegurando que no quede líquido en ellos.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_en")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_en_op")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>

              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Paso 5 - Componentes cortopunzantes</h4>
                <p className="mb-3 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  Remover, si es posible, todos los componentes cortopunzantes. Si deben ser cambiados, depositarlos en guardianes.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_CP")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_CP_op")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>

              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Paso 6 - Limpieza con Hipoclorito 5%</h4>
                <p className="mb-3 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  Limpiar superficies con paño libre de pelusa y solución de hipoclorito al 5%.
                </p>
                <div className="flex items-start gap-3">
                  <input type="checkbox" {...register("chk_lim")} className="mt-1" />
                  <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Aplicar solución desinfectante</span>
                </div>
              </ServicioCard>

              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Paso 7 - Eliminación del cloro</h4>
                <p className="mb-3 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  Eliminar inmediatamente el cloro con paño sin pelusa humedecido con agua, seguido de un paño seco.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_cloro")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_OP_cloro")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <StepHeader title="Pasos 8-9 - Secado y Traslado" description="Secado completo y traslado del equipo" />
            <div className="grid grid-cols-1 gap-4">
              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Secado completo</h4>
                <p className="mb-3 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  Asegurarse de que las piezas estén completamente secas antes de enviar el equipo o encenderlo.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_PS")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_PS_peo")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>PEO</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_PS_op")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>

              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Traslado al área de revisión</h4>
                <p className="mb-3 text-sm" style={{ color: "var(--st-text-muted)" }}>Trasladar el instrumento al área de revisión y reparación.</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_tras")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_tras_peo")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>PEO</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_tras_op")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <StepHeader title="Paso 10 - Verificación Eléctrica" description="Verificación de conexiones eléctricas" />
            <ServicioCard className="p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" {...register("chk_CVITE")} className="mt-1" />
                <div>
                  <p className="font-medium" style={{ color: "var(--st-text)" }}>Verifique conexiones y tarjetas eléctricas y electrónicas</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>
                    Verificación crítica antes de encendido del equipo. <strong>Obligatorio si existen componentes PEO.</strong>
                  </p>
                </div>
              </div>
            </ServicioCard>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <StepHeader title="Pasos 11-12 - Documentación" description="Registro del formato y certificados" />
            <div className="grid grid-cols-1 gap-4">
              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Diligenciar formato de desinfección</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_DFD")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_DFD_peo")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>PEO</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_DFD_o")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>

              <ServicioCard className="p-4">
                <h4 className="mb-3 font-medium" style={{ color: "var(--st-text)" }}>Adjuntar certificado</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_CD")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>General</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_CD_peo")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>PEO</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" {...register("chk_CD_op")} className="mt-1" />
                    <span className="text-sm font-medium" style={{ color: "var(--st-text)" }}>Otras Partes</span>
                  </div>
                </div>
              </ServicioCard>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <StepHeader title="Certificación y Evidencia" description="FamSign y evidencia fotográfica del proceso" />

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)" }}>
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="mt-0.5 shrink-0" style={{ color: "var(--st-warning)" }} />
                <div>
                  <h4 className="mb-1 font-medium" style={{ color: "var(--st-warning)" }}>FamSign</h4>
                  <p className="text-sm" style={{ color: "var(--st-warning)" }}>
                    Este documento será firmado digitalmente con sello institucional y código QR verificable, cumpliendo con la Ley de Comercio Electrónico del Ecuador.
                  </p>
                </div>
              </div>
            </ServicioCard>

            <ServicioCard className="p-4">
              <h4 className="mb-4 font-medium" style={{ color: "var(--st-text)" }}>Evidencia Fotográfica</h4>
              <div className="space-y-3">
                <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>Adjunte fotos del proceso de desinfección para evidencia legal</p>
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                  <Button variant="secondary" icon={FiUpload} onClick={() => fileInputRef.current?.click()}>Seleccionar Fotos</Button>
                  {watch("adjunto_evidencia")?.length > 0 && (
                    <span className="text-sm" style={{ color: "var(--st-text-muted)" }}>{watch("adjunto_evidencia").length} archivo(s) seleccionado(s)</span>
                  )}
                </div>
              </div>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-accent-soft)", background: "var(--st-accent-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-accent-strong)" }}>Certificación Legal</h4>
              <p className="mb-3 text-sm" style={{ color: "var(--st-accent-strong)" }}>
                "Con la presente certifico que: He completado los pasos de desinfección para el instrumento en mención. El instrumento se encuentra libre de fluidos corporales y material contaminante."
              </p>
              <p className="text-xs" style={{ color: "var(--st-accent-strong)" }}>
                Esta certificación tendrá valor legal equivalente a una firma manuscrita según la legislación ecuatoriana.
              </p>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-success-soft)", background: "var(--st-success-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-success)" }}>¿Qué incluye FamSign?</h4>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                {["Hash criptográfico SHA-256", "Sello institucional", "Código QR verificable", "Cadena de confianza", "Bloqueo del documento", "Audit trail completo"].map((label) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                    <span style={{ color: "var(--st-success)" }}>{label}</span>
                  </div>
                ))}
              </div>
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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--st-success-soft)" }}>
            <FiCheckCircle className="h-8 w-8" style={{ color: "var(--st-success)" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>¡Registro Completado!</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>El proceso de desinfección ha sido registrado correctamente</p>
        </div>

        <ServicioCard className="mb-6 p-6">
          <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--st-text)" }}>Resumen del Registro</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Estado del Proceso</label>
                <div className="mt-1"><ServicioBadge tone="success">Completado</ServicioBadge></div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Archivos Generados</label>
                <div className="mt-1 space-y-1 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                    PDF de desinfección guardado en Drive
                  </div>
                  {completionData.imageCount > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                      {completionData.imageCount} evidencia(s) fotográfica(s) guardada(s)
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Ubicación en Drive</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Servicio Técnico / Desinfección / [Equipo]-[Fecha]</p>
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
            Nuevo Registro de Desinfección
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="st-scope mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-center text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
          Desinfección de Instrumentos y Partes
        </h1>
        <p className="mt-2 text-center text-sm" style={{ color: "var(--st-text-muted)" }}>Formulario F.ST-02 - Registro de desinfección según V04</p>
      </div>

      {renderStepIndicator()}

      <form onSubmit={handleSubmit(onSubmit)}>
        <ServicioCard className="mb-6 p-6">{renderStepContent()}</ServicioCard>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={prevStep} disabled={currentStep === 0} icon={FiChevronLeft}>Anterior</Button>
          <div className="text-sm" style={{ color: "var(--st-text-muted)" }}>Paso {currentStep + 1} de {STEPS.length}</div>
          {currentStep === STEPS.length - 1 ? (
            <Button type="submit" disabled={isGeneratingPDF} icon={FiCheckCircle}>{isGeneratingPDF ? "Procesando..." : "Completar Registro"}</Button>
          ) : (
            <Button type="button" onClick={nextStep} icon={FiChevronRight}>Siguiente</Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default DesinfeccionStepper;
