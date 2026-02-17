import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload, FiCamera } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { generateEquipmentVerificationPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import FirmaDigital from "./FirmaDigital";

const STEPS = [
  {
    id: "datos",
    title: "Datos del Equipo",
    description: "Información básica del equipo a verificar",
  },
  {
    id: "resultados",
    title: "Resultados de Verificación",
    description: "Estado inicial y pruebas funcionales",
  },
  {
    id: "analisis",
    title: "Análisis Técnico",
    description: "Interpretación de resultados y recomendaciones",
  },
  {
    id: "certificacion",
    title: "Certificación y Evidencia",
    description: "Firma especialista y evidencia fotográfica",
  },
];

const VerificacionStepper = () => {
  const [searchParams] = useSearchParams();
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
    },
  });

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

  const handleSignatureCapture = (signatureData) => {
    console.log("✍️ VerificacionStepper: Signature captured", {
      dataLength: signatureData?.length,
      dataPreview: signatureData?.substring(0, 50) + "..."
    });
    setValue("firma_af_image", signatureData);
    console.log("✍️ VerificacionStepper: Signature stored in form");
  };

  const handleAnnexUpload = (event) => {
    const files = Array.from(event.target.files);
    const base64Promises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(base64Promises).then((base64Files) => {
      setAnnexes(prev => [...prev, ...base64Files]);
      showToast(`Se agregaron ${base64Files.length} imagen(es) de evidencia`, "success");
    }).catch(err => {
      console.error("Error processing annex files:", err);
      showToast("Error al procesar las imágenes", "error");
    });
  };

  const removeAnnex = (index) => {
    setAnnexes(prev => prev.filter((_, i) => i !== index));
  };

  const validateStepData = (stepIndex, data) => {
    switch (stepIndex) {
      case 0: // Datos del Equipo
        if (!data.Fecha) return "La fecha es obligatoria";
        if (!data.Cliente) return "El cliente es obligatorio";
        if (!data.Equipo) return "El equipo es obligatorio";
        if (!data.Serie) return "La serie es obligatoria";
        break;
      case 1: // Resultados
        if (!data.RESULTADOS || data.RESULTADOS.trim().length < 10) {
          return "Los resultados son obligatorios y deben contener al menos 10 caracteres";
        }
        break;
      case 2: // Análisis
        if (!data.ANALISIS || data.ANALISIS.trim().length < 10) {
          return "El análisis es obligatorio y debe contener al menos 10 caracteres";
        }
        break;
      case 3: // Certificación
        if (!data.firma_af_image || data.firma_af_image.length < 10) {
          return "La firma del especialista es obligatoria";
        }
        break;
    }
    return null;
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);

      // Validate all steps
      for (let i = 0; i < STEPS.length; i++) {
        const validationError = validateStepData(i, data);
        if (validationError) {
          showToast(validationError, "error");
          setCurrentStep(i);
          setIsGeneratingPDF(false);
          return;
        }
      }

      console.log("Form data received:", {
        firma_af_image: !!data.firma_af_image,
        signatureLength: data.firma_af_image?.length,
        fecha: data.Fecha,
        cliente: data.Cliente,
        equipo: data.Equipo,
        serie: data.Serie,
        annexesCount: annexes.length
      });

      // Prepare data for PDF generation
      const verificationData = {
        // 2️⃣ DATOS GENERALES DEL EQUIPO
        Fecha: data.Fecha,
        Cliente: data.Cliente,
        Equipo: data.Equipo,
        Serie: data.Serie,

        // 3️⃣ RESULTADOS (Estado inicial, pruebas funcionales, etc.)
        RESULTADOS: data.RESULTADOS,

        // 4️⃣ ANÁLISIS (Interpretación técnica, recomendación)
        ANALISIS: data.ANALISIS,

        // 5️⃣ FIRMA DEL ESPECIALISTA
        firma_af_image: data.firma_af_image,

        // 6️⃣ ANEXOS / EVIDENCIA FOTOGRÁFICA
        anexos_af_image: annexes.length > 0 ? annexes : undefined,
      };

      console.log("Submitting verification data:", {
        hasSignature: !!verificationData.firma_af_image,
        signatureLength: verificationData.firma_af_image?.length,
        fecha: verificationData.Fecha,
        cliente: verificationData.Cliente,
        equipo: verificationData.Equipo,
        serie: verificationData.Serie,
        annexesCount: annexes.length
      });

      const result = await generateEquipmentVerificationPDF(verificationData, workflowContext);

      console.log("API Response:", result);

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
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <button
            onClick={() => goToStep(index)}
            disabled={index > Math.max(...completedSteps) + 1}
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
              index === currentStep
                ? "bg-blue-600 border-blue-600 text-white"
                : completedSteps.has(index)
                ? "bg-green-600 border-green-600 text-white"
                : index <= Math.max(...completedSteps, 0) + 1
                ? "border-gray-300 text-gray-500 hover:border-gray-400"
                : "border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
          >
            {completedSteps.has(index) ? (
              <FiCheckCircle className="w-5 h-5" />
            ) : (
              <span className="text-sm font-medium">{index + 1}</span>
            )}
          </button>
          {index < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-4 ${
                completedSteps.has(index) ? "bg-green-600" : "bg-gray-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Datos del Equipo
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Datos del Equipo
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Información básica del equipo nuevo a verificar
              </p>
            </div>

            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de Verificación *
                  </label>
                  <input
                    type="date"
                    {...register("Fecha", { required: "La fecha es obligatoria" })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Fecha && (
                    <p className="text-xs text-red-500 mt-1">{errors.Fecha.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente *
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre del cliente"
                    {...register("Cliente", { required: "El cliente es obligatorio" })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Cliente && (
                    <p className="text-xs text-red-500 mt-1">{errors.Cliente.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Equipo *
                  </label>
                  <input
                    type="text"
                    placeholder="Nombre/modelo del equipo"
                    {...register("Equipo", { required: "El equipo es obligatorio" })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Equipo && (
                    <p className="text-xs text-red-500 mt-1">{errors.Equipo.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Serie *
                  </label>
                  <input
                    type="text"
                    placeholder="Número de serie del equipo"
                    {...register("Serie", { required: "La serie es obligatoria" })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Serie && (
                    <p className="text-xs text-red-500 mt-1">{errors.Serie.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Este formulario es para equipos NUEVOS sin historial previo.
                  El equipo y serie deben corresponder a un equipo recientemente adquirido.
                </p>
              </div>
            </Card>
          </div>
        );

      case 1: // Resultados de Verificación
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Resultados de Verificación
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Estado inicial del equipo y pruebas funcionales realizadas
              </p>
            </div>

            <Card className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  RESULTADOS *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Describa detalladamente: estado inicial del equipo, pruebas funcionales realizadas,
                  encendido correcto, alarmas o errores encontrados, observaciones técnicas objetivas.
                </p>
                <textarea
                  rows="8"
                  placeholder="Ejemplo:
• Estado inicial: Equipo en caja sellada, embalaje intacto
• Pruebas funcionales: Encendido correcto, pantalla responde adecuadamente
• Alarmas: Ninguna alarma presente
• Observaciones: Equipo calibrado de fábrica, listo para instalación"
                  {...register("RESULTADOS", {
                    required: "Los resultados son obligatorios",
                    minLength: { value: 10, message: "Debe contener al menos 10 caracteres" }
                  })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
                {errors.RESULTADOS && (
                  <p className="text-xs text-red-500 mt-1">{errors.RESULTADOS.message}</p>
                )}
              </div>

              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Importante:</strong> En auditoría, un simple "OK" no es suficiente.
                  Los resultados deben ser detallados y objetivamente verificables.
                </p>
              </div>
            </Card>
          </div>
        );

      case 2: // Análisis Técnico
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Análisis Técnico
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Interpretación de resultados y recomendaciones profesionales
              </p>
            </div>

            <Card className="p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ANÁLISIS *
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Interprete los resultados: ¿cumple/no cumple?, recomendación específica
                  (apto para instalación, requiere ajuste, requiere soporte técnico).
                </p>
                <textarea
                  rows="6"
                  placeholder="Ejemplo:
• Análisis: Los resultados de las pruebas funcionales indican que el equipo cumple con las especificaciones técnicas requeridas
• Recomendación: APTO PARA INSTALACIÓN. El equipo está en condiciones óptimas para ser instalado y puesto en funcionamiento"
                  {...register("ANALISIS", {
                    required: "El análisis es obligatorio",
                    minLength: { value: 10, message: "Debe contener al menos 10 caracteres" }
                  })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 resize-vertical"
                />
                {errors.ANALISIS && (
                  <p className="text-xs text-red-500 mt-1">{errors.ANALISIS.message}</p>
                )}
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>✓ Recomendaciones típicas:</strong><br />
                  • "APTO PARA INSTALACIÓN" - Equipo verificado correctamente<br />
                  • "REQUIERE AJUSTE" - Necesita calibración o configuración adicional<br />
                  • "REQUIERE SOPORTE" - Problemas que requieren intervención técnica
                </p>
              </div>
            </Card>
          </div>
        );

      case 3: // Certificación y Evidencia
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Certificación y Evidencia
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Firma del especialista y evidencia fotográfica
              </p>
            </div>

            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-4">✍️ Firma del Especialista *</h4>
              <div onClick={(e) => e.preventDefault()}>
                <FirmaDigital onSignatureCapture={handleSignatureCapture} />
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-4">📸 Evidencia Fotográfica (Recomendado)</h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subir imágenes de evidencia
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleAnnexUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos recomendados: equipo instalado, pantalla de inicio, número de serie, accesorios incluidos
                  </p>
                </div>

                {annexes.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {annexes.map((annex, index) => (
                      <div key={index} className="relative">
                        <img
                          src={annex}
                          alt={`Evidencia ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeAnnex(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-4 bg-blue-50 border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Certificación</h4>
              <p className="text-sm text-blue-800">
                "Con la presente certifico que: He realizado la verificación técnica del equipo según
                los procedimientos establecidos, los resultados son veraces y las recomendaciones son
                profesionalmente fundadas."
              </p>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // Show completion screen if process is completed
  if (isCompleted && completionData) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <FiCheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              ¡Verificación Completada!
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              La verificación de equipo ha sido registrada correctamente
            </p>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de la Verificación</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estado del Proceso</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Completado
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Fecha de Verificación</label>
                  <p className="text-sm text-gray-600 mt-1">{completionData.fecha}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Cliente</label>
                  <p className="text-sm text-gray-600 mt-1">{completionData.cliente}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Equipo Verificado</label>
                  <p className="text-sm text-gray-600 mt-1">{completionData.equipo}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Archivo Generado</label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      PDF de verificación guardado en Drive
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Serie del Equipo</label>
                  <p className="text-sm text-gray-600 mt-1">{completionData.serie}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Ubicación en Drive</label>
                  <p className="text-sm text-gray-600 mt-1">
                    Servicio Técnico / Verificación / [Cliente]-[Equipo]-[Serie]-[Fecha]-[Usuario]
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">ID de Carpeta</label>
                  <p className="text-xs font-mono text-gray-500 mt-1 break-all">
                    {completionData.driveFolderId}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Verificación de Equipos Nuevos
        </h1>
        <p className="text-sm text-gray-500 text-center mt-2">
          Formulario F.ST-09 - V03 - Verificación técnica de equipos nuevos
        </p>
      </div>

      {renderStepIndicator()}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="p-6 mb-6">
          {renderStepContent()}
        </Card>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
            icon={FiChevronLeft}
          >
            Anterior
          </Button>

          <div className="text-sm text-gray-500">
            Paso {currentStep + 1} de {STEPS.length}
          </div>

          {currentStep === STEPS.length - 1 ? (
            <Button
              type="submit"
              disabled={isGeneratingPDF}
              icon={FiCheckCircle}
            >
              {isGeneratingPDF ? "Procesando..." : "Completar Verificación"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={nextStep}
              icon={FiChevronRight}
            >
              Siguiente
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default VerificacionStepper;
