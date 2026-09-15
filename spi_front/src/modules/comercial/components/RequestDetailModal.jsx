import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FiFile, FiDownload } from 'react-icons/fi';
import { useAuth } from '../../../core/auth/useAuth';
import { useUI } from '../../../core/ui/UIContext';
import { processCreditRequestDecision } from '../../../core/api/requestsApi';

const safeJSON = (txt) => {
 try {
 return typeof txt === "string" ? JSON.parse(txt) : txt || {};
 } catch {
 return {};
 }
};

const formatDate = (dateString) => {
 if (!dateString) return "—";
 return new Date(dateString).toLocaleString("es-ES", {
 dateStyle: "medium",
 timeStyle: "short",
});
};

const CREDIT_FIELDS = [
 { key: "asesor_comercial", label: "Asesor comercial" },
 { key: "fecha_solicitud", label: "Fecha solicitud" },
 { key: "razon_social", label: "Razon social" },
 { key: "ruc_id", label: "RUC / ID" },
 { key: "telefono_contacto", label: "Telefono contacto" },
 { key: "correo_electronico", label: "Correo electronico" },
 { key: "cupo_credito_sugerido", label: "Cupo sugerido" },
 { key: "plazo_pago_acordado", label: "Plazo acordado" },
 { key: "activos", label: "Activos" },
 { key: "pasivos", label: "Pasivos" },
 { key: "patrimonio", label: "Patrimonio" },
 { key: "ingresos_negocio", label: "Ingresos negocio" },
 { key: "egresos_negocio", label: "Egresos negocio" },
 { key: "ingresos_relacion_dependencia", label: "Ingresos relacion dependencia" },
 { key: "gastos_familiares", label: "Gastos familiares" },
 { key: "otros_ingresos", label: "Otros ingresos" },
 { key: "prestamos_obligaciones", label: "Prestamos / obligaciones" },
 { key: "total_ingresos", label: "Total ingresos" },
 { key: "total_egresos", label: "Total egresos" },
 { key: "utilidad_perdida_neta", label: "Utilidad / perdida neta" },
 { key: "banco_1", label: "Banco 1" },
 { key: "banco_2", label: "Banco 2" },
 { key: "cuenta_corriente_1", label: "Cuenta corriente 1" },
 { key: "cuenta_corriente_2", label: "Cuenta corriente 2" },
 { key: "cuenta_ahorros_1", label: "Cuenta ahorros 1" },
 { key: "cuenta_ahorros_2", label: "Cuenta ahorros 2" },
 { key: "proveedor_1", label: "Proveedor 1" },
 { key: "proveedor_2", label: "Proveedor 2" },
 { key: "contacto_proveedor_1", label: "Contacto proveedor 1" },
 { key: "contacto_proveedor_2", label: "Contacto proveedor 2" },
 { key: "telefono_proveedor_1", label: "Telefono proveedor 1" },
 { key: "telefono_proveedor_2", label: "Telefono proveedor 2" },
 { key: "ref_personal_nombre_1", label: "Referencia personal 1" },
 { key: "ref_personal_nombre_2", label: "Referencia personal 2" },
 { key: "ref_personal_parentesco_1", label: "Parentesco 1" },
 { key: "ref_personal_parentesco_2", label: "Parentesco 2" },
 { key: "ref_personal_telefono_1", label: "Telefono referencia 1" },
 { key: "ref_personal_telefono_2", label: "Telefono referencia 2" },
 { key: "nombre_responsable_cobros", label: "Responsable cobros y pagos" },
 { key: "direccion_fisica", label: "Direccion fisica" },
 { key: "ciudad", label: "Ciudad" },
 { key: "provincia", label: "Provincia" },
 { key: "telefono_fijo", label: "Telefono fijo" },
 { key: "telefono_celular", label: "Telefono celular" },
 { key: "ruc_ci_firmante", label: "RUC / CI firmante" },
 { key: "monto_sugerido_jefe_comercial", label: "Monto sugerido interno" },
 { key: "validacion_referencias", label: "Validacion referencias" },
 { key: "decision_solicitud", label: "Decision" },
 { key: "monto_credito_autorizado", label: "Monto autorizado" },
 { key: "plazo_credito_autorizado", label: "Plazo autorizado" },
 { key: "fecha_resolucion", label: "Fecha resolucion" },
 { key: "observaciones_validacion", label: "Observaciones validacion" },
];

const CreditDecisionPanel = ({ request, onProcessed }) => {
 const { user } = useAuth();
 const { showToast } = useUI();
 const role = String(user?.role_name || user?.role || "").toLowerCase();
 const canResolve = role === "jefe_financiero";
 const status = String(request?.status || "").toLowerCase();
 const isCredit = String(request?.type_code || "").toUpperCase() === "F.VE-02";
 const isResolved = ["aprobado", "rechazado", "approved", "rejected", "cancelado"].includes(status);
 const [saving, setSaving] = useState(false);
 const [form, setForm] = useState({
 monto_sugerido_jefe_comercial: "",
 validacion_referencias: "CONFORME",
 monto_credito_autorizado: "",
 plazo_credito_autorizado: "30",
 fecha_resolucion: new Date().toISOString().slice(0, 10),
 observaciones_validacion: "",
 });

 if (!isCredit || !canResolve || isResolved) return null;

 const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
 const submit = async (action) => {
 setSaving(true);
 try {
 await processCreditRequestDecision(request.id, action, form);
 showToast(action === "approve" ? "Solicitud de credito aprobada" : "Solicitud de credito rechazada", "success");
 await onProcessed?.();
 } catch (error) {
 showToast(error?.response?.data?.message || "No se pudo resolver la solicitud de credito", "error");
 } finally {
 setSaving(false);
 }
 };

 return (
 <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
 <h4 className="text-lg font-semibold text-blue-950 mb-1">Revision financiera</h4>
 <p className="text-sm text-blue-800 mb-4">Completa uso interno para aprobar o rechazar la solicitud de credito.</p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <input className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm" type="number" placeholder="Monto sugerido interno" value={form.monto_sugerido_jefe_comercial} onChange={(e) => update("monto_sugerido_jefe_comercial", e.target.value)} />
 <select className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm" value={form.validacion_referencias} onChange={(e) => update("validacion_referencias", e.target.value)}>
 <option value="CONFORME">CONFORME</option>
 <option value="NO CONFORME">NO CONFORME</option>
 </select>
 <input className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm" type="number" placeholder="Monto credito autorizado" value={form.monto_credito_autorizado} onChange={(e) => update("monto_credito_autorizado", e.target.value)} />
 <select className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm" value={form.plazo_credito_autorizado} onChange={(e) => update("plazo_credito_autorizado", e.target.value)}>
 {["15", "30", "45", "60", "90"].map((days) => <option key={days} value={days}>{days} dias</option>)}
 </select>
 <input className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm" type="date" value={form.fecha_resolucion} onChange={(e) => update("fecha_resolucion", e.target.value)} />
 <textarea className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm md:col-span-2" rows={3} placeholder="Observaciones / motivo si se niega" value={form.observaciones_validacion} onChange={(e) => update("observaciones_validacion", e.target.value)} />
 </div>
 <div className="mt-4 flex flex-wrap justify-end gap-2">
 <button type="button" disabled={saving} onClick={() => submit("reject")} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60">
 Rechazar
 </button>
 <button type="button" disabled={saving} onClick={() => submit("approve")} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
 Aprobar credito
 </button>
 </div>
 </section>
 );
};

const RequestDetailModal = ({ detail, onClose, onProcessed }) => {
 const payload = safeJSON(detail.data?.request?.payload);
 const documents = Array.isArray(detail.data?.documents) ? detail.data.documents : [];
 const files = Array.isArray(detail.data?.files) ? detail.data.files : [];

 const isCreditRequest = String(detail.data?.request?.type_code || "").toUpperCase() === "F.VE-02";
 const formFields = isCreditRequest ? CREDIT_FIELDS : [
 { key: "nombre_cliente", label: "Cliente" },
 { key: "commercial_name", label: "Nombre comercial" },
 { key: "ruc_cedula", label: "RUC / Cédula" },
 { key: "persona_contacto", label: "Persona de contacto" },
 { key: "celular_contacto", label: "Celular" },
 { key: "correo_contacto", label: "Correo" },
 { key: "direccion_cliente", label: "Dirección" },
 { key: "fecha_instalacion", label: "Fecha de instalación" },
 { key: "fecha_tope_instalacion", label: "Fecha tope" },
 { key: "equipo_principal", label: "Equipo principal" },
 { key: "equipos", label: "Equipos relacionados" },
 { key: "observaciones", label: "Observaciones" },
 { key: "anotaciones", label: "Anotaciones" },
 { key: "accesorios", label: "Accesorios" },
 { key: "requiere_lis", label: "Requiere LIS" },
 { key: "requiere_instalacion", label: "Requiere instalación" },
 { key: "direccion", label: "Dirección alternativa" },
 ];

 const formatValue = (key, value) => {
 if (value === null || value === undefined || value === "") return null;
 const boolKeys = ["requiere_lis", "requiere_instalacion"];
 if (typeof value === "boolean" && boolKeys.includes(key)) {
 return value ? "Sí" : "No";
 }
 if (Array.isArray(value)) {
 return value.map((item) => {
 if (typeof item === "string") return item;
 if (item?.nombre_equipo) return item.nombre_equipo;
 if (item?.nombre) return item.nombre;
 return JSON.stringify(item);
 }).join(", ");
 }
 return typeof value === "object" ? JSON.stringify(value) : String(value);
 };

 const fallbackValues = {
 commercial_name: detail.data?.request?.commercial_name,
 ruc_cedula: detail.data?.request?.payload?.ruc_cedula ?? detail.data?.request?.ruc_cedula,
 };

 const sanitizedFields = formFields
 .map(({ key, label }) => {
 const value = payload?.[key] ?? (key === "equipos" ? payload?.equipos : null) ?? fallbackValues[key];
 const formatted = formatValue(key, value);
 if (!formatted) return null;
 return { label, value: formatted };
 })
 .filter(Boolean);

 return (
 <Transition.Root show={detail.open} as={Fragment}>
 <Dialog as="div" className="relative z-50" onClose={onClose}>
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-200"
 enterFrom="opacity-0"
 enterTo="opacity-100"
 leave="ease-in duration-150"
 leaveFrom="opacity-100"
 leaveTo="opacity-0"
 >
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
 </Transition.Child>
 <div className="fixed inset-0 overflow-y-auto">
 <div className="flex min-h-full items-center justify-center p-4">
 <Transition.Child
 as={Fragment}
 enter="ease-out duration-200"
 enterFrom="opacity-0 translate-y-2"
 enterTo="opacity-100 translate-y-0"
 leave="ease-in duration-150"
 leaveFrom="opacity-100 translate-y-0"
 leaveTo="opacity-0 translate-y-2"
 >
 <Dialog.Panel className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <Dialog.Title className="text-2xl font-semibold text-gray-900 dark:text-white">
 Detalle de solicitud
 </Dialog.Title>
 {detail.data?.request?.id && (
 <p className="text-sm text-gray-500">
 #{detail.data.request.id} —{" "}
 {detail.data.request.type_title ||
 detail.data.request.type ||
 "Solicitud"}
 </p>
 )}
 </div>
 <button
 onClick={onClose}
 className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
 >
 Cerrar
 </button>
 </div>

 {detail.loading ? (
 <p className="text-center text-gray-500 py-10">
 Cargando documentación…
 </p>
 ) : detail.error ? (
 <p className="text-center text-red-500 py-6">{detail.error}</p>
 ) : (
 <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
 <section>
 <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
 Datos principales
 </h4>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
 <div>
 <p className="text-gray-500">Solicitante</p>
 <p className="font-semibold text-gray-900 dark:text-gray-100">
 {detail.data?.request?.requester_name ||
 detail.data?.request?.requester_email ||
 "—"}
 </p>
 </div>
 <div>
 <p className="text-gray-500">Estado actual</p>
 <p className="font-semibold capitalize">
 {detail.data?.request?.status || "—"}
 </p>
 </div>
 <div>
 <p className="text-gray-500">Creada</p>
 <p className="font-semibold">
 {formatDate(detail.data?.request?.created_at)}
 </p>
 </div>
 </div>
 </section>

 <CreditDecisionPanel
 request={detail.data?.request}
 onProcessed={onProcessed}
 />

 <section>
 <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
 Información del formulario
 </h4>
 {sanitizedFields.length === 0 ? (
 <p className="text-sm text-gray-500">
 No hay información relevante disponible.
 </p>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
 {sanitizedFields.map(({ label, value }) => (
 <div
 key={label}
 className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700"
 >
 <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
 {label}
 </p>
 <p className="font-medium text-gray-900 dark:text-gray-100 break-words">
 {value}
 </p>
 </div>
 ))}
 </div>
 )}
 </section>

 {(documents.length > 0 || files.length > 0) && (
 <section>
 <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
 Archivos adjuntos
 </h4>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {documents.map((doc, idx) => (
 <div
 key={doc.id || idx}
 className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
 >
 <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
 <FiFile />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {doc.filename || doc.name || "Documento"}
 </p>
 <p className="text-xs text-gray-500">
 {formatDate(doc.created_at)}
 </p>
 </div>
 {doc.url && (
 <a
 href={doc.url}
 target="_blank"
 rel="noopener noreferrer"
 className="p-2 text-gray-400 hover:text-blue-600 transition"
 >
 <FiDownload />
 </a>
 )}
 </div>
 ))}
 {files.map((file, idx) => (
 <div
 key={file.id || idx}
 className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
 >
 <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
 <FiFile />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium truncate">
 {file.original_name || file.filename || "Archivo"}
 </p>
 <p className="text-xs text-gray-500">
 {(file.size / 1024).toFixed(1)} KB
 </p>
 </div>
 {file.path && (
 <a
 href={`${process.env.REACT_APP_API_URL || ''}/${file.path}`}
 target="_blank"
 rel="noopener noreferrer"
 className="p-2 text-gray-400 hover:text-blue-600 transition"
 >
 <FiDownload />
 </a>
 )}
 </div>
 ))}
 </div>
 </section>
 )}
 </div>
 )}
 </Dialog.Panel>
 </Transition.Child>
 </div>
 </div>
 </Dialog>
 </Transition.Root>
 );
};

export default RequestDetailModal;
