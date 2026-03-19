import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiChevronDown, FiChevronRight, FiSave, FiUploadCloud, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";

import { DashboardLayout, DashboardHeader } from "../../../core/ui/layouts/DashboardLayout";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { useAuth } from "../../../core/auth/AuthContext";
import {
 getCollaboratorProfile,
 updateCollaboratorProfile,
 uploadCollaboratorDocument,
} from "../../../core/api/collaboratorsApi";
import { getUserCertifications } from "../../../core/api/userCertificationsApi";
import {
 defaultProfile as defaultProfileTemplate,
 profileSections as profileSectionsTemplate,
 documentTypes as documentTypesTemplate,
 checklistSections as checklistSectionsTemplate,
} from "../components/collaboratorProfileDefinitions";

const CollaboratorWorkspace = () => {
 const navigate = useNavigate();
 const { user } = useAuth();
 const role = (user?.role || user?.role_name || user?.rol || "").toLowerCase();
 const canUnlockSections = role === "talento_humano" || role === "gerencia_general" || role === "gerencia";
 const { id } = useParams();
 const [profileLoading, setProfileLoading] = useState(false);
 const [profileSaving, setProfileSaving] = useState(false);
 const [profileData, setProfileData] = useState(null);
 const [documents, setDocuments] = useState([]);
 const [docUploading, setDocUploading] = useState(null);
 const [profileErrors, setProfileErrors] = useState({});
 const [sectionSaving, setSectionSaving] = useState({});
 const autosaveTimers = useRef({});
 const profileRef = useRef(null);
 const [openSections, setOpenSections] = useState(() => new Set(["personal", "laboral"]));
 const [collaborator, setCollaborator] = useState(null);
 const [certifications, setCertifications] = useState([]);
 const [certificationSummary, setCertificationSummary] = useState({
 active: 0,
 expired: 0,
 expiring_soon: 0,
 });
 const [profileLastReviewedAt, setProfileLastReviewedAt] = useState(null);
 const [offboardingSaving, setOffboardingSaving] = useState(false);

 const defaultProfile = useMemo(() => defaultProfileTemplate, []);
 const profileSections = useMemo(() => profileSectionsTemplate, []);
 const documentTypes = useMemo(() => documentTypesTemplate, []);
 const checklistSections = useMemo(() => checklistSectionsTemplate, []);

 const mergeProfile = (incoming = {}) => {
 const merged = {};
 Object.keys(defaultProfile).forEach((section) => {
 merged[section] = {
 ...defaultProfile[section],
 ...(incoming?.[section] || {}),
 };
 });
 return merged;
 };

 const isDocUploaded = (docType) => documents.some((doc) => doc.doc_type === docType);

 const checklistProgress = useMemo(() => {
 if (!profileData) {
 return { total: 0, done: 0, bySection: [] };
 }
 const bySection = checklistSections.map((section) => {
 const total = section.items.length;
 const done = section.items.reduce((acc, item) => {
 if (item.type === "doc") {
 return acc + (isDocUploaded(item.docType) ? 1 : 0);
 }
 return acc + (profileData?.onboarding?.[item.flagKey] ? 1 : 0);
 }, 0);
 return { title: section.title, total, done };
 });

 const safeBySection = bySection.filter(Boolean);
 const total = safeBySection.reduce((acc, entry) => acc + entry.total, 0);
 const done = safeBySection.reduce((acc, entry) => acc + entry.done, 0);
 return { total, done, bySection: safeBySection };
 }, [checklistSections, documents, profileData]);

 const isNAValue = (value) => {
 const normalized = String(value || '').trim().toLowerCase();
 return normalized === 'n/a' || normalized === 'na' || normalized === 'no aplica';
 };

 const isFieldComplete = (value, field) => {
 if (field?.allowNA && isNAValue(value)) return true;
 return value !== null && value !== undefined && String(value).trim() !== '';
 };
 const getSectionCompletion = (sectionTitle) => {
 const entry = checklistProgress.bySection.find((item) => item.title === sectionTitle);
 const total = entry?.total || 0;
 const done = entry?.done || 0;
 return { total, done, complete: total > 0 && done === total };
 };

 const getProfileSectionCompletion = (section) => {
 const fieldsToCheck = section.fields;
 const total = fieldsToCheck.length;
 const done = fieldsToCheck.reduce((acc, field) => {
 const value = profileData?.[section.key]?.[field.key];
 return acc + (isFieldComplete(value, field) ? 1 : 0);
 }, 0);
 return { total, done, complete: total > 0 && done === total };
 };

 const OFFBOARDING_TITLE = "Salida / Desvinculación";
 const getOffboardingProgress = () =>
 checklistProgress.bySection.find((section) => section.title === OFFBOARDING_TITLE) || {
 total: 0,
 done: 0,
 };

 const isOffboardingComplete = () => {
 const { total, done } = getOffboardingProgress();
 return total > 0 && done === total;
 };

 const reviewStatus = useMemo(() => {
 if (!profileLastReviewedAt) {
 return { pending: true, label: "Revision anual pendiente", tone: "amber" };
 }

 const lastDate = new Date(profileLastReviewedAt);
 if (Number.isNaN(lastDate.getTime())) {
 return { pending: true, label: "Revision anual pendiente", tone: "amber" };
 }

 const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
 if (diffDays >= 365) {
 return { pending: true, label: "Revision anual vencida", tone: "red" };
 }

 return { pending: false, label: "Revision anual al dia", tone: "emerald" };
 }, [profileLastReviewedAt]);

 const handleFinalizeOffboarding = async () => {
 if (!profileData) return;
 if (!isOffboardingComplete()) {
 toast.error("Completa la salida (equipos, cuentas, SRI y liquidación).");
 return;
 }
 if (!profileData?.laboral?.fecha_salida) {
 toast.error("Registra la fecha de salida antes de finalizar.");
 return;
 }
 setOffboardingSaving(true);
 try {
 const nextProfile = {
 ...profileData,
 laboral: {
 ...(profileData?.laboral || {}),
 estatus_empleado: "desvinculado",
 },
 };
 await updateCollaboratorProfile(id, nextProfile);
 setProfileData(nextProfile);
 toast.success("Desvinculación completada.");
 } catch (error) {
 console.error("Error finalizando desvinculación:", error);
 toast.error("No se pudo finalizar la desvinculación.");
 } finally {
 setOffboardingSaving(false);
 }
 };

 const getLockedSections = () => profileData?.onboarding?.locked_sections || [];
 const getManualUnlockedSections = () => profileData?.onboarding?.manual_unlocked_sections || [];

 const setSectionLockedState = (sectionKey, locked) => {
 setProfileData((prev) => {
 const lockedSet = new Set(prev?.onboarding?.locked_sections || []);
 const manualSet = new Set(prev?.onboarding?.manual_unlocked_sections || []);
 if (locked) {
 lockedSet.add(sectionKey);
 manualSet.delete(sectionKey);
 } else {
 lockedSet.delete(sectionKey);
 manualSet.add(sectionKey);
 }
 return {
 ...(prev || {}),
 onboarding: {
 ...(prev?.onboarding || {}),
 locked_sections: Array.from(lockedSet),
 manual_unlocked_sections: Array.from(manualSet),
 },
 };
 });
 scheduleAutosave("onboarding");
 };
 
 const calculateAge = (dateValue) => {
 if (!dateValue) return "";
 const birth = new Date(dateValue);
 if (Number.isNaN(birth.getTime())) return "";
 const today = new Date();
 let age = today.getFullYear() - birth.getFullYear();
 const monthDiff = today.getMonth() - birth.getMonth();
 if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
 age -= 1;
 }
 return age >= 0 ? String(age) : "";
 };

 const loadProfile = async () => {
 if (!id) return;
 setProfileLoading(true);
 try {
 const [profileResult, certsResult] = await Promise.allSettled([
 getCollaboratorProfile(id),
 getUserCertifications(id),
 ]);

 if (profileResult.status === 'rejected') {
 throw profileResult.reason;
 }

 const response = profileResult.value;
 const mergedProfile = mergeProfile(response.data?.profile || {});
 setProfileData(mergedProfile);
 setDocuments(response.data?.documents || []);
 setCollaborator(response.data?.user || null);
 setProfileLastReviewedAt(response.data?.profile_last_reviewed_at || null);

 if (certsResult.status === 'fulfilled') {
 setCertifications(certsResult.value.data || []);
 setCertificationSummary(certsResult.value.summary || {
 active: 0,
 expired: 0,
 expiring_soon: 0,
 });
 } else {
 setCertifications([]);
 setCertificationSummary({ active: 0, expired: 0, expiring_soon: 0 });
 }
 } catch (error) {
 console.error("Error cargando colaborador:", error);
 toast.error("Error al cargar el perfil del colaborador");
 } finally {
 setProfileLoading(false);
 }
 };

 useEffect(() => {
 loadProfile();
 }, [id]);

 useEffect(() => {
 profileRef.current = profileData;
 }, [profileData]);

 useEffect(() => {
 if (!profileData) return;
 const locked = new Set(getLockedSections());
 const manual = new Set(getManualUnlockedSections());
 let changed = false;

 profileSections.forEach((section) => {
 const completion = getProfileSectionCompletion(section);
 if (completion.complete && !locked.has(section.key) && !manual.has(section.key)) {
 locked.add(section.key);
 changed = true;
 }
 });

 if (changed) {
 setProfileData((prev) => ({
 ...(prev || {}),
 onboarding: {
 ...(prev?.onboarding || {}),
 locked_sections: Array.from(locked),
 manual_unlocked_sections: Array.from(manual),
 },
 }));
 }
 }, [profileSections, profileData]);
 useEffect(() => {
 if (!profileData?.personal) return;
 const nextAge = calculateAge(profileData.personal.fecha_nacimiento);
 if (nextAge !== profileData.personal.edad) {
 setProfileData((prev) => ({
 ...prev,
 personal: {
 ...prev.personal,
 edad: nextAge,
 },
 }));
 }
 }, [profileData?.personal?.fecha_nacimiento]);

 

 const saveSection = async (sectionKey, { silent = true } = {}) => {
 if (!id || !profileRef.current) return;
 const payload = {
 [sectionKey]: profileRef.current?.[sectionKey],
 onboarding: profileRef.current?.onboarding || {},
 };
 setSectionSaving((prev) => ({ ...prev, [sectionKey]: true }));
 try {
 await updateCollaboratorProfile(id, payload);
 if (!silent) toast.success("Sección guardada");
 } catch (error) {
 console.error("Error guardando sección:", error);
 if (!silent) toast.error("Error al guardar la sección");
 } finally {
 setSectionSaving((prev) => ({ ...prev, [sectionKey]: false }));
 }
 };

 const scheduleAutosave = (sectionKey) => {
 if (!sectionKey) return;
 const existing = autosaveTimers.current[sectionKey];
 if (existing) clearTimeout(existing);
 autosaveTimers.current[sectionKey] = setTimeout(() => {
 saveSection(sectionKey, { silent: true });
 }, 1200);
 };
const handleProfileChange = (sectionKey, fieldKey, value) => {
 const numericOnlyFields = new Set([
 "cedula",
 "telefono_personal",
 "telefono_celular_famproject",
 "telefono_fijo",
 "telefono_contacto",
 "cedula_conyuge",
 "cedula_primer_hijo",
 "cedula_segundo_hijo",
 ]);
 const cleanValue = numericOnlyFields.has(fieldKey) ? value.replace(/[^\d]/g, "") : value;
 setProfileData((prev) => ({
 ...(prev || {}),
 [sectionKey]: {
 ...((prev && prev[sectionKey]) || {}),
 [fieldKey]: cleanValue,
 },
 }));
 scheduleAutosave(sectionKey);
 };

 const handleSaveProfile = async () => {
 if (!profileData) return;
 const errors = {};
 profileSections.forEach((section) => {
 section.fields.forEach((field) => {
 const fieldValue = profileData?.[section.key]?.[field.key];
 if (!isFieldComplete(fieldValue, field)) {
 errors[`${section.key}.${field.key}`] = "Requerido";
 }
 });
 });
 setProfileErrors(errors);
 if (Object.keys(errors).length > 0) {
 toast.error("Completa todos los campos antes de guardar.");
 return;
 }

 setProfileSaving(true);
 try {
 await updateCollaboratorProfile(id, profileData || defaultProfile);
 toast.success("Perfil actualizado correctamente");
 } catch (error) {
 console.error("Error guardando perfil:", error);
 toast.error("Error al guardar el perfil");
 } finally {
 setProfileSaving(false);
 }
 };

 const handleDocumentUpload = async (docType, file) => {
 if (!id || !file) return;
 setDocUploading(docType);
 try {
 await uploadCollaboratorDocument(id, docType, file);
 toast.success("Documento subido correctamente");
 loadProfile();
 } catch (error) {
 console.error("Error subiendo documento:", error);
 toast.error("Error al subir documento");
 } finally {
 setDocUploading(null);
 }
 };

 const toggleSection = (sectionKey) => {
 setOpenSections((prev) => {
 const next = new Set(prev);
 if (next.has(sectionKey)) {
 next.delete(sectionKey);
 } else {
 next.add(sectionKey);
 }
 return next;
 });
 };

 const handleChecklistToggle = (flagKey) => {
 setProfileData((prev) => ({
 ...(prev || {}),
 onboarding: {
 ...(prev?.onboarding || {}),
 [flagKey]: !prev?.onboarding?.[flagKey],
 },
 }));
 scheduleAutosave("onboarding");
 };

 if (profileLoading) {
 return (
 <DashboardLayout includeWidgets={false}>
 <div className="flex justify-center items-center min-h-[60vh]">
 <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
 </div>
 </DashboardLayout>
 );
 }

 return (
 <DashboardLayout includeWidgets={false}>
 <DashboardHeader
 title="Workspace de Colaborador"
 subtitle="Completa el perfil y documentos del colaborador"
 actions={
 <div className="flex items-center gap-2">
 <Button variant="secondary" onClick={() => navigate(-1)}>
 Volver
 </Button>
 <Button onClick={handleSaveProfile} disabled={profileSaving} className="flex items-center gap-2">
 <FiSave /> Guardar perfil
 </Button>
 </div>
 }
 />

 {collaborator && (
 <div className="mb-6 flex items-center gap-3 text-sm text-gray-600">
 <FiUsers className="text-blue-600" />
 <span className="font-semibold text-gray-900">{collaborator.fullname || collaborator.email}</span>
 <span>{collaborator.email}</span>
 <span>{collaborator.department_name || "Sin departamento"}</span>
 </div>
 )}

 <div className="mb-6 grid gap-4 md:grid-cols-4">
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Perfil</p>
 <p className="text-2xl font-semibold text-gray-800">
 {checklistProgress.total > 0 ? `${Math.round((checklistProgress.done / checklistProgress.total) * 100)}%` : "0%"}
 </p>
 <p className="text-xs text-gray-500">Completitud del expediente</p>
 </Card>
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Documentos</p>
 <p className="text-2xl font-semibold text-gray-800">
 {documents.length}
 </p>
 <p className="text-xs text-gray-500">
 {documents.length === 1 ? "Documento cargado" : "Documentos cargados"}
 </p>
 </Card>
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Certificaciones</p>
 <p className="text-2xl font-semibold text-emerald-600">{certificationSummary.active}</p>
 <p className="text-xs text-gray-500">Vigentes</p>
 </Card>
 <Card className="p-4">
 <p className="text-xs uppercase tracking-wide text-gray-400">Revision anual</p>
 <p className={`text-2xl font-semibold ${reviewStatus.pending ? "text-amber-600" : "text-emerald-600"}`}>
 {reviewStatus.pending ? "Pendiente" : "OK"}
 </p>
 <p className="text-xs text-gray-500">{reviewStatus.label}</p>
 </Card>
 </div>

 {(certificationSummary.expired > 0 || certificationSummary.expiring_soon > 0) && (
 <Card className="mb-6 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
 <p className="font-semibold">Alertas de certificaciones</p>
 <p className="mt-1 text-amber-800">
 {certificationSummary.expired > 0 ? `${certificationSummary.expired} vencidas` : ""}
 {certificationSummary.expired > 0 && certificationSummary.expiring_soon > 0 ? " y " : ""}
 {certificationSummary.expiring_soon > 0 ? `${certificationSummary.expiring_soon} por vencer` : ""}.
 </p>
 </Card>
 )}

 <Card className="p-4 mb-6">
 <div className="flex flex-col gap-2 text-xs text-gray-600">
 <div className="flex items-center justify-between">
 <span className="font-semibold text-gray-800">Desvinculacion</span>
 <span>{isOffboardingComplete() ? "Checklist completo" : "Checklist pendiente"}</span>
 </div>
 <p>
 Para desvincular se requiere: entrega de equipos, cierre de cuentas, registro de salida en SRI y
 liquidacion.
 </p>
 <div className="flex items-center justify-between">
 <span>
 Progreso: {getOffboardingProgress().done}/{getOffboardingProgress().total}
 </span>
 <Button
 variant="primary"
 size="sm"
 onClick={handleFinalizeOffboarding}
 disabled={offboardingSaving || !isOffboardingComplete() || !canUnlockSections}
 >
 {offboardingSaving ? "Guardando..." : "Finalizar desvinculacion"}
 </Button>
 </div>
 </div>
 </Card>

 <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
 <div className="space-y-6">
 <Card className="p-5">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-semibold text-gray-900">Perfil del colaborador</h3>
 <p className="text-sm text-gray-500">Todos los campos deben estar completos para marcar al 100%.</p>
 </div>

 </div>

 <div className="mt-4 space-y-4">
 {profileSections.map((section) => {
 const isOpen = openSections.has(section.key);
 const completion = getProfileSectionCompletion(section);
 const isLocked = getLockedSections().includes(section.key);
 return (
 <div key={section.key} className="border border-gray-100 rounded-xl overflow-hidden">
 <div className="flex flex-col gap-3 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
 <button
 type="button"
 onClick={() => toggleSection(section.key)}
 aria-expanded={isOpen}
 className="flex min-w-0 flex-1 items-center gap-3 text-left"
 >
 {isOpen ? <FiChevronDown className="shrink-0" /> : <FiChevronRight className="shrink-0" />}
 <span className="min-w-0 truncate font-semibold text-gray-800">{section.title}</span>

 {isLocked && (
 <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">Bloqueado</span>
 )}
 {!isLocked && completion.complete && (
 <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Completo</span>
 )}
 </button>

 <div className="flex flex-wrap items-center gap-2 sm:justify-end">
 <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-400 ring-1 ring-gray-200">
 {completion.done}/{completion.total}
 </span>
 {canUnlockSections && (
 <button
 type="button"
 onClick={() => setSectionLockedState(section.key, !isLocked)}
 className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
 >
 {isLocked ? "Desbloquear" : "Bloquear"}
 </button>
 )}
 <button
 type="button"
 onClick={() => saveSection(section.key, { silent: false })}
 className="rounded-full border border-blue-200 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
 >
 {sectionSaving[section.key] ? "Guardando..." : "Guardar sección"}
 </button>
 </div>
 </div>

 {isOpen && (
 <div className="p-4 grid gap-3 sm:grid-cols-2">
 {section.fields.map((field) => (
 <label key={field.key} className="text-xs text-gray-500">
 <span className="uppercase font-medium">{field.label}</span>
 <input
 type={field.allowNA && field.type === "date" ? "text" : field.type || "text"}
 inputMode={field.inputMode}
 pattern={field.pattern || undefined}
 maxLength={field.maxLength}
 placeholder={field.placeholder || ""}
 readOnly={field.readOnly || isLocked}
 disabled={isLocked}
 value={profileData?.[section.key]?.[field.key] || ""}
 onChange={(e) => handleProfileChange(section.key, field.key, e.target.value)}
 className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${field.readOnly ? "bg-gray-100" : "bg-white"} ${
 profileErrors[`${section.key}.${field.key}`] ? "border-red-400" : "border-gray-200"
 }`}
 />
 {profileErrors[`${section.key}.${field.key}`] && (
 <span className="text-xs text-red-500">Requerido</span>
 )}
 </label>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </Card>
 </div>

 <div className="space-y-6">
 <Card className="p-5">
 <h3 className="text-lg font-semibold text-gray-900 mb-3">Documentacion</h3>
 <div className="space-y-4">
 {documentTypes.map((doc) => (
 <div key={doc.key} className="flex items-center justify-between gap-2 text-sm">
 <div>
 <p className="text-gray-800 font-medium">{doc.label}</p>
 <p className="text-xs text-gray-500">{isDocUploaded(doc.key) ? "Subido" : "Pendiente"}</p>
 </div>
 <label className="inline-flex items-center gap-2">
 <input
 type="file"
 className="hidden"
 onChange={(e) => handleDocumentUpload(doc.key, e.target.files?.[0])}
 />
 <Button
 variant="secondary"
 size="sm"
 disabled={docUploading === doc.key}
 className="flex items-center gap-2"
 >
 <FiUploadCloud />
 {docUploading === doc.key ? "Subiendo..." : "Subir"}
 </Button>
 </label>
 </div>
 ))}
 </div>
 </Card>

 <Card className="p-5">
 <h3 className="text-lg font-semibold text-gray-900 mb-3">Checklist operativo</h3>
 <div className="space-y-3">
 {checklistSections.map((section) => {
 const completion = getSectionCompletion(section.title);
 return (
 <div key={section.title} className="border border-gray-100 rounded-lg p-3">
 <div className="flex items-center justify-between mb-2">
 <span className="font-medium text-gray-800">{section.title}</span>
 <span className="text-xs text-gray-500">{completion.done}/{completion.total}</span>
 </div>
 <div className="space-y-2">
 {section.items.map((item) => (
 <label key={item.label} className="flex items-center gap-2 text-sm text-gray-600">
 {item.type === "doc" ? (
 <input type="checkbox" checked={isDocUploaded(item.docType)} readOnly />
 ) : (
 <input
 type="checkbox"
 checked={Boolean(profileData?.onboarding?.[item.flagKey])}
 onChange={() => handleChecklistToggle(item.flagKey)}
 disabled={!canUnlockSections}
 />
 )}
 <span>{item.label}</span>
 </label>
 ))}
 </div>
 </div>
 );
 })}
 </div>
 </Card>
 <Card className="p-5">
 <h3 className="text-lg font-semibold text-gray-900 mb-3">Credenciales y titulos</h3>
 {certifications.length === 0 ? (
 <p className="text-sm text-gray-500">Sin certificaciones registradas.</p>
 ) : (
 <ul className="space-y-2 text-sm text-gray-700">
 {certifications.map((cert) => (
 <li key={cert.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
 <div className="min-w-0">
 <p className="font-medium text-gray-900 truncate">{cert.title}</p>
 <p className="text-xs text-gray-500 truncate">{cert.issuer || ""}</p>
 </div>
 <div className="text-right">
 <p className={`text-xs font-semibold ${
 cert.status === "expired"
 ? "text-red-600"
 : cert.status === "expiring_soon"
 ? "text-amber-600"
 : cert.status === "permanent"
 ? "text-blue-600"
 : "text-emerald-600"
 }`}>
 {cert.status_label || (cert.expiry_date ? "Con vencimiento" : "Sin caducidad")}
 </p>
 {cert.days_until_expiry !== null && cert.days_until_expiry !== undefined && (
 <p className="text-[11px] text-gray-400">
 {cert.days_until_expiry < 0
 ? `${Math.abs(cert.days_until_expiry)} dias vencida`
 : `${cert.days_until_expiry} dias restantes`}
 </p>
 )}
 </div>
 </li>
 ))}
 </ul>
 )}
 </Card>

 </div>
 </div>
 </DashboardLayout>
 );
};

export default CollaboratorWorkspace;
