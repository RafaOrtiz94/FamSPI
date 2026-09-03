import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiBox,
  FiCheckCircle,
  FiClock,
  FiLayers,
  FiLoader,
  FiPackage,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiShield,
  FiTrash2,
  FiTruck,
  FiUpload,
} from "react-icons/fi";

import { useUI } from "../../../../../core/ui/UIContext";
import {
  addConsumableFileLine,
  cancelConsumableFile,
  cancelConsumableOrder,
  createConsumableFileFromPurchase,
  createConsumableFileSection,
  createConsumableOrder,
  deleteConsumableFileLine,
  dispatchConsumableOrder,
  getConsumableFile,
  getConsumableFileByPurchase,
  importConsumableFileBusinessCase,
  importConsumableFileEquipment,
  registerConsumableFile,
  reviewConsumableOrderExtra,
  searchConsumableCatalog,
  updateConsumableFile,
  updateConsumableFileLine,
  uploadStandaloneConsumableDocument,
} from "../../../../../core/api/consumableFilesApi";
import { buildStandaloneFormStateFromFile } from "../../components/StandaloneConsumableForm";
import TabBadge from "../../components/TabBadge";
import Modal from "../../../../../core/ui/components/Modal";

const ELEVATED_CARD = "rounded-2xl border border-soft-border bg-white shadow-ambient";

// Documentos previos al Control de Consumibles: el proceso (oferta, contrato, inspeccion,
// entrega) ya ocurrio fuera del sistema. Aqui solo se sube evidencia; debe reflejar
// STANDALONE_REQUIRED_DOC_TYPES / STANDALONE_OPTIONAL_DOC_TYPES en consumableFiles.service.js.
const STANDALONE_DOC_SLOTS = [
  { docType: "signed_offer", label: "Oferta firmada por el cliente", required: true },
  { docType: "contract_client_signed", label: "Contrato firmado por el cliente", required: true },
  { docType: "site_inspection_fst07", label: "Inspeccion de ambiente (F.ST-07)", required: true },
  { docType: "delivery_act_fst10", label: "Acta de entrega (F.ST-10)", required: true },
  { docType: "visual_reception_fst14", label: "Evidencia de recepcion visual (F.ST-14)", required: false },
];

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const STATUS_STYLES = {
  draft: "bg-amber-soft text-caution-amber",
  registered: "bg-green-soft text-operative-green",
  cancelled: "bg-red-soft text-alert-red",
  extra_pending: "bg-amber-soft text-caution-amber",
  approved: "bg-blue-100 text-blue-700",
  partially_dispatched: "bg-amber-soft text-caution-amber",
  dispatched: "bg-green-soft text-operative-green",
};

const FILE_STATUS_BADGE = {
  draft: 'pending',
  registered: 'done',
  cancelled: 'blocked',
};

const ORDER_STATUS_BADGE = {
  draft: 'pending',
  submitted: 'pending',
  extra_pending: 'pending',
  approved: 'active',
  partially_dispatched: 'active',
  dispatched: 'done',
  cancelled: 'blocked',
};

const formatNumber = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number % 1 === 0 ? String(number) : number.toFixed(3);
};

const formatStatus = (value) => String(value || "").replace(/_/g, " ");

const slugifySectionCode = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 60);

const currentPeriod = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}`;
};

const extractEquipmentOptions = (purchase) => {
  const seen = new Set();
  return (Array.isArray(purchase?.equipment) ? purchase.equipment : [])
    .map((item) => {
      const equipmentId = item?.equipment_model_id || item?.model_id || item?.id || null;
      if (!equipmentId || seen.has(String(equipmentId))) return null;
      seen.add(String(equipmentId));
      return {
        id: Number(equipmentId),
        label: item?.model || item?.name || item?.equipment_name || `Equipo ${equipmentId}`,
      };
    })
    .filter(Boolean);
};

const EmptyBlock = ({ title, detail, action = null }) => (
  <div className={`${ELEVATED_CARD} flex min-h-[220px] flex-col items-center justify-center gap-3 px-6 py-10 text-center`}>
    <div className="rounded-full bg-slate-100 p-3 text-warm-ash">
      <FiArchive size={22} />
    </div>
    <div className="space-y-1">
      <p className="text-sm font-semibold text-ink-slate">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-warm-ash">{detail}</p>
    </div>
    {action}
  </div>
);

const SummaryField = ({ label, value, className = "" }) => (
  <div className={className}>
    <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-warm-ash">{label}</span>
    <p className="mt-1 text-sm text-ink-slate">{value || "Sin dato"}</p>
  </div>
);

const SectionPill = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-medium transition-colors duration-150 active:scale-[0.97] ${
      active
        ? "bg-action-blue/10 text-action-blue"
        : "bg-slate-100 text-ink-slate hover:bg-slate-200"
    }`}
  >
    {label}
  </button>
);

const ConsumableFilesTab = ({ purchase, type, userRoles = [], fileId = null }) => {
  const { showToast } = useUI();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [processNameDraft, setProcessNameDraft] = useState("");
  const [processCodeDraft, setProcessCodeDraft] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [boxQtyDraft, setBoxQtyDraft] = useState("1");
  const [equipmentBoxQtyDraft, setEquipmentBoxQtyDraft] = useState("1");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [orderPeriod, setOrderPeriod] = useState(currentPeriod);
  const [orderNotes, setOrderNotes] = useState("");
  const [orderDrafts, setOrderDrafts] = useState({});
  const [dispatchDrafts, setDispatchDrafts] = useState({});
  const [dispatchNotesDrafts, setDispatchNotesDrafts] = useState({});
  const [sectionLabelDraft, setSectionLabelDraft] = useState("");
  const [extraApprovalDrafts, setExtraApprovalDrafts] = useState({});
  const [standaloneDraft, setStandaloneDraft] = useState(() => buildStandaloneFormStateFromFile(null));
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  const equipmentOptions = useMemo(() => extractEquipmentOptions(purchase), [purchase]);
  const isOpsReviewer = userRoles.some((role) => ["jefe_operaciones", "gerencia", "gerencia_general"].includes(role));
  const isLogisticsReviewer = userRoles.some((role) => ["jefe_logistica", "logistica", "gerencia", "gerencia_general"].includes(role));
  const canManageLifecycle = userRoles.some((role) => ["jefe_operaciones", "jefe_logistica", "gerencia", "gerencia_general"].includes(role));

  const purchaseLink = useMemo(() => ({
    purchaseType: type,
    purchaseRequestId: purchase?.id,
  }), [purchase?.id, type]);
  const isStandaloneMode = Boolean(fileId);

  const activeSection = useMemo(
    () => detail?.sections?.find((section) => section.id === activeSectionId) || detail?.sections?.[0] || null,
    [activeSectionId, detail?.sections],
  );
  // Solo se muestran reactivos/calibradores/controles/materiales con cantidad maxima
  // confirmada; los que quedaron en 0 (sincronizados desde equipo, sin BC aplicado todavia)
  // no aportan nada visible hasta tener un dato real.
  const linesWithMaxQuantity = useMemo(
    () => (activeSection?.lines || []).filter((line) => Number(line.max_units) > 0),
    [activeSection?.lines],
  );

  const loadDetail = useCallback(async () => {
    if (isStandaloneMode) {
      setLoading(true);
      setError(null);
      try {
        const data = await getConsumableFile(fileId);
        setDetail(data);
        const nextFile = data?.file || null;
        setProcessNameDraft(nextFile?.process_name || "");
        setProcessCodeDraft(nextFile?.process_code || "");
        setStandaloneDraft(buildStandaloneFormStateFromFile(nextFile));
        setActiveSectionId((current) => {
          if (current && data?.sections?.some((section) => section.id === current)) return current;
          return data?.sections?.[0]?.id || null;
        });
      } catch (loadError) {
        setError(loadError?.response?.data?.message || loadError?.message || "No se pudo cargar el expediente de consumibles");
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!purchaseLink.purchaseRequestId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getConsumableFileByPurchase(purchaseLink);
      setDetail(data);
      const nextFile = data?.file || null;
      setProcessNameDraft(nextFile?.process_name || "");
      setProcessCodeDraft(nextFile?.process_code || "");
      setStandaloneDraft(buildStandaloneFormStateFromFile(nextFile));
      setActiveSectionId((current) => {
        if (current && data?.sections?.some((section) => section.id === current)) return current;
        return data?.sections?.[0]?.id || null;
      });
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || "No se pudo cargar el expediente de consumibles");
    } finally {
      setLoading(false);
    }
  }, [fileId, isStandaloneMode, purchaseLink]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    let cancelled = false;
    if (!catalogQuery || catalogQuery.trim().length < 2) {
      setCatalogResults([]);
      return () => {};
    }
    const timer = setTimeout(async () => {
      setCatalogLoading(true);
      try {
        const rows = await searchConsumableCatalog({ q: catalogQuery, limit: 12 });
        if (!cancelled) setCatalogResults(rows);
      } catch (catalogError) {
        if (!cancelled) {
          showToast(catalogError?.response?.data?.message || catalogError?.message || "No se pudo buscar en el catalogo", "error");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [catalogQuery, showToast]);

  const handleCreate = async () => {
    if (isStandaloneMode) return;
    setSubmitting(true);
    try {
      const nextDetail = await createConsumableFileFromPurchase({
        ...purchaseLink,
        processName: processNameDraft || undefined,
      });
      setDetail(nextDetail);
      setProcessNameDraft(nextDetail.file.process_name || "");
      setProcessCodeDraft(nextDetail.file.process_code || "");
      setActiveSectionId(nextDetail.sections?.[0]?.id || null);
      showToast("Expediente de consumibles creado", "success");
    } catch (createError) {
      showToast(createError?.response?.data?.message || createError?.message || "No se pudo crear el expediente", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const refreshDetailState = (nextDetail) => {
    setDetail(nextDetail);
    setProcessNameDraft(nextDetail?.file?.process_name || "");
    setProcessCodeDraft(nextDetail?.file?.process_code || "");
    setStandaloneDraft(buildStandaloneFormStateFromFile(nextDetail?.file || null));
    setActiveSectionId((current) => {
      if (current && nextDetail?.sections?.some((section) => section.id === current)) return current;
      return nextDetail?.sections?.[0]?.id || null;
    });
  };

  const handleSaveHeader = async () => {
    if (!detail?.file?.id) return;
    if (isStandaloneMode) {
      if (!standaloneDraft.processName.trim()) {
        showToast("Debes ingresar un nombre de proceso", "error");
        return;
      }
      if (!standaloneDraft.contractingEntity.trim() && !(standaloneDraft.sameEntityAsClient && standaloneDraft.clientId)) {
        showToast("Debes completar la entidad contratante o vincularla con el cliente", "error");
        return;
      }
      if (!standaloneDraft.contractObject.trim()) {
        showToast("Debes ingresar el objeto de contratacion", "error");
        return;
      }
      if (!standaloneDraft.equipmentIds.length) {
        showToast("Debes seleccionar al menos un equipo", "error");
        return;
      }
    }
    setSubmitting(true);
    try {
      const nextDetail = await updateConsumableFile(detail.file.id, {
        process_name: isStandaloneMode ? standaloneDraft.processName : processNameDraft,
        process_code: isStandaloneMode ? standaloneDraft.processCode : processCodeDraft,
        ...(isStandaloneMode ? {
          client_id: standaloneDraft.clientId,
          contracting_entity: standaloneDraft.contractingEntity,
          same_entity_as_client: standaloneDraft.sameEntityAsClient,
          contract_object: standaloneDraft.contractObject,
          equipment_ids: standaloneDraft.equipmentIds,
        } : {}),
      });
      refreshDetailState(nextDetail);
      showToast("Cabecera actualizada", "success");
    } catch (saveError) {
      showToast(saveError?.response?.data?.message || saveError?.message || "No se pudo guardar la cabecera", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!detail?.file?.id) return;
    setSubmitting(true);
    try {
      const nextDetail = await registerConsumableFile(detail.file.id);
      refreshDetailState(nextDetail);
      showToast("Expediente registrado. Ahora queda congelado.", "success");
    } catch (registerError) {
      showToast(registerError?.response?.data?.message || registerError?.message || "No se pudo registrar el expediente", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAdd = async (item) => {
    if (!activeSection?.id) return;
    setSubmitting(true);
    try {
      await addConsumableFileLine(activeSection.id, {
        catalog_consumable_id: item.id,
        box_qty: Number(boxQtyDraft || 1),
      });
      await loadDetail();
      showToast("Linea agregada al subexpediente", "success");
    } catch (addError) {
      showToast(addError?.response?.data?.message || addError?.message || "No se pudo agregar la linea", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportEquipment = async () => {
    if (!activeSection?.id || !selectedEquipmentId) return;
    setSubmitting(true);
    try {
      const nextDetail = await importConsumableFileEquipment(activeSection.id, {
        equipment_id: Number(selectedEquipmentId),
        box_qty: Number(equipmentBoxQtyDraft || 1),
      });
      refreshDetailState(nextDetail);
      showToast("Consumibles importados desde el equipo", "success");
    } catch (importError) {
      showToast(importError?.response?.data?.message || importError?.message || "No se pudo importar desde el equipo", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSection = async () => {
    if (!detail?.file?.id) return;
    const label = sectionLabelDraft.trim();
    const areaCode = slugifySectionCode(label);
    if (!label || !areaCode) {
      showToast("Debes ingresar un nombre valido para el subexpediente", "error");
      return;
    }
    setSubmitting(true);
    try {
      await createConsumableFileSection(detail.file.id, {
        label,
        area_code: areaCode,
        sort_order: (detail.sections?.length || 0) * 10 + 10,
      });
      await loadDetail();
      setSectionLabelDraft("");
      showToast("Subexpediente creado", "success");
    } catch (sectionError) {
      showToast(sectionError?.response?.data?.message || sectionError?.message || "No se pudo crear el subexpediente", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportBusinessCase = async () => {
    if (!activeSection?.id) return;
    setSubmitting(true);
    try {
      const nextDetail = await importConsumableFileBusinessCase(activeSection.id);
      refreshDetailState(nextDetail);
      showToast("Consumos del business case importados al subexpediente", "success");
    } catch (importError) {
      showToast(importError?.response?.data?.message || importError?.message || "No se pudo importar desde business case", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLine = async (line, patch) => {
    setSubmitting(true);
    try {
      await updateConsumableFileLine(line.id, patch);
      await loadDetail();
      showToast("Linea actualizada", "success");
    } catch (lineError) {
      showToast(lineError?.response?.data?.message || lineError?.message || "No se pudo actualizar la linea", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLine = async (lineId) => {
    setSubmitting(true);
    try {
      await deleteConsumableFileLine(lineId);
      await loadDetail();
      showToast("Linea eliminada", "success");
    } catch (deleteError) {
      showToast(deleteError?.response?.data?.message || deleteError?.message || "No se pudo eliminar la linea", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!detail?.file?.id) return;
    const payloadLines = (detail.sections || [])
      .flatMap((section) => section.lines || [])
      .map((line) => ({
        consumable_file_line_id: line.id,
        requested_new_units: Number(orderDrafts[line.id] || 0),
      }))
      .filter((line) => line.requested_new_units > 0 || Number((detail.sections || []).flatMap((section) => section.lines || []).find((row) => row.id === line.consumable_file_line_id)?.carryover_units || 0) > 0);

    if (!payloadLines.length) {
      showToast("Debes ingresar cantidades para el pedido mensual", "error");
      return;
    }

    setSubmitting(true);
    try {
      const nextDetail = await createConsumableOrder(detail.file.id, {
        period: orderPeriod,
        notes: orderNotes,
        lines: payloadLines,
      });
      refreshDetailState(nextDetail);
      setOrderDrafts({});
      setOrderNotes("");
      setOrderModalOpen(false);
      showToast("Pedido mensual enviado", "success");
    } catch (orderError) {
      showToast(orderError?.response?.data?.message || orderError?.message || "No se pudo crear el pedido", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewExtra = async (orderId, decision) => {
    setSubmitting(true);
    try {
      const order = detail?.orders?.find((row) => row.id === orderId);
      const lines = (order?.lines || [])
        .filter((line) => Number(line.extra_requested_units || 0) > 0)
        .map((line) => ({
          order_line_id: line.id,
          approved_extra_units: Number(
            extraApprovalDrafts[`${orderId}:${line.id}`]
            ?? line.extra_requested_units
            ?? 0,
          ),
        }));
      const nextDetail = await reviewConsumableOrderExtra(orderId, { decision, lines });
      refreshDetailState(nextDetail);
      showToast(
        decision === "approved" ? "Excedente aprobado" : "Excedente rechazado",
        "success",
      );
    } catch (reviewError) {
      showToast(reviewError?.response?.data?.message || reviewError?.message || "No se pudo revisar el excedente", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispatch = async (order) => {
    const lines = (order.lines || []).map((line) => ({
      order_line_id: line.id,
      sent_units: Number(dispatchDrafts[`${order.id}:${line.id}`] ?? line.remaining_dispatch_units ?? 0),
    }));
    setSubmitting(true);
    try {
      const nextDetail = await dispatchConsumableOrder(order.id, {
        lines,
        notes: dispatchNotesDrafts[order.id] || "",
      });
      refreshDetailState(nextDetail);
      showToast("Despacho registrado", "success");
    } catch (dispatchError) {
      showToast(dispatchError?.response?.data?.message || dispatchError?.message || "No se pudo registrar el despacho", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadStandaloneDocument = async (docType, file) => {
    if (!detail?.file?.id || !file) return;
    setSubmitting(true);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const nextDetail = await uploadStandaloneConsumableDocument(detail.file.id, {
        docType,
        fileBase64,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
      });
      refreshDetailState(nextDetail);
      showToast("Documento subido", "success");
    } catch (uploadError) {
      showToast(uploadError?.response?.data?.message || uploadError?.message || "No se pudo subir el documento", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelFile = async () => {
    if (!detail?.file?.id) return;
    const reason = window.prompt("Motivo de cancelacion del expediente");
    if (reason === null) return;
    setSubmitting(true);
    try {
      const nextDetail = await cancelConsumableFile(detail.file.id, { reason });
      refreshDetailState(nextDetail);
      showToast("Expediente cancelado", "success");
    } catch (cancelError) {
      showToast(cancelError?.response?.data?.message || cancelError?.message || "No se pudo cancelar el expediente", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const reason = window.prompt("Motivo de cancelacion del pedido");
    if (reason === null) return;
    setSubmitting(true);
    try {
      const nextDetail = await cancelConsumableOrder(orderId, { reason });
      refreshDetailState(nextDetail);
      showToast("Pedido cancelado", "success");
    } catch (cancelError) {
      showToast(cancelError?.response?.data?.message || cancelError?.message || "No se pudo cancelar el pedido", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const fileStatus = detail?.file?.status || "draft";
  // Debe reflejar FILE_EDIT_ROLES en consumableFiles.service.js: antes solo
  // se chequeaba el status, asi que operaciones/logistica (viewerRoles) veian
  // y podian click los botones de editar/crear/pedido aunque el backend
  // siempre los rechaza con 403.
  const isFileEditor = userRoles.some((role) => [
    "comercial", "asesor_comercial", "analista_comercial",
    "backoffice", "backoffice_comercial", "acp_comercial",
    "jefe_comercial", "jefe_de_comercial", "gerencia", "gerencia_general",
  ].includes(role));
  const canEditFile = fileStatus === "draft" && isFileEditor;
  const allLines = (detail?.sections || []).flatMap((section) => section.lines || []);
  const operationalInsights = useMemo(() => {
    const sectionById = new Map((detail?.sections || []).map((section) => [section.id, section.label]));
    const maxedLines = allLines
      .filter((line) => Number(line.available_units || 0) <= 0)
      .map((line) => ({
        ...line,
        section_label: sectionById.get(line.section_id) || "Sin area",
      }));
    const carryoverLines = allLines
      .filter((line) => Number(line.carryover_units || 0) > 0)
      .map((line) => ({
        ...line,
        section_label: sectionById.get(line.section_id) || "Sin area",
      }))
      .sort((a, b) => Number(b.carryover_units || 0) - Number(a.carryover_units || 0));
    const extraPendingOrders = (detail?.orders || []).filter((order) => order.status === "extra_pending");
    const dispatchQueue = (detail?.orders || []).filter((order) => ["approved", "partially_dispatched"].includes(order.status));
    const remainingDispatchLines = dispatchQueue
      .flatMap((order) => (order.lines || []).map((line) => {
        const sourceLine = allLines.find((row) => row.id === line.consumable_file_line_id);
        return {
          order_id: order.id,
          order_period: order.period,
          item_name: sourceLine?.item_name || `Linea ${line.consumable_file_line_id}`,
          section_label: sourceLine ? sectionById.get(sourceLine.section_id) || "Sin area" : "Sin area",
          remaining_dispatch_units: Number(line.remaining_dispatch_units || 0),
        };
      }))
      .filter((line) => line.remaining_dispatch_units > 0)
      .sort((a, b) => b.remaining_dispatch_units - a.remaining_dispatch_units);
    return {
      maxedLines,
      carryoverLines,
      extraPendingOrders,
      dispatchQueue,
      remainingDispatchLines,
    };
  }, [allLines, detail?.orders, detail?.sections]);

  const standaloneDocuments = detail?.file?.metadata?.standalone?.documents || {};
  const missingRequiredDocs = STANDALONE_DOC_SLOTS.filter((slot) => slot.required && !standaloneDocuments[slot.docType]?.file_id);

  const TabHeader = () => (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 -mx-6 -mt-6 mb-6 rounded-t-2xl">
      <div>
        <h2 className="text-lg font-semibold text-ink-slate">Control de Insumos</h2>
        <p className="text-xs text-warm-ash mt-0.5">Consumibles, pedidos mensuales y despacho</p>
      </div>
      {detail?.file && <TabBadge variant={FILE_STATUS_BADGE[fileStatus] || 'na'} label={formatStatus(fileStatus)} />}
    </div>
  );

  if (loading) {
    return (
      <div className="p-6">
        <TabHeader />
        <div className={`${ELEVATED_CARD} flex min-h-[320px] items-center justify-center`}>
          <div className="flex items-center gap-2 text-sm text-warm-ash">
            <FiLoader className="animate-spin text-action-blue" />
            Cargando expediente de consumibles...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <TabHeader />
        <div className={`${ELEVATED_CARD} flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 text-center`}>
          <div className="rounded-full bg-red-soft p-3 text-alert-red">
            <FiAlertCircle size={24} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink-slate">No se pudo cargar el expediente</p>
            <p className="text-xs text-warm-ash">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadDetail}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-soft-border bg-white px-4 text-sm font-medium text-ink-slate hover:bg-paper-white active:scale-[0.97]"
          >
            <FiRefreshCw size={14} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!detail?.file) {
    return (
      <div className="p-6">
        <TabHeader />
        <EmptyBlock
          title="Aun no existe un expediente de consumibles"
          detail={isStandaloneMode
            ? "No se encontro el expediente de Control de Consumibles solicitado."
            : "Desde este mismo tab puedes crear el expediente ligado a esta compra, estructurar subexpedientes por area y congelar la base para los pedidos mensuales."}
          action={(
            !isStandaloneMode && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? <FiLoader className="animate-spin" size={14} /> : <FiPlus size={14} />}
              Crear expediente
            </button>
            )
          )}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <TabHeader />
      <div className="space-y-6">
      <section className={`${ELEVATED_CARD} overflow-hidden`}>
        <div className="border-b border-soft-border bg-paper-white px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-warm-ash">Expediente de consumibles</span>
                <TabBadge variant={FILE_STATUS_BADGE[fileStatus] || 'na'} label={formatStatus(fileStatus)} />
              </div>
              <h3 className="text-[20px] font-semibold tracking-tight text-ink-slate">{detail.file.process_name}</h3>
              <p className="text-xs text-warm-ash">
                {detail.file.purchase_type === "public" ? "Compra publica" : "Compra privada"} · {formatNumber(detail.file.summary?.total_lines || 0)} lineas base · {formatNumber(detail.file.summary?.total_orders || 0)} pedidos
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-soft-border bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-warm-ash">Lineas</p>
                <p className="mt-1 text-lg font-semibold text-ink-slate">{formatNumber(detail.file.summary?.total_lines || 0)}</p>
              </div>
              <div className="rounded-2xl border border-soft-border bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-warm-ash">Maximo base</p>
                <p className="mt-1 text-lg font-semibold text-ink-slate">{formatNumber(detail.file.summary?.total_max_units || 0)}</p>
              </div>
              <div className="rounded-2xl border border-soft-border bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-warm-ash">Pend. extra</p>
                <p className="mt-1 text-lg font-semibold text-ink-slate">{formatNumber(detail.file.summary?.orders_pending_extra || 0)}</p>
              </div>
              <div className="rounded-2xl border border-soft-border bg-white px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.08em] text-warm-ash">Parciales</p>
                <p className="mt-1 text-lg font-semibold text-ink-slate">{formatNumber(detail.file.summary?.orders_partial || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {isStandaloneMode && (
            <div className={`${ELEVATED_CARD} space-y-3 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-ink-slate">Documentos previos (proceso realizado fuera del sistema)</h4>
                  <p className="text-xs text-warm-ash">
                    Sube la evidencia de lo ya ocurrido. El Control de Consumibles solo se habilita cuando estan los obligatorios.
                  </p>
                </div>
                {missingRequiredDocs.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    <FiAlertCircle size={12} /> Faltan {missingRequiredDocs.length}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    <FiCheckCircle size={12} /> Completo
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {STANDALONE_DOC_SLOTS.map((slot) => {
                  const uploaded = standaloneDocuments[slot.docType];
                  return (
                    <div key={slot.docType} className="flex items-center justify-between gap-2 rounded-xl border border-soft-border bg-paper-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink-slate">
                          {slot.label}{slot.required ? " *" : " (opcional)"}
                        </p>
                        <p className="truncate text-[11px] text-warm-ash">
                          {uploaded?.file_name || "Sin subir"}
                        </p>
                      </div>
                      {canEditFile && (
                        <label className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-soft-border bg-white px-3 text-[11px] font-medium text-ink-slate hover:bg-paper-white active:scale-[0.97]">
                          <FiUpload size={12} />
                          {uploaded ? "Reemplazar" : "Subir"}
                          <input
                            type="file"
                            className="hidden"
                            disabled={submitting}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              if (file) handleUploadStandaloneDocument(slot.docType, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {isStandaloneMode ? (
            <div className="grid gap-4 rounded-2xl border border-soft-border bg-paper-white p-4 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryField label="Nombre del proceso" value={detail.file.process_name} />
              <SummaryField label="Codigo del proceso" value={detail.file.process_code} />
              <SummaryField label="Entidad contratante" value={standaloneDraft.contractingEntity} />
              <SummaryField label="Cliente" value={standaloneDraft.clientLabel || "Sin cliente vinculado"} />
              <SummaryField label="Objeto de contratacion" value={standaloneDraft.contractObject} className="sm:col-span-2 lg:col-span-3" />
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-warm-ash">Equipos vinculados</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(detail.file.metadata?.standalone?.selected_equipment || []).map((equipment) => (
                    <span key={equipment.id} className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                      <FiPackage size={12} />
                      {equipment.label}
                    </span>
                  ))}
                  {!(detail.file.metadata?.standalone?.selected_equipment || []).length && (
                    <span className="text-xs text-warm-ash">Sin equipos vinculados.</span>
                  )}
                </div>
              </div>
              <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-warm-ash">
                Estos datos quedan fijos desde la creacion del expediente para preservar la trazabilidad.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_auto]">
              <label className="space-y-2">
                <span className="text-xs font-medium text-ink-slate">Nombre del proceso</span>
                <input
                  value={processNameDraft}
                  onChange={(event) => setProcessNameDraft(event.target.value)}
                  disabled={!canEditFile || submitting}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20 disabled:bg-paper-white disabled:text-warm-ash"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-ink-slate">Codigo del proceso</span>
                <input
                  value={processCodeDraft}
                  onChange={(event) => setProcessCodeDraft(event.target.value)}
                  disabled={!canEditFile || submitting}
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20 disabled:bg-paper-white disabled:text-warm-ash"
                />
              </label>
              <div className="flex items-end gap-2">
                {canEditFile && (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveHeader}
                      disabled={submitting}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-soft-border bg-white px-4 text-sm font-medium text-ink-slate hover:bg-paper-white active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                    >
                      {submitting ? <FiLoader className="animate-spin" size={14} /> : <FiCheckCircle size={14} />}
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={handleRegister}
                      disabled={submitting}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                    >
                      <FiShield size={14} />
                      Registrar
                    </button>
                    {canManageLifecycle && (
                      <button
                        type="button"
                        onClick={handleCancelFile}
                        disabled={submitting}
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                      >
                        <FiAlertCircle size={14} />
                        Cancelar
                      </button>
                    )}
                  </>
                )}
                {!canEditFile && canManageLifecycle && fileStatus !== "cancelled" && (
                  <button
                    type="button"
                    onClick={handleCancelFile}
                    disabled={submitting}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                  >
                    <FiAlertCircle size={14} />
                    Cancelar expediente
                  </button>
                )}
              </div>
            </div>
          )}
          {isStandaloneMode && (
            <div className="flex flex-wrap justify-end gap-2">
              {canEditFile && (
                <>
                  <button
                    type="button"
                    onClick={handleRegister}
                    disabled={submitting || missingRequiredDocs.length > 0}
                    title={missingRequiredDocs.length ? "Completa los documentos obligatorios antes de registrar" : undefined}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                  >
                    <FiShield size={14} />
                    Registrar
                  </button>
                  {canManageLifecycle && (
                    <button
                      type="button"
                      onClick={handleCancelFile}
                      disabled={submitting}
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                    >
                      <FiAlertCircle size={14} />
                      Cancelar
                    </button>
                  )}
                </>
              )}
              {!canEditFile && canManageLifecycle && fileStatus !== "cancelled" && (
                <button
                  type="button"
                  onClick={handleCancelFile}
                  disabled={submitting}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                >
                  <FiAlertCircle size={14} />
                  Cancelar expediente
                </button>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(detail.sections || []).map((section) => (
              <SectionPill
                key={section.id}
                active={section.id === activeSection?.id}
                label={`${section.label} (${section.lines?.length || 0})`}
                onClick={() => {
                  setActiveSectionId(section.id);
                  setSectionModalOpen(true);
                }}
              />
            ))}
          </div>

          {canEditFile && (
            <div className="grid gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="space-y-2">
                <span className="text-xs font-medium text-ink-slate">Nuevo subexpediente</span>
                <input
                  value={sectionLabelDraft}
                  onChange={(event) => setSectionLabelDraft(event.target.value)}
                  placeholder="Ej. Hematologia, gases arteriales, microbiologia"
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleCreateSection}
                  disabled={!sectionLabelDraft.trim() || submitting}
                  className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-soft-border bg-white px-4 text-sm font-medium text-ink-slate hover:bg-paper-white active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiPlus size={14} />
                  Agregar subexpediente
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Modal
        open={sectionModalOpen && Boolean(activeSection)}
        onClose={() => setSectionModalOpen(false)}
        title={activeSection ? `Subexpediente: ${activeSection.label}` : "Subexpediente"}
        maxWidth="max-w-6xl"
      >
      <div className="space-y-5">
      {detail?.file && (
        <TabBadge variant={FILE_STATUS_BADGE[fileStatus] || 'na'} label={formatStatus(fileStatus)} />
      )}
      {canEditFile && activeSection && (
        <section className={`grid gap-5 ${detail.file.business_case_id && equipmentOptions.length
          ? "xl:grid-cols-3"
          : equipmentOptions.length
          ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
          : "xl:grid-cols-2"}`}>
          <div className={`${ELEVATED_CARD} p-5`}>
            <div className="mb-4 flex items-center gap-2">
              <FiSearch className="text-action-blue" size={16} />
              <h4 className="text-base font-semibold text-ink-slate">Agregar desde catalogo</h4>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_120px]">
              <label className="space-y-2">
                <span className="text-xs font-medium text-ink-slate">Buscar consumible, calibrador o control</span>
                <input
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="Nombre o codigo del proveedor"
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-medium text-ink-slate">Cajas</span>
                <input
                  value={boxQtyDraft}
                  onChange={(event) => setBoxQtyDraft(event.target.value)}
                  type="number"
                  min="1"
                  step="0.001"
                  className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                />
              </label>
            </div>
            <div className="mt-4 space-y-2">
              {catalogLoading ? (
                <div className="flex min-h-[120px] items-center justify-center text-sm text-warm-ash">
                  <FiLoader className="mr-2 animate-spin text-action-blue" />
                  Buscando en el catalogo...
                </div>
              ) : catalogResults.length ? (
                catalogResults.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-soft-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-slate">{item.name}</span>
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_STYLES.approved}`}>
                          {item.type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-warm-ash">
                        Presentacion base: {formatNumber(item.units_per_kit || 1)} · Codigo proveedor: {item.supplier_code || "N/D"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickAdd(item)}
                      disabled={submitting}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
                    >
                      <FiPlus size={14} />
                      Agregar
                    </button>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-warm-ash">
                  Escribe al menos 2 caracteres para buscar en el catalogo.
                </p>
              )}
            </div>
          </div>

          {equipmentOptions.length > 0 && (
            <div className={`${ELEVATED_CARD} p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <FiLayers className="text-action-blue" size={16} />
                <h4 className="text-base font-semibold text-ink-slate">Importar desde equipo</h4>
              </div>
              <div className="space-y-3">
                <label className="space-y-2">
                  <span className="text-xs font-medium text-ink-slate">Equipo de la compra</span>
                  <select
                    value={selectedEquipmentId}
                    onChange={(event) => setSelectedEquipmentId(event.target.value)}
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                  >
                    <option value="">Selecciona un equipo</option>
                    {equipmentOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-medium text-ink-slate">Cantidad de cajas</span>
                  <input
                    value={equipmentBoxQtyDraft}
                    onChange={(event) => setEquipmentBoxQtyDraft(event.target.value)}
                    type="number"
                    min="1"
                    step="0.001"
                    className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleImportEquipment}
                  disabled={!selectedEquipmentId || submitting}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiBox size={14} />
                  Importar consumibles vinculados
                </button>
              </div>
            </div>
          )}

          {detail.file.business_case_id && (
            <div className={`${ELEVATED_CARD} p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <FiRefreshCw className="text-action-blue" size={16} />
                <h4 className="text-base font-semibold text-ink-slate">Traer consumos del business case</h4>
              </div>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-600">
                  Usa los consumos ya definidos en el business case como base del subexpediente activo. La importacion actualiza cantidades maximas y conserva el vinculo para trazabilidad.
                </p>
                <div className="rounded-2xl border border-soft-border bg-paper-white px-4 py-3 text-xs text-warm-ash">
                  BC vinculado: <span className="font-mono text-ink-slate">{detail.file.business_case_id}</span>
                </div>
                <button
                  type="button"
                  onClick={handleImportBusinessCase}
                  disabled={submitting}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiRefreshCw size={14} />
                  Importar consumos BC
                </button>
              </div>
            </div>
          )}

        </section>
      )}

      <section className={`${ELEVATED_CARD} overflow-hidden`}>
        <div className="border-b border-soft-border bg-paper-white px-5 py-4">
          <div className="flex items-center gap-2">
            <FiPackage className="text-action-blue" size={16} />
            <h4 className="text-base font-semibold text-ink-slate">Lineas base</h4>
          </div>
        </div>

        {!linesWithMaxQuantity.length ? (
          <div className="px-5 py-10">
            <EmptyBlock
              title="Este subexpediente aun no tiene lineas con cantidad maxima"
              detail="Los insumos aparecen aqui cuando tienen una cantidad maxima confirmada (desde el business case o cargada manualmente)."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-paper-white text-warm-ash">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">DET/KIT</th>
                  <th className="px-4 py-3 text-right font-semibold">Cantidades maximas / caja</th>
                  <th className="px-4 py-3 text-right font-semibold">Cantidades maximas / unidades</th>
                  {canEditFile && <th className="px-4 py-3 text-right font-semibold">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-soft-border">
                {linesWithMaxQuantity.map((line) => (
                  <tr key={line.id} className="hover:bg-paper-white">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-slate">{line.item_name}</div>
                      <div className="text-xs text-warm-ash">{line.source_type}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink-slate">{formatNumber(line.units_per_box)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-slate">{formatNumber(line.box_qty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-slate">{formatNumber(line.max_units)}</td>
                    {canEditFile && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateLine(line, { box_qty: Number(line.box_qty || 0) + 1 })}
                            disabled={submitting}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-soft-border px-3 text-xs font-medium text-ink-slate hover:bg-paper-white active:scale-[0.97]"
                          >
                            +1 caja
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLine(line.id)}
                            disabled={submitting}
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-soft px-3 text-xs font-medium text-alert-red hover:bg-red-soft active:scale-[0.97]"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
      </Modal>

      {(isOpsReviewer || isLogisticsReviewer) && (
        <section className={`${ELEVATED_CARD} p-5`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FiActivity className="text-action-blue" size={16} />
                <h4 className="text-base font-semibold text-ink-slate">Tablero operativo</h4>
              </div>
              <p className="mt-1 text-sm text-warm-ash">
                Resumen de faltantes, excedentes y lineas que ya agotaron su cupo base dentro de este expediente.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-amber-700">Extras pendientes</p>
              <p className="mt-1 text-lg font-semibold text-amber-900">{operationalInsights.extraPendingOrders.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-blue-700">Pedidos por despachar</p>
              <p className="mt-1 text-lg font-semibold text-blue-900">{operationalInsights.dispatchQueue.length}</p>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-orange-700">Faltantes acumulados</p>
              <p className="mt-1 text-lg font-semibold text-orange-900">{operationalInsights.remainingDispatchLines.length}</p>
            </div>
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.08em] text-green-700">Lineas al maximo</p>
              <p className="mt-1 text-lg font-semibold text-green-800">{operationalInsights.maxedLines.length}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-soft-border bg-white p-4">
              <h5 className="text-sm font-semibold text-ink-slate">Excedentes en revision</h5>
              <div className="mt-3 space-y-2">
                {operationalInsights.extraPendingOrders.length ? operationalInsights.extraPendingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-amber-900">Pedido #{order.id}</span>
                      <span className="text-xs text-amber-700">Periodo {order.period}</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-900">
                      {(order.lines || []).filter((line) => Number(line.extra_requested_units || 0) > 0).length} lineas con excedente.
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-warm-ash">No hay excedentes pendientes en este expediente.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-soft-border bg-white p-4">
              <h5 className="text-sm font-semibold text-ink-slate">Faltantes por entregar</h5>
              <div className="mt-3 space-y-2">
                {operationalInsights.remainingDispatchLines.length ? operationalInsights.remainingDispatchLines.slice(0, 6).map((line) => (
                  <div key={`${line.order_id}:${line.item_name}`} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-orange-900">{line.item_name}</span>
                      <span className="font-mono text-xs text-orange-700">{formatNumber(line.remaining_dispatch_units)}</span>
                    </div>
                    <p className="mt-1 text-xs text-orange-900">
                      Pedido #{line.order_id} · {line.order_period} · {line.section_label}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-warm-ash">No existen faltantes acumulados por despacho.</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-soft-border bg-white p-4">
              <h5 className="text-sm font-semibold text-ink-slate">Lineas maximizadas</h5>
              <div className="mt-3 space-y-2">
                {operationalInsights.maxedLines.length ? operationalInsights.maxedLines.slice(0, 6).map((line) => (
                  <div key={line.id} className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-green-800">{line.item_name}</span>
                      <span className="font-mono text-xs text-green-700">{formatNumber(line.max_units)}</span>
                    </div>
                    <p className="mt-1 text-xs text-green-800">
                      {line.section_label} · disponible {formatNumber(line.available_units)} · pendiente {formatNumber(line.carryover_units)}
                    </p>
                  </div>
                )) : (
                  <p className="text-sm text-warm-ash">Todavia no hay lineas que hayan agotado el maximo base.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {!canEditFile && (
        <section className={`${ELEVATED_CARD} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-2">
            <FiSend className="text-action-blue" size={16} />
            <div>
              <h4 className="text-base font-semibold text-ink-slate">Pedido mensual</h4>
              <p className="text-xs text-warm-ash">Solicita unidades nuevas para este periodo.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOrderModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97]"
          >
            <FiSend size={14} />
            Nuevo pedido
          </button>
        </section>
      )}

      <Modal
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        title="Nuevo pedido mensual"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <label className="space-y-2">
              <span className="text-xs font-medium text-ink-slate">Periodo</span>
              <input
                value={orderPeriod}
                onChange={(event) => setOrderPeriod(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-medium text-ink-slate">Notas del pedido</span>
              <input
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
              />
            </label>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-soft-border">
            <table className="min-w-full text-sm">
              <thead className="bg-paper-white text-warm-ash">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Disponible</th>
                  <th className="px-4 py-3 text-right font-semibold">Pendiente</th>
                  <th className="px-4 py-3 text-right font-semibold">Solicitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft-border">
                {allLines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-slate">{line.item_name}</div>
                      <div className="text-xs text-warm-ash">{line.item_type}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-operative-green">{formatNumber(line.available_units)}</td>
                    <td className="px-4 py-3 text-right font-mono text-caution-amber">{formatNumber(line.carryover_units)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={orderDrafts[line.id] || ""}
                        onChange={(event) => setOrderDrafts((prev) => ({ ...prev, [line.id]: event.target.value }))}
                        className="min-h-11 w-28 rounded-xl border border-slate-300 px-3 text-right font-mono text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={submitting}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-action-blue px-4 text-sm font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? <FiLoader className="animate-spin" size={14} /> : <FiSend size={14} />}
              Enviar pedido
            </button>
          </div>
        </div>
      </Modal>

      <section className={`${ELEVATED_CARD} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <FiClock className="text-action-blue" size={16} />
          <h4 className="text-base font-semibold text-ink-slate">Historial de pedidos</h4>
        </div>
        {!detail.orders?.length ? (
          <p className="text-sm text-warm-ash">Todavia no existen pedidos mensuales para este expediente.</p>
        ) : (
          <div className="space-y-4">
            {detail.orders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-soft-border">
                <div className="flex flex-col gap-3 border-b border-soft-border bg-paper-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink-slate">Pedido #{order.id}</span>
                      <TabBadge variant={ORDER_STATUS_BADGE[order.status] || 'na'} label={formatStatus(order.status)} />
                    </div>
                    <p className="mt-1 text-xs text-warm-ash">Periodo {order.period}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOpsReviewer && order.status === "extra_pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReviewExtra(order.id, "approved")}
                          disabled={submitting}
                          className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-green-600 px-4 text-xs font-semibold text-white hover:bg-green-700 active:scale-[0.97] disabled:opacity-60"
                        >
                          <FiCheckCircle size={13} />
                          Aprobar excedente
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewExtra(order.id, "rejected")}
                          disabled={submitting}
                          className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-red-soft bg-white text-xs font-semibold text-alert-red hover:bg-red-soft active:scale-[0.97] disabled:opacity-60 px-4"
                        >
                          <FiAlertCircle size={13} />
                          Rechazar excedente
                        </button>
                      </>
                    )}
                    {isLogisticsReviewer && ["approved", "partially_dispatched"].includes(order.status) && (
                      <button
                        type="button"
                        onClick={() => handleDispatch(order)}
                        disabled={submitting}
                        className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-action-blue px-4 text-xs font-semibold text-white hover:bg-blue-700 active:scale-[0.97] disabled:opacity-60"
                      >
                        <FiTruck size={13} />
                        {order.status === "partially_dispatched" ? "Continuar despacho" : "Registrar despacho"}
                      </button>
                    )}
                    {canManageLifecycle && ["draft", "submitted", "extra_pending", "approved"].includes(order.status) && (
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={submitting}
                        className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 hover:bg-red-50 active:scale-[0.97] disabled:opacity-60"
                      >
                        <FiAlertCircle size={13} />
                        Cancelar pedido
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-warm-ash">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Linea</th>
                        <th className="px-4 py-3 text-right font-semibold">Pendiente previo</th>
                        <th className="px-4 py-3 text-right font-semibold">Nuevo</th>
                        <th className="px-4 py-3 text-right font-semibold">Extra</th>
                        <th className="px-4 py-3 text-right font-semibold">Aprobado</th>
                        <th className="px-4 py-3 text-right font-semibold">Enviado</th>
                        <th className="px-4 py-3 text-right font-semibold">Restante</th>
                        {isOpsReviewer && order.status === "extra_pending" && <th className="px-4 py-3 text-right font-semibold">Aprobar extra</th>}
                        {isLogisticsReviewer && ["approved", "partially_dispatched"].includes(order.status) && <th className="px-4 py-3 text-right font-semibold">Enviar ahora</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-soft-border">
                      {order.lines.map((line) => {
                        const sourceLine = allLines.find((row) => row.id === line.consumable_file_line_id);
                        return (
                          <tr key={line.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-ink-slate">{sourceLine?.item_name || `Linea ${line.consumable_file_line_id}`}</div>
                              <div className="text-xs text-warm-ash">{sourceLine?.item_type || "sin tipo"}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-caution-amber">{formatNumber(line.carryover_units)}</td>
                            <td className="px-4 py-3 text-right font-mono text-ink-slate">{formatNumber(line.requested_new_units)}</td>
                            <td className="px-4 py-3 text-right font-mono text-alert-red">{formatNumber(line.extra_requested_units)}</td>
                            <td className="px-4 py-3 text-right font-mono text-ink-slate">{formatNumber(line.approved_units)}</td>
                            <td className="px-4 py-3 text-right font-mono text-teal-700">{formatNumber(line.dispatched_units)}</td>
                            <td className="px-4 py-3 text-right font-mono text-caution-amber">{formatNumber(line.remaining_dispatch_units)}</td>
                            {isOpsReviewer && order.status === "extra_pending" && (
                              <td className="px-4 py-3 text-right">
                                {Number(line.extra_requested_units || 0) > 0 ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    max={line.extra_requested_units}
                                    value={extraApprovalDrafts[`${order.id}:${line.id}`] ?? line.extra_requested_units}
                                    onChange={(event) => setExtraApprovalDrafts((prev) => ({
                                      ...prev,
                                      [`${order.id}:${line.id}`]: event.target.value,
                                    }))}
                                    className="min-h-11 w-28 rounded-xl border border-slate-300 px-3 text-right font-mono text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                                  />
                                ) : (
                                  <span className="text-xs text-slate-400">No aplica</span>
                                )}
                              </td>
                            )}
                            {isLogisticsReviewer && ["approved", "partially_dispatched"].includes(order.status) && (
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  max={line.remaining_dispatch_units}
                                  value={dispatchDrafts[`${order.id}:${line.id}`] ?? line.remaining_dispatch_units}
                                  onChange={(event) => setDispatchDrafts((prev) => ({
                                    ...prev,
                                    [`${order.id}:${line.id}`]: event.target.value,
                                  }))}
                                  className="min-h-11 w-28 rounded-xl border border-slate-300 px-3 text-right font-mono text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {isLogisticsReviewer && ["approved", "partially_dispatched"].includes(order.status) && (
                  <div className="border-t border-soft-border px-4 py-4">
                    <label className="space-y-2">
                      <span className="text-xs font-medium text-ink-slate">Notas del despacho</span>
                      <input
                        value={dispatchNotesDrafts[order.id] || ""}
                        onChange={(event) => setDispatchNotesDrafts((prev) => ({ ...prev, [order.id]: event.target.value }))}
                        className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm text-ink-slate focus:border-action-blue focus:outline-none focus:ring-2 focus:ring-sky-signal/20"
                      />
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
};

export default ConsumableFilesTab;
