import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
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

const InvestmentsSection = ({ permissions = {}, ownership = {} }) => {
 const { id: bcId } = useParams();
 const { showToast } = useUI();
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

 const canEdit = permissions.canEdit !== false && ownership?.canUserEdit !== false;

 const loadCatalog = useCallback(async () => {
 if (!bcId) return;
 try {
 setLoading(true);
 const res = await api.get(`/business-case/${bcId}/investments/catalog`);
 const data = res?.data?.data || res?.data || [];
 setItems(Array.isArray(data) ? data : []);
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
 showToast(`Se guardaron ${dirtyItemsToSave.length} inversiones del carrito`, "success");
 } catch (err) {
 console.error("Error saving investment cart", err);
 showToast(err.response?.data?.message || "No se pudo guardar el carrito de inversiones", "error");
 } finally {
 setSavingCart(false);
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
 return (
 <div key={item.id} className="p-4 flex flex-col gap-3 border-b last:border-b-0">
 <div className="flex items-start justify-between gap-3">
 <label className="flex items-start gap-3 cursor-pointer">
 <input
 type="checkbox"
 className="mt-1 accent-emerald-600"
 checked={!!item.selected}
 onChange={() => handleToggle(item)}
 disabled={!canEdit || savingCart}
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
 disabled={!canEdit || !item.selected || savingCart}
 placeholder="0"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50"
 />
 </div>

 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Caracteristicas</label>
 <input
 value={item.characteristics || ""}
 onChange={(e) => updateItem(item.id, { characteristics: e.target.value })}
 disabled={!canEdit || !item.selected || savingCart}
 placeholder="Especificaciones solicitadas"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:bg-gray-50"
 />
 </div>

 <div className="flex flex-col gap-2 md:col-span-3">
 <label className="text-xs font-semibold text-gray-500">Observaciones</label>
 <input
 value={item.notes || ""}
 onChange={(e) => updateItem(item.id, { notes: e.target.value })}
 disabled={!canEdit || !item.selected || savingCart}
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
 {pendingCreateCount > 0 && (
 <div className="text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full w-fit">
 {pendingCreateCount} nuevos por crear
 </div>
 )}
 {canEdit && (
 <button
 type="button"
 onClick={handleSaveCart}
 disabled={savingCart || dirtyCount === 0}
 className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs sm:text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
 >
 <FiSave size={13} />
 {savingCart ? "Guardando..." : "Guardar cambios"}
 </button>
 )}
 </div>
 </div>

 {!canEdit && (
 <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-800 text-sm">
 No tienes permisos para editar inversiones en este estado.
 </div>
 )}

 <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 space-y-3">
 <div>
 <h3 className="text-sm font-semibold text-gray-900">Agregar inversion no listada</h3>
 <p className="text-xs text-gray-500">Si no aparece en el catalogo, puedes crearla y agregarla al carrito.</p>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Producto / nombre</label>
 <input
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 placeholder="Ej: Control externo"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
 disabled={!canEdit || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2">
 <label className="text-xs font-semibold text-gray-500">Categoria</label>
 <input
 value={newCategory}
 onChange={(e) => setNewCategory(e.target.value)}
 placeholder="Ej: Tecnologia"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
 disabled={!canEdit || savingCart}
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
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
 disabled={!canEdit || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Caracteristicas</label>
 <input
 value={newCharacteristics}
 onChange={(e) => setNewCharacteristics(e.target.value)}
 placeholder="Especificaciones"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
 disabled={!canEdit || savingCart}
 />
 </div>
 <div className="flex flex-col gap-2 md:col-span-2">
 <label className="text-xs font-semibold text-gray-500">Observaciones</label>
 <input
 value={newNotes}
 onChange={(e) => setNewNotes(e.target.value)}
 placeholder="Detalles adicionales"
 className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
 disabled={!canEdit || savingCart}
 />
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 <button
 type="button"
 onClick={handleCreateCustomInvestment}
 disabled={!canEdit || savingCart}
 className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500"
 >
 Agregar al carrito
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
 </div>
 );
};

export default InvestmentsSection;
