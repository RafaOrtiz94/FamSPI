import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload, FiPlus, FiTrash2 } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { generateAttendanceListPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import FirmaDigital from "./FirmaDigital";

const STEPS = [
  {
    id: "orden",
    title: "Datos de la Orden",
    description: "Información básica de la orden de asistencia",
  },
  {
    id: "asistentes",
    title: "Registro de Asistentes",
    description: "Captura de datos de los asistentes al entrenamiento",
  },
  {
    id: "asistencia",
    title: "Control de Asistencia",
    description: "Registro de asistencia por día",
  },
  {
    id: "certificacion",
    title: "Certificación y Firma",
    description: "Firma digital del especialista",
  },
];

const AsistenciaStepper = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionData, setCompletionData] = useState(null);
  const [attendees, setAttendees] = useState([
    { id: 1, nombre: "", cargo: "", email: "", asistencia: { dia1: false, dia2: false, dia3: false } }
  ]);
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
      ORDFecha: new Date().toISOString().split("T")[0],
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
    console.log("✍️ AsistenciaStepper: Signature captured", {
      dataLength: signatureData?.length,
      dataPreview: signatureData?.substring(0, 50) + "..."
    });
    setValue("Firma_Especialista", signatureData);
    console.log("✍️ AsistenciaStepper: Signature stored in form");
  };

  const addAttendee = () => {
    if (attendees.length < 7) {
      const newAttendee = {
        id: attendees.length + 1,
        nombre: "",
        cargo: "",
        email: "",
        asistencia: { dia1: false, dia2: false, dia3: false }
      };
      setAttendees([...attendees, newAttendee]);
    }
  };

  const removeAttendee = (id) => {
    if (attendees.length > 1) {
      setAttendees(attendees.filter(attendee => attendee.id !== id));
    }
  };

  const updateAttendee = (id, field, value) => {
    setAttendees(attendees.map(attendee =>
      attendee.id === id ? { ...attendee, [field]: value } : attendee
    ));
  };

  const updateAttendance = (attendeeId, day, checked) => {
    setAttendees(attendees.map(attendee =>
      attendee.id === attendeeId
        ? {
            ...attendee,
            asistencia: { ...attendee.asistencia, [day]: checked }
          }
        : attendee
    ));
  };

  const validateAttendees = () => {
    for (const attendee of attendees) {
      if (attendee.nombre.trim()) {
        if (!attendee.cargo.trim() || !attendee.email.trim()) {
          return false;
        }
        // Check if attendee has at least one attendance mark
        const hasAttendance = Object.values(attendee.asistencia).some(attended => attended);
        if (!hasAttendance) {
          return false;
        }
      }
    }
    return true;
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);

      console.log("Form data received:", {
        Firma_Especialista: !!data.Firma_Especialista,
        signatureLength: data.Firma_Especialista?.length,
        Num_Orden: data.Num_Orden,
        ORDCliente: data.ORDCliente,
        attendees: attendees.length
      });

      // Validate that at least signature is present
      if (!data.Firma_Especialista || data.Firma_Especialista.length < 10) {
        showToast("Debe firmar digitalmente antes de completar el registro", "error");
        setIsGeneratingPDF(false);
        return;
      }

      // Validate attendees data
      if (!validateAttendees()) {
        showToast("Todos los asistentes registrados deben tener cargo, email y al menos una marca de asistencia", "error");
        setIsGeneratingPDF(false);
        return;
      }

      // Check if at least one attendee is registered
      const hasAttendees = attendees.some(attendee => attendee.nombre.trim());
      if (!hasAttendees) {
        showToast("Debe registrar al menos un asistente", "error");
        setIsGeneratingPDF(false);
        return;
      }

      // Prepare data for PDF generation
      const attendanceData = {
        // 1️⃣ DATOS GENERALES DEL ENTRENAMIENTO
        Num_Orden: data.Num_Orden,
        ORDFecha: data.ORDFecha,
        ORDCliente: data.ORDCliente,
        ORDEquipo: data.ORDEquipo,
        ORDSerie: data.ORDSerie,
        ORDResponsable: data.ORDResponsable,

        // 2️⃣ TABLA DE ASISTENCIA (Hasta 7 asistentes)
        ...attendees.reduce((acc, attendee, index) => {
          const num = index + 1;
          acc[`Nombres_Apellidos${num}`] = attendee.nombre;
          acc[`Cargo${num}`] = attendee.cargo;
          acc[`Correo_Electrónico${num}`] = attendee.email;
          return acc;
        }, {}),

        // 3️⃣ ASISTENCIA POR DÍA
        ...attendees.reduce((acc, attendee, index) => {
          const num = index + 1;
          acc[`Dia_1_${num}`] = attendee.asistencia.dia1 ? "✔️" : "";
          acc[`Dia_2_${num}`] = attendee.asistencia.dia2 ? "✔️" : "";
          acc[`Dia_3_${num}`] = attendee.asistencia.dia3 ? "✔️" : "";
          return acc;
        }, {}),

        // 4️⃣ FIRMA DEL ESPECIALISTA
        Firma_Especialista: data.Firma_Especialista,
      };

      console.log("Submitting attendance data:", {
        hasSignature: !!attendanceData.Firma_Especialista,
        signatureLength: attendanceData.Firma_Especialista?.length,
        ordenNumero: attendanceData.Num_Orden,
        cliente: attendanceData.ORDCliente,
        attendeesCount: attendees.filter(a => a.nombre.trim()).length
      });

      const result = await generateAttendanceListPDF(attendanceData);

      console.log("API Response:", result);

      if (result.ok) {
        setIsCompleted(true);
        setCompletionData(result);
        showToast(`Lista de asistencia registrada: ${result.ordenNumero} - ${result.cliente}`, "success");
      } else {
        showToast(result.message || "Error al procesar la lista de asistencia", "error");
      }

    } catch (error) {
      console.error("Error processing attendance list:", error);
      showToast(error.response?.data?.message || "Error al procesar la lista de asistencia", "error");
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
                Información básica de la orden de asistencia al entrenamiento
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
                  {...register("Num_Orden", { required: "El número de orden es obligatorio" })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {errors.Num_Orden && (
                  <p className="text-xs text-red-500 mt-1">{errors.Num_Orden.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha del Entrenamiento *
                </label>
                <input
                  type="date"
                  {...register("ORDFecha", { required: "La fecha es obligatoria" })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {errors.ORDFecha && (
                  <p className="text-xs text-red-500 mt-1">{errors.ORDFecha.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
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
                  Equipo Entrenado *
                </label>
                <input
                  type="text"
                  placeholder="Equipo capacitado"
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
                  Responsable *
                </label>
                <input
                  type="text"
                  placeholder="Especialista responsable"
                  {...register("ORDResponsable", { required: "El responsable es obligatorio" })}
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
                {errors.ORDResponsable && (
                  <p className="text-xs text-red-500 mt-1">{errors.ORDResponsable.message}</p>
                )}
              </div>
            </div>
          </div>
        );

      case 1: // Registro de Asistentes
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Registro de Asistentes
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Captura de datos de los asistentes al entrenamiento
              </p>
            </div>

            <Card className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-medium text-gray-900">Asistentes Registrados ({attendees.length}/7)</h4>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addAttendee}
                  disabled={attendees.length >= 7}
                  icon={FiPlus}
                >
                  Agregar Asistente
                </Button>
              </div>

              <div className="space-y-4">
                {attendees.map((attendee) => (
                  <div key={attendee.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="font-medium text-gray-700">Asistente {attendee.id}</h5>
                      {attendees.length > 1 && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => removeAttendee(attendee.id)}
                          icon={FiTrash2}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nombres y Apellidos
                        </label>
                        <input
                          type="text"
                          placeholder="Nombres completos"
                          value={attendee.nombre}
                          onChange={(e) => updateAttendee(attendee.id, 'nombre', e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cargo
                        </label>
                        <input
                          type="text"
                          placeholder="Cargo o posición"
                          value={attendee.cargo}
                          onChange={(e) => updateAttendee(attendee.id, 'cargo', e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          placeholder="email@empresa.com"
                          value={attendee.email}
                          onChange={(e) => updateAttendee(attendee.id, 'email', e.target.value)}
                          className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {attendee.nombre && (!attendee.cargo || !attendee.email) && (
                      <p className="text-xs text-red-500 mt-2">
                        Si registra un asistente, debe completar cargo y email
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        );

      case 2: // Control de Asistencia
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Control de Asistencia
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Registro de asistencia por día para cada asistente
              </p>
            </div>

            <Card className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Asistente</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Día 1</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Día 2</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Día 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees
                      .filter(attendee => attendee.nombre.trim())
                      .map((attendee) => (
                        <tr key={attendee.id}>
                          <td className="border border-gray-300 px-4 py-2">
                            <div>
                              <div className="font-medium">{attendee.nombre}</div>
                              <div className="text-sm text-gray-500">{attendee.cargo}</div>
                            </div>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={attendee.asistencia.dia1}
                              onChange={(e) => updateAttendance(attendee.id, 'dia1', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={attendee.asistencia.dia2}
                              onChange={(e) => updateAttendance(attendee.id, 'dia2', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={attendee.asistencia.dia3}
                              onChange={(e) => updateAttendance(attendee.id, 'dia3', e.target.checked)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {attendees.filter(a => a.nombre.trim()).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No hay asistentes registrados. Vaya al paso anterior para agregar asistentes.
                </div>
              )}

              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Cada asistente debe tener al menos una marca de asistencia (✔️) en alguno de los días.
                </p>
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
                Firma digital del especialista para validar la lista de asistencia
              </p>
            </div>

            <Card className="p-4">
              <h4 className="font-medium text-gray-900 mb-4">✍️ Firma del Especialista</h4>
              <div onClick={(e) => e.preventDefault()}>
                <FirmaDigital onSignatureCapture={handleSignatureCapture} />
              </div>
            </Card>

            <Card className="p-4 bg-blue-50 border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">Certificación</h4>
              <p className="text-sm text-blue-800">
                "Con la presente certifico que: He supervisado el entrenamiento y registrado correctamente
                la asistencia de los participantes según los procedimientos establecidos."
              </p>
            </Card>

            <Card className="p-4 bg-green-50 border-green-200">
              <h4 className="font-medium text-green-900 mb-2">Resumen de Asistencia</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {attendees.filter(a => a.nombre.trim()).length}
                  </div>
                  <div className="text-green-800">Asistentes registrados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {attendees.filter(a => a.nombre.trim() && Object.values(a.asistencia).some(att => att)).length}
                  </div>
                  <div className="text-blue-800">Con asistencia marcada</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {attendees.filter(a => a.nombre.trim() && !Object.values(a.asistencia).some(att => att)).length}
                  </div>
                  <div className="text-purple-800">Sin asistencia</div>
                </div>
              </div>
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
              ¡Lista de Asistencia Completada!
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              La lista de asistencia ha sido registrada correctamente
            </p>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen de la Lista de Asistencia</h3>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700">Asistentes Registrados</label>
                  <p className="text-sm text-gray-600 mt-1">
                    {attendees.filter(a => a.nombre.trim()).length} persona(s)
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Archivo Generado</label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      PDF de lista de asistencia guardado en Drive
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Ubicación en Drive</label>
                  <p className="text-sm text-gray-600 mt-1">
                    Servicio Técnico / Entrenamiento / [Num_Orden]-[Cliente]-[Fecha]
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
              setAttendees([{ id: 1, nombre: "", cargo: "", email: "", asistencia: { dia1: false, dia2: false, dia3: false } }]);
            }}
            icon={FiUpload}
          >
            Nueva Lista de Asistencia
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center">
          Lista de Asistencia de Entrenamiento
        </h1>
        <p className="text-sm text-gray-500 text-center mt-2">
          Formulario F.ST-05 - V03 - Control de asistencia a entrenamientos
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
              {isGeneratingPDF ? "Procesando..." : "Completar Lista"}
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

export default AsistenciaStepper;
