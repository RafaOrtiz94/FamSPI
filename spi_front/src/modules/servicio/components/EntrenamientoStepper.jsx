import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiDownload, FiUpload } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { generateTrainingCoordinationPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import FirmaDigital from "./FirmaDigital";

const STEPS = [
  {
    id: "orden",
    title: "Datos de la Orden",
    description: "Información básica de la orden de entrenamiento",
  },
  {
    id: "planificacion",
    title: "Planificación del Entrenamiento",
    description: "Fechas, duración y recursos del entrenamiento",
  },
  {
    id: "observaciones",
    title: "Observaciones",
    description: "Comentarios adicionales sobre el entrenamiento",
  },
  {
    id: "certificacion",
    title: "Certificación y Firma",
    description: "Firma digital de compromiso",
  },
];

const EntrenamientoStepper = () => {
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
      Fecha_Inicio: new Date().toISOString().split("T")[0],
      Fecha_final: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 7 days later
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
    console.log("✍️ EntrenamientoStepper: Signature captured", {
      dataLength: signatureData?.length,
      dataPreview: signatureData?.substring(0, 50) + "..."
    });
    setValue("Firma_af_image", signatureData);
    console.log("✍️ EntrenamientoStepper: Signature stored in form");
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);

      console.log("Form data received:", {
        Firma_af_image: !!data.Firma_af_image,
        signatureLength: data.Firma_af_image?.length,
        ORDNumero: data.ORDNumero,
        ORDCliente: data.ORDCliente
      });

      // Validate that at least signature is present
      if (!data.Firma_af_image || data.Firma_af_image.length < 10) {
        showToast("Debe firmar digitalmente antes de completar el registro", "error");
        setIsGeneratingPDF(false);
        return;
      }

      // Validate date logic: Fecha_final >= Fecha_Inicio
      const fechaInicio = new Date(data.Fecha_Inicio);
      const fechaFinal = new Date(data.Fecha_final);
      if (fechaFinal < fechaInicio) {
        showToast("La fecha de finalización debe ser igual o posterior a la fecha de inicio", "error");
        setIsGeneratingPDF(false);
        return;
      }

      // Validate duration: Dias > 0, Horas > 0, Num_P >= 1
      if (data.Dias <= 0 || data.Horas <= 0 || data.Num_P < 1) {
        showToast("Los valores de duración deben ser mayores a cero y al menos 1 profesional", "error");
        setIsGeneratingPDF(false);
        return;
      }

      // Prepare data for PDF generation
      const pdfData = {
        // 1️⃣ DATOS GENERALES DE LA ORDEN
        ORDNumero: data.ORDNumero,
        ORDCliente: data.ORDCliente,
        ORDEquipo: data.ORDEquipo,
        ORDSerie: data.ORDSerie,
        ORDResponsable: data.ORDResponsable,

        // 3️⃣ PLANIFICACIÓN DEL ENTRENAMIENTO
        Fecha_Inicio: data.Fecha_Inicio,
        Fecha_final: data.Fecha_final,
        Dias: data.Dias,
        Horas: data.Horas,
        Num_P: data.Num_P,

        // 4️⃣ OBSERVACIONES
        Obs_1: data.Obs_1 || "",
        Obs_2: data.Obs_2 || "",
        Obs_3: data.Obs_3 || "",
        Obs_4: data.Obs_4 || "",

        // 5️⃣ FIRMA
        Firma_af_image: data.Firma_af_image,
      };

      console.log("Submitting training coordination data:", {
        hasSignature: !!pdfData.Firma_af_image,
        signatureLength: pdfData.Firma_af_image?.length,
        ordenNumero: pdfData.ORDNumero,
        cliente: pdfData.ORDCliente
      });

      const result = await generateTrainingCoordinationPDF(pdfData);

      console.log("API Response:", result);

      if (result.ok) {
        setIsCompleted(true);
        setCompletionData(result);
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
      case 0: // Datos de la Orden
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Datos de la Orden
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Información básica de la orden de coordinación de entrenamiento
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Orden *
                </label>
                <input
                  type="text"
                  placeholder="ORD-2025-001"
                  {...register("ORDNumero", { required: "El número de orden es obligatorio" })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {errors.ORDNumero && (
                  <p className="text-xs text-red-500 mt-1">{errors.ORDNumero.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente *
                </label>
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  {...register("ORDCliente", { required: "El cliente es obligatorio" })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {errors.ORDCliente && (
                  <p className="text-xs text-red-500 mt-1">{errors.ORDCliente.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipo *
                </label>
                <input
                  type="text"
                  placeholder="Equipo a capacitar"
                  {...register("ORDEquipo", { required: "El equipo es obligatorio" })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {errors.ORDEquipo && (
                  <p className="text-xs text-red-500 mt-1">{errors.ORDEquipo.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serie
                </label>
                <input
                  type="text"
                  placeholder="Número de serie (opcional)"
                  {...register("ORDSerie")}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsable
                </label>
                <input
                  type="text"
                  placeholder="Responsable Famproject"
                  {...register("ORDResponsable")}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        );

      case 1: // Planificación del Entrenamiento
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Planificación del Entrenamiento
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Fechas, duración y recursos del entrenamiento
              </p>
            </div>

            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-4">📅 Fechas del Entrenamiento</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    {...register("Fecha_Inicio", { required: "La fecha de inicio es obligatoria" })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Fecha_Inicio && (
                    <p className="text-xs text-red-500 mt-1">{errors.Fecha_Inicio.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha Finalización *
                  </label>
                  <input
                    type="date"
                    {...register("Fecha_final", { required: "La fecha de finalización es obligatoria" })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Fecha_final && (
                    <p className="text-xs text-red-500 mt-1">{errors.Fecha_final.message}</p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-4">⏱️ Duración del Entrenamiento</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nº de Días *
                  </label>
                  <input
                    type="number"
                    min="1"
                    {...register("Dias", { required: "Los días son obligatorios", min: { value: 1, message: "Debe ser al menos 1 día" } })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Dias && (
                    <p className="text-xs text-red-500 mt-1">{errors.Dias.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nº Horas Diarias *
                  </label>
                  <input
                    type="number"
                    min="1"
                    {...register("Horas", { required: "Las horas son obligatorias", min: { value: 1, message: "Debe ser al menos 1 hora" } })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Horas && (
                    <p className="text-xs text-red-500 mt-1">{errors.Horas.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nº Profesionales *
                  </label>
                  <input
                    type="number"
                    min="1"
                    {...register("Num_P", { required: "El número de profesionales es obligatorio", min: { value: 1, message: "Debe ser al menos 1 profesional" } })}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.Num_P && (
                    <p className="text-xs text-red-500 mt-1">{errors.Num_P.message}</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        );

      case 2: // Observaciones
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Observaciones
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Comentarios adicionales sobre el entrenamiento
              </p>
            </div>

            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observación 1
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Comentarios adicionales, ajustes de agenda, limitaciones del cliente..."
                    {...register("Obs_1")}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observación 2
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Observaciones logísticas, reprogramaciones..."
                    {...register("Obs_2")}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observación 3
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Comentarios adicionales..."
                    {...register("Obs_3")}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observación 4
                  </label>
                  <textarea
                    rows="2"
                    placeholder="Comentarios finales..."
                    {...register("Obs_4")}
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </Card>
          </div>
        );

      case 3: // Certificación y Firma
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Certificación y Firma
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Firma digital de compromiso para la coordinación del entrenamiento
              </p>
            </div>

            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-4">✍️ Firma Famproject</h4>
              <div onClick={(e) => e.preventDefault()}>
                <FirmaDigital onSignatureCapture={handleSignatureCapture} />
              </div>
            </Card>

            <Card className="p-4 bg-blue-50 border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Certificación</h4>
              <p className="text-sm text-blue-800">
                "Con la presente certifico que: He coordinado las fechas del entrenamiento según lo solicitado.
                El entrenamiento se encuentra programado y confirmado según las especificaciones acordadas."
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
              ¡Coordinación Completada!
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              La coordinación de entrenamiento ha sido registrada correctamente
            </p>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de la Coordinación</h3>

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
                  <label className="block text-sm font-medium text-gray-700">Orden de Entrenamiento</label>
                  <p className="text-sm text-gray-600 mt-1">{completionData.ordenNumero}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Cliente</label>
                  <p className="text-sm text-gray-600 mt-1">{completionData.cliente}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Archivo Generado</label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      PDF de coordinación guardado en Drive
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Ubicación en Drive</label>
                  <p className="text-sm text-gray-600 mt-1">
                    Servicio Técnico / Entrenamiento / [ORDNumero]-[Cliente]-[Fecha]
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Coordinación de la Fecha de Entrenamiento
        </h1>
        <p className="text-sm text-gray-500 text-center mt-2">
          Formulario F.ST-04 - V03 - Planificación de entrenamientos
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
              {isGeneratingPDF ? "Procesando..." : "Completar Coordinación"}
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

export default EntrenamientoStepper;
