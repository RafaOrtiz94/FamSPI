import React, { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiEdit3 } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import Modal from "../../../../../core/ui/components/Modal";

const InvestmentsSection = ({ permissions = {}, ownership = {}, onSave = () => {} }) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const canEdit = permissions.canEdit !== false && ownership?.canUserEdit !== false;
  const role = (user?.role || user?.scope || user?.role_name || "").toLowerCase();
  const canSeePrice = role === "jefe_operaciones" || role === "jefe_de_operaciones";
  const canEditPrice = canEdit && canSeePrice;
  const [searchTerm, setSearchTerm] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [creating, setCreating] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);

  const loadCatalog = async () => {
    if (!bcId) return;
    try {
      setLoading(true);
      const res = await api.get(`/business-case/${bcId}/investments/catalog`);
      const data = res?.data?.data || res?.data || [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading investment catalog", err);
      showToast("No se pudo cargar el catalogo de inversiones", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [bcId]);

  const handleToggle = async (item) => {
    if (!canEdit) return;
    try {
      setSavingId(item.id);
      const nextSelected = !item.selected;
      const res = await api.post(`/business-case/${bcId}/investments/selections`, {
        catalog_id: item.id,
        selected: nextSelected,
        notes: item.notes || null,
        quantity: item.quantity ?? null,
        characteristics: item.characteristics || null,
        unit_price: canEditPrice ? (item.unit_price ?? null) : undefined,
      });
      const saved = res?.data?.data;
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                selected: saved?.selected ?? nextSelected,
                notes: saved?.notes ?? row.notes,
                quantity: saved?.quantity ?? row.quantity,
                characteristics: saved?.characteristics ?? row.characteristics,
                unit_price: saved?.unit_price ?? row.unit_price,
              }
            : row
        )
      );
      if (onSave) onSave();
    } catch (err) {
      console.error("Error saving investment selection", err);
      showToast(err.response?.data?.message || "No se pudo guardar", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleNotesChange = (id, value) => {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, notes: value } : row)));
  };

  const handleNotesSave = async (item) => {
    if (!canEdit) return;
    try {
      setSavingId(item.id);
      await api.post(`/business-case/${bcId}/investments/selections`, {
        catalog_id: item.id,
        selected: item.selected || false,
        notes: item.notes || null,
        quantity: item.quantity ?? null,
        characteristics: item.characteristics || null,
        unit_price: canEditPrice ? (item.unit_price ?? null) : undefined,
      });
      if (onSave) onSave();
    } catch (err) {
      console.error("Error saving notes", err);
      showToast(err.response?.data?.message || "No se pudo guardar la nota", "error");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateCustomInvestment = async () => {
    if (!canEdit || !bcId) return;
    const name = newName.trim();
    if (!name) {
      showToast("Ingresa el nombre de la inversion", "warning");
      return;
    }
    try {
      setCreating(true);
      const res = await api.post(`/business-case/${bcId}/investments/catalog`, {
        name,
        category: newCategory.trim() || null,
        notes: newNotes.trim() || null,
        selected: true,
        unit_price: canEditPrice && newPrice !== "" ? Number(newPrice) : undefined,
      });
      const created = res?.data?.data;
      if (created) {
        setItems((prev) => {
          const exists = prev.some((row) => row.id === created.id);
          if (exists) {
            return prev.map((row) => (row.id === created.id ? { ...row, ...created } : row));
          }
          return [...prev, created];
        });
        setNewName("");
        setNewCategory("");
        setNewNotes("");
        setNewPrice("");
        if (onSave) onSave();
      }
    } catch (err) {
      console.error("Error creating custom investment", err);
      showToast(err.response?.data?.message || "No se pudo crear la inversion", "error");
    } finally {
      setCreating(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    if (!normalizedSearch) return items;
    return items.filter((item) => item.name?.toLowerCase().includes(normalizedSearch));
  }, [items, normalizedSearch]);
  const selectedItems = useMemo(() => items.filter((i) => i.selected), [items]);
  const selectedCount = selectedItems.length;

  const renderSelectedItemCard = (item) => (
    <div key={item.id} className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 accent-emerald-600"
            checked={!!item.selected}
            onChange={() => handleToggle(item)}
            disabled={!canEdit || savingId === item.id}
          />
          <div>
            <div className="text-sm font-semibold text-gray-900">{item.name}</div>
            {item.updated_by_role && (
              <div className="text-xs text-gray-500">
                Actualizado por: {item.updated_by_role}
                {item.updated_by_email ? ` (${item.updated_by_email})` : ""}
              </div>
            )}
          </div>
        </label>
        {item.selected && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
            <FiCheckCircle size={12} />
            Seleccionado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-500">Cantidad requerida</label>
          <input
            type="number"
            min={0}
            value={item.quantity ?? ""}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((row) =>
                  row.id === item.id
                    ? { ...row, quantity: e.target.value === "" ? null : Number(e.target.value) }
                    : row
                )
              )
            }
            disabled={!canEdit}
            placeholder="0"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
          />
        </div>

        {canSeePrice && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500">Precio unitario</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={item.unit_price ?? ""}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.id === item.id
                      ? { ...row, unit_price: e.target.value === "" ? null : Number(e.target.value) }
                      : row
                  )
                )
              }
              disabled={!canEditPrice}
              placeholder="0.00"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs font-semibold text-gray-500">Caracteristicas</label>
          <input
            value={item.characteristics || ""}
            onChange={(e) =>
              setItems((prev) =>
                prev.map((row) => (row.id === item.id ? { ...row, characteristics: e.target.value } : row))
              )
            }
            disabled={!canEdit}
            placeholder="Especificaciones solicitadas"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
          />
        </div>

        <div className="flex flex-col gap-2 md:col-span-3">
          <label className="text-xs font-semibold text-gray-500">Observaciones</label>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              value={item.notes || ""}
              onChange={(e) => handleNotesChange(item.id, e.target.value)}
              disabled={!canEdit}
              placeholder="Detalles adicionales"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 flex-1"
            />
            <button
              type="button"
              onClick={() => handleNotesSave(item)}
              disabled={!canEdit || savingId === item.id}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSearchCard = (item) => (
    <div key={`search-${item.id}`} className="p-4 flex flex-col gap-3 border-b last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{item.name}</div>
          <div className="text-xs text-gray-500">Categoria: {item.category || "Sin categoria"}</div>
        </div>
        <button
          type="button"
          onClick={() => handleToggle(item)}
          disabled={!canEdit || savingId === item.id}
          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500"
        >
          {item.selected ? "Quitar" : "Agregar"}
        </button>
      </div>
      <p className="text-xs text-gray-500">{item.notes || "Pulsa para agregar al listado"}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white border border-gray-100 rounded-2xl shadow-sm">
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Inversiones adicionales</h2>
          <p className="text-sm text-gray-500">Selecciona una o varias inversiones requeridas por el laboratorio</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit">
            {selectedCount} seleccionadas
          </div>
          <button
            type="button"
            onClick={() => setCatalogOpen(true)}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Ver catalogo completo
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-amber-800 text-sm">
          No tienes permisos para editar inversiones en este estado.
        </div>
      )}

      <Modal
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        title="Catalogo de inversiones adicionales"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buscar inversiones</label>
            <input
              type="search"
              placeholder="Nombre, categoria o palabra clave"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-200 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
            />
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Agregar inversion no listada</h3>
              <p className="text-xs text-gray-500">Si no aparece en el catalogo, puedes crearla y quedara disponible para futuros casos.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500">Nombre</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Control externo de tercera opinion"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500">Categoria</label>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ej: Tecnologia / Laboratorio"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-1">
                <label className="text-xs font-semibold text-gray-500">Observaciones</label>
                <input
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Detalles opcionales"
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  disabled={!canEdit}
                />
              </div>
              {canSeePrice && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-gray-500">Precio unitario</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                    disabled={!canEditPrice}
                  />
                </div>
              )}
            </div>
            <div>
              <button
                type="button"
                onClick={handleCreateCustomInvestment}
                disabled={!canEdit || creating}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500"
              >
                {creating ? "Agregando..." : "Agregar inversion"}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
            {!items.length && !loading && (
              <div className="p-6 text-center text-gray-500 text-sm">El catalogo no contiene inversiones adicionales por el momento.</div>
            )}
            {items.length > 0 && (
              <>
                {filteredItems.length ? (
                  filteredItems.map(renderSearchCard)
                ) : (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No se encontraron coincidencias. Intenta con otra palabra clave.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Inversiones anadidas</h3>
        {selectedItems.length ? (
          selectedItems.map((item) => (
            <div key={`selected-${item.id}`} className="bg-white border border-gray-100 rounded-2xl shadow-sm">
              {renderSelectedItemCard(item)}
            </div>
          ))
        ) : (
          <div className="p-6 text-gray-500 text-sm">Aun no has seleccionado ninguna inversion.</div>
        )}
      </div>
    </div>
  );
};

export default InvestmentsSection;
