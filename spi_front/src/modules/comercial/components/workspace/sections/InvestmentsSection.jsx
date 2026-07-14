import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiPlus, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import { useAutoEditSection } from "../BusinessCaseWorkspaceContext";
import Modal from "../../../../../core/ui/components/Modal";
const makeTempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isTempId = (id) => String(id).startsWith("tmp-");

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
 const status = Number(err?.response?.status || 0);
 const raw = String(err?.response?.data?.message || "").trim();
 if (status === 403) return "No tienes permiso para realizar esta acción en este momento.";
 if (status === 409) return "La información cambió mientras trabajabas. Recarga la sección e inténtalo de nuevo.";
 if (!raw) return fallback;
 if (/\b(4\d\d|5\d\d)\b/.test(raw) || /forbidden|conflict|unauthorized|status/i.test(raw)) return fallback;
 return raw;
};

const InvestmentsSection = ({ permissions = {}, ownership = {} }) => {
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

 const canEditBase = permissions.canEdit !== false && ownership?.canUserEdit !== false;
 const canEdit = canEditBase && !cartStatus?.confirmed;
 const currentUserEmail = String(user?.email || "").trim().toLowerCase();

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
 showToast(getNaturalErrorMessage(err, "No se pudo registrar la solicitud."), "error");
 }
 };

 const handleSaveCart = async () => {
 if (!canEdit || !bcId) return;

 const dirtyItems = items.filter((row) => Boolean(dirtyMap[String(row.id)]));
 if (!dirtyItems.length) {
 showToast("No hay cambios pendientes por guardar", "info");
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
 const savedRows = Array.isArray(res?.data?.data?.items) ? res.data.data.items : [];

 if (savedRows.length) {
 const savedByCatalog = new Map(savedRows.map((row) => [Number(row.catalog_id), row]));
 workingItems = workingItems.map((row) => {
 const saved = savedByCatalog.get(Number(row.id));
 if (!saved) return row;
 return {
 ...row,
 selected: saved.selected,
 notes: saved.notes,
 quantity: saved.quantity,
 characteristics: saved.characteristics,
 updated_by_role: saved.updated_by_role,
 updated_by_email: saved.updated_by_email,
 };
 });
 }

 setItems(workingItems);
 setDirtyMap({});
 setIsEditing(false);
 showToast(`Se guardaron ${dirtyItemsToSave.length} inversiones del carrito`, "success");
 } catch (err) {
 console.error("Error saving investment cart", err);
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
if (!bcId || !canEdit) return;
if (dirtyCount > 0) {
showToast("Guarda los cambios pendientes antes de confirmar el carrito.", "warning");
return;
}
 try {
 await api.post(`/business-case/${bcId}/investments/confirm-cart`);
 showToast("Carrito confirmado. Edición bloqueada y plazo de 48 horas iniciado para Jefe de Operaciones.", "success");
 setConfirmCartModalOpen(false);
 await loadCatalog();
 } catch (err) {
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
 const filteredItems = useMemo(() => {
 let base = showOnlySelected ? items.filter((i) => i.selected) : items;
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
 }, [items, normalizedSearch, showOnlySelected]);

 const selectedCount = useMemo(() => items.filter((i) => i.selected).length, [items]);
 const dirtyCount = useMemo(() => Object.keys(dirtyMap).length, [dirtyMap]);
 const pendingCreateCount = useMemo(() => items.filter((item) => isTempId(item.id)).length, [items]);

 const renderInvestmentCard = (item) => {
 const isDirty = Boolean(dirtyMap[String(item.id)]);
 const pendingCreate = isTempId(item.id);
 const ownerEmail = String(item?.owner_email || "").trim().toLowerCase();
 const isOwner = !ownerEmail || ownerEmail === currentUserEmail;
 const canModifySelectionAndQty = isEditing && isOwner;
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
 {!isOwner && item.selected && (
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
 disabled={!isEditing || !item.selected || savingCart}
 placeholder="Especificaciones solicitadas"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50"
 />
 </div>

 <div className="flex flex-col gap-2 md:col-span-3">
 <label className="text-xs font-semibold text-gray-500">Observaciones</label>
 <input
 value={item.notes || ""}
 onChange={(e) => updateItem(item.id, { notes: e.target.value })}
 disabled={!isEditing || !item.selected || savingCart}
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
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <div className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit">
 {selectedCount} en carrito
 </div>
 <div className="text-xs sm:text-sm font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full w-fit">
 {dirtyCount} pendientes
 </div>
 {cartStatus?.confirmed && (
 <div className="text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full w-fit">
 Carrito confirmado
 </div>
 )}
 {pendingCreateCount > 0 && (
 <div className="text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full w-fit">
 {pendingCreateCount} nuevos por crear
 </div>
 )}
 </div>
 </div>

 {!canEdit && (
 <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-800 text-sm">
 {cartStatus?.confirmed
 ? "Carrito confirmado: contenido bloqueado para edición. Jefe de Operaciones debe cargar valores en 48h."
 : "No tienes permisos para editar inversiones en este estado."}
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
 disabled={!isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Categoria</label>
 <input
 value={newCategory}
 onChange={(e) => setNewCategory(e.target.value)}
 placeholder="Ej: Tecnologia"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!isEditing || savingCart}
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
 disabled={!isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Caracteristicas</label>
 <input
 value={newCharacteristics}
 onChange={(e) => setNewCharacteristics(e.target.value)}
 placeholder="Especificaciones"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!isEditing || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Observaciones</label>
 <input
 value={newNotes}
 onChange={(e) => setNewNotes(e.target.value)}
 placeholder="Detalles adicionales"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
 disabled={!isEditing || savingCart}
 />
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={handleCreateCustomInvestment}
 disabled={!isEditing || savingCart}
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

 {canEdit && (
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-gray-100">
 <p className="text-xs text-gray-400 font-medium">
  {isEditing ? "Guarda los cambios pendientes antes de confirmar el carrito." : "Sección en modo solo lectura."}
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
  <button
  type="button"
  onClick={() => setConfirmCartModalOpen(true)}
  disabled={savingCart || dirtyCount > 0}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
  >
  Confirmar carrito
  </button>
  <button
  type="button"
  onClick={handleSaveCart}
  disabled={savingCart || dirtyCount === 0}
  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
  >
  <FiSave size={16} />
  {savingCart ? "Guardando..." : "Guardar cambios"}
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
 title="Confirmar carrito"
 maxWidth="max-w-lg"
 >
 <div className="space-y-4">
 <p className="text-sm text-slate-700">
 Al confirmar, el carrito quedará bloqueado para edición y empezará el plazo de 48 horas para cargar valores.
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
