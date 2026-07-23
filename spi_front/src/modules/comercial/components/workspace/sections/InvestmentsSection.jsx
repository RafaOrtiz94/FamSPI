import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiEye, FiLayers, FiLock, FiPlus, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import { useAutoEditSection } from "../BusinessCaseWorkspaceContext";
import Modal from "../../../../../core/ui/components/Modal";
import SectionEditorBadge from "../SectionEditorBadge";
const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isTempId = (id) => String(id).startsWith("tmp-");

const CART_VIEWS = [
 { key: "general", label: "Carrito General", description: "Unión de ACP y Servicio", tone: "emerald" },
 { key: "acp", label: "Carrito ACP", description: "Solicitud comercial confirmada", tone: "indigo" },
 { key: "service", label: "Carrito Servicio", description: "Complementos del área técnica", tone: "violet" },
];

const CART_SCOPE_LABELS = {
 acp: "ACP",
 service: "Servicio",
 available: "Disponible",
};

const dedupeItemsById = (rows = []) => {
 const map = new Map();
 (Array.isArray(rows) ? rows : []).forEach((row) => {
 const key = String(row?.id);
 if (!key) return;
 const previous = map.get(key) || {};
 map.set(key, { ...previous, ...row });
 });
 return Array.from(map.values());
};

const getNaturalErrorMessage = (err, fallback) => {
 const raw = String(err?.response?.data?.message || "").trim();
 const code = String(err?.response?.data?.code || "").trim();
 if (code === "INVESTMENT_STAT_DOCUMENT_REQUIRED") {
 return "Primero se debe cargar el documento de estadistica para habilitar el carrito de inversiones.";
 }
 if (code === "INVESTMENT_CART_CONFIRMED_LOCKED" || code === "INVESTMENT_SERVICE_CART_CONFIRMED_LOCKED") {
 return "El carrito de Servicio ya fue confirmado y esta bloqueado.";
 }
 if (code === "INVESTMENT_ACP_CART_CONFIRMED_SERVICE_HANDOFF") {
 return "El carrito ACP ya fue confirmado. Solo Jefe de Servicio puede agregar inversiones o solicitar aumentos.";
 }
 if (code === "INVESTMENT_ACP_CART_ALREADY_CONFIRMED") {
 return "El carrito ACP ya fue confirmado.";
 }
 if (code === "INVESTMENT_ACP_ITEM_READ_ONLY") {
 return "Este ítem pertenece al Carrito ACP y está protegido. Solicita un aumento de cantidad si lo necesitas.";
 }
 if (code === "INVESTMENT_ACP_ROLE_REQUIRED") {
 return "En procesos publicos la primera confirmacion corresponde a ACP Comercial.";
 }
 if (code === "INVESTMENT_SERVICE_CART_ALREADY_CONFIRMED") {
 return "El carrito de Servicio ya fue confirmado.";
 }
 if (!raw) return fallback;
 if (/\b(4\d\d|5\d\d)\b/.test(raw) || /forbidden|conflict|unauthorized|status/i.test(raw)) return fallback;
 return raw;
};

const buildInvestmentBlocker = ({ permissions = {}, ownership = {}, cartStatus = {}, requiresStatDocument, statDocumentUploaded, currentRole }) => {
 if (cartStatus?.serviceConfirmed || cartStatus?.confirmed) {
 const confirmedAt = cartStatus?.confirmed_at || cartStatus?.confirmedAt || null;
 return {
 code: "INVESTMENT_SERVICE_CART_CONFIRMED",
 title: "Carrito de Servicio confirmado",
 message: "El contenido ya esta bloqueado. Jefe de Operaciones puede cargar los precios operativos.",
 detail: `Confirmado${confirmedAt ? ` el ${confirmedAt}` : ""}.`,
 };
 }
 if (cartStatus?.acpConfirmed && currentRole !== "jefe_servicio") {
 return {
 code: "INVESTMENT_ACP_CART_CONFIRMED_SERVICE_HANDOFF",
 title: "Carrito ACP confirmado",
 message: "Jefe de Servicio puede agregar nuevas inversiones, solicitar aumentos y realizar la confirmacion final.",
 detail: `acpConfirmed=true; rol actual=${currentRole || "desconocido"}`,
 };
 }
 if (requiresStatDocument && !statDocumentUploaded) {
 return {
 code: "INVESTMENT_STAT_DOCUMENT_REQUIRED",
 title: "Documento de estadistica pendiente",
 message: "El carrito se habilita cuando el usuario comercial carga el documento de estadistica.",
 detail: "Bloqueante recibido desde ownership.metadata.stat_document_uploaded=false.",
 };
 }
 if (permissions?.canEditInvestments === false) {
 return {
 code: "UI_GUIDANCE_CAN_EDIT_INVESTMENTS_FALSE",
 title: "Gate de inversiones no habilitado",
 message: "El backend no habilito la edicion de inversiones para este Business Case.",
 detail: `permissions.canEditInvestments=${String(permissions?.canEditInvestments)}`,
 };
 }
 if (ownership?.canUserEdit === false) {
 return {
 code: "SECTION_OWNERSHIP_BLOCKED",
 title: "Ownership de seccion bloqueado",
 message: "La regla de ownership de la seccion inversiones esta bloqueando la edicion.",
 detail: `ownership.canUserEdit=${String(ownership?.canUserEdit)}`,
 };
 }
 return {
 code: "UNKNOWN_INVESTMENT_BLOCKER",
 title: "Bloqueo no clasificado",
 message: "La UI no puede editar inversiones, pero no recibio un bloqueante especifico.",
 detail: "Revisar ui-guidance, ownership y respuesta del endpoint de inversiones.",
 };
};

const InvestmentsSection = ({ businessCase = {}, permissions = {}, ownership = {} }) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
 const { user } = useAuth();
 const [items, setItems] = useState([]);
 const [loading, setLoading] = useState(true);
 const [savingCart, setSavingCart] = useState(false);
 const [searchTerm, setSearchTerm] = useState("");
 const [showOnlySelected, setShowOnlySelected] = useState(false);
 const [newName, setNewName] = useState("");
 const [newCategory, setNewCategory] = useState("");
 const [newQuantity, setNewQuantity] = useState("");
 const [newCharacteristics, setNewCharacteristics] = useState("");
 const [newNotes, setNewNotes] = useState("");
 const [dirtyMap, setDirtyMap] = useState({});
 const [cartStatus, setCartStatus] = useState({ confirmed: false, deadline_at: null, confirmed_at: null });
 const [cartSummary, setCartSummary] = useState(null);
 const [cartView, setCartView] = useState("general");
 const [increaseModal, setIncreaseModal] = useState({
  open: false,
  item: null,
  requestedQuantity: "",
  reason: "",
  submitting: false,
 });
 const [confirmCartModalOpen, setConfirmCartModalOpen] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
 useAutoEditSection("investments", () => setIsEditing(true));

 const requiresStatDocument = ownership?.metadata?.requires_stat_document === true;
 const statDocumentUploaded = ownership?.metadata?.stat_document_uploaded === true;
 const explicitCanEditInvestments = permissions.canEditInvestments;
 const canEditByInvestmentGate = explicitCanEditInvestments === true
 || (
 explicitCanEditInvestments === undefined
 && ownership?.canUserEdit !== false
 && (!requiresStatDocument || statDocumentUploaded)
 );
 const canEditBase = canEditByInvestmentGate && ownership?.canUserEdit !== false;
 const currentUserEmail = String(user?.email || "").trim().toLowerCase();
 const currentRole = String(user?.role || user?.scope || user?.role_name || "").trim().toLowerCase();
 const acpConfirmed = Boolean(cartStatus?.acpConfirmed ?? cartStatus?.acp_confirmed);
 const serviceConfirmed = Boolean(cartStatus?.serviceConfirmed ?? cartStatus?.service_confirmed ?? cartStatus?.confirmed);
 const canEdit = canEditBase && !serviceConfirmed;
 const canConfirmCart = ["acp_comercial", "jefe_comercial", "jefe_de_comercial"].includes(currentRole);
 const purchaseType = String(businessCase?.bc_purchase_type || businessCase?.business_case_type || "").trim().toLowerCase();
 const isPublicProcess = purchaseType === "public" || purchaseType === "comodato_publico";
 const canConfirmAcpCart = currentRole === "acp_comercial" || (canConfirmCart && !isPublicProcess);
 const canConfirmServiceCart = currentRole === "jefe_servicio";
 const activeCartView = CART_VIEWS.find((view) => view.key === cartView) || CART_VIEWS[0];
 const investmentBlocker = useMemo(
 () => !canEdit
 ? buildInvestmentBlocker({
 permissions,
 ownership,
 cartStatus,
 requiresStatDocument,
 statDocumentUploaded,
 currentRole,
 })
 : null,
 [canEdit, permissions, ownership, cartStatus, requiresStatDocument, statDocumentUploaded, currentRole],
 );
 const editStatus = canEdit
 ? {
 code: isEditing ? "INVESTMENT_EDIT_MODE_ACTIVE" : "INVESTMENT_EDIT_MODE_AVAILABLE",
 title: isEditing ? "Edicion activa" : "Edicion disponible",
 message: isEditing
 ? "Puedes modificar el carrito de inversiones y guardar los cambios."
 : "La seccion esta habilitada, pero esta en modo lectura. Presiona Editar para modificar el carrito.",
 }
 : null;

 const startEditing = useCallback(() => {
 console.info("[BusinessCase][Investments] Activando modo edicion", {
 canEdit,
 canEditBase,
 explicitCanEditInvestments,
 ownership,
 cartStatus,
 userRole: user?.role || null,
 userEmail: user?.email || null,
 });
 setIsEditing(true);
 }, [canEdit, canEditBase, explicitCanEditInvestments, ownership, cartStatus, user?.role, user?.email]);

 useEffect(() => {
 const payload = {
 canEdit,
 canEditBase,
 canEditByInvestmentGate,
 explicitCanEditInvestments,
 requiresStatDocument,
 statDocumentUploaded,
 isEditing,
 blocker: investmentBlocker,
 permissions,
 ownership,
 cartStatus,
 userRole: user?.role || null,
 userEmail: user?.email || null,
 };
 if (investmentBlocker) {
 console.warn("[BusinessCase][Investments] Seccion bloqueada", payload);
 return;
 }
 console.info("[BusinessCase][Investments] Estado de edicion", payload);
 }, [
 canEdit,
 canEditBase,
 canEditByInvestmentGate,
 explicitCanEditInvestments,
 requiresStatDocument,
 statDocumentUploaded,
 isEditing,
 investmentBlocker,
 permissions,
 ownership,
 cartStatus,
 user?.role,
 user?.email,
 ]);

 const loadCatalog = useCallback(async () => {
 if (!bcId) return;
 try {
 setLoading(true);
 const res = await api.get(`/business-case/${bcId}/investments/catalog`);
 const payload = res?.data?.data || res?.data || [];
 const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
 const cart = payload?.cart || { confirmed: false };
 setItems(Array.isArray(list) ? list : []);
 setCartStatus(cart);
 setCartSummary(payload?.cart_summary || null);
 setDirtyMap({});
 } catch (err) {
 console.error("Error loading investment catalog", err);
 showToast("No se pudo cargar el catalogo de inversiones", "error");
 } finally {
 setLoading(false);
 }
 }, [bcId, showToast]);

 useEffect(() => {
 loadCatalog();
 }, [loadCatalog]);

 const markDirty = (id) => {
 setDirtyMap((prev) => ({ ...prev, [String(id)]: true }));
 };

 const handleToggle = (item) => {
 if (!canEdit) return;
 setItems((prev) =>
 prev.map((row) =>
 row.id === item.id
 ? {
 ...row,
 selected: !row.selected,
 }
 : row,
 ),
 );
 markDirty(item.id);
 };

 const updateItem = (id, patch) => {
 setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
 markDirty(id);
 };

 const openIncreaseModal = (item) => {
 const currentQty = Number(item?.quantity ?? 0);
 setIncreaseModal({
  open: true,
  item,
  requestedQuantity: String(Math.max(currentQty + 1, 1)),
  reason: "",
  submitting: false,
 });
 };

 const closeIncreaseModal = () => {
 if (increaseModal.submitting) return;
 setIncreaseModal((prev) => ({ ...prev, open: false }));
 };

 const submitIncreaseRequest = async () => {
 if (!bcId || !increaseModal.item) return;
 const currentQty = Number(increaseModal.item?.quantity ?? 0);
 const requestedQuantity = Number(increaseModal.requestedQuantity);
 if (!Number.isFinite(requestedQuantity) || requestedQuantity <= currentQty) {
 showToast("La cantidad solicitada debe ser mayor a la actual.", "warning");
 return;
 }
 if (!String(increaseModal.reason || "").trim()) {
 showToast("Debes indicar el motivo de la solicitud.", "warning");
 return;
 }
 try {
 setIncreaseModal((prev) => ({ ...prev, submitting: true }));
 await api.post(`/business-case/${bcId}/investments/selections/request-increase`, {
  catalog_id: increaseModal.item.id,
  requested_quantity: requestedQuantity,
  reason: increaseModal.reason.trim(),
 });
 showToast("Solicitud enviada al propietario del carrito.", "success");
 setIncreaseModal({ open: false, item: null, requestedQuantity: "", reason: "", submitting: false });
 await loadCatalog();
 } catch (err) {
 setIncreaseModal((prev) => ({ ...prev, submitting: false }));
 console.error("[BusinessCase][Investments] Error solicitando aumento", {
 status: err?.response?.status,
 code: err?.response?.data?.code,
 message: err?.response?.data?.message,
 data: err?.response?.data,
 });
 showToast(getNaturalErrorMessage(err, "No se pudo registrar la solicitud."), "error");
 }
 };

 const handleSaveCart = async () => {
 if (!canEdit || !bcId) return;

 const dirtyItems = items.filter((row) => Boolean(dirtyMap[String(row.id)]));
 if (!dirtyItems.length) {
 showToast("No hay inversiones pendientes por agregar al carrito", "info");
 return;
 }

 try {
 setSavingCart(true);
 let workingItems = [...items];
 const tempItems = dirtyItems.filter((row) => isTempId(row.id));
 const tempIdToCatalog = new Map();

 for (const row of tempItems) {
 // eslint-disable-next-line no-await-in-loop
 const createRes = await api.post(`/business-case/${bcId}/investments/catalog`, {
 name: row.name,
 category: row.category || null,
 selected: false,
 });
 const created = createRes?.data?.data;
 if (!created?.id) {
 throw new Error(`No se pudo crear la inversion del carrito: ${row.name || "sin nombre"}`);
 }
 tempIdToCatalog.set(String(row.id), created);
 }

 if (tempIdToCatalog.size > 0) {
 workingItems = workingItems.map((row) => {
 const created = tempIdToCatalog.get(String(row.id));
 if (!created) return row;
 return {
 ...row,
 id: created.id,
 code: created.code,
 name: created.name,
 category: created.category,
 is_active: created.is_active,
 _pendingCreate: false,
 };
 });
 workingItems = dedupeItemsById(workingItems);
 }

 const normalizedDirtyIds = new Set(
 Object.keys(dirtyMap).map((key) => {
 const created = tempIdToCatalog.get(String(key));
 return String(created?.id || key);
 }),
 );
 const dirtyItemsToSave = workingItems.filter((row) => normalizedDirtyIds.has(String(row.id)));

 const payload = {
 selections: dirtyItemsToSave.map((row) => ({
 catalog_id: row.id,
 selected: Boolean(row.selected),
 notes: row.notes || null,
 quantity: row.quantity ?? null,
 characteristics: row.characteristics || null,
 })),
 };

 const res = await api.post(`/business-case/${bcId}/investments/selections`, payload);
 console.info("[BusinessCase][Investments] Carrito guardado", {
 savedCount: res?.data?.data?.saved_count,
 response: res?.data,
 });
 await loadCatalog();
 setIsEditing(false);
 showToast(`Se guardaron ${dirtyItemsToSave.length} inversiones del carrito`, "success");
 } catch (err) {
 console.error("[BusinessCase][Investments] Error saving investment cart", {
 status: err?.response?.status,
 code: err?.response?.data?.code,
 message: err?.response?.data?.message,
 data: err?.response?.data,
 err,
 });
 showToast(getNaturalErrorMessage(err, "No se pudo guardar el carrito de inversiones"), "error");
 } finally {
 setSavingCart(false);
 }
 };

const handleCancelEdit = () => {
 setIsEditing(false);
 loadCatalog();
};

const handleConfirmCart = async () => {
// BC-10: acp_comercial puede tener la seccion en solo lectura (no edita
// items) pero SI puede confirmar el carrito -- por eso el guard es
// canConfirmCart (permiso especifico de la accion), no canEdit (permiso
// general de edicion de items).
 if (!bcId || (!canConfirmAcpCart && !canConfirmServiceCart)) return;
if (dirtyCount > 0) {
showToast("Agrega primero las inversiones pendientes al carrito antes de confirmarlo.", "warning");
return;
}
 try {
 await api.post(`/business-case/${bcId}/investments/confirm-cart`);
 showToast(
  canConfirmServiceCart
   ? "Carrito de Servicio confirmado. Se habilitaron los precios operativos."
 : "Carrito ACP confirmado. Se habilitaron los precios financieros.",
  "success",
 );
 setConfirmCartModalOpen(false);
 await loadCatalog();
 } catch (err) {
 console.error("[BusinessCase][Investments] Error confirmando carrito", {
 status: err?.response?.status,
 code: err?.response?.data?.code,
 message: err?.response?.data?.message,
 data: err?.response?.data,
 });
 showToast(getNaturalErrorMessage(err, "No se pudo confirmar el carrito."), "error");
 }
 };

 const handleCreateCustomInvestment = () => {
 if (!canEdit || !bcId) return;
 const name = newName.trim();
 if (!name) {
 showToast("Ingresa el nombre de la inversion", "warning");
 return;
 }

 const tempId = makeTempId();
 const normalizedQuantity = newQuantity === "" ? null : Number(newQuantity);
 const localItem = {
 id: tempId,
 code: null,
 name,
 category: newCategory.trim() || null,
 is_active: true,
 selected: true,
 quantity: Number.isFinite(normalizedQuantity) ? normalizedQuantity : null,
 characteristics: newCharacteristics.trim() || null,
 notes: newNotes.trim() || null,
 updated_by_role: null,
 updated_by_email: null,
 _pendingCreate: true,
 };

 setItems((prev) => [...prev, localItem]);
 markDirty(tempId);
 setNewName("");
 setNewCategory("");
 setNewQuantity("");
 setNewCharacteristics("");
 setNewNotes("");

 showToast("Inversion agregada al carrito local. Guarda para persistir.", "success");
 };

 const normalizedSearch = searchTerm.trim().toLowerCase();
 const selectedItems = useMemo(() => items.filter((item) => item.selected), [items]);
 const filteredItems = useMemo(() => {
 let base = showOnlySelected ? items.filter((i) => i.selected) : items;
 if (cartView !== "general") {
  base = base.filter((item) => {
   if (cartView === "service" && currentRole === "jefe_servicio") return true;
   if (item.cart_scope === cartView) return true;
   // Servicio consulta también los ítems ACP heredados en modo lectura.
   if (cartView === "service" && item.cart_scope === "acp" && item.selected) return true;
   // Jefe de Servicio needs the available catalog to add new items after ACP.
   if (cartView === "service" && acpConfirmed && item.selected === false && currentRole === "jefe_servicio") return true;
   // Before ACP confirms, the whole catalog belongs to the initial cart view.
   if (cartView === "acp" && !acpConfirmed && item.selected === false) return true;
   return false;
  });
 }
 if (!normalizedSearch) return base;
 return base.filter((item) => {
 const name = String(item.name || "").toLowerCase();
 const category = String(item.category || "").toLowerCase();
 const notes = String(item.notes || "").toLowerCase();
 const characteristics = String(item.characteristics || "").toLowerCase();
 return (
 name.includes(normalizedSearch) ||
 category.includes(normalizedSearch) ||
 notes.includes(normalizedSearch) ||
 characteristics.includes(normalizedSearch)
 );
 });
 }, [items, normalizedSearch, showOnlySelected, cartView, acpConfirmed, currentRole]);

 const selectedCount = selectedItems.length;
 const dirtyCount = useMemo(() => Object.keys(dirtyMap).length, [dirtyMap]);
 const pendingCreateCount = useMemo(() => items.filter((item) => isTempId(item.id)).length, [items]);
 const getCartBucket = (scope) => {
  const fallbackItems = selectedItems.filter((item) => scope === "general" || item.cart_scope === scope);
  return cartSummary?.[scope] || { item_count: fallbackItems.length, quantity: fallbackItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) };
 };

 const renderInvestmentCard = (item) => {
 const isDirty = Boolean(dirtyMap[String(item.id)]);
 const pendingCreate = isTempId(item.id);
 const ownerEmail = String(item?.owner_email || "").trim().toLowerCase();
 const isOwner = !ownerEmail || ownerEmail === currentUserEmail;
 const isProtectedAcpItem = acpConfirmed && currentRole === "jefe_servicio" && item.selected && item.cart_scope === "acp" && !isOwner;
 const canModifySelectionAndQty = canEdit && isEditing && isOwner && !isProtectedAcpItem;
 return (
 <div key={item.id} className="p-4 flex flex-col gap-3 border-b last:border-b-0">
 <div className="flex items-start justify-between gap-3">
 <label className="flex items-start gap-3 cursor-pointer">
 <input
 type="checkbox"
 className="mt-1 accent-emerald-600"
 checked={!!item.selected}
 onChange={() => handleToggle(item)}
 disabled={!canModifySelectionAndQty || savingCart}
 />
 <div>
 <div className="text-sm font-semibold text-gray-900">{item.name}</div>
 <div className="text-xs text-gray-500">Categoria: {item.category || "Sin categoria"}</div>
 {pendingCreate ? (
 <div className="text-xs text-amber-700">Pendiente de creacion en catalogo</div>
 ) : (
 item.updated_by_role && (
 <div className="text-xs text-gray-500">
 Ultima actualizacion por: {item.updated_by_role}
 {item.updated_by_email ? ` (${item.updated_by_email})` : ""}
 </div>
 )
 )}
 {item.owner_email && (
 <div className="text-xs text-gray-500">Propietario del carrito: {item.owner_email}</div>
 )}
 </div>
 </label>

 <span
 className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
 isDirty
 ? "text-amber-700 bg-amber-50"
 : item.selected
 ? "text-emerald-700 bg-emerald-50"
 : "text-gray-600 bg-gray-100"
 }`}
 >
 {isDirty ? (
 <>
 <FiClock size={12} />
 Pendiente de guardar
 </>
 ) : item.selected ? (
 <>
 <FiCheckCircle size={12} />
 En carrito
 </>
 ) : (
 "No seleccionado"
 )}
 </span>
 <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
 item.cart_scope === "acp"
  ? "bg-indigo-50 text-indigo-700"
  : item.cart_scope === "service"
  ? "bg-violet-50 text-violet-700"
  : "bg-slate-100 text-slate-600"
 }`}>
  {item.cart_scope === "acp" && <FiLock size={11} />}
  {item.cart_scope === "service" && <FiLayers size={11} />}
  {CART_SCOPE_LABELS[item.cart_scope] || "Disponible"}
 </span>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Cantidad</label>
 <input
 type="number"
 min={0}
 value={item.quantity ?? ""}
 onChange={(e) => updateItem(item.id, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
 disabled={!canModifySelectionAndQty || !item.selected || savingCart}
 placeholder="0"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50"
 />
 </div>
 {isProtectedAcpItem && (
 <div className="flex flex-col gap-2 md:col-span-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
 <div className="text-xs text-amber-800">
 Solo el propietario puede cambiar cantidad o quitar del carrito.
 </div>
 <button
 type="button"
 onClick={() => openIncreaseModal(item)}
 disabled={savingCart}
 className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-60 w-fit"
 >
 Solicitar aumento
 </button>
 </div>
 )}
 {Number(item?.pending_requests_count || 0) > 0 && (
 <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 md:col-span-3">
 Solicitudes pendientes para este item: {Number(item.pending_requests_count)}
 </div>
 )}

 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Caracteristicas</label>
 <input
 value={item.characteristics || ""}
 onChange={(e) => updateItem(item.id, { characteristics: e.target.value })}
 disabled={!canModifySelectionAndQty || !item.selected || savingCart}
 placeholder="Especificaciones solicitadas"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50"
 />
 </div>

 <div className="flex flex-col gap-2 md:col-span-3">
 <label className="text-xs font-semibold text-gray-500">Observaciones</label>
 <input
 value={item.notes || ""}
 onChange={(e) => updateItem(item.id, { notes: e.target.value })}
 disabled={!canModifySelectionAndQty || !item.selected || savingCart}
 placeholder="Detalles adicionales"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50"
 />
 </div>
 </div>
 </div>
 );
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <div className="p-4 sm:p-5 bg-white border border-gray-100 rounded-2xl shadow-sm">
 <div className="animate-pulse space-y-3">
 <div className="h-4 bg-gray-100 rounded w-3/4"></div>
 <div className="h-3 bg-gray-100 rounded w-1/2"></div>
 <div className="h-3 bg-gray-100 rounded w-5/6"></div>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-5">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
 <div>
 <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Inversiones adicionales</h2>
 <p className="text-sm text-gray-500">
 Agrega multiples inversiones al carrito y guarda todo en un solo paso.
 </p>
 <div className="mt-2">
 <SectionEditorBadge ownership={ownership} />
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 {canEdit && !isEditing && (
 <button
 type="button"
 onClick={startEditing}
 className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
 >
 Editar carrito
 </button>
 )}
 <div className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit">
 {selectedCount} en carrito
 </div>
 <div className="text-xs sm:text-sm font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full w-fit">
 {dirtyCount} pendientes
 </div>
 {acpConfirmed && (
 <div className="text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full w-fit">
 Carrito ACP confirmado
 </div>
 )}
 {serviceConfirmed && (
 <div className="text-xs sm:text-sm font-semibold text-purple-700 bg-purple-50 px-3 py-1 rounded-full w-fit">
 Carrito de Servicio confirmado
 </div>
 )}
 {pendingCreateCount > 0 && (
 <div className="text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full w-fit">
 {pendingCreateCount} nuevos por crear
 </div>
 )}
 </div>
 </div>

 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
  <div className="flex items-start gap-3">
   <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
    <FiLayers size={17} />
   </div>
   <div className="min-w-0">
    <div className="text-sm font-semibold text-slate-900">Cómo se organiza el carrito</div>
    <p className="mt-1 text-xs leading-5 text-slate-600">
     ACP confirma la solicitud inicial. Servicio puede ver esos ítems, solicitar aumentos y agregar complementos propios. El General reúne ambos carritos.
    </p>
   </div>
  </div>
  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
   {CART_VIEWS.map((view) => {
    const bucket = getCartBucket(view.key);
    const isActive = cartView === view.key;
    const isConfirmed = view.key === "acp" ? acpConfirmed : view.key === "service" ? serviceConfirmed : serviceConfirmed;
    return (
     <button
      key={view.key}
      type="button"
      onClick={() => setCartView(view.key)}
      className={`text-left rounded-2xl border p-4 transition-colors ${isActive ? "border-emerald-400 bg-white shadow-sm" : "border-slate-200 bg-white/70 hover:border-slate-300"}`}
     >
      <div className="flex items-start justify-between gap-3">
       <div>
        <div className="text-sm font-bold text-slate-900">{view.label}</div>
        <div className="mt-1 text-xs text-slate-500">{view.description}</div>
       </div>
       {isConfirmed ? <FiCheckCircle className="mt-0.5 text-emerald-600" size={17} /> : <FiClock className="mt-0.5 text-amber-500" size={17} />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
       <div>
       <div className="text-2xl font-bold text-slate-900">{bucket.visible_item_count ?? bucket.item_count ?? 0}</div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">ítems seleccionados</div>
       </div>
       <div className="text-right text-xs text-slate-500">Cantidad total<br /><strong className="text-slate-800">{bucket.visible_quantity ?? bucket.quantity ?? 0}</strong></div>
      </div>
      <div className={`mt-3 text-xs font-semibold ${isConfirmed ? "text-emerald-700" : "text-amber-700"}`}>
       {view.key === "general" ? (serviceConfirmed ? "Consolidado y cerrado" : "Vista consolidada") : isConfirmed ? "Confirmado" : "Pendiente de confirmación"}
      </div>
     </button>
    );
   })}
  </div>
 </div>

 <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
  <div>
   <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FiEye size={15} className="text-slate-500" />{activeCartView.label}</div>
   <p className="text-xs text-slate-500">{activeCartView.description}. Los ítems ACP confirmados se muestran en modo protegido.</p>
  </div>
  <div className="text-xs font-semibold text-slate-500">{getCartBucket(cartView).visible_item_count ?? getCartBucket(cartView).item_count ?? 0} ítems visibles</div>
 </div>

 {editStatus && (
 <div className={`rounded-2xl border p-4 text-sm ${
 isEditing
 ? "border-emerald-200 bg-emerald-50 text-emerald-900"
 : "border-sky-200 bg-sky-50 text-sky-900"
 }`}>
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <div className="font-semibold">{editStatus.title}</div>
 <p className="mt-1 leading-6">{editStatus.message}</p>
 <div className="mt-2 font-mono text-xs opacity-80">{editStatus.code}</div>
 </div>
 {!isEditing && (
 <button
 type="button"
 onClick={startEditing}
 className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
 >
 Editar
 </button>
 )}
 </div>
 </div>
 )}

 {investmentBlocker && (
 <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
 <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
 <FiAlertTriangle size={18} />
 </div>
 <div className="min-w-0 flex-1">
 <div className="font-semibold text-amber-950">{investmentBlocker.title}</div>
 <p className="mt-1 leading-6">{investmentBlocker.message}</p>
 <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
 <div className="rounded-xl border border-amber-100 bg-white/70 px-3 py-2">
 <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Codigo</div>
 <div className="break-all font-mono text-xs text-amber-950">{investmentBlocker.code}</div>
 </div>
 <div className="rounded-xl border border-amber-100 bg-white/70 px-3 py-2">
 <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Detalle</div>
 <div className="break-words text-xs text-amber-950">{investmentBlocker.detail}</div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {acpConfirmed && !serviceConfirmed && (
 <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
 <div className="font-semibold">Carrito ACP confirmado</div>
 <p className="mt-1 leading-6">
  {currentRole === "jefe_servicio"
   ? "Puedes agregar nuevas inversiones al carrito de Servicio. Los ítems confirmados por ACP permanecen protegidos; si necesitas aumentar uno, usa Solicitar aumento."
   : "El carrito inicial está confirmado. Jefe de Servicio puede completar nuevas inversiones y realizar la confirmación final."}
 </p>
 </div>
 )}

 <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-3">
 <div>
 <h3 className="text-sm font-semibold text-gray-900">Agregar inversión no listada</h3>
 <p className="text-xs text-gray-500">Si no aparece en el catálogo, puedes crearla y agregarla al carrito.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Producto / nombre</label>
 <input
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 placeholder="Ej: Control externo"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!canEdit || !isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Categoria</label>
 <input
 value={newCategory}
 onChange={(e) => setNewCategory(e.target.value)}
 placeholder="Ej: Tecnologia"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!canEdit || !isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Cantidad</label>
 <input
 type="number"
 min={0}
 value={newQuantity}
 onChange={(e) => setNewQuantity(e.target.value)}
 placeholder="0"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!canEdit || !isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Caracteristicas</label>
 <input
 value={newCharacteristics}
 onChange={(e) => setNewCharacteristics(e.target.value)}
 placeholder="Especificaciones"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!canEdit || !isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Observaciones</label>
 <input
 value={newNotes}
 onChange={(e) => setNewNotes(e.target.value)}
 placeholder="Detalles adicionales"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!canEdit || !isEditing || savingCart}
 />
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={handleCreateCustomInvestment}
 disabled={!canEdit || !isEditing || savingCart}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500"
 >
 <FiPlus size={15} />
 Agregar inversión no listada
 </button>
 </div>
 </div>

 <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5">
 <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
 <div className="flex flex-col gap-2 flex-1">
 <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buscar inversiones</label>
 <input
 type="search"
 placeholder="Nombre, categoria o palabra clave"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="border border-gray-200 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
 />
 </div>
 <div className="flex rounded-xl overflow-hidden border border-gray-200 self-end">
 <button
 type="button"
 onClick={() => setShowOnlySelected(false)}
 className={`px-3 py-2 text-xs font-semibold transition-colors ${
 !showOnlySelected
 ? "bg-emerald-600 text-white"
 : "bg-white text-gray-600 hover:bg-gray-50"
 }`}
 >
 Todas
 </button>
 <button
 type="button"
 onClick={() => setShowOnlySelected(true)}
 className={`px-3 py-2 text-xs font-semibold transition-colors ${
 showOnlySelected
 ? "bg-emerald-600 text-white"
 : "bg-white text-gray-600 hover:bg-gray-50"
 }`}
 >
 En carrito ({selectedCount})
 </button>
 </div>
 </div>

 {!items.length && !loading && (
 <div className="p-6 text-center text-gray-500 text-sm">El catalogo no contiene inversiones adicionales por el momento.</div>
 )}

 {items.length > 0 && (
 <>
 {filteredItems.length ? (
 filteredItems.map(renderInvestmentCard)
 ) : (
 <div className="p-6 text-center text-gray-500 text-sm">
 {showOnlySelected
 ? "No hay inversiones en el carrito aun."
 : "No se encontraron coincidencias. Intenta con otra palabra clave."}
 </div>
 )}
 </>
 )}
 </div>

 {/* BC-10: acp_comercial (y similares) ven la seccion en solo lectura --
     no pueden editar items, pero si deben poder confirmar el carrito, o la
     seccion queda abierta para siempre sin forma de avanzar el flujo.
     Sticky al fondo del viewport: la lista de inversiones puede ser larga y
     no debe hacer falta scrollear hasta el final para encontrar el boton. */}
 {!canEdit && canConfirmAcpCart && !acpConfirmed && (
 <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-5 lg:-mx-6 -mb-4 sm:-mb-5 lg:-mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 bg-white px-4 sm:px-5 lg:px-6 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
 <p className="text-xs text-gray-400 font-medium">
 Sección en modo solo lectura. Confirma el carrito para continuar el flujo.
 </p>
 <button
 type="button"
 onClick={() => setConfirmCartModalOpen(true)}
 disabled={savingCart}
 className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
 >
 {canConfirmServiceCart ? "Confirmar carrito de Servicio" : "Confirmar carrito ACP"}
 </button>
 </div>
 )}

 {canEdit && (
 <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-5 lg:-mx-6 -mb-4 sm:-mb-5 lg:-mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 bg-white px-4 sm:px-5 lg:px-6 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
 <p className="text-xs text-gray-400 font-medium">
  {isEditing ? "Agrega las inversiones seleccionadas al carrito antes de confirmarlo." : "Sección en modo solo lectura."}
 </p>
 {isEditing ? (
  <div className="flex flex-wrap gap-2 sm:justify-end">
  <button
  type="button"
  onClick={handleCancelEdit}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all"
  >
  Cancelar
  </button>
 {((canConfirmAcpCart && !acpConfirmed) || (canConfirmServiceCart && acpConfirmed && !serviceConfirmed)) && (
  <button
  type="button"
  onClick={() => setConfirmCartModalOpen(true)}
  disabled={savingCart || dirtyCount > 0}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
  >
  {canConfirmServiceCart ? "Confirmar carrito de Servicio" : "Confirmar carrito ACP"}
  </button>
  )}
  <button
  type="button"
  onClick={handleSaveCart}
  disabled={savingCart || dirtyCount === 0}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
  >
  <FiSave size={16} />
  {savingCart ? "Agregando..." : "Agregar al carrito de inversiones"}
  </button>
  </div>
 ) : (
  <button
  type="button"
  onClick={startEditing}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-all w-full sm:w-auto"
  >
  Editar
  </button>
 )}
 </div>
 )}

 <Modal
 open={increaseModal.open}
 onClose={closeIncreaseModal}
 title="Solicitar aumento de cantidad"
 maxWidth="max-w-xl"
 >
 <div className="space-y-4">
 <p className="text-sm text-slate-600">
 {increaseModal.item?.name || "Ítem"} tiene cantidad actual de{" "}
 <span className="font-semibold text-slate-900">{Number(increaseModal.item?.quantity ?? 0)}</span>.
 </p>
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nueva cantidad solicitada</label>
 <input
 type="number"
 min={0}
 value={increaseModal.requestedQuantity}
 onChange={(event) => setIncreaseModal((prev) => ({ ...prev, requestedQuantity: event.target.value }))}
 className="min-h-[44px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
 />
 </div>
 <div className="space-y-2">
 <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Motivo</label>
 <textarea
 rows={3}
 value={increaseModal.reason}
 onChange={(event) => setIncreaseModal((prev) => ({ ...prev, reason: event.target.value }))}
 className="min-h-[96px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
 placeholder="Explica por qué se necesita aumentar la cantidad"
 />
 </div>
 <div className="flex justify-end gap-2 pt-1">
 <button
 type="button"
 onClick={closeIncreaseModal}
 disabled={increaseModal.submitting}
 className="min-h-[44px] rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-transform active:scale-[0.97] disabled:opacity-50"
 >
 Cancelar
 </button>
 <button
 type="button"
 onClick={submitIncreaseRequest}
 disabled={increaseModal.submitting}
 className="min-h-[44px] rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.97] disabled:opacity-50"
 >
 {increaseModal.submitting ? "Enviando..." : "Enviar solicitud"}
 </button>
 </div>
 </div>
 </Modal>

 <Modal
 open={confirmCartModalOpen}
 onClose={() => setConfirmCartModalOpen(false)}
 title={canConfirmServiceCart ? "Confirmar carrito de Servicio" : "Confirmar carrito ACP"}
 maxWidth="max-w-lg"
 >
 <div className="space-y-4">
 <p className="text-sm text-slate-700">
 {canConfirmServiceCart
  ? "Al confirmar, se cerrará el carrito de Servicio y se habilitarán los precios operativos."
  : "Al confirmar, se cerrará el carrito inicial de ACP y se habilitarán los precios financieros. Jefe de Servicio podrá agregar nuevas inversiones."}
 </p>
 <div className="flex justify-end gap-2">
 <button
 type="button"
 onClick={() => setConfirmCartModalOpen(false)}
 className="min-h-[44px] rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-transform active:scale-[0.97]"
 >
 Cancelar
 </button>
 <button
 type="button"
 onClick={handleConfirmCart}
 className="min-h-[44px] rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.97]"
 >
 Confirmar
 </button>
 </div>
 </div>
 </Modal>
 </div>
 );
};

export default InvestmentsSection;
