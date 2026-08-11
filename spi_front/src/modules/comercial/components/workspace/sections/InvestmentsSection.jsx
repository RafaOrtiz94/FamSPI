import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiSave } from "react-icons/fi";
import api from "../../../../../core/api";
import { useParams } from "react-router-dom";
import { useUI } from "../../../../../core/ui/UIContext";
import { useAuth } from "../../../../../core/auth/AuthContext";
import { useAutoEditSection } from "../BusinessCaseWorkspaceContext";
import Modal from "../../../../../core/ui/components/Modal";
import SectionEditorBadge from "../SectionEditorBadge";

// Edicion en paralelo: sin carrito ni dueno por item. Estos son los unicos
// roles que pueden agregar items o cambiar cantidades/caracteristicas (debe
// coincidir con INVESTMENT_EDIT_ROLES en businessCase.controller.js).
const EDIT_ROLES = new Set([
  "acp_comercial",
  "jefe_comercial",
  "jefe_de_comercial",
  "jefe_operaciones",
  "jefe_servicio",
  "jefe_logistica",
]);

const getNaturalErrorMessage = (err, fallback) => {
  const raw = String(err?.response?.data?.message || "").trim();
  const code = String(err?.response?.data?.code || "").trim();
  if (code === "INVESTMENT_STAT_DOCUMENT_REQUIRED") {
    return "Primero se debe cargar el documento de estadistica para habilitar las inversiones.";
  }
  if (code === "INVESTMENT_ROLE_REQUIRED") {
    return "No tienes permisos para editar la lista de inversiones.";
  }
  if (!raw) return fallback;
  if (/\b(4\d\d|5\d\d)\b/.test(raw) || /forbidden|unauthorized|status/i.test(raw)) return fallback;
  return raw;
};

const buildInvestmentBlocker = ({ permissions = {}, ownership = {}, requiresStatDocument, statDocumentUploaded, canEditRole }) => {
  if (requiresStatDocument && !statDocumentUploaded) {
    return {
      code: "INVESTMENT_STAT_DOCUMENT_REQUIRED",
      title: "Documento de estadistica pendiente",
      message: "La lista se habilita cuando el usuario comercial carga el documento de estadistica.",
      detail: "Bloqueante recibido desde ownership.metadata.stat_document_uploaded=false.",
    };
  }
  if (!canEditRole) {
    return {
      code: "INVESTMENT_ROLE_REQUIRED",
      title: "Tu rol no edita inversiones",
      message: "Solo ACP Comercial, Jefe Comercial, Jefe de Operaciones, Jefe de Servicio y Jefe de Logistica pueden editar la lista.",
      detail: "Puedes ver la lista en modo lectura.",
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

const InvestmentsSection = ({ businessCase = {}, permissions = {}, ownership = {}, onSave = () => {} }) => {
  const { id: bcId } = useParams();
  const { showToast } = useUI();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [closingWithoutItems, setClosingWithoutItems] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyWithQuantity, setShowOnlyWithQuantity] = useState(false);
  const [dirtyMap, setDirtyMap] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  useAutoEditSection("investments", () => setIsEditing(true));

  const [qtyModal, setQtyModal] = useState({
    open: false,
    item: null,
    quantity: "",
    characteristics: "",
    notes: "",
    submitting: false,
  });

  const requiresStatDocument = ownership?.metadata?.requires_stat_document === true;
  const statDocumentUploaded = ownership?.metadata?.stat_document_uploaded === true;
  const currentRole = String(user?.role || user?.scope || user?.role_name || "").trim().toLowerCase();
  const canEditRole = EDIT_ROLES.has(currentRole);
  const explicitCanEditInvestments = permissions.canEditInvestments;
  const canEdit = canEditRole
    && ownership?.canUserEdit !== false
    && explicitCanEditInvestments !== false
    && (!requiresStatDocument || statDocumentUploaded);

  const investmentBlocker = useMemo(
    () => !canEdit
      ? buildInvestmentBlocker({ permissions, ownership, requiresStatDocument, statDocumentUploaded, canEditRole })
      : null,
    [canEdit, permissions, ownership, requiresStatDocument, statDocumentUploaded, canEditRole],
  );

  const loadCatalog = useCallback(async () => {
    if (!bcId) return;
    try {
      setLoading(true);
      const res = await api.get(`/business-case/${bcId}/investments/catalog`);
      const payload = res?.data?.data || res?.data || [];
      const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
      setItems(Array.isArray(list) ? list : []);
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

  const openQtyModal = (item) => {
    setQtyModal({
      open: true,
      item,
      quantity: String(item.quantity ?? ""),
      characteristics: item.characteristics || "",
      notes: item.notes || "",
      submitting: false,
    });
  };

  const closeQtyModal = () => {
    if (qtyModal.submitting) return;
    setQtyModal((prev) => ({ ...prev, open: false }));
  };

  const submitQtyModal = () => {
    if (!qtyModal.item) return;
    const currentQty = Number(qtyModal.item.quantity ?? 0);
    const nextQty = Number(qtyModal.quantity);
    if (!Number.isFinite(nextQty) || nextQty <= 0) {
      showToast("Ingresa una cantidad valida.", "warning");
      return;
    }
    if (currentQty > 0 && nextQty < currentQty) {
      showToast("La cantidad no puede disminuir, solo aumentar.", "warning");
      return;
    }
    const characteristics = qtyModal.characteristics.trim();
    if (!characteristics) {
      showToast("Ingresa las caracteristicas de la inversion.", "warning");
      return;
    }
    const targetId = qtyModal.item.id;
    setItems((prev) => prev.map((row) => (row.id === targetId
      ? { ...row, quantity: nextQty, characteristics, notes: qtyModal.notes.trim() || null, selected: true }
      : row)));
    markDirty(targetId);
    setQtyModal({ open: false, item: null, quantity: "", characteristics: "", notes: "", submitting: false });
  };

  const handleSaveDraft = async () => {
    if (!canEdit || !bcId) return;

    const dirtyItems = items.filter((row) => Boolean(dirtyMap[String(row.id)]));
    if (!dirtyItems.length) {
      showToast("No hay cambios pendientes por guardar", "info");
      return;
    }

    try {
      setSavingDraft(true);
      const payload = {
        selections: dirtyItems.map((row) => ({
          catalog_id: row.id,
          notes: row.notes || null,
          quantity: row.quantity ?? null,
          characteristics: row.characteristics || null,
        })),
      };

      await api.post(`/business-case/${bcId}/investments/selections`, payload);
      await loadCatalog();
      setIsEditing(false);
      showToast(`Borrador guardado: ${dirtyItems.length} inversion(es)`, "success");
      onSave();
    } catch (err) {
      console.error("[BusinessCase][Investments] Error saving draft", {
        status: err?.response?.status,
        code: err?.response?.data?.code,
        message: err?.response?.data?.message,
        err,
      });
      showToast(getNaturalErrorMessage(err, "No se pudo guardar el borrador"), "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    loadCatalog();
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    let base = showOnlyWithQuantity ? items.filter((i) => Number(i.quantity) > 0) : items;
    if (!normalizedSearch) return base;
    return base.filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();
      return name.includes(normalizedSearch) || category.includes(normalizedSearch);
    });
  }, [items, normalizedSearch, showOnlyWithQuantity]);

  const withQuantityCount = useMemo(() => items.filter((item) => Number(item.quantity) > 0).length, [items]);
  const dirtyCount = useMemo(() => Object.keys(dirtyMap).length, [dirtyMap]);
  const isClosedWithoutInvestments = Boolean(ownership?.metadata?.no_additional_investments);
  const canCloseWithoutItems = Boolean(canEdit && !isClosedWithoutInvestments && withQuantityCount === 0 && dirtyCount === 0);

  const handleCloseWithoutItems = async () => {
    if (!bcId || !canCloseWithoutItems) return;
    try {
      setClosingWithoutItems(true);
      await api.post(`/business-case/${bcId}/investments/close-without-items`);
      await loadCatalog();
      setIsEditing(false);
      showToast("Inversiones y precios cerrados como no aplica", "success");
      onSave();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo cerrar sin inversiones adicionales", "error");
    } finally {
      setClosingWithoutItems(false);
    }
  };

  const renderInvestmentRow = (item) => {
    const isDirty = Boolean(dirtyMap[String(item.id)]);
    const hasQuantity = Number(item.quantity) > 0;
    return (
      <div key={item.id} className="p-4 flex flex-col gap-2 border-b last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900">{item.name}</div>
          <div className="text-xs text-gray-500">Categoria: {item.category || "Sin categoria"}</div>
          {item.updated_by_role && (
            <div className="text-xs text-gray-500">
              Ultima actualizacion por: {item.updated_by_role}
              {item.updated_by_email ? ` (${item.updated_by_email})` : ""}
            </div>
          )}
          {item.characteristics && (
            <div className="mt-1 text-xs text-gray-600">Caracteristicas: {item.characteristics}</div>
          )}
          {item.notes && (
            <div className="text-xs text-gray-400">Obs: {item.notes}</div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
              isDirty
                ? "text-amber-700 bg-amber-50"
                : hasQuantity
                ? "text-emerald-700 bg-emerald-50"
                : "text-gray-600 bg-gray-100"
            }`}
          >
            {isDirty ? (
              <>
                <FiClock size={12} />
                Pendiente de guardar
              </>
            ) : hasQuantity ? (
              <>
                <FiCheckCircle size={12} />
                En la lista
              </>
            ) : (
              "Sin cantidad"
            )}
          </span>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{item.quantity ?? 0}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">cantidad</div>
          </div>
          <button
            type="button"
            onClick={() => openQtyModal(item)}
            disabled={!canEdit || !isEditing || savingDraft}
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:bg-gray-200 disabled:text-gray-500"
          >
            {hasQuantity ? "Cambiar cantidad" : "Agregar cantidad"}
          </button>
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
            Lista completa de inversiones. ACP Comercial, Jefe Comercial, Jefe de Operaciones, Jefe de Servicio y
            Jefe de Logistica pueden editarla en paralelo — la cantidad de cada item solo puede aumentar.
          </p>
          <div className="mt-2">
            <SectionEditorBadge ownership={ownership} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Editar lista
            </button>
          )}
          <div className="text-xs sm:text-sm font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full w-fit">
            {withQuantityCount} en la lista
          </div>
          <div className="text-xs sm:text-sm font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full w-fit">
            {dirtyCount} pendientes
          </div>
          {isClosedWithoutInvestments && (
            <div className="text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-full w-fit">
              Cerrado sin inversiones
            </div>
          )}
        </div>
      </div>

      {investmentBlocker && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <FiAlertTriangle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-amber-950">{investmentBlocker.title}</div>
              <p className="mt-1 leading-6">{investmentBlocker.message}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        El catalogo de inversiones es fijo. Si necesitas registrar algo que no aparece en la lista, usa el item
        <span className="font-bold"> Otros</span> y detalla las caracteristicas.
      </div>

      {canCloseWithoutItems && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-bold text-blue-950">Este BC no requiere inversiones adicionales</p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Si no se necesita ningun item, cierra esta seccion. Tambien se cerraran automaticamente precios operativos y financieros porque no aplican.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseWithoutItems}
              disabled={closingWithoutItems}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:bg-blue-200"
            >
              <FiCheckCircle size={16} />
              {closingWithoutItems ? "Cerrando..." : "Cerrar sin inversiones adicionales"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buscar inversiones</label>
            <input
              type="search"
              placeholder="Nombre o categoria"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-200 rounded-2xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
            />
          </div>
          <div className="flex rounded-xl overflow-hidden border border-gray-200 self-end">
            <button
              type="button"
              onClick={() => setShowOnlyWithQuantity(false)}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                !showOnlyWithQuantity ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setShowOnlyWithQuantity(true)}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                showOnlyWithQuantity ? "bg-emerald-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              En la lista ({withQuantityCount})
            </button>
          </div>
        </div>

        {!items.length && !loading && (
          <div className="p-6 text-center text-gray-500 text-sm">El catalogo no contiene inversiones adicionales por el momento.</div>
        )}

        {items.length > 0 && (
          filteredItems.length ? (
            filteredItems.map(renderInvestmentRow)
          ) : (
            <div className="p-6 text-center text-gray-500 text-sm">
              {showOnlyWithQuantity
                ? "No hay inversiones con cantidad asignada aun."
                : "No se encontraron coincidencias. Intenta con otra palabra clave."}
            </div>
          )
        )}
      </div>

      {canEdit && (
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-5 lg:-mx-6 -mb-4 sm:-mb-5 lg:-mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-gray-100 bg-white px-4 sm:px-5 lg:px-6 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
          <p className="text-xs text-gray-400 font-medium">
            {isEditing ? "Cambia cantidades o caracteristicas antes de guardar." : "Sección en modo solo lectura."}
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
                onClick={handleSaveDraft}
                disabled={savingDraft || dirtyCount === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm disabled:bg-gray-200 disabled:text-gray-500 transition-colors"
              >
                <FiSave size={16} />
                {savingDraft ? "Guardando..." : "Guardar borrador"}
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
        open={qtyModal.open}
        onClose={closeQtyModal}
        title="Cantidad y caracteristicas"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {qtyModal.item?.name || "Ítem"}
            {Number(qtyModal.item?.quantity) > 0 && (
              <> — cantidad actual: <span className="font-semibold text-slate-900">{Number(qtyModal.item?.quantity)}</span></>
            )}
          </p>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cantidad</label>
            <input
              type="number"
              min={Number(qtyModal.item?.quantity ?? 0)}
              value={qtyModal.quantity}
              onChange={(event) => setQtyModal((prev) => ({ ...prev, quantity: event.target.value }))}
              className="min-h-[44px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caracteristicas</label>
            <textarea
              rows={3}
              value={qtyModal.characteristics}
              onChange={(event) => setQtyModal((prev) => ({ ...prev, characteristics: event.target.value }))}
              className="min-h-[88px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
              placeholder="Especificaciones solicitadas para esta inversion"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Observaciones (opcional)</label>
            <textarea
              rows={2}
              value={qtyModal.notes}
              onChange={(event) => setQtyModal((prev) => ({ ...prev, notes: event.target.value }))}
              className="min-h-[64px] w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-sky-200"
              placeholder="Detalles adicionales"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeQtyModal}
              className="min-h-[44px] rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-transform active:scale-[0.97]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitQtyModal}
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
