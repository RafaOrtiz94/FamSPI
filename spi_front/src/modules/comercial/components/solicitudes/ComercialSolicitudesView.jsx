import React, { useEffect, useState } from "react";
import { useUI } from "../../../../core/ui/UIContext";
import { getRequestById, getClientRequestById } from "../../../../core/api/requestsApi";
import { getDocumentsByRequest } from "../../../../core/api/documentsApi";
import { getFilesByRequest } from "../../../../core/api/filesApi";
import { createPrivatePurchase } from "../../../../core/api/privatePurchasesApi";
import { getEquipmentPurchaseMeta } from "../../../../core/api/equipmentPurchasesApi";
import Button from "../../../../core/ui/components/Button";
import Modal from "../../../../core/ui/components/Modal";
import RequestDetailModal from "../RequestDetailModal";

import PermisoVacacionModal from "../../../shared/solicitudes/modals/PermisoVacacionModal";
import RequestsListModal from "../../../shared/solicitudes/components/RequestsListModal";
import BaseSolicitudesView from "../../../shared/solicitudes/BaseSolicitudesView";

const initialPrivateForm = {
 firstName: "",
 lastName: "",
 clientName: "",
 clientEmail: "",
 clientIdentifier: "",
 notes: "",
 clientType: "persona_natural",
};

const defaultOfferValidity = () => {
 const date = new Date();
 date.setFullYear(date.getFullYear() + 5);
 return date.toISOString().split("T")[0];
};

const fileToBase64 = (file) =>
 new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.onload = () => resolve(reader.result);
 reader.onerror = reject;
 reader.readAsDataURL(file);
 });

const ComercialSolicitudesView = () => {
 const { showToast, showLoader, hideLoader } = useUI();

 const [, setShowPurchaseHandoff] = useState(false);
 const [showPermisoModal, setShowPermisoModal] = useState(false);
 const [showPurchaseTypeModal, setShowPurchaseTypeModal] = useState(false);

 // Private purchase modal states - RESTORED FROM REFERENCE VERSION
 const [privateForm, setPrivateForm] = useState(initialPrivateForm);
 const [selectedEquipment, setSelectedEquipment] = useState([]);
 const [equipmentCatalog, setEquipmentCatalog] = useState([]);
 const [loadingEquipment, setLoadingEquipment] = useState(false);
 const [offerValidity, setOfferValidity] = useState(defaultOfferValidity());
 const [offerKind, setOfferKind] = useState("venta");
 const [comodatoFile, setComodatoFile] = useState(null);
 const [showPrivateModal, setShowPrivateModal] = useState(false);

 // Cargar equipos disponibles al montar el componente - RESTORED FROM REFERENCE VERSION
 useEffect(() => {
 let active = true;
 const loadEquipment = async () => {
 setLoadingEquipment(true);
 try {
 const meta = await getEquipmentPurchaseMeta();
 console.info("[FLOW_PRIVADA][FE][DEBUG] equipment meta", {
 fetched: Array.isArray(meta?.equipment) ? meta.equipment.length : 0,
 payload: meta,
 });
 if (!active) return;
 const catalog = meta.equipment || [];
 console.info("[FLOW_PRIVADA][FE][DEBUG] catalog count", catalog.length);
 setEquipmentCatalog(catalog);
 } catch (error) {
 console.error("Error cargando equipos:", error);
 showToast("No se pudieron cargar los equipos disponibles", "error");
 } finally {
 setLoadingEquipment(false);
 }
 };
 loadEquipment();
 return () => {
 active = false;
 };
 }, [showToast]);

 // Grid data states
 const [detail, setDetail] = useState({
 open: false,
 loading: false,
 data: null,
 error: null,
 });

 const handleViewRequest = async (request) => {
 setDetail({ open: true, loading: true, data: null, error: null });
 try {
 const normalizeClientPayload = (raw) => {
 const base = raw?.request || raw || {};
 const payloadSource = base.payload || base;
 const payload = typeof payloadSource === "string"
 ? (() => {
 try {
 return JSON.parse(payloadSource);
 } catch {
 return {};
 }
 })()
 : (payloadSource || {});
 return { request: { ...base, payload }, documents: [], files: [] };
 };

 const shouldUseClientRequest =
 viewType === "client_request" ||
 request?.type === "client_request" ||
 request?.type_code === "client_request" ||
 request?.commercial_name ||
 request?.ruc_cedula ||
 request?.created_by;

 if (shouldUseClientRequest) {
 const requestData = await getClientRequestById(request.id);
 setDetail({
 open: true,
 loading: false,
 data: normalizeClientPayload(requestData),
 error: null,
 });
 return;
 }

 let requestData = null;
 try {
 requestData = await getRequestById(request.id);
 } catch (err) {
 if (err?.response?.status === 404) {
 const fallbackData = await getClientRequestById(request.id);
 setDetail({
 open: true,
 loading: false,
 data: normalizeClientPayload(fallbackData),
 error: null,
 });
 return;
 }
 throw err;
 }
 let documents = [];
 let files = [];
 try {
 documents = await getDocumentsByRequest(request.id);
 } catch (err) {
 console.warn("No se pudieron cargar los documentos:", err);
 }
 try {
 files = await getFilesByRequest(request.id);
 } catch (err) {
 console.warn("No se pudieron cargar los archivos:", err);
 }
 const normalizedRequest = requestData?.request || requestData || {};
 let payload = normalizedRequest.payload;
 if (typeof payload === "string") {
 try {
 payload = JSON.parse(payload);
 } catch {
 payload = {};
 }
 }
 payload = payload || {};
 setDetail({
 open: true,
 loading: false,
 data: {
 request: { ...normalizedRequest, payload },
 documents: documents || [],
 files: files || [],
 },
 error: null,
 });
 } catch (error) {
 console.error("No se pudo cargar el detalle de la solicitud:", error);
 setDetail({
 open: true,
 loading: false,
 data: null,
 error: "No se pudo cargar el detalle de la solicitud",
 });
 }
 };

 const reloadCurrentRequestDetail = async () => {
 const current = detail.data?.request;
 if (!current?.id) return;
 await handleViewRequest(current);
 };

 // View Modal State
 const [viewType, setViewType] = useState(null);
 const [viewTitle] = useState("");
 const [viewCustomFetcher] = useState(null);

 const handlePurchaseHandoffOpen = () => {
 setShowPurchaseHandoff(true);
 };

 const resetPrivateModalFields = () => {
 setPrivateForm(initialPrivateForm);
 setSelectedEquipment([]);
 setOfferValidity(defaultOfferValidity());
 setOfferKind("venta");
 setComodatoFile(null);
 };

 const closePrivateModal = () => {
 resetPrivateModalFields();
 setShowPrivateModal(false);
 };

 const handlePurchaseTypeSelection = (type) => {
 setShowPurchaseTypeModal(false);
 if (type === "public") {
 handlePurchaseHandoffOpen();
 } else if (type === "private") {
 // Abrir modal de compra privada detallado
 resetPrivateModalFields();
 setShowPrivateModal(true);
 }
 };

 // Funciones para manejo de equipos en modal privado
 const normalizeEquipmentId = (id) => `${id}`;

 const toggleEquipment = (id) => {
 setSelectedEquipment((prev) => {
 const normalizedId = normalizeEquipmentId(id);
 const exists = prev.find((item) => item.id === normalizedId);
 console.debug("[FLOW_PRIVADA][FE][DEBUG] toggleEquipment", { id: normalizedId, exists: !!exists });
 if (exists) {
 return prev.filter((item) => item.id !== normalizedId);
 }
 return [...prev, { id: normalizedId, type: "new" }];
 });
 };

 const updateEquipmentType = (id, type) => {
 setSelectedEquipment((prev) =>
 prev.map((item) =>
 item.id === normalizeEquipmentId(id) ? { ...item, type } : item)
 );
 };

 // Función para crear solicitud privada
 const handlePrivateSubmit = async () => {
 if (!privateForm.firstName.trim() || !privateForm.lastName.trim()) {
 showToast("Ingresa nombres y apellidos del cliente", "warning");
 return;
 }
 if (!privateForm.clientName.trim()) {
 showToast("Ingresa el nombre comercial del cliente", "warning");
 return;
 }
 if (!selectedEquipment.length) {
 showToast("Selecciona al menos un equipo", "warning");
 return;
 }
 if (offerKind === "comodato" && !comodatoFile) {
 showToast("Adjunta el documento de estadísticas para comodato", "warning");
 return;
 }

 showLoader();
 const flowId = `pp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
 try {
 const equipmentPayload = selectedEquipment
 .map((selected) => {
 const item = equipmentCatalog.find(
 (equip) => `${equip.id}` === normalizeEquipmentId(selected.id)
 );
 return {
 id: item?.id || selected.id,
 name: item?.name || "Equipo",
 sku: item?.sku || null,
 type: selected.type || "new",
 };
 })
 .filter(Boolean);
 console.debug("[FLOW_PRIVADA][FE][DEBUG] equipmentPayload", {
 selectedEquipment,
 equipmentCatalogCount: equipmentCatalog.length,
 payloadCount: equipmentPayload.length,
 payloadPreview: equipmentPayload.slice(0,3),
 });

 const payload = {
 clientSnapshot: {
 client_type: privateForm.clientType,
 commercial_name: privateForm.clientName.trim(),
 client_email: privateForm.clientEmail.trim() || null,
 client_identifier: privateForm.clientIdentifier.trim() || null,
 first_name: privateForm.firstName.trim(),
 last_name: privateForm.lastName.trim(),
 },
 equipment: equipmentPayload,
 notes: privateForm.notes.trim() || null,
 offer_valid_until: new Date(offerValidity).toISOString(),
 offer_kind: offerKind,
 };

 if (offerKind === "comodato" && comodatoFile) {
 const base64 = await fileToBase64(comodatoFile);
 payload.comodato_document_base64 = base64;
 payload.comodato_document_name = comodatoFile.name;
 payload.comodato_document_mime = comodatoFile.type;
 }

 console.log("[FLOW_PRIVADA][FE][COMERCIAL][CREATE][START]", {
 flowId,
 client: payload.clientSnapshot?.commercial_name,
 equipmentCount: payload.equipment?.length || 0,
 offerKind: payload.offer_kind
 });
 const created = await createPrivatePurchase(payload, {
 headers: { "x-flow-id": flowId }
 });
 console.log("[FLOW_PRIVADA][FE][COMERCIAL][CREATE][SUCCESS]", {
 flowId,
 requestId: created?.id,
 client: payload.clientSnapshot?.commercial_name,
 offerKind: payload.offer_kind
 });
 if (created?.id) {
 localStorage.setItem(`private_purchase_flow_${created.id}`, flowId);
 }
 showToast("Solicitud privada registrada. Backoffice la revisará", "success");
 closePrivateModal();
 } catch (error) {
 console.error("[FLOW_PRIVADA][FE][COMERCIAL][CREATE][ERROR]", {
 flowId,
 error: error?.message || error
 });
 showToast("No pudimos crear la solicitud privada", "error");
 } finally {
 hideLoader();
 }
 };

 return (
 <div className="space-y-8">
 <BaseSolicitudesView
 />

 {/* PURCHASE HANDOFF MODAL REMOVED - Now using global modals */}

 <Modal
 open={showPurchaseTypeModal}
 onClose={() => setShowPurchaseTypeModal(false)}
 title="Selecciona el tipo de cliente"
 >
 <div className="space-y-3">
 <p>¿El cliente pertenece a la red pública o es un cliente privado?</p>
 <div className="flex flex-wrap gap-3">
 <Button 
 variant="secondary" 
 onClick={() => handlePurchaseTypeSelection("public")}
 className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-600"
 >
 Público
 </Button>
 <Button 
 variant="primary" 
 onClick={() => handlePurchaseTypeSelection("private")}
 className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-md active:scale-95"
 >
 Privado
 </Button>
 </div>
 </div>
 </Modal>

 {/* PERMISOS/VACACIONES MODAL */}

 {/* PERMISOS/VACACIONES MODAL */}
 <PermisoVacacionModal
 open={showPermisoModal}
 onClose={() => setShowPermisoModal(false)}
 />

 {/* MODAL LISTADO DE SOLICITUDES */}
 <RequestsListModal
 open={!!viewType}
 onClose={() => setViewType(null)}
 type={viewType}
 title={viewTitle}
 customFetcher={viewCustomFetcher}
 onView={handleViewRequest}
 />

 <RequestDetailModal
 detail={detail}
 onProcessed={reloadCurrentRequestDetail}
 onClose={() =>
 setDetail({ open: false, loading: false, data: null, error: null })
 }
 />

 {/* MODAL DE COMPRA PRIVADA DETALLADO */}
 <Modal
 open={showPrivateModal}
 onClose={closePrivateModal}
 title="Registrar solicitud privada"
 size="large"
 >
 <div className="space-y-6 text-sm text-gray-700">
 <p className="text-sm text-gray-600">
 Registra los datos completos del cliente privado para que Backoffice continúe el proceso.
 </p>

 {/* Información del Cliente */}
 <div className="border-b pb-4">
 <h3 className="text-lg font-semibold text-gray-900 mb-4">Información del Cliente</h3>
 <div className="grid gap-4 md:grid-cols-2">
 <input
 className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 placeholder="Nombres"
 value={privateForm.firstName}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, firstName: e.target.value }))}
 />
 <input
 className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 placeholder="Apellidos"
 value={privateForm.lastName}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, lastName: e.target.value }))}
 />
 </div>
 <input
 className="w-full mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 placeholder="Nombre Comercial"
 value={privateForm.clientName}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, clientName: e.target.value }))}
 />
 <div className="grid gap-4 md:grid-cols-2 mt-4">
 <input
 className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 placeholder="RUC / Cédula"
 value={privateForm.clientIdentifier}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, clientIdentifier: e.target.value }))}
 />
 <input
 className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 placeholder="Correo de contacto"
 value={privateForm.clientEmail}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, clientEmail: e.target.value }))}
 />
 </div>
 <div className="mt-4">
 <label className="flex flex-col text-sm text-gray-600 gap-1">
 Tipo de cliente
 <select
 className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 value={privateForm.clientType}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, clientType: e.target.value }))}
 >
 <option value="persona_natural">Persona natural</option>
 <option value="persona_juridica">Persona jurídica</option>
 </select>
 </label>
 </div>
 </div>

 {/* Equipos */}
 <div className="border-b pb-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-gray-900">Modelos disponibles</h3>
 </div>
 <p className="text-xs text-gray-500 mb-3">
 Selecciona el modelo. El número de serie se asigna cuando se vincula el equipo al cliente.
 </p>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 {equipmentCatalog.map((equipment) => {
 const selected = selectedEquipment.find(item => item.id === `${equipment.id}`);
 return (
 <div
 key={equipment.id}
 onClick={() => toggleEquipment(equipment.id)}
 className={`rounded-2xl border p-4 transition-all duration-200 cursor-pointer shadow-sm ${
 selected ? "border-blue-500 bg-blue-50 shadow-blue-100" : "border-gray-200 bg-white hover:shadow-md hover:border-gray-300"
 }`}
 >
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-semibold text-gray-900">
 {equipment.name}
 </p>
 <div className="text-xs text-gray-500 space-y-0.5">
 <p>Modelo: {equipment.model || equipment.name || "N/A"}</p>
 <p>SKU: {equipment.sku || "N/A"}</p>
 <p>Categoria: {equipment.category || "N/A"}</p>
 </div>
 </div>
 <span className={`text-xs font-semibold ${selected ? "text-blue-700" : "text-gray-400"}`}>
 {selected ? "Seleccionado" : "Agregar"}
 </span>
 </div>
 {selected && (
 <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
 <span>Tipo:</span>
 <button
 type="button"
 className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
 selected.type === "new" ? "bg-blue-600 text-white shadow-sm" : "border border-gray-300 bg-white hover:bg-gray-50"
 }`}
 onClick={(e) => {
 e.stopPropagation();
 updateEquipmentType(equipment.id, "new");
 }}
 >
 Nuevo
 </button>
 <button
 type="button"
 className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
 selected.type === "cu" ? "bg-blue-600 text-white shadow-sm" : "border border-gray-300 bg-white hover:bg-gray-50"
 }`}
 onClick={(e) => {
 e.stopPropagation();
 updateEquipmentType(equipment.id, "cu");
 }}
 >
 CU
 </button>
 </div>
 )}
 </div>
 );
 })}
 </div>
 {equipmentCatalog.length === 0 && (
 <p className="text-sm text-gray-500 text-center py-4">
 {loadingEquipment ? "Cargando modelos..." : "No hay modelos disponibles"}
 </p>
 )}
 </div>

 {/* Configuración de oferta */}
 <div className="space-y-4">
 <div className="flex flex-col gap-1">
 <label className="text-sm font-semibold text-gray-600">
 Vigencia de la oferta
 </label>
 <input
 type="date"
 value={offerValidity}
 onChange={(e) => setOfferValidity(e.target.value)}
 className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 />
 <p className="text-xs text-gray-500">
 Vigencia sugerida: 5 años desde la fecha actual.
 </p>
 </div>

 <div>
 <label className="flex flex-col text-sm text-gray-600 gap-1">
 Tipo de oferta
 <select
 className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 value={offerKind}
 onChange={(e) => setOfferKind(e.target.value)}
 >
 <option value="venta">Venta</option>
 <option value="alquiler">Alquiler</option>
 <option value="alquiler_transferencia_dominio">Alquiler con transferencia de dominio</option>
 <option value="comodato">Comodato</option>
 </select>
 </label>
 </div>

 {offerKind === "comodato" && (
 <div>
 <label className="flex flex-col text-sm text-gray-600 gap-1">
 Documento de estadística de consumo
 <input
 type="file"
 accept=".pdf,.png,.jpg,.jpeg"
 onChange={(e) => setComodatoFile(e.target.files?.[0] || null)}
 className="rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm bg-gray-50 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white dark:hover:border-blue-400 dark:focus:border-blue-400"
 />
 </label>
 </div>
 )}

 <div>
 <label className="flex flex-col text-sm text-gray-600 gap-1">
 Notas adicionales
 <textarea
 rows={3}
 className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:shadow-blue-100 resize-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
 placeholder="Información adicional sobre la solicitud..."
 value={privateForm.notes}
 onChange={(e) => setPrivateForm(prev => ({ ...prev, notes: e.target.value }))}
 />
 </label>
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-4">
 <Button 
 variant="secondary" 
 onClick={closePrivateModal}
 className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-600"
 >
 Cancelar
 </Button>
 <Button
 onClick={handlePrivateSubmit}
 disabled={!privateForm.clientName || selectedEquipment.length === 0}
 className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-md active:scale-95 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
 >
 Crear solicitud privada
 </Button>
 </div>
 </div>
 </Modal>
 </div>
 );
};

export default ComercialSolicitudesView;
