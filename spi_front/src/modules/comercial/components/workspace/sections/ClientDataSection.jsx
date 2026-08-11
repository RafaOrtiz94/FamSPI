import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FiCheckCircle, FiChevronDown, FiUsers } from "react-icons/fi";
import { useParams } from "react-router-dom";
import api from "../../../../../core/api";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import SectionObservationAlert from "../SectionObservationAlert";
import SectionEditorBadge from "../SectionEditorBadge";
import LocationManager from "../../LocationManager";
import ProvinciaCiudadInput from "../../../../../components/ProvinciaCiudadInput";
import { useAutoEditSection } from "../BusinessCaseWorkspaceContext";

const SECTION_FIELDS = {
 general: [
 "client",
 "locationId",
 "clientType",
 "contractingEntity",
 "provinceCity",
 "processCode",
 "contractObject",
 "smartObjective",
 "notes",
 ],
};

const SECTION_ORDER = ["general"];

// Mismos roles que ya autoriza el backend en POST /sections/:section/unlock
// (businessCase.routes.js) -- unico camino para reabrir "general" una vez
// que comercial guardo y quedo bloqueada automaticamente.
const GENERAL_REOPEN_ROLES = new Set(["acp_comercial", "backoffice", "backoffice_comercial", "jefe_comercial", "jefe_de_comercial"]);

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const getClientLabel = (client) =>
 client?.nombre ||
 client?.commercial_name ||
 client?.name ||
 client?.display_name ||
 client?.email ||
 client?.identificador ||
 client?.id ||
 "Cliente";

const getClientAssignmentSummary = (client, currentUserEmail) => {
 const details = Array.isArray(client?.assignment_details) ? client.assignment_details : [];
 const activeDetails = details.filter((item) => item && item.is_active !== false);
 if (!activeDetails.length) {
 return { label: "Sin asignar", tone: "slate" };
 }

 const myEmail = String(currentUserEmail || "").trim().toLowerCase();
 const isAssignedToMe = myEmail && activeDetails.some(
 (item) => String(item?.assigned_to_email || "").toLowerCase() === myEmail,
 );

 if (isAssignedToMe) {
 return { label: "Tu cliente", tone: "emerald" };
 }

 const names = activeDetails
 .map((item) => item?.assigned_to_name || item?.assigned_to_email || "")
 .map((value) => String(value || "").trim())
 .filter(Boolean);

 return {
 label: names.length ? `Asignado a ${names[0]}` : "Asignado",
 tone: "amber",
 };
};

const toCleanText = (value) => {
 const normalized = String(value || "").trim();
 return normalized || "";
};

const resolveProvinceCityFromClient = (client) => {
 if (!client || typeof client !== "object") return "";

 // Prefer explicit shipping fields, then fall back to other known variants.
 const province =
 toCleanText(client?.shipping_province) ||
 toCleanText(client?.establishment_province) ||
 toCleanText(client?.provincia) ||
 toCleanText(client?.province);
 const city =
 toCleanText(client?.shipping_city) ||
 toCleanText(client?.establishment_city) ||
 toCleanText(client?.ciudad) ||
 toCleanText(client?.city);

 return [province, city].filter(Boolean).join(", ");
};

const resolveProvinceCityFromLocation = (location) => {
 if (!location || typeof location !== "object") return "";
 const province = toCleanText(location?.province);
 const city = toCleanText(location?.city);
 return [province, city].filter(Boolean).join(", ");
};

const getLocationLabel = (location) => {
 if (!location || typeof location !== "object") return "";
 const provinceCity = resolveProvinceCityFromLocation(location);
 const name = toCleanText(location?.name);
 if (name && provinceCity) return `${name} - ${provinceCity}`;
 return name || provinceCity || toCleanText(location?.address) || "Sede";
};

const normalizeClientType = (value) => {
 const normalized = String(value || "").trim().toLowerCase();
 if (["persona_natural", "natural", "pn"].includes(normalized)) return "persona_natural";
 if (["persona_juridica", "juridica", "jurídica", "pj", "sub_distribuidor"].includes(normalized)) {
 return "persona_juridica";
 }
 return "";
};

const isPublicPurchaseType = (value) => {
 const normalized = String(value || "").trim().toLowerCase();
 return normalized.includes("public");
};

const AccordionSection = ({
 id,
 title,
 description,
 isOpen,
 onToggle,
 statusBadge,
 children,
 onInteraction,
}) => (
 <div
 className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300"
 onFocusCapture={() => onInteraction?.(id)}
 >
 <button
 type="button"
 onClick={() => onToggle(id)}
 aria-expanded={isOpen}
 aria-controls={`section-panel-${id}`}
 className="flex w-full items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none"
 >
 <div>
 <p className="text-base font-bold text-gray-900 tracking-tight">{title}</p>
 {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
 </div>
 <div className="flex items-center gap-4">
 {statusBadge}
 <div className={`p-2 rounded-full transition-all duration-200 ${isOpen ? "bg-blue-50 text-blue-600 rotate-180" : "bg-gray-100 text-gray-500"}`}>
 <FiChevronDown size={16} />
 </div>
 </div>
 </button>
 <div
 id={`section-panel-${id}`}
 className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"} overflow-hidden`}
 >
 <div className="px-4 sm:px-5 pb-5 pt-0">{children}</div>
 </div>
 </div>
);

const ClientDataSection = ({
 businessCase,
 uiGuidance,
 permissions = {},
 ownership = {},
 observationData,
 onSave = () => {}
}) => {
 const { id: bcId } = useParams();
 const { showToast, showLoader, hideLoader } = useUI();
 const { user: currentUser } = useAuth();
 const [clients, setClients] = useState([]);
 const [loadingClients, setLoadingClients] = useState(false);
 const [saving, setSaving] = useState(false);
 const [loading, setLoading] = useState(true);
 const [isEditing, setIsEditing] = useState(false);
 useAutoEditSection("general", () => setIsEditing(true));

 const [showClientDropdown, setShowClientDropdown] = useState(false);
 const [filteredClients, setFilteredClients] = useState([]);
 const [isClientInputFocused, setIsClientInputFocused] = useState(false);
 const [, setShowLocationDropdown] = useState(false);
 const [, setFilteredLocations] = useState([]);
 const [isNewClient, setIsNewClient] = useState(false);
 const [clientLocations, setClientLocations] = useState([]);
 const [selectedLocation, setSelectedLocation] = useState(null);

 // Explicit state for selected client to handle async reconciliation
 const [selectedClient, setSelectedClient] = useState(null);
 const fallbackBusinessCase = useMemo(() => uiGuidance?.businessCase || null, [uiGuidance?.businessCase]);
 const bcPurchaseType = businessCase?.bc_purchase_type || fallbackBusinessCase?.bc_purchase_type || "";
 const startedAsPublic = isPublicPurchaseType(bcPurchaseType);
 const originLabel = startedAsPublic ? "Compra publica" : "Compra privada";

 const defaultValues = useMemo(() => ({}), []);

 const {
 register,
 handleSubmit,
 watch,
 reset,
 setValue,
 formState: { errors },
 } = useForm({ defaultValues });

 const [naFields, setNaFields] = useState({});
const watchClient = watch("client");
const watchLocationId = watch("locationId");
const watchClientType = watch("clientType");
const watchProvinceCity = watch("provinceCity");
 const selectedClientLabel = selectedClient ? normalizeText(getClientLabel(selectedClient)) : "";
 const [openSections, setOpenSections] = useState(() =>
 SECTION_ORDER.reduce((acc, id) => {
 acc[id] = true;
 return acc;
 }, {}),
 );

 const initializeForm = useCallback(() => {
 if (!bcId) return;

 try {
 const metadata =
 businessCase?.modern_bc_metadata ||
 fallbackBusinessCase?.modern_bc_metadata ||
 {};
 const metadataGeneral =
 metadata?.general_data && typeof metadata.general_data === "object"
 ? metadata.general_data
 : {};
 const savedLocationId =
  businessCase?.client_location_id ||
  fallbackBusinessCase?.client_location_id ||
  metadata.client_location_id ||
  metadataGeneral.client_location_id ||
  "";
 const initialData = {
 client:
 businessCase?.client_name ||
 fallbackBusinessCase?.client_name ||
 "",
 clientType:
 startedAsPublic
 ? "persona_juridica"
 : normalizeClientType(
 businessCase?.clientType ||
 fallbackBusinessCase?.clientType ||
 metadata.clientType ||
 metadataGeneral.clientType ||
 "",
 ),
 contractingEntity:
 businessCase?.contractingEntity ||
 fallbackBusinessCase?.contractingEntity ||
 metadata.contractingEntity ||
 metadataGeneral.contractingEntity ||
 "",
 provinceCity:
 businessCase?.provinceCity ||
 fallbackBusinessCase?.provinceCity ||
 metadata.provinceCity ||
 metadataGeneral.provinceCity ||
 "",
 processCode:
 businessCase?.processCode ||
 businessCase?.process_code ||
 fallbackBusinessCase?.processCode ||
 fallbackBusinessCase?.process_code ||
 "",
 contractObject:
 businessCase?.contractObject ||
 businessCase?.contract_object ||
 fallbackBusinessCase?.contractObject ||
 fallbackBusinessCase?.contract_object ||
 "",
 smartObjective:
 businessCase?.smart_objective ||
 fallbackBusinessCase?.smart_objective ||
 metadata.smart_objective ||
 metadata.smartObjective ||
 metadataGeneral.smart_objective ||
 metadataGeneral.smartObjective ||
 "",
 notes:
 businessCase?.notes ||
 fallbackBusinessCase?.notes ||
 metadata.notes ||
 metadataGeneral.notes ||
 "",
 locationId: savedLocationId ? String(savedLocationId) : "",
 };

 reset(initialData);
 } catch (err) {
 showToast("Error inicializando formulario", "error");
 console.error("Error initializing form:", err);
 } finally {
 setLoading(false);
 }
 }, [
 bcId,
 businessCase,
 fallbackBusinessCase,
 reset,
 showToast,
 startedAsPublic,
 ]);

 const sectionHasErrors = (sectionId) =>
 SECTION_FIELDS[sectionId]?.some((field) => Boolean(errors[field])) ?? false;

 const toggleSection = (sectionId) => {
 setOpenSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
 };

 const handleSectionInteraction = (sectionId) => {
 setOpenSections((prev) => {
 if (prev[sectionId]) return prev;
 return { ...prev, [sectionId]: true };
 });
 };

 const renderStatusBadge = (sectionId) => {
 const hasError = sectionHasErrors(sectionId);
 return (
 <span className={`text-xs font-bold px-3 py-1 rounded-full ${hasError ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
 {hasError ? "Requiere atención" : "Listo"}
 </span>
 );
 };

 const toggleNA = (field) => {
 setNaFields((prev) => {
 const next = { ...prev, [field]: !prev[field] };
 setValue(field, next[field] ? "N/A" : "", { shouldDirty: true });
 return next;
 });
 };

 const isNA = (field) => Boolean(naFields[field]);

 const renderNAButton = (field) => (
 <button
 type="button"
 onClick={() => toggleNA(field)}
 className="text-[10px] font-bold text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded-md border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all"
 >
 N/A
 </button>
 );

 const naInputClass = (field) =>
 `w-full border rounded-xl px-4 py-2.5 transition-all outline-none ${
 isNA(field) 
 ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
 : "bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 placeholder-gray-400"
 }`;

 useEffect(() => {
 initializeForm();
 }, [initializeForm]);

 useEffect(() => {
 SECTION_ORDER.forEach((sectionId) => {
 const hasError = SECTION_FIELDS[sectionId]?.some((field) => Boolean(errors[field]));
 if (hasError) {
 setOpenSections((prev) => {
 if (prev[sectionId]) return prev;
 return { ...prev, [sectionId]: true };
 });
 }
 });
 }, [errors]);

 const findClientByInput = useCallback((value) => {
 const needle = normalizeText(value);
 if (!needle) return null;
 return (
 clients.find((c) => String(c.id) === String(value)) ||
 clients.find((c) => normalizeText(c.email) === needle) ||
 clients.find((c) => normalizeText(c.identificador) === needle) ||
 clients.find((c) => normalizeText(getClientLabel(c)) === needle) ||
 null
 );
 }, [clients]);

 useEffect(() => {
 const fetchClients = async () => {
 setLoadingClients(true);
 try {
 const res = await api.get("/clients", {
 params: { include_all_for_business_case: true },
 });
 const payload = res.data?.data ?? res.data;
 const parsedClients = Array.isArray(payload?.items)
 ? payload.items
 : Array.isArray(payload?.clients)
 ? payload.clients
 : Array.isArray(payload?.data)
 ? payload.data
 : Array.isArray(payload)
 ? payload
 : [];
 setClients(parsedClients);
 } catch (err) {
 console.warn("No se pudieron cargar clientes", err.message);
 } finally {
 setLoadingClients(false);
 }
 };

 fetchClients();
 }, []);

 // Resolve selected client when both client list and saved values are available
 useEffect(() => {
 if (clients.length === 0) return;

 if (businessCase?.client_id) {
 const clientOption = clients.find((c) => String(c.id) === String(businessCase.client_id));
 if (clientOption) {
 const label = getClientLabel(clientOption);
 setSelectedClient(clientOption);
 setValue("client", label, { shouldDirty: false });
 }
 return;
 }

 const fromName = findClientByInput(businessCase?.client_name);
 if (fromName) {
 setSelectedClient(fromName);
 setValue("client", getClientLabel(fromName), { shouldDirty: false });
 }
 }, [clients, businessCase?.client_id, businessCase?.client_name, setValue, findClientByInput]);

 useEffect(() => {
 const term = normalizeText(watchClient);
 if (!term) {
 setFilteredClients([]);
 setShowClientDropdown(false);
 setSelectedClient(null);
 setClientLocations([]);
 setSelectedLocation(null);
 setValue("locationId", "", { shouldDirty: true, shouldValidate: true });
 setIsNewClient(false);
 return;
 }

 const exact = findClientByInput(watchClient);
 setSelectedClient(exact);
 setIsNewClient(Boolean(term) && !exact);

 const exactLabel = exact ? normalizeText(getClientLabel(exact)) : "";
 if (exact && term === exactLabel && (!selectedClientLabel || selectedClientLabel === exactLabel)) {
 setFilteredClients([]);
 setShowClientDropdown(false);
 return;
 }

 if (term.length < 2) {
 setFilteredClients([]);
 setShowClientDropdown(false);
 return;
 }

 const matches = clients
 .filter((client) => {
 const haystack = [
 getClientLabel(client),
 client?.identificador,
 client?.client_email,
 client?.shipping_city,
 client?.shipping_province,
 ]
 .map((value) => normalizeText(value))
 .filter(Boolean)
 .join(" ");
 return haystack.includes(term);
 })
 .slice(0, 8);
 setFilteredClients(matches);
 setShowClientDropdown(isClientInputFocused && !exact && matches.length > 0);
 }, [watchClient, clients, setValue, findClientByInput, selectedClientLabel, isClientInputFocused]);

 useEffect(() => {
 if (!selectedClient) return;
 if (!Array.isArray(clientLocations) || !clientLocations.length) {
 setSelectedLocation(null);
 setValue("locationId", "", { shouldDirty: false, shouldValidate: false });
 return;
 }

 const byFormId = clientLocations.find((location) => String(location.id) === String(watchLocationId));
 const fallbackLocation = byFormId || clientLocations.find((location) => location.is_main) || clientLocations[0];
 if (!fallbackLocation) return;

 setSelectedLocation(fallbackLocation);
 if (!byFormId) {
 setValue("locationId", String(fallbackLocation.id), { shouldDirty: false, shouldValidate: false });
 }
 }, [selectedClient, clientLocations, watchLocationId, setValue]);

 useEffect(() => {
 if (startedAsPublic) {
 setValue("clientType", "persona_juridica", { shouldDirty: true });
 return;
 }

 if (!selectedClient) return;

 const currentType = normalizeClientType(watchClientType);
 if (currentType) return;

 const suggestedType = normalizeClientType(
 selectedClient?.client_type ||
 selectedClient?.person_type ||
 selectedClient?.tipo_persona,
 );
 if (suggestedType) {
 setValue("clientType", suggestedType, { shouldDirty: false });
 }
 }, [
 selectedClient,
 setValue,
 startedAsPublic,
 watchClientType
 ]);

 useEffect(() => {
 const term = normalizeText(watchProvinceCity);
 if (!selectedClient || !clientLocations.length) {
 setFilteredLocations([]);
 setShowLocationDropdown(false);
 return;
 }

 if (!term) {
 setFilteredLocations(clientLocations.slice(0, 8));
 return;
 }

 const matches = clientLocations
 .filter((location) => {
 const haystack = [
 getLocationLabel(location),
 location?.address,
 location?.city,
 location?.province,
 ]
 .map((value) => normalizeText(value))
 .filter(Boolean)
 .join(" ");
 return haystack.includes(term);
 })
 .slice(0, 8);
 setFilteredLocations(matches);
 }, [clientLocations, selectedClient, watchProvinceCity]);

 useEffect(() => {
 if (Boolean(naFields.provinceCity)) return;

 if (selectedLocation) {
 setValue("provinceCity", getLocationLabel(selectedLocation), { shouldDirty: false, shouldValidate: true });
 return;
 }

 if (selectedClient && !clientLocations.length) {
 const fallbackProvinceCity = resolveProvinceCityFromClient(selectedClient);
 if (fallbackProvinceCity) {
 setValue("provinceCity", fallbackProvinceCity, { shouldDirty: false, shouldValidate: false });
 }
 }
 }, [clientLocations.length, selectedClient, selectedLocation, setValue, naFields.provinceCity]);

 const handleSave = async (formData) => {
 if (!bcId) {
 showToast("Primero crea el Business Case", "warning");
 return;
 }

 const selected = selectedClient || findClientByInput(formData.client);
 const client_name = selected ? getClientLabel(selected) : String(formData.client || "").trim();
 const client_id = selected?.id && Number.isFinite(Number(selected.id)) ? Number(selected.id) : undefined;
 const selectedLocationValue =
 selectedLocation ||
 clientLocations.find((location) => String(location.id) === String(formData.locationId));
 const client_location_id =
 selectedLocationValue?.id && Number.isFinite(Number(selectedLocationValue.id))
 ? Number(selectedLocationValue.id)
 : null;
 const client_location_name = selectedLocationValue?.name || null;
 const locationProvinceCity = selectedLocationValue
 ? resolveProvinceCityFromLocation(selectedLocationValue)
 : "";

 if (selected && clientLocations.length > 0 && !client_location_id) {
 showToast("Selecciona una sede de instalación para continuar.", "warning");
 return;
 }

 const finalClientType = startedAsPublic
 ? "persona_juridica"
 : normalizeClientType(formData.clientType);
 const normalizedSmartObjective = String(formData.smartObjective || "").trim();
 const finalContractingEntity = startedAsPublic ? String(formData.contractingEntity || "").trim() : null;
 const finalProcessCode = startedAsPublic ? String(formData.processCode || "").trim() || null : null;

 const metadata = {
 notes: formData.notes,
 clientType: finalClientType,
 contractingEntity: finalContractingEntity,
 provinceCity: formData.provinceCity || locationProvinceCity || "",
 client_location_id,
 client_location_name,
 installation_address: selectedLocationValue?.address || null,
 installation_city: selectedLocationValue?.city || null,
 installation_province: selectedLocationValue?.province || null,
 installation_lat: selectedLocationValue?.lat ?? null,
 installation_lng: selectedLocationValue?.lng ?? null,
 general_data: {
 notes: formData.notes,
 smart_objective: normalizedSmartObjective,
 smartObjective: normalizedSmartObjective,
 clientType: finalClientType,
 contractingEntity: finalContractingEntity,
 provinceCity: formData.provinceCity || locationProvinceCity || "",
 client_location_id,
 client_location_name,
 installation_address: selectedLocationValue?.address || null,
 installation_city: selectedLocationValue?.city || null,
 installation_province: selectedLocationValue?.province || null,
 installation_lat: selectedLocationValue?.lat ?? null,
 installation_lng: selectedLocationValue?.lng ?? null,
 },
 };

 showLoader();
 setSaving(true);

 try {
 // Update business case metadata
 await api.put(`/business-case/${bcId}`, {
 client_id,
 client_name,
 process_code: finalProcessCode,
 contract_object: formData.contractObject || null,
 modern_bc_metadata: metadata,
 });

 showToast("Datos del cliente guardados correctamente", "success");
 setIsEditing(false);
 onSave();

 } catch (error) {
 showToast(
 error.response?.data?.message || error.message || "No se pudo guardar los datos del cliente",
 "error",
 );
 } finally {
 hideLoader();
 setSaving(false);
 }
 };

 // Check permissions based on role
 const canEdit = () => {
 const role = permissions?.userRole || "comercial";
 const hasRoleAccess = [
 "comercial",
 "acp_comercial",
 "backoffice_comercial",
 "jefe_comercial",
 "jefe_tecnico",
 "jefe_operaciones",
 ].includes(role);
 return hasRoleAccess && permissions?.canEdit !== false && ownership?.canUserEdit !== false;
 };

 // Reabrir "general" tras el auto-bloqueo al guardar comercial (ver
 // update() en businessCase.controller.js). Reutiliza el endpoint generico
 // de bloqueo/desbloqueo por seccion, ya restringido a estos mismos roles
 // en el backend -- no hace falta flujo de "solicitar desbloqueo".
 const canReopenGeneral = ownership?.isLocked === true && GENERAL_REOPEN_ROLES.has(permissions?.userRole || "");

 const handleReopenGeneral = async () => {
 if (!bcId || saving) return;
 setSaving(true);
 try {
  await api.post(`/business-case/${bcId}/sections/general/unlock`);
  onSave();
  showToast("Sección reabierta para edición.", "success");
 } catch (err) {
  showToast(err?.response?.data?.message || "No se pudo reabrir la sección.", "error");
 } finally {
  setSaving(false);
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <div className="flex items-center gap-3">
 <div className="p-3 bg-gray-100 rounded-xl animate-pulse">
 <FiCheckCircle className="text-gray-400" size={24} />
 </div>
 <div>
 <div className="h-5 w-48 bg-gray-200 rounded-md animate-pulse mb-2"></div>
 <div className="h-4 w-32 bg-gray-100 rounded-md animate-pulse"></div>
 </div>
 </div>
 <div className="animate-pulse bg-white border border-gray-100 h-32 rounded-2xl shadow-sm"></div>
 </div>
 );
 }

 return (
 <div className="space-y-5">
 <div className="flex flex-col sm:flex-row sm:items-start gap-3">
 <div className="p-3 rounded-xl bg-blue-50 text-blue-600 shadow-sm">
 <FiCheckCircle size={24} />
 </div>
 <div>
 <h2 className="text-xl font-bold text-gray-900 tracking-tight">Datos Comerciales y Operativos</h2>
 <p className="text-sm text-gray-500 mt-1">
 Captura lo necesario para que operaciones pueda continuar con el Business Case.
 {!canEdit() && " (Solo lectura)"}
 </p>
 <div className="mt-2 flex flex-wrap items-center gap-2">
 <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
 Origen del flujo: {originLabel}
 </div>
 <SectionEditorBadge ownership={ownership} />
 </div>
 </div>
 </div>

 {/* Permission warning */}
 {!canEdit() && (
 <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <span className="text-sm text-amber-800 font-medium">
 {ownership?.isLocked
 ? "Comercial ya guardó esta sección y quedó en solo lectura."
 : "No tienes permisos para editar datos del cliente en el estado actual."}
 </span>
 {canReopenGeneral && (
 <button
  type="button"
  onClick={handleReopenGeneral}
  disabled={saving}
  className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 w-full sm:w-auto"
 >
  Reabrir para edición
 </button>
 )}
 </div>
 )}

 {/* Observation alert for this section */}
 <SectionObservationAlert
 sectionId="general"
 observationData={observationData}
 />

 <form className="space-y-5" onSubmit={handleSubmit(handleSave)}>
 <AccordionSection
 id="general"
 title="Datos comerciales"
 description="Captura los datos clave del cliente y del contrato."
 isOpen={openSections.general}
 onToggle={toggleSection}
 statusBadge={renderStatusBadge("general")}
 onInteraction={handleSectionInteraction}
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-2">

 <label className="flex flex-col gap-1.5">
 <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
 <FiUsers className="text-gray-400" /> Nombre del cliente
 </span>
 <div className="relative">
 <input
 type="text"
 className={`w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 ${
 selectedClient ? "bg-emerald-50" : isNewClient ? "bg-blue-50" : ""
 }`}
 placeholder={loadingClients ? "Cargando clientes..." : "Escribe o selecciona un cliente"}
 disabled={!isEditing}
 {...register("client", { required: "El cliente es obligatorio" })}
 onChange={(event) => {
 setValue("client", event.target.value, { shouldDirty: true, shouldValidate: true });
 }}
 onFocus={() => {
 setIsClientInputFocused(true);
 if (!selectedClient && filteredClients.length > 0) setShowClientDropdown(true);
 }}
 onBlur={() => setTimeout(() => {
 setIsClientInputFocused(false);
 setShowClientDropdown(false);
 }, 120)}
 />
 {selectedClient && (
 <span className="absolute right-2 top-2 rounded bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">
 Registrado
 </span>
 )}
 {isNewClient && !selectedClient && (
 <span className="absolute right-2 top-2 rounded bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-800">
 Nuevo
 </span>
 )}
 {showClientDropdown && filteredClients.length > 0 && (
 <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
 {filteredClients.map((client) => {
 const assignment = getClientAssignmentSummary(client, currentUser?.email);
 return (
 <button
 key={client.id}
 type="button"
 className="w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
 onMouseDown={(event) => event.preventDefault()}
 onClick={() => {
 const label = getClientLabel(client);
 setValue("client", label, { shouldDirty: true, shouldValidate: true });
 setSelectedClient(client);
 setClientLocations([]);
 setSelectedLocation(null);
 setValue("provinceCity", "", { shouldDirty: true, shouldValidate: true });
 setValue("locationId", "", { shouldDirty: true, shouldValidate: true });
 setIsNewClient(false);
 setShowClientDropdown(false);
 }}
 >
 <div className="flex items-start justify-between gap-3">
 <div>
 <p className="text-sm font-medium text-slate-900">{getClientLabel(client)}</p>
 <p className="text-xs text-slate-500">
 {[client?.identificador, client?.shipping_city, client?.shipping_province].filter(Boolean).join(" • ") || "Cliente registrado"}
 </p>
 </div>
 <span
 className={`rounded-full px-2 py-1 text-[10px] font-semibold flex-shrink-0 ${
 assignment.tone === "emerald"
 ? "bg-emerald-100 text-emerald-800"
 : assignment.tone === "amber"
 ? "bg-amber-100 text-amber-800"
 : "bg-slate-100 text-slate-600"
 }`}
 >
 {assignment.label}
 </span>
 </div>
 </button>
 );
 })}
 </div>
 )}
 </div>
 {loadingClients && <p className="text-xs text-blue-500 font-medium ml-1">Cargando clientes...</p>}
 {errors.client && <p className="text-xs text-rose-500 font-medium ml-1">{errors.client.message}</p>}
 </label>

 <input type="hidden" {...register("locationId")} />
 <div className="md:col-span-2">
 {selectedClient ? (
 <LocationManager
 clientId={selectedClient.id}
 canEdit={isEditing}
 selectedLocationId={watchLocationId}
 onSelectLocation={(location) => {
 setSelectedLocation(location || null);
 setValue("locationId", location?.id ? String(location.id) : "", { shouldDirty: true, shouldValidate: true });
 const autoProvinceCity = getLocationLabel(location);
 if (!naFields.provinceCity && autoProvinceCity) {
 setValue("provinceCity", autoProvinceCity, { shouldDirty: true, shouldValidate: false });
 }
 }}
 onLocationsChange={(locations) => {
 setClientLocations(Array.isArray(locations) ? locations : []);
 }}
 />
 ) : isNewClient ? (
 <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 text-sm">
 <p className="font-semibold text-blue-900 mb-1">Cliente nuevo</p>
 <p className="text-blue-700">
 Las sedes de instalación se registran desde el módulo de Clientes una vez creado el cliente.
 Completa Provincia / Ciudad manualmente para continuar.
 </p>
 </div>
 ) : (
 <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
 Selecciona primero un cliente para gestionar sus sedes de instalación.
 </div>
 )}
 </div>

 <label className="flex flex-col gap-1.5">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Tipo de Cliente</span>
 </div>
 <select
 className="w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
 {...register("clientType", { required: "El tipo de cliente es obligatorio" })}
 disabled={!isEditing ||startedAsPublic}
 >
 <option value="">Selecciona tipo</option>
 <option value="persona_natural">Persona natural</option>
 <option value="persona_juridica">Persona juridica</option>
 </select>
 {startedAsPublic && (
 <p className="text-xs text-slate-500 ml-1">
 En compras publicas, el tipo de cliente siempre es persona juridica.
 </p>
 )}
 {errors.clientType && <p className="text-xs text-rose-500 font-medium ml-1">{errors.clientType.message}</p>}
 </label>

 {startedAsPublic && (
 <label className="flex flex-col gap-1.5">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Entidad contratante</span>
 {renderNAButton("contractingEntity")}
 </div>
 <input
 type="text"
 className={naInputClass("contractingEntity")}
 disabled={isNA("contractingEntity") || !isEditing}
 {...register("contractingEntity")}
 />
 </label>
 )}

 <label className="flex flex-col gap-1.5">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Provincia / Ciudad</span>
 </div>
 <ProvinciaCiudadInput
 value={watchProvinceCity || ""}
 disabled={!isEditing}
 onChange={(text) => {
   setValue("provinceCity", text, { shouldDirty: true, shouldValidate: true });
   if (selectedLocation && normalizeText(getLocationLabel(selectedLocation)) !== normalizeText(text)) {
     setSelectedLocation(null);
     setValue("locationId", "", { shouldDirty: true, shouldValidate: true });
   }
 }}
 onSelect={(loc) => {
   setValue("provinceCity", loc.label, { shouldDirty: true, shouldValidate: true });
 }}
 />
 </label>
 {selectedClient && clientLocations.length > 0 && !watchLocationId && (
 <p className="text-xs text-amber-600 -mt-2 md:col-span-2">
 Selecciona una sede de instalación desde el selector de sedes.
 </p>
 )}
 {startedAsPublic && (
 <label className="flex flex-col gap-1.5">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Código del proceso</span>
 {renderNAButton("processCode")}
 </div>
 <input
 type="text"
 className={naInputClass("processCode")}
 disabled={isNA("processCode") || !isEditing}
 {...register("processCode")}
 />
 </label>
 )}

 <label className="flex flex-col gap-1.5">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Objeto de contratación</span>
 {renderNAButton("contractObject")}
 </div>
 <input
 type="text"
 className={naInputClass("contractObject")}
 disabled={isNA("contractObject") || !isEditing}
 {...register("contractObject")}
 />
 </label>
 <label className="flex flex-col gap-1.5 md:col-span-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Objetivo SMART</span>
 </div>
 <textarea
 rows={3}
 className="w-full border rounded-xl px-4 py-2.5 transition-all outline-none bg-gray-50 border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-gray-900 placeholder-gray-400 disabled:bg-gray-100 disabled:text-gray-500"
 disabled={!isEditing}
 placeholder="Ejemplo: Incrementar cobertura diagnostica en 20% en 12 meses con trazabilidad mensual."
 {...register("smartObjective", { required: "El objetivo SMART es obligatorio" })}
 />
 {errors.smartObjective && <p className="text-xs text-rose-500 font-medium ml-1">{errors.smartObjective.message}</p>}
 </label>
 <label className="flex flex-col gap-1.5 md:col-span-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-gray-700">Notas / contexto</span>
 {renderNAButton("notes")}
 </div>
 <textarea
 rows={3}
 className={naInputClass("notes")}
 disabled={isNA("notes") || !isEditing}
 {...register("notes")}
 />
 </label>
 </div>
 </AccordionSection>

 {/* Section Actions */}
 {canEdit() && (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
 <p className="text-xs text-gray-400 font-medium">
  {isEditing ? "Los cambios se guardan al presionar Guardar." : "Sección en modo solo lectura."}
 </p>
 {isEditing ? (
  <div className="flex gap-2 sm:justify-end">
  <button
  type="button"
  onClick={() => { initializeForm(); setIsEditing(false); }}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
  >
  Cancelar
  </button>
  <button
  type="submit"
  disabled={saving}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-[0.99] shadow-sm transition-all disabled:opacity-60 disabled:scale-100 w-full sm:w-auto"
  >
  {saving ? "Guardando..." : "Guardar"}
  </button>
  </div>
 ) : (
  <button
  type="button"
  onClick={() => setIsEditing(true)}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
  >
  Editar
  </button>
 )}
 </div>
 )}
 </form>
 </div>
 );
};

export default ClientDataSection;
