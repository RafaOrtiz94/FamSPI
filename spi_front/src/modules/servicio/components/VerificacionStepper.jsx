import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload, FiAlertTriangle } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { generateEquipmentVerificationPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import FirmaDigital from "./FirmaDigital";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import "../design/tokens.css";

const STEPS = [
  { id: "datos", title: "Datos del Equipo", description: "Información básica del equipo a verificar" },
  { id: "resultados", title: "Resultados de Verificación", description: "Estado inicial y pruebas funcionales" },
  { id: "analisis", title: "Análisis Técnico", description: "Interpretación de resultados y recomendaciones" },
  { id: "certificacion", title: "Certificación y Evidencia", description: "Firma especialista y evidencia fotográfica" },
];

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };
const labelClass = "mb-1 block text-sm font-medium";
const labelStyle = { color: "var(--st-text-muted)" };

const VerificacionStepper = () => {
  const [searchParams] = useSearchParams();
  const prefilledClient = searchParams.get("client_name") || "";
  const prefilledEquipment = searchParams.get("equipment_name") || "";
  const prefilledSerial = searchParams.get("equipment_serial") || "";
  const workflowContext = {
    source_type: searchParams.get("source_type") || undefined,
    source_id: searchParams.get("source_id") || undefined,
    request_id: searchParams.get("request_id") || undefined,
  };
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const [annexes, setAnnexes] = useState([]);
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
      Fecha: new Date().toISOString().split("T")[0],
      Cliente: prefilledClient,
      Equipo: prefilledEquipment,
      Serie: prefilledSerial,
      verification_result: "passed",
      criteria_reference: "",
      remediation_notes: "",
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
    setValue("firma_af_image", signatureData);
  };

  const handleAnnexUpload = (event) => {
    const files = Array.from(event.target.files);
    const base64Promises = files.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(base64Promises)
      .then((base64Files) => {
        setAnnexes((prev) => [...prev, ...base64Files]);
        showToast(`Se agregaron ${base64Files.length} imagen(es) de evidencia`, "success");
      })
      .catch((err) => {
        console.error("Error processing annex files:", err);
        showToast("Error al procesar las imágenes", "error");
      });
  };

  const removeAnnex = (index) => {
    setAnnexes((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStepData = (stepIndex, data) => {
    switch (stepIndex) {
      case 0:
        if (!data.Fecha) return "La fecha es obligatoria";
        if (!data.Cliente) return "El cliente es obligatorio";
        if (!data.Equipo) return "El equipo es obligatorio";
        if (!data.Serie) return "La serie es obligatoria";
        break;
      case 1:
        if (!data.RESULTADOS || data.RESULTADOS.trim().length < 10) {
          return "Los resultados son obligatorios y deben contener al menos 10 caracteres";
        }
        break;
      case 2:
        if (!data.ANALISIS || data.ANALISIS.trim().length < 10) {
          return "El análisis es obligatorio y debe contener al menos 10 caracteres";
        }
        if (!data.criteria_reference || data.criteria_reference.trim().length < 6) {
          return "Debes registrar la fuente o criterio técnico de verificación";
        }
        if (!["passed", "failed"].includes(String(data.verification_result || "").trim().toLowerCase())) {
          return "Debes indicar si la verificación fue aprobada o fallida";
        }
        break;
      case 3:
        if (!data.firma_af_image || data.firma_af_image.length < 10) {
          return "La firma del especialista es obligatoria";
        }
        if (
          String(data.verification_result || "").trim().toLowerCase() === "failed" &&
          (!data.remediation_notes || data.remediation_notes.trim().length < 6)
        ) {
          return "Cuando F.ST-09 falla debes registrar notas de remediación";
        }
        break;
      default:
        break;
    }
    return null;
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);

      for (let i = 0; i < STEPS.length; i++) {
        const validationError = validateStepData(i, data);
        if (validationError) {
          showToast(validationError, "error");
          setCurrentStep(i);
          setIsGeneratingPDF(false);
          return;
        }
      }

      const verificationData = {
        Fecha: data.Fecha,
        Cliente: data.Cliente,
        Equipo: data.Equipo,
        Serie: data.Serie,
        RESULTADOS: data.RESULTADOS,
        ANALISIS: data.ANALISIS,
        firma_af_image: data.firma_af_image,
        anexos_af_image: annexes.length > 0 ? annexes : undefined,
        verification_result: String(data.verification_result || "").trim().toLowerCase(),
        criteria_reference: data.criteria_reference,
        remediation_notes: data.remediation_notes || undefined,
      };

      const result = await generateEquipmentVerificationPDF(verificationData, workflowContext);

      if (result.ok) {
        setIsCompleted(true);
        setCompletionData(result);
        showToast(`Verificación de equipo registrada: ${result.equipo} - ${result.cliente}`, "success");
      } else {
        showToast(result.message || "Error al procesar la verificación de equipo", "error");
      }
    } catch (error) {
      console.error("Error processing equipment verification:", error);
      showToast(error.response?.data?.message || "Error al procesar la verificación de equipo", "error");
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
            <StepHeader title="Datos del Equipo" description="Información básica del equipo nuevo a verificar" />
            <ServicioCard className="p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} style={labelStyle}>Fecha de Verificación *</label>
                  <input type="date" {...register("Fecha", { required: "La fecha es obligatoria" })} className={inputClass} style={inputStyle} />
                  {errors.Fecha && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Fecha.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Cliente *</label>
                  <input type="text" placeholder="Nombre del cliente" {...register("Cliente", { required: "El cliente es obligatorio" })} className={inputClass} style={inputStyle} />
                  {errors.Cliente && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Cliente.message}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass} style={labelStyle}>Equipo *</label>
                  <input type="text" placeholder="Nombre/modelo del equipo" {...register("Equipo", { required: "El equipo es obligatorio" })} className={inputClass} style={inputStyle} />
                  {errors.Equipo && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Equipo.message}</p>}
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Número de Serie *</label>
                  <input type="text" placeholder="Número de serie del equipo" {...register("Serie", { required: "La serie es obligatoria" })} className={inputClass} style={inputStyle} />
                  {errors.Serie && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Serie.message}</p>}
                </div>
              </div>

              <div className="mt-4 rounded-[var(--st-radius-md)] p-3" style={{ background: "var(--st-accent-soft)" }}>
                <p className="text-sm" style={{ color: "var(--st-accent-strong)" }}>
                  <strong>Nota:</strong> Este formulario es para equipos NUEVOS sin historial previo. El equipo y serie deben corresponder a un equipo recientemente adquirido.
                </p>
              </div>
            </ServicioCard>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <StepHeader title="Resultados de Verificación" description="Estado inicial del equipo y pruebas funcionales realizadas" />
            <ServicioCard className="p-4">
              <div className="mb-4">
                <label className={`${labelClass} mb-2`} style={labelStyle}>RESULTADOS *</label>
                <p className="mb-2 text-xs" style={{ color: "var(--st-text-faint)" }}>
                  Describa detalladamente: estado inicial del equipo, pruebas funcionales realizadas, encendido correcto, alarmas o errores encontrados, observaciones técnicas objetivas.
                </p>
                <textarea
                  rows="8"
                  placeholder={"Ejemplo:\n• Estado inicial: Equipo en caja sellada, embalaje intacto\n• Pruebas funcionales: Encendido correcto, pantalla responde adecuadamente\n• Alarmas: Ninguna alarma presente\n• Observaciones: Equipo calibrado de fábrica, listo para instalación"}
                  {...register("RESULTADOS", { required: "Los resultados son obligatorios", minLength: { value: 10, message: "Debe contener al menos 10 caracteres" } })}
                  className={`${inputClass} resize-vertical`}
                  style={inputStyle}
                />
                {errors.RESULTADOS && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.RESULTADOS.message}</p>}
              </div>

              <div className="rounded-[var(--st-radius-md)] p-3" style={{ background: "var(--st-warning-soft)" }}>
                <p className="text-sm" style={{ color: "var(--st-warning)" }}>
                  <strong>Importante:</strong> En auditoría, un simple "OK" no es suficiente. Los resultados deben ser detallados y objetivamente verificables.
                </p>
              </div>
            </ServicioCard>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <StepHeader title="Análisis Técnico" description="Interpretación de resultados y recomendaciones profesionales" />
            <ServicioCard className="p-4">
              <div className="mb-4">
                <label className={`${labelClass} mb-2`} style={labelStyle}>ANÁLISIS *</label>
                <p className="mb-2 text-xs" style={{ color: "var(--st-text-faint)" }}>
                  Interprete los resultados: ¿cumple/no cumple?, recomendación específica (apto para instalación, requiere ajuste, requiere soporte técnico).
                </p>
                <textarea
                  rows="6"
                  placeholder={"Ejemplo:\n• Análisis: Los resultados de las pruebas funcionales indican que el equipo cumple con las especificaciones técnicas requeridas\n• Recomendación: APTO PARA INSTALACIÓN. El equipo está en condiciones óptimas para ser instalado y puesto en funcionamiento"}
                  {...register("ANALISIS", { required: "El análisis es obligatorio", minLength: { value: 10, message: "Debe contener al menos 10 caracteres" } })}
                  className={`${inputClass} resize-vertical`}
                  style={inputStyle}
                />
                {errors.ANALISIS && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ANALISIS.message}</p>}
              </div>

              <div className="rounded-[var(--st-radius-md)] p-3" style={{ background: "var(--st-success-soft)" }}>
                <p className="text-sm" style={{ color: "var(--st-success)" }}>
                  <strong>Recomendaciones típicas:</strong>
                  <br />• "APTO PARA INSTALACIÓN" - Equipo verificado correctamente
                  <br />• "REQUIERE AJUSTE" - Necesita calibración o configuración adicional
                  <br />• "REQUIERE SOPORTE" - Problemas que requieren intervención técnica
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass} style={labelStyle}>Resultado de verificación *</label>
                  <select {...register("verification_result", { required: true })} className={inputClass} style={inputStyle}>
                    <option value="passed">Aprobada</option>
                    <option value="failed">Fallida (requiere remediación)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={labelStyle}>Fuente/Criterio técnico *</label>
                  <input
                    type="text"
                    placeholder="Ej: Manual fabricante v2.1, sección 4.3"
                    {...register("criteria_reference", { required: "Campo obligatorio", minLength: { value: 6, message: "Debe contener al menos 6 caracteres" } })}
                    className={inputClass}
                    style={inputStyle}
                  />
                  {errors.criteria_reference && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.criteria_reference.message}</p>}
                </div>
              </div>
            </ServicioCard>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <StepHeader title="Certificación y Evidencia" description="Firma del especialista y evidencia fotográfica" />

            <ServicioCard className="p-4">
              <h4 className="mb-4 font-medium" style={{ color: "var(--st-text)" }}>Firma del Especialista *</h4>
              <div onClick={(e) => e.preventDefault()}>
                <FirmaDigital onSignatureCapture={handleSignatureCapture} />
              </div>
            </ServicioCard>

            <ServicioCard className="p-4">
              <h4 className="mb-4 font-medium" style={{ color: "var(--st-text)" }}>Evidencia Fotográfica (Recomendado)</h4>
              <div className="space-y-4">
                <div>
                  <label className={`${labelClass} mb-2`} style={labelStyle}>Subir imágenes de evidencia</label>
                  <input type="file" multiple accept="image/*" onChange={handleAnnexUpload} className="block w-full text-sm" style={{ color: "var(--st-text-muted)" }} />
                  <p className="mt-1 text-xs" style={{ color: "var(--st-text-faint)" }}>
                    Formatos recomendados: equipo instalado, pantalla de inicio, número de serie, accesorios incluidos
                  </p>
                </div>

                {annexes.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {annexes.map((annex, index) => (
                      <div key={index} className="relative">
                        <img src={annex} alt={`Evidencia ${index + 1}`} className="h-24 w-full rounded-[var(--st-radius-md)] border object-cover" style={{ borderColor: "var(--st-border)" }} />
                        <button
                          type="button"
                          onClick={() => removeAnnex(index)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs text-white"
                          style={{ background: "var(--st-danger)" }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-accent-soft)", background: "var(--st-accent-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-accent-strong)" }}>Certificación</h4>
              <p className="text-sm" style={{ color: "var(--st-accent-strong)" }}>
                "Con la presente certifico que: He realizado la verificación técnica del equipo según los procedimientos establecidos, los resultados son veraces y las recomendaciones son profesionalmente fundadas."
              </p>
            </ServicioCard>

            {String(watch("verification_result") || "").trim().toLowerCase() === "failed" && (
              <ServicioCard className="p-4" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <FiAlertTriangle style={{ color: "var(--st-warning)" }} />
                  <h4 className="font-medium" style={{ color: "var(--st-warning)" }}>Notas de remediación *</h4>
                </div>
                <textarea
                  rows="4"
                  placeholder="Describe revisión técnica, ajustes y siguiente acción antes de repetir F.ST-09"
                  {...register("remediation_notes", { required: "Campo obligatorio cuando la verificación falla", minLength: { value: 6, message: "Debe contener al menos 6 caracteres" } })}
                  className={inputClass}
                  style={inputStyle}
                />
                {errors.remediation_notes && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.remediation_notes.message}</p>}
              </ServicioCard>
            )}
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
          <h1 className="text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>¡Verificación Completada!</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>La verificación de equipo ha sido registrada correctamente</p>
        </div>

        <ServicioCard className="mb-6 p-6">
          <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--st-text)" }}>Resumen de la Verificación</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Estado del Proceso</label>
                <div className="mt-1"><ServicioBadge tone="success">Completado</ServicioBadge></div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Fecha de Verificación</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{completionData.fecha}</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Cliente</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{completionData.cliente}</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Equipo Verificado</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{completionData.equipo}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Archivo Generado</label>
                <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                  PDF de verificación guardado en Drive
                </div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Serie del Equipo</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{completionData.serie}</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Ubicación en Drive</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Servicio Técnico / Verificación / [Cliente]-[Equipo]-[Serie]-[Fecha]-[Usuario]</p>
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
              setAnnexes([]);
            }}
            icon={FiUpload}
          >
            Nueva Verificación de Equipo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="st-scope mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-center text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Verificación de Equipos Nuevos</h1>
        <p className="mt-2 text-center text-sm" style={{ color: "var(--st-text-muted)" }}>Formulario F.ST-09 - V03 - Verificación técnica de equipos nuevos</p>
      </div>

      {renderStepIndicator()}

      <form onSubmit={handleSubmit(onSubmit)}>
        <ServicioCard className="mb-6 p-6">{renderStepContent()}</ServicioCard>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={prevStep} disabled={currentStep === 0} icon={FiChevronLeft}>Anterior</Button>
          <div className="text-sm" style={{ color: "var(--st-text-muted)" }}>Paso {currentStep + 1} de {STEPS.length}</div>
          {currentStep === STEPS.length - 1 ? (
            <Button type="submit" disabled={isGeneratingPDF} icon={FiCheckCircle}>{isGeneratingPDF ? "Procesando..." : "Completar Verificación"}</Button>
          ) : (
            <Button type="button" onClick={nextStep} icon={FiChevronRight}>Siguiente</Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default VerificacionStepper;
