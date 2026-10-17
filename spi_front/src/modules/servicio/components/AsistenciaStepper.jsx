import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiUpload, FiPlus, FiTrash2, FiAlertTriangle } from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import { generateAttendanceListPDF } from "../../../core/api/servicioApi";
import { useUI } from "../../../core/ui/UIContext";
import DocumentSigner from "../../signature/components/DocumentSigner";
import ServicioCard from "../design/ServicioCard";
import ServicioBadge from "../design/ServicioBadge";
import "../design/tokens.css";

const STEPS = [
  { id: "orden", title: "Datos de la Orden", description: "Informacion basica de la orden de asistencia" },
  { id: "asistentes", title: "Registro de Asistentes", description: "Captura de datos de los asistentes al entrenamiento" },
  { id: "asistencia", title: "Control de Asistencia", description: "Registro de asistencia por dia" },
  { id: "certificacion", title: "Certificacion y Firma", description: "Firma digital del especialista" },
];
const MAX_ATTENDEES = 30;

const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-2 outline-none";
const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };
const labelClass = "mb-1 block text-sm font-medium";
const labelStyle = { color: "var(--st-text-muted)" };

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
    { id: 1, nombre: "", cargo: "", email: "", asistencia: { dia1: false, dia2: false, dia3: false } },
  ]);
  const { showToast } = useUI();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { ORDFecha: new Date().toISOString().split("T")[0] },
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
  const addAttendee = () => {
    if (attendees.length < MAX_ATTENDEES) {
      setAttendees([...attendees, { id: attendees.length + 1, nombre: "", cargo: "", email: "", asistencia: { dia1: false, dia2: false, dia3: false } }]);
    }
  };
  const removeAttendee = (id) => {
    if (attendees.length > 1) setAttendees(attendees.filter((attendee) => attendee.id !== id));
  };
  const updateAttendee = (id, field, value) => {
    setAttendees(attendees.map((attendee) => (attendee.id === id ? { ...attendee, [field]: value } : attendee)));
  };
  const updateAttendance = (attendeeId, day, checked) => {
    setAttendees(attendees.map((attendee) => (attendee.id === attendeeId ? { ...attendee, asistencia: { ...attendee.asistencia, [day]: checked } } : attendee)));
  };
  const validateAttendees = () => {
    for (const attendee of attendees) {
      if (attendee.nombre.trim()) {
        if (!attendee.cargo.trim() || !attendee.email.trim()) return false;
        const hasAttendance = Object.values(attendee.asistencia).some((attended) => attended);
        if (!hasAttendance) return false;
      }
    }
    return true;
  };

  const onSubmit = async (data) => {
    try {
      setIsGeneratingPDF(true);
      if (!validateAttendees()) {
        showToast("Todos los asistentes registrados deben tener cargo, email y al menos una marca de asistencia", "error");
        setIsGeneratingPDF(false);
        return;
      }
      const hasAttendees = attendees.some((attendee) => attendee.nombre.trim());
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

      const attendanceData = {
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
        ...templateAttendees.reduce((acc, attendee, index) => {
          const num = index + 1;
          acc[`Nombres_Apellidos${num}`] = attendee.nombre;
          acc[`Cargo${num}`] = attendee.cargo;
          acc[`Correo_Electrónico${num}`] = attendee.email;
          return acc;
        }, {}),
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

      const result = await generateAttendanceListPDF(attendanceData, workflowContext);
      if (result.ok) {
        setPendingResult(result);
        if (result.documentId && result.documentBase64) {
          setSigningDoc({ id: result.documentId, base64: result.documentBase64, name: "Lista_Asistencia_" + (attendanceData.Num_Orden || "documento") + ".pdf" });
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
            <StepHeader title="Datos de la Orden" description="Informacion basica de la orden de asistencia al entrenamiento" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} style={labelStyle}>Numero de Orden *</label>
                <input type="text" placeholder="ORD-2025-001" {...register("Num_Orden", { required: "El numero de orden es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.Num_Orden && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.Num_Orden.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Fecha del Entrenamiento *</label>
                <input type="date" {...register("ORDFecha", { required: "La fecha es obligatoria" })} className={inputClass} style={inputStyle} />
                {errors.ORDFecha && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDFecha.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} style={labelStyle}>Cliente *</label>
                <input type="text" placeholder="Nombre del cliente" {...register("ORDCliente", { required: "El cliente es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.ORDCliente && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDCliente.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} style={labelStyle}>Equipo Entrenado *</label>
                <input type="text" placeholder="Equipo capacitado" {...register("ORDEquipo", { required: "El equipo es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.ORDEquipo && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDEquipo.message}</p>}
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Serie</label>
                <input type="text" placeholder="Numero de serie (opcional)" {...register("ORDSerie")} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Responsable *</label>
                <input type="text" placeholder="Especialista responsable" {...register("ORDResponsable", { required: "El responsable es obligatorio" })} className={inputClass} style={inputStyle} />
                {errors.ORDResponsable && <p className="mt-1 text-xs" style={{ color: "var(--st-danger)" }}>{errors.ORDResponsable.message}</p>}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <StepHeader title="Registro de Asistentes" description="Captura de datos de los asistentes al entrenamiento" />
            <ServicioCard className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-medium" style={{ color: "var(--st-text)" }}>Asistentes Registrados ({attendees.length}/{MAX_ATTENDEES})</h4>
                <Button type="button" variant="secondary" size="sm" onClick={addAttendee} disabled={attendees.length >= MAX_ATTENDEES} icon={FiPlus}>Agregar Asistente</Button>
              </div>
              <div className="space-y-4">
                {attendees.map((attendee) => (
                  <div key={attendee.id} className="rounded-[var(--st-radius-md)] border p-4" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
                    <div className="mb-3 flex items-center justify-between">
                      <h5 className="font-medium" style={{ color: "var(--st-text-muted)" }}>Asistente {attendee.id}</h5>
                      {attendees.length > 1 && (
                        <Button type="button" variant="danger" size="sm" onClick={() => removeAttendee(attendee.id)} icon={FiTrash2}>Eliminar</Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className={labelClass} style={labelStyle}>Nombres y Apellidos</label>
                        <input type="text" placeholder="Nombres completos" value={attendee.nombre} onChange={(e) => updateAttendee(attendee.id, "nombre", e.target.value)} className={inputClass} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelClass} style={labelStyle}>Cargo</label>
                        <input type="text" placeholder="Cargo o posicion" value={attendee.cargo} onChange={(e) => updateAttendee(attendee.id, "cargo", e.target.value)} className={inputClass} style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelClass} style={labelStyle}>Correo Electronico</label>
                        <input type="email" placeholder="email@empresa.com" value={attendee.email} onChange={(e) => updateAttendee(attendee.id, "email", e.target.value)} className={inputClass} style={inputStyle} />
                      </div>
                    </div>
                    {attendee.nombre && (!attendee.cargo || !attendee.email) && (
                      <p className="mt-2 text-xs" style={{ color: "var(--st-danger)" }}>Si registra un asistente, debe completar cargo y email</p>
                    )}
                  </div>
                ))}
              </div>
              {attendees.filter((attendee) => attendee.nombre.trim()).length > 7 && (
                <div className="mt-3 rounded-[var(--st-radius-md)] border p-3 text-sm" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)", color: "var(--st-warning)" }}>
                  La plantilla F.ST-05 permite 7 asistentes visibles. Los adicionales se registrarán en el workflow para trazabilidad y reglas de aprobación.
                </div>
              )}
            </ServicioCard>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <StepHeader title="Control de Asistencia" description="Registro de asistencia por dia para cada asistente" />
            <ServicioCard className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ background: "var(--st-surface-sunken)" }}>
                      <th className="border px-4 py-2 text-left" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>Asistente</th>
                      <th className="border px-4 py-2 text-center" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>Dia 1</th>
                      <th className="border px-4 py-2 text-center" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>Dia 2</th>
                      <th className="border px-4 py-2 text-center" style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)" }}>Dia 3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.filter((attendee) => attendee.nombre.trim()).map((attendee) => (
                      <tr key={attendee.id}>
                        <td className="border px-4 py-2" style={{ borderColor: "var(--st-border)" }}>
                          <div className="font-medium" style={{ color: "var(--st-text)" }}>{attendee.nombre}</div>
                          <div className="text-sm" style={{ color: "var(--st-text-faint)" }}>{attendee.cargo}</div>
                        </td>
                        <td className="border px-4 py-2 text-center" style={{ borderColor: "var(--st-border)" }}>
                          <input type="checkbox" checked={attendee.asistencia.dia1} onChange={(e) => updateAttendance(attendee.id, "dia1", e.target.checked)} className="h-4 w-4" />
                        </td>
                        <td className="border px-4 py-2 text-center" style={{ borderColor: "var(--st-border)" }}>
                          <input type="checkbox" checked={attendee.asistencia.dia2} onChange={(e) => updateAttendance(attendee.id, "dia2", e.target.checked)} className="h-4 w-4" />
                        </td>
                        <td className="border px-4 py-2 text-center" style={{ borderColor: "var(--st-border)" }}>
                          <input type="checkbox" checked={attendee.asistencia.dia3} onChange={(e) => updateAttendance(attendee.id, "dia3", e.target.checked)} className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {attendees.filter((a) => a.nombre.trim()).length === 0 && (
                <div className="py-8 text-center text-sm" style={{ color: "var(--st-text-faint)" }}>No hay asistentes registrados. Vaya al paso anterior para agregar asistentes.</div>
              )}
              <div className="mt-4 rounded-[var(--st-radius-md)] p-3" style={{ background: "var(--st-accent-soft)" }}>
                <p className="text-sm" style={{ color: "var(--st-accent-strong)" }}>
                  <strong>Nota:</strong> Cada asistente debe tener al menos una marca de asistencia (X) en alguno de los dias.
                </p>
              </div>
            </ServicioCard>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <StepHeader title="Certificacion y Firma" description="FamSign para validar la lista de asistencia" />

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-warning)", background: "var(--st-warning-soft)" }}>
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="mt-0.5 shrink-0" style={{ color: "var(--st-warning)" }} />
                <div>
                  <h4 className="mb-1 font-medium" style={{ color: "var(--st-warning)" }}>FamSign</h4>
                  <p className="text-sm" style={{ color: "var(--st-warning)" }}>
                    Esta lista de asistencia sera firmada digitalmente con sello institucional y codigo QR verificable, cumpliendo con la Ley de Comercio Electronico del Ecuador.
                  </p>
                </div>
              </div>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-accent-soft)", background: "var(--st-accent-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-accent-strong)" }}>Certificacion Legal</h4>
              <p className="mb-3 text-sm" style={{ color: "var(--st-accent-strong)" }}>
                "Con la presente certifico que: He supervisado el entrenamiento y registrado correctamente la asistencia de los participantes segun los procedimientos establecidos."
              </p>
              <p className="text-xs" style={{ color: "var(--st-accent-strong)" }}>Esta certificacion tendra valor legal equivalente a una firma manuscrita segun la legislacion ecuatoriana.</p>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-success-soft)", background: "var(--st-success-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-success)" }}>Que incluye FamSign?</h4>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                {["Hash criptografico SHA-256", "Sello institucional", "Codigo QR verificable", "Cadena de confianza", "Bloqueo del documento", "Audit trail completo"].map((label) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                    <span style={{ color: "var(--st-success)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </ServicioCard>

            <ServicioCard className="p-4" style={{ borderColor: "var(--st-success-soft)", background: "var(--st-success-soft)" }}>
              <h4 className="mb-2 font-medium" style={{ color: "var(--st-success)" }}>Resumen de Asistencia</h4>
              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: "var(--st-success)" }}>{attendees.filter((a) => a.nombre.trim()).length}</div>
                  <div style={{ color: "var(--st-success)" }}>Asistentes registrados</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: "var(--st-accent)" }}>{attendees.filter((a) => a.nombre.trim() && Object.values(a.asistencia).some((att) => att)).length}</div>
                  <div style={{ color: "var(--st-accent-strong)" }}>Con asistencia marcada</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: "var(--st-warning)" }}>{attendees.filter((a) => a.nombre.trim() && !Object.values(a.asistencia).some((att) => att)).length}</div>
                  <div style={{ color: "var(--st-warning)" }}>Sin asistencia</div>
                </div>
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
        {!hideHeader && (
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--st-success-soft)" }}>
              <FiCheckCircle className="h-8 w-8" style={{ color: "var(--st-success)" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Lista de Asistencia Completada!</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>La lista de asistencia ha sido registrada correctamente</p>
          </div>
        )}
        <ServicioCard className="mb-6 p-6">
          <h3 className="mb-4 text-lg font-semibold" style={{ color: "var(--st-text)" }}>Resumen de la Lista de Asistencia</h3>
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
              <div>
                <label className={labelClass} style={labelStyle}>Asistentes Registrados</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>{attendees.filter((a) => a.nombre.trim()).length} persona(s)</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass} style={labelStyle}>Archivo Generado</label>
                <div className="mt-1 flex items-center gap-2 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--st-success)" }} />
                  PDF de lista de asistencia guardado en Drive
                </div>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>Ubicacion en Drive</label>
                <p className="mt-1 text-sm" style={{ color: "var(--st-text-muted)" }}>Servicio Tecnico / Entrenamiento / [Num_Orden]-[Cliente]-[Fecha]</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>ID de Carpeta</label>
                <p className="mt-1 break-all font-mono text-xs" style={{ color: "var(--st-text-faint)" }}>{completionData.driveFolderId}</p>
              </div>
            </div>
          </div>
        </ServicioCard>
        {signingDoc && (
          <ServicioCard className="mb-6 p-4">
            <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--st-text)" }}>Firma electronica avanzada</h3>
            <DocumentSigner documentId={signingDoc.id} initialDocument={{ name: signingDoc.name, base64: signingDoc.base64 }} onSignatureComplete={handleAdvancedSignatureComplete} onCancel={() => setSigningDoc(null)} />
          </ServicioCard>
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
    <div className="st-scope mx-auto max-w-6xl p-6">
      {!hideHeader && (
        <div className="mb-8">
          <h1 className="text-center text-2xl font-bold" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>Lista de Asistencia de Entrenamiento</h1>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--st-text-muted)" }}>Formulario F.ST-05 - V03 - Control de asistencia a entrenamientos</p>
        </div>
      )}
      {renderStepIndicator()}
      <form onSubmit={handleSubmit(onSubmit)}>
        <ServicioCard className="mb-6 p-6">{renderStepContent()}</ServicioCard>
        {signingDoc && (
          <ServicioCard className="mb-6 p-4">
            <h3 className="mb-3 text-lg font-semibold" style={{ color: "var(--st-text)" }}>Firma electronica avanzada</h3>
            <DocumentSigner documentId={signingDoc.id} initialDocument={{ name: signingDoc.name, base64: signingDoc.base64 }} onSignatureComplete={handleAdvancedSignatureComplete} onCancel={() => setSigningDoc(null)} />
          </ServicioCard>
        )}
        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={prevStep} disabled={currentStep === 0} icon={FiChevronLeft}>Anterior</Button>
          <div className="text-sm" style={{ color: "var(--st-text-muted)" }}>Paso {currentStep + 1} de {STEPS.length}</div>
          {currentStep === STEPS.length - 1 ? (
            <Button type="submit" disabled={isGeneratingPDF} icon={FiCheckCircle}>{isGeneratingPDF ? "Procesando..." : "Completar Lista"}</Button>
          ) : (
            <Button type="button" onClick={nextStep} icon={FiChevronRight}>Siguiente</Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default AsistenciaStepper;
