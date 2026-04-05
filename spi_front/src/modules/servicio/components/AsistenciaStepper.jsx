import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload, FiPlus, FiTrash2 } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { generateAttendanceListPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import DocumentSigner from "../../signature/components/DocumentSigner";
const STEPS = [
 {
 id: "orden",
 title: "Datos de la Orden",
 description: "Informacion basica de la orden de asistencia",
 },
 {
 id: "asistentes",
 title: "Registro de Asistentes",
 description: "Captura de datos de los asistentes al entrenamiento",
 },
 {
 id: "asistencia",
 title: "Control de Asistencia",
 description: "Registro de asistencia por dia",
 },
 {
 id: "certificacion",
 title: "Certificacion y Firma",
 description: "Firma digital del especialista",
 },
];
const MAX_ATTENDEES = 30;

const AsistenciaStepper = ({ workflowContext: workflowContextProp = null, onCompleted = null, hideHeader = false }) => {
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
 const [signingDoc, setSigningDoc] = useState(null);
 const [, setSignatureResult] = useState(null);
 const [pendingResult, setPendingResult] = useState(null);
 const [attendees, setAttendees] = useState([
 { id: 1, nombre: "", cargo: "", email: "", asistencia: { dia1: false, dia2: false, dia3: false } }
 ]);
 const { showToast } = useUI();
 const {
 register,
 handleSubmit,
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
 const addAttendee = () => {
 if (attendees.length < MAX_ATTENDEES) {
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
 Num_Orden: data.Num_Orden,
 ORDCliente: data.ORDCliente,
 attendees: attendees.length
 });
 // Validaciones obligatorias antes de completar
 if (!validateAttendees()) {
 showToast("Todos los asistentes registrados deben tener cargo, email y al menos una marca de asistencia", "error");
 setIsGeneratingPDF(false);
 return;
 }
 const hasAttendees = attendees.some(attendee => attendee.nombre.trim());
 if (!hasAttendees) {
 showToast("Debe registrar al menos un asistente", "error");
 setIsGeneratingPDF(false);
 return;
 }
 if (!data.Num_Orden?.trim() || !data.ORDCliente?.trim() || !data.ORDEquipo?.trim() || !data.ORDResponsable?.trim()) {
 showToast("Debe completar todos los datos basicos de la orden", "error");
 setIsGeneratingPDF(false);
 return;
 }
 const activeAttendees = attendees.filter((attendee) => attendee.nombre.trim());
 const templateAttendees = activeAttendees.slice(0, 7);

 // Prepare data for PDF generation
 const attendanceData = {
 // 1. DATOS GENERALES DEL ENTRENAMIENTO
 Num_Orden: data.Num_Orden,
 ORDFecha: data.ORDFecha,
 ORDCliente: data.ORDCliente,
 ORDEquipo: data.ORDEquipo,
 ORDSerie: data.ORDSerie,
 ORDResponsable: data.ORDResponsable,
 attendees: activeAttendees.map((attendee) => ({
 nombre: attendee.nombre,
 cargo: attendee.cargo,
 email: attendee.email,
 asistencia: {
 dia1: Boolean(attendee.asistencia?.dia1),
 dia2: Boolean(attendee.asistencia?.dia2),
 dia3: Boolean(attendee.asistencia?.dia3),
 },
 })),
 // 2. TABLA DE ASISTENCIA (campos de plantilla reales: Dia_1, Dia_1_2..7)
 ...templateAttendees.reduce((acc, attendee, index) => {
 const num = index + 1;
 acc[`Nombres_Apellidos${num}`] = attendee.nombre;
 acc[`Cargo${num}`] = attendee.cargo;
 acc[`Correo_Electr\u00F3nico${num}`] = attendee.email;
 return acc;
 }, {}),
 // 3. ASISTENCIA POR DIA
 ...templateAttendees.reduce((acc, attendee, index) => {
 const num = index + 1;
 const day1Field = num === 1 ? "Dia_1" : `Dia_1_${num}`;
 const day2Field = num === 1 ? "Dia_2" : `Dia_2_${num}`;
 const day3Field = num === 1 ? "Dia_3" : `Dia_3_${num}`;
 acc[day1Field] = attendee.asistencia.dia1 ? "X" : "";
 acc[day2Field] = attendee.asistencia.dia2 ? "X" : "";
 acc[day3Field] = attendee.asistencia.dia3 ? "X" : "";
 return acc;
 }, {}),
 };
 console.log("Submitting attendance data:", {
 ordenNumero: attendanceData.Num_Orden,
 cliente: attendanceData.ORDCliente,
 attendeesCount: activeAttendees.length,
 overflowAttendees: Math.max(0, activeAttendees.length - 7),
 });
 const result = await generateAttendanceListPDF(attendanceData, workflowContext);
 console.log("API Response:", result);
 if (result.ok) {
 setPendingResult(result);
 if (result.documentId && result.documentBase64) {
 setSigningDoc({
 id: result.documentId,
 base64: result.documentBase64,
 name: "Lista_Asistencia_" + (attendanceData.Num_Orden || "documento") + ".pdf",
 });
 showToast("Documento generado. Procede a la firma electronica avanzada.", "info");
 } else {
 setIsCompleted(true);
 setCompletionData(result);
 if (typeof onCompleted === "function") onCompleted(result);
 showToast(`Lista de asistencia registrada: ${result.ordenNumero} - ${result.cliente}`, "success");
 }
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
 const handleAdvancedSignatureComplete = (signatureData) => {
 setSignatureResult(signatureData);
 setIsCompleted(true);
 setCompletionData(pendingResult || {});
 setSigningDoc(null);
 if (typeof onCompleted === "function") onCompleted(pendingResult || {});
 showToast("Documento firmado digitalmente", "success");
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
 Informacion basica de la orden de asistencia al entrenamiento
 </p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Numero de Orden *
 </label>
 <input
 type="text"
 placeholder="ORD-2025-001"
 {...register("Num_Orden", { required: "El numero de orden es obligatorio" })}
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
 placeholder="Numero de serie (opcional)"
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
 <h4 className="font-medium text-gray-900">Asistentes Registrados ({attendees.length}/{MAX_ATTENDEES})</h4>
 <Button
 type="button"
 variant="secondary"
 size="sm"
 onClick={addAttendee}
 disabled={attendees.length >= MAX_ATTENDEES}
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
 placeholder="Cargo o posicion"
 value={attendee.cargo}
 onChange={(e) => updateAttendee(attendee.id, 'cargo', e.target.value)}
 className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Correo Electronico
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
 {attendees.filter((attendee) => attendee.nombre.trim()).length > 7 && (
 <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
 La plantilla F.ST-05 permite 7 asistentes visibles. Los adicionales se registrarán en el workflow para trazabilidad y reglas de aprobación.
 </div>
 )}
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
 Registro de asistencia por dia para cada asistente
 </p>
 </div>
 <Card className="p-4">
 <div className="overflow-x-auto">
 <table className="w-full border-collapse border border-gray-300">
 <thead>
 <tr className="bg-gray-100">
 <th className="border border-gray-300 px-4 py-2 text-left">Asistente</th>
 <th className="border border-gray-300 px-4 py-2 text-center">Dia 1</th>
 <th className="border border-gray-300 px-4 py-2 text-center">Dia 2</th>
 <th className="border border-gray-300 px-4 py-2 text-center">Dia 3</th>
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
 <strong>Nota:</strong> Cada asistente debe tener al menos una marca de asistencia (X) en alguno de los dias.
 </p>
 </div>
 </Card>
 </div>
 );
 case 3: // Certificacion y Firma
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Certificacion y Firma
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 FamSign para validar la lista de asistencia
 </p>
 </div>
 {/* Informacion importante sobre FamSign */}
 <Card className="p-4 bg-yellow-50 border-yellow-200">
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0">
 <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
 d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
 </svg>
 </div>
 <div>
 <h4 className="font-medium text-yellow-900 mb-1">FamSign</h4>
 <p className="text-sm text-yellow-800">
 Esta lista de asistencia sera firmada digitalmente con sello institucional y codigo QR verificable,
 cumpliendo con la Ley de Comercio Electronico del Ecuador.
 </p>
 </div>
 </div>
 </Card>
 <Card className="p-4 bg-blue-50 border-blue-200">
 <h4 className="font-medium text-blue-900 mb-2">Certificacion Legal</h4>
 <p className="text-sm text-blue-800 mb-3">
 "Con la presente certifico que: He supervisado el entrenamiento y registrado correctamente
 la asistencia de los participantes segun los procedimientos establecidos."
 </p>
 <p className="text-xs text-blue-700">
 Esta certificacion tendra valor legal equivalente a una firma manuscrita segun la legislacion ecuatoriana.
 </p>
 </Card>
 {/* Informacion sobre FamSign */}
 <Card className="p-4 bg-green-50 border-green-200">
 <h4 className="font-medium text-green-900 mb-2">Que incluye FamSign?</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Hash criptografico SHA-256</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Sello institucional</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Codigo QR verificable</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Cadena de confianza</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Bloqueo del documento</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Audit trail completo</span>
 </div>
 </div>
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
 {!hideHeader && <div className="mb-8">
 <div className="text-center">
 <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
 <FiCheckCircle className="w-8 h-8 text-green-600" />
 </div>
 <h1 className="text-2xl font-bold text-gray-900">
 Lista de Asistencia Completada!
 </h1>
 <p className="text-sm text-gray-500 mt-2">
 La lista de asistencia ha sido registrada correctamente
 </p>
 </div>
 </div>}
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
 <label className="block text-sm font-medium text-gray-700">Ubicacion en Drive</label>
 <p className="text-sm text-gray-600 mt-1">
 Servicio Tecnico / Entrenamiento / [Num_Orden]-[Cliente]-[Fecha]
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
 {signingDoc && (
 <Card className="p-4 mb-6">
 <h3 className="text-lg font-semibold text-gray-900 mb-3">Firma electronica avanzada</h3>
 <DocumentSigner
 documentId={signingDoc.id}
 initialDocument={{ name: signingDoc.name, base64: signingDoc.base64 }}
 onSignatureComplete={handleAdvancedSignatureComplete}
 onCancel={() => setSigningDoc(null)}
 />
 </Card>
 )}
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
 {!hideHeader && <div className="mb-8">
 <h1 className="text-2xl font-bold text-gray-900 text-center">
 Lista de Asistencia de Entrenamiento
 </h1>
 <p className="text-sm text-gray-500 text-center mt-2">
 Formulario F.ST-05 - V03 - Control de asistencia a entrenamientos
 </p>
 </div>}
 {renderStepIndicator()}
 <form onSubmit={handleSubmit(onSubmit)}>
 <Card className="p-6 mb-6">
 {renderStepContent()}
 </Card>
 {signingDoc && (
 <Card className="p-4 mb-6">
 <h3 className="text-lg font-semibold text-gray-900 mb-3">Firma electronica avanzada</h3>
 <DocumentSigner
 documentId={signingDoc.id}
 initialDocument={{ name: signingDoc.name, base64: signingDoc.base64 }}
 onSignatureComplete={handleAdvancedSignatureComplete}
 onCancel={() => setSigningDoc(null)}
 />
 </Card>
 )}
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
