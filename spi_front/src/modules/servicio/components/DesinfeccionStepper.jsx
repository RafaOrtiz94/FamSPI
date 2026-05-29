import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiDownload, FiUpload } from "react-icons/fi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { generateDisinfectionPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import FirmaDigital from "./FirmaDigital";
import DocumentSigner from "../../signature/components/DocumentSigner";
import { signDocument, fileToBase64 } from "../../../core/api";

const STEPS = [
 {
 id: "identification",
 title: "Identificación del Servicio",
 description: "Datos básicos del equipo y responsable",
 },
 {
 id: "epp",
 title: "Paso 1 - Seguridad Personal",
 description: "Colocación de EPP",
 },
 {
 id: "peo_separation",
 title: "Paso 2 - Partes Eléctricas y Ópticas",
 description: "Separación de componentes sensibles",
 },
 {
 id: "dry_cleaning",
 title: "Paso 3 - Limpieza en Seco",
 description: "Eliminación de polvo y residuos",
 },
 {
 id: "critical_procedures",
 title: "Pasos 4-7 - Procedimientos Críticos",
 description: "Enjuague, remoción y limpieza química",
 },
 {
 id: "drying_transfer",
 title: "Pasos 8-9 - Secado y Traslado",
 description: "Secado completo y traslado del equipo",
 },
 {
 id: "electrical_verification",
 title: "Paso 10 - Verificación Eléctrica",
 description: "Verificación de conexiones eléctricas",
 },
 {
 id: "documentation",
 title: "Pasos 11-12 - Documentación",
 description: "Registro del formato y certificados",
 },
 {
 id: "certification",
 title: "Certificación y Evidencia",
 description: "Firma digital y adjuntos fotográficos",
 },
];

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

 const handleSignatureCapture = (signatureData) => {
 console.log("📝 DesinfeccionStepper: Signature captured", {
 dataLength: signatureData?.length,
 dataPreview: signatureData?.substring(0, 50) + "..."
 });
 setValue("firma_ing_SC", signatureData);
 console.log("📝 DesinfeccionStepper: Signature stored in form");
 };

 const handleFileUpload = async (event) => {
 const files = Array.from(event.target.files);

 // Convert files to base64 data URLs
 const processedFiles = await Promise.all(
 files.map(async (file) => {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => {
 resolve({
 name: file.name,
 type: file.type,
 data: reader.result, // This will be a data URL like "data:image/jpeg;base64,..."
 size: file.size
 });
 };
 reader.onerror = reject;
 reader.readAsDataURL(file);
 });
 })
 );

 setValue("adjunto_evidencia", processedFiles);
 };

 const onSubmit = async (data) => {
 try {
 setIsGeneratingPDF(true);

 console.log("Form data received:", {
 adjunto_evidencia: !!data.adjunto_evidencia,
 evidenceCount: data.adjunto_evidencia?.length || 0
 });

 // VALIDACIONES OBLIGATORIAS ANTES DE COMPLETAR

 // 1. Validar que se haya subido evidencia fotográfica
 if (!data.adjunto_evidencia || data.adjunto_evidencia.length === 0) {
 showToast("Debe adjuntar al menos una evidencia fotográfica del proceso de desinfección", "error");
 setIsGeneratingPDF(false);
 return;
 }

 // 2. Validar que se haya realizado la firma (temporal, será reemplazada por firma avanzada)
 if (!data.firma_ing_SC || data.firma_ing_SC.length < 10) {
 showToast("Debe firmar digitalmente el registro antes de completarlo", "error");
 setIsGeneratingPDF(false);
 return;
 }

 // 3. Validar que todos los pasos críticos estén marcados
 const criticalSteps = [
 'chk_general', 'chk_PEO', 'chk_PEO_1', 'chk_OP_1',
 'chk_en', 'chk_CP', 'chk_lim', 'chk_cloro',
 'chk_PS', 'chk_tras', 'chk_CVITE',
 'chk_DFD', 'chk_CD'
 ];

 const missingSteps = criticalSteps.filter(step => !data[step]);
 if (missingSteps.length > 0) {
 showToast(`Faltan completar ${missingSteps.length} paso(s) obligatorio(s) del proceso de desinfección`, "error");
 setIsGeneratingPDF(false);
 return;
 }

 // Prepare data for PDF generation (con firma básica, será reemplazada por firma avanzada)
 const pdfData = {
 // 1. DATOS GENERALES
 fecha: data.fecha,
 equipo: data.equipo,
 parte_repuesto: data.parte_repuesto || "",
 serie: data.serie,
 responsable: data.responsable,

 // 2. PASO 1 - SEGURIDAD PERSONAL
 chk_general: data.chk_general || false,

 // 3. PASO 2 - PARTES ELÉCTRICAS Y ÓPTICAS
 chk_PEO: data.chk_PEO || false,

 // 4. PASO 3 - LIMPIEZA EN SECO
 chk_PEO_1: data.chk_PEO_1 || false,
 chk_OP_1: data.chk_OP_1 || false,

 // 5. PASOS 4-7 - PROCEDIMIENTOS CRÍTICOS
 chk_en: data.chk_en || false,
 chk_en_op: data.chk_en_op || false,
 chk_CP: data.chk_CP || false,
 chk_CP_op: data.chk_CP_op || false,
 chk_lim: data.chk_lim || false,
 chk_cloro: data.chk_cloro || false,
 chk_OP_cloro: data.chk_OP_cloro || false,

 // 6. PASOS 8-9 - SECADO Y TRASLADO
 chk_PS: data.chk_PS || false,
 chk_PS_peo: data.chk_PS_peo || false,
 chk_PS_op: data.chk_PS_op || false,
 chk_tras: data.chk_tras || false,
 chk_tras_peo: data.chk_tras_peo || false,
 chk_tras_op: data.chk_tras_op || false,

 // 7. PASO 10 - VERIFICACIÓN ELÉCTRICA
 chk_CVITE: data.chk_CVITE || false,

 // 8. PASOS 11-12 - DOCUMENTACIÓN
 chk_DFD: data.chk_DFD || false,
 chk_DFD_peo: data.chk_DFD_peo || false,
 chk_DFD_o: data.chk_DFD_o || false,
 chk_CD: data.chk_CD || false,
 chk_CD_peo: data.chk_CD_peo || false,
 chk_CD_op: data.chk_CD_op || false,

 // 9. DECLARACIÓN Y FIRMA (temporal, será reemplazada por firma avanzada)
 firma_ing_SC: "FIRMA_ELECTRONICA_AVANZADA_PENDIENTE",

 // 🔟 ADJUNTOS
 adjunto_evidencia: data.adjunto_evidencia,
 };

 console.log("Submitting disinfection data for PDF generation:", {
 hasAttachments: !!pdfData.adjunto_evidencia && pdfData.adjunto_evidencia.length > 0,
 attachmentCount: pdfData.adjunto_evidencia?.length || 0
 });

 const result = await generateDisinfectionPDF(pdfData, workflowContext);

 console.log("PDF Generation API Response:", result);

 if (result.ok) {
 // Crear documento en el sistema de firma electrónica
 const documentData = {
 title: `Desinfección - ${data.equipo} - ${data.fecha}`,
 type: 'DESINFECTION_REPORT',
 content: `Registro de desinfección de instrumento médico según F.ST-02 V04`,
 metadata: {
 form_type: 'F.ST-02',
 form_version: 'V04',
 equipment: data.equipo,
 serial: data.serie,
 responsible: data.responsable,
 disinfection_date: data.fecha,
 drive_folder_id: result.driveFolderId,
 pdf_url: result.pdfUrl
 }
 };

 // Aquí iría la lógica para crear el documento y redirigir a firma avanzada
 // Por ahora, mostramos el resultado del PDF
 setIsCompleted(true);
 setCompletionData(result);
 showToast(`PDF generado exitosamente. Próximamente: Firma electrónica avanzada.`, "success");

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
 <div className="flex items-center justify-center mb-8">
 {STEPS.map((step, index) => (
 <React.Fragment key={step.id}>
 <button
 onClick={() => goToStep(index)}
 disabled={index > Math.max(...completedSteps, 0) + 1}
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
 case 0: // Identificación del Servicio
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Identificación del Servicio
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Complete los datos básicos del equipo que será desinfectado
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Fecha *
 </label>
 <input
 type="date"
 {...register("fecha", { required: "La fecha es obligatoria" })}
 className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
 />
 {errors.fecha && (
 <p className="text-xs text-red-500 mt-1">{errors.fecha.message}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Responsable *
 </label>
 <input
 type="text"
 placeholder="Nombre del técnico responsable"
 {...register("responsable", { required: "El responsable es obligatorio" })}
 className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
 />
 {errors.responsable && (
 <p className="text-xs text-red-500 mt-1">{errors.responsable.message}</p>
 )}
 </div>

 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Equipo *
 </label>
 <input
 type="text"
 placeholder="Nombre o descripción del equipo"
 {...register("equipo", { required: "El equipo es obligatorio" })}
 className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
 />
 {errors.equipo && (
 <p className="text-xs text-red-500 mt-1">{errors.equipo.message}</p>
 )}
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Parte/Repuesto
 </label>
 <input
 type="text"
 placeholder="Parte o repuesto específico (opcional)"
 {...register("parte_repuesto")}
 className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1">
 Serie *
 </label>
 <input
 type="text"
 placeholder="Número de serie único"
 {...register("serie", { required: "La serie es obligatoria" })}
 className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
 />
 {errors.serie && (
 <p className="text-xs text-red-500 mt-1">{errors.serie.message}</p>
 )}
 </div>
 </div>
 </div>
 );

 case 1: // Paso 1 - Seguridad Personal
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Paso 1 - Seguridad Personal
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Colocación de Equipos de Protección Personal (EPP)
 </p>
 </div>

 <Card className="p-4">
 <div className="flex items-start gap-3">
 <input
 type="checkbox"
 {...register("chk_general")}
 className="mt-1"
 />
 <div>
 <p className="font-medium text-gray-900">
 Colóquese una bata de laboratorio, gafas de seguridad y guantes
 </p>
 <p className="text-sm text-gray-600 mt-1">
 Confirmación de EPP completo antes de iniciar cualquier procedimiento.
 </p>
 </div>
 </div>
 </Card>
 </div>
 );

 case 2: // Paso 2 - Partes Eléctricas y Ópticas
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Paso 2 - Partes Eléctricas y Ópticas
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Separación de componentes sensibles
 </p>
 </div>

 <Card className="p-4">
 <div className="flex items-start gap-3">
 <input
 type="checkbox"
 {...register("chk_PEO")}
 className="mt-1"
 />
 <div>
 <p className="font-medium text-gray-900">
 Seleccione los componentes ópticos, electrónicos o sensibles para tratamiento por separado
 </p>
 <p className="text-sm text-gray-600 mt-1">
 <strong>NO aplicarles cloro</strong> - Estos componentes requieren tratamiento especial.
 </p>
 </div>
 </div>
 </Card>
 </div>
 );

 case 3: // Paso 3 - Limpieza en Seco
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Paso 3 - Limpieza en Seco
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Eliminación de polvo y residuos secos
 </p>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Partes Eléctricas/Ópticas</h4>
 <div className="flex items-start gap-3">
 <input
 type="checkbox"
 {...register("chk_PEO_1")}
 className="mt-1"
 />
 <div>
 <p className="font-medium text-gray-900">
 Elimine polvo, salpicaduras o residuos secos
 </p>
 <p className="text-sm text-gray-600 mt-1">
 Limpieza cuidadosa de componentes sensibles.
 </p>
 </div>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Otras Partes</h4>
 <div className="flex items-start gap-3">
 <input
 type="checkbox"
 {...register("chk_OP_1")}
 className="mt-1"
 />
 <div>
 <p className="font-medium text-gray-900">
 Elimine polvo, salpicaduras o residuos secos
 </p>
 <p className="text-sm text-gray-600 mt-1">
 Limpieza general de componentes no sensibles.
 </p>
 </div>
 </div>
 </Card>
 </div>
 </div>
 );

 case 4: // Pasos 4-7 - Procedimientos Críticos
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Pasos 4-7 - Procedimientos Críticos
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Enjuague, remoción y limpieza química
 </p>
 </div>

 <div className="grid grid-cols-1 gap-4">
 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Paso 4 - Enjuague de ductos hidráulicos</h4>
 <p className="text-sm text-gray-600 mb-3">
 Enjuagar todos los ductos hidráulicos antes de desensamblar, asegurando que no quede líquido en ellos.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_en")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_en_op")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Paso 5 - Componentes cortopunzantes</h4>
 <p className="text-sm text-gray-600 mb-3">
 Remover, si es posible, todos los componentes cortopunzantes. Si deben ser cambiados, depositarlos en guardianes.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_CP")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_CP_op")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Paso 6 - Limpieza con Hipoclorito 5%</h4>
 <p className="text-sm text-gray-600 mb-3">
 Limpiar superficies con paño libre de pelusa y solución de hipoclorito al 5%.
 </p>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_lim")} className="mt-1" />
 <span className="text-sm font-medium">Aplicar solución desinfectante</span>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Paso 7 - Eliminación del cloro</h4>
 <p className="text-sm text-gray-600 mb-3">
 Eliminar inmediatamente el cloro con paño sin pelusa humedecido con agua, seguido de un paño seco.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_cloro")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_OP_cloro")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>
 </div>
 </div>
 );

 case 5: // Pasos 8-9 - Secado y Traslado
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Pasos 8-9 - Secado y Traslado
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Secado completo y traslado del equipo
 </p>
 </div>

 <div className="grid grid-cols-1 gap-4">
 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Secado completo</h4>
 <p className="text-sm text-gray-600 mb-3">
 Asegurarse de que las piezas estén completamente secas antes de enviar el equipo o encenderlo.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_PS")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_PS_peo")} className="mt-1" />
 <span className="text-sm font-medium">PEO</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_PS_op")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Traslado al área de revisión</h4>
 <p className="text-sm text-gray-600 mb-3">
 Trasladar el instrumento al área de revisión y reparación.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_tras")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_tras_peo")} className="mt-1" />
 <span className="text-sm font-medium">PEO</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_tras_op")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>
 </div>
 </div>
 );

 case 6: // Paso 10 - Verificación Eléctrica
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Paso 10 - Verificación Eléctrica
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Verificación de conexiones eléctricas
 </p>
 </div>

 <Card className="p-4">
 <div className="flex items-start gap-3">
 <input
 type="checkbox"
 {...register("chk_CVITE")}
 className="mt-1"
 />
 <div>
 <p className="font-medium text-gray-900">
 Verifique conexiones y tarjetas eléctricas y electrónicas
 </p>
 <p className="text-sm text-gray-600 mt-1">
 Verificación crítica antes de encendido del equipo.
 <strong>Obligatorio si existen componentes PEO.</strong>
 </p>
 </div>
 </div>
 </Card>
 </div>
 );

 case 7: // Pasos 11-12 - Documentación
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Pasos 11-12 - Documentación
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 Registro del formato y certificados
 </p>
 </div>

 <div className="grid grid-cols-1 gap-4">
 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Diligenciar formato de desinfección</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_DFD")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_DFD_peo")} className="mt-1" />
 <span className="text-sm font-medium">PEO</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_DFD_o")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-3">Adjuntar certificado</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_CD")} className="mt-1" />
 <span className="text-sm font-medium">General</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_CD_peo")} className="mt-1" />
 <span className="text-sm font-medium">PEO</span>
 </div>
 <div className="flex items-start gap-3">
 <input type="checkbox" {...register("chk_CD_op")} className="mt-1" />
 <span className="text-sm font-medium">Otras Partes</span>
 </div>
 </div>
 </Card>
 </div>
 </div>
 );

 case 8: // Certificación y Evidencia
 return (
 <div className="space-y-6">
 <div className="text-center">
 <h3 className="text-lg font-semibold text-gray-900">
 Certificación y Evidencia
 </h3>
 <p className="text-sm text-gray-500 mt-1">
 FamSign y evidencia fotográfica del proceso
 </p>
 </div>

 {/* Información importante sobre la firma avanzada */}
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
 Este documento será firmado digitalmente con sello institucional y código QR verificable,
 cumpliendo con la Ley de Comercio Electrónico del Ecuador.
 </p>
 </div>
 </div>
 </Card>

 <Card className="p-4">
 <h4 className="font-medium text-gray-900 mb-4">Evidencia Fotográfica</h4>
 <div className="space-y-3">
 <p className="text-sm text-gray-600">
 Adjunte fotos del proceso de desinfección para evidencia legal
 </p>
 <div className="flex items-center gap-3">
 <input
 ref={fileInputRef}
 type="file"
 multiple
 accept="image/*"
 onChange={handleFileUpload}
 className="hidden"
 />
 <Button
 variant="secondary"
 icon={FiUpload}
 onClick={() => fileInputRef.current?.click()}
 >
 Seleccionar Fotos
 </Button>
 {watch("adjunto_evidencia")?.length > 0 && (
 <span className="text-sm text-gray-600">
 {watch("adjunto_evidencia").length} archivo(s) seleccionado(s)
 </span>
 )}
 </div>
 </div>
 </Card>

 {/* Certificación legal */}
 <Card className="p-4 bg-blue-50 border-blue-200">
 <h4 className="font-medium text-blue-900 mb-2">Certificación Legal</h4>
 <p className="text-sm text-blue-800 mb-3">
 "Con la presente certifico que: He completado los pasos de desinfección para el instrumento en mención.
 El instrumento se encuentra libre de fluidos corporales y material contaminante."
 </p>
 <p className="text-xs text-blue-700">
 Esta certificación tendrá valor legal equivalente a una firma manuscrita según la legislación ecuatoriana.
 </p>
 </Card>

 {/* Información sobre la firma avanzada */}
 <Card className="p-4 bg-green-50 border-green-200">
 <h4 className="font-medium text-green-900 mb-2">¿Qué incluye FamSign?</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Hash criptográfico SHA-256</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Sello institucional</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-2 h-2 bg-green-500 rounded-full"></div>
 <span className="text-green-800">Código QR verificable</span>
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
 ¡Registro Completado!
 </h1>
 <p className="text-sm text-gray-500 mt-2">
 El proceso de desinfección ha sido registrado correctamente
 </p>
 </div>
 </div>

 <Card className="p-6 mb-6">
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen del Registro</h3>

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
 <label className="block text-sm font-medium text-gray-700">Archivos Generados</label>
 <div className="mt-1 space-y-1">
 <div className="flex items-center gap-2 text-sm text-gray-600">
 <span className="w-2 h-2 bg-green-500 rounded-full"></span>
 PDF de desinfección guardado en Drive
 </div>
 {completionData.imageCount > 0 && (
 <div className="flex items-center gap-2 text-sm text-gray-600">
 <span className="w-2 h-2 bg-green-500 rounded-full"></span>
 {completionData.imageCount} evidencia(s) fotográfica(s) guardada(s)
 </div>
 )}
 </div>
 </div>
 </div>

 <div className="space-y-3">
 <div>
 <label className="block text-sm font-medium text-gray-700">Ubicación en Drive</label>
 <p className="text-sm text-gray-600 mt-1">
 Servicio Técnico / Desinfección / [Equipo]-[Fecha]
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
 // Reset the form and state for a new process
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
 <div className="max-w-4xl mx-auto p-6">
 <div className="mb-8">
 <h1 className="text-2xl font-bold text-gray-900 text-center">
 Desinfección de Instrumentos y Partes
 </h1>
 <p className="text-sm text-gray-500 text-center mt-2">
 Formulario F.ST-02 - Registro de desinfección según V04
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
 {isGeneratingPDF ? "Procesando..." : "Completar Registro"}
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

export default DesinfeccionStepper;

