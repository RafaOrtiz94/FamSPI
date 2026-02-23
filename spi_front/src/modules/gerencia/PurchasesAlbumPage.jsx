import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiSearch, FiFileText, FiChevronRight, FiPackage, FiClipboard } from "react-icons/fi";
import { DashboardLayout, DashboardHeader } from "../../core/ui/layouts/DashboardLayout";
import Card from "../../core/ui/components/Card";
import Button from "../../core/ui/components/Button";
import Modal from "../../core/ui/components/Modal";
import Input from "../../core/ui/components/Input";
import Select from "../../core/ui/components/Select";
import { formatDateTimeEC } from "../../core/utils/dateUtils";
import { listPrivatePurchases, getPrivatePurchaseById, getPrivatePurchaseDocuments, getPrivatePurchaseTimeline, uploadPrivatePurchaseContract } from "../../core/api/privatePurchasesApi";
import { listEquipmentPurchases, getEquipmentPurchaseById } from "../../core/api/equipmentPurchasesApi";
import { PRIVATE_PURCHASE_STATUS_DEFINITIONS } from "../shared/constants/privatePurchaseConstants";
import { subscribeToPurchaseUpdates } from "../../core/services/purchaseEvents";
import { subscribeToPrivatePurchaseUpdates } from "../../core/services/privatePurchaseEvents";
import { useUI } from "../../core/ui/useUI";
import { useAuth } from "../../core/auth/useAuth";

const privateStatusMap = PRIVATE_PURCHASE_STATUS_DEFINITIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

const formatDate = (value) => formatDateTimeEC(value, "Sin fecha");
const getSnapshotSources = (snapshot) => [
  snapshot,
  snapshot?.client_data,
  snapshot?.client_request,
  snapshot?.client,
  snapshot?.data,
];
const resolveSnapshotValue = (snapshot, keys = []) => {
  const sources = getSnapshotSources(snapshot);
  for (const key of keys) {
    for (const source of sources) {
      const value = source?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
  }
  return "";
};
const resolvePrivateClientName = (item = {}) => {
  if (!item) return "Cliente";
  if (item.client_name) return item.client_name;
  if (item.client_business_name) return item.client_business_name;
  const snapshot = item.client_snapshot || {};
  const resolved = resolveSnapshotValue(snapshot, [
    "commercial_name",
    "legal_person_business_name",
    "business_name",
    "client_name",
    "name",
    "fullname",
  ]);
  return resolved || "Cliente";
};
const DOC_LABELS = {
  PROFORMA: "Proforma",
  PROFORMA_FIRMADA: "Proforma firmada",
  CONTRATO: "Contrato",
  PROCESO: "Documento de proceso",
  OFFER: "Oferta",
  SIGNED_OFFER: "Oferta firmada",
  CONTRACT_DRAFT: "Contrato borrador",
  CONTRACT_CLIENT_SIGNED: "Contrato firmado cliente",
  CONTRACT_SIGNED: "Contrato firmado gerencia",
  INSPECTION_ACT: "Acta inspeccion",
  DELIVERY_ACT_DRAFT: "Acta entrega borrador",
  DELIVERY_ACT_LOGISTICS_SIGNED: "Acta entrega (logistica)",
  DELIVERY_ACT: "Acta entrega final",
  COMODATO: "Comodato",
  AVAILABILITY_EMAIL: "Disponibilidad (correo)",
  RESERVATION_EMAIL: "Reserva (correo)",
  RESERVATION_EVENT: "Evento de reserva",
  DELIVERY_GUIDE: "Guia de despacho",
  CLIENT_ID: "Cedula / ID",
  RUC: "RUC",
  OPERATING_PERMIT: "Permiso de funcionamiento",
  LEGAL_REP_APPOINTMENT: "Nombramiento representante",
  APPROVAL_LETTER: "Carta de aprobacion",
  LOPDP_RECORD: "Registro LOPDP",
  LOPDP_EVIDENCE: "Evidencia LOPDP",
};

const OFFER_KIND_LABELS = {
  venta: "Venta directa",
  alquiler: "Alquiler",
  alquiler_transferencia_dominio: "Alquiler con transferencia de dominio",
  alquiler_con_transferencia_de_dominio: "Alquiler con transferencia de dominio",
  prestamo: "Alquiler",
  comodato: "Comodato",
  direct_purchase: "Venta directa",
  rental: "Alquiler",
};

const resolveOfferKindLabel = (value) => {
  const key = String(value || "").toLowerCase();
  return OFFER_KIND_LABELS[key] || value || "N/A";
};

const resolvePublicClientName = (item) => {
  const safe = item || {};
  return safe.client_name || safe.client_business_name || "Cliente";
};

const resolvePublicAvailabilityActor = (item) => {
  const safe = item || {};
  return safe.assigned_to_name || safe.assigned_to_email || safe.created_by_email || "ACP";
};

const resolvePublicProviderActor = (item) => {
  const safe = item || {};
  return safe.provider_email || "Proveedor";
};

const PurchasesAlbumPage = () => {
  const { showToast } = useUI();
  const { user } = useAuth();
  const normalizedRole = (user?.role || user?.role_name || user?.scope || "").toLowerCase();
  const isGerenciaGeneral = normalizedRole.includes("gerencia_general");
  const [activeTab, setActiveTab] = useState("private");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [privatePurchases, setPrivatePurchases] = useState([]);
  const [publicPurchases, setPublicPurchases] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailDocs, setDetailDocs] = useState([]);
  const [detailTimeline, setDetailTimeline] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [contractUpload, setContractUpload] = useState({
    file: null,
    notes: "",
    loading: false,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [privateData, publicData] = await Promise.all([
        listPrivatePurchases(),
        listEquipmentPurchases(),
      ]);
      setPrivatePurchases((privateData || []).filter(Boolean));
      setPublicPurchases((publicData || []).filter(Boolean));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribePublic = subscribeToPurchaseUpdates(({ request }) => {
      if (!request) return;
      setPublicPurchases((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((item) => item.id === request.id);
        if (idx >= 0) {
          list[idx] = request;
        } else {
          list.unshift(request);
        }
        return list;
      });
    });

    const unsubscribePrivate = subscribeToPrivatePurchaseUpdates(({ request }) => {
      if (!request) return;
      setPrivatePurchases((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((item) => item.id === request.id);
        if (idx >= 0) {
          list[idx] = request;
        } else {
          list.unshift(request);
        }
        return list;
      });
    });

    return () => {
      unsubscribePublic?.();
      unsubscribePrivate?.();
    };
  }, []);

  const filteredPrivate = useMemo(() => {
    return privatePurchases.filter((item) => {
      const clientName = resolvePrivateClientName(item);
      const matchSearch = !search
        || String(clientName || "")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [privatePurchases, search, statusFilter]);

  const filteredPublic = useMemo(() => {
    return publicPurchases.filter((item) => {
      const matchSearch = !search
        || String(item.client_name || item.client_business_name || "")
          .toLowerCase()
          .includes(search.toLowerCase());
      return matchSearch;
    });
  }, [publicPurchases, search]);

  const loadPrivateDetail = useCallback(async (id) => {
    const [detail, docs, timeline] = await Promise.all([
      getPrivatePurchaseById(id),
      getPrivatePurchaseDocuments(id),
      getPrivatePurchaseTimeline(id),
    ]);
    setDetailData({ type: "private", ...detail });
    setDetailDocs(docs || []);
    setDetailTimeline(timeline?.events || []);
  }, []);

  const openPrivateDetail = async (id) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      await loadPrivateDetail(id);
    } finally {
      setDetailLoading(false);
    }
  };

  const openPublicDetail = async (id) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const detail = await getEquipmentPurchaseById(id);
      setDetailData({ type: "public", ...detail });
      setDetailDocs([
        detail?.proforma_file_link && { doc_type: "PROFORMA", link: detail.proforma_file_link },
        detail?.signed_proforma_file_link && { doc_type: "PROFORMA_FIRMADA", link: detail.signed_proforma_file_link },
        detail?.contract_file_link && { doc_type: "CONTRATO", link: detail.contract_file_link },
        detail?.process_doc_link && { doc_type: "PROCESO", link: detail.process_doc_link },
      ].filter(Boolean));
      setDetailTimeline([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderPrivateCard = (item) => {
    const statusInfo = privateStatusMap[item.status] || {};
    const clientName = resolvePrivateClientName(item);
    const availabilityActor =
      item.provider_response?.actor?.name ||
      item.provider_response?.actor?.email ||
      "ACP";
    return (
      <Card key={`private-${item.id}`} className="p-5 flex flex-col gap-4 bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{clientName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">#{item.id}</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {resolveOfferKindLabel(item.offer_kind)}
              </span>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
            {statusInfo.label || item.status || "Sin estado"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Solicitud</p>
            <p className="font-semibold text-gray-800 truncate">
              {item.created_by_name || item.created_by_email || "N/A"}
            </p>
            <p className="text-gray-500">{formatDate(item.created_at)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Disponibilidad</p>
            <p className="font-semibold text-gray-800">
              {item.availability_email_sent_at ? "Solicitada" : "Pendiente"}
            </p>
            <p className="text-gray-500">Backoffice · {item.availability_email_sent_at ? formatDate(item.availability_email_sent_at) : "—"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Respuesta</p>
            <p className="font-semibold text-gray-800">{item.provider_response_at ? "Recibida" : "Pendiente"}</p>
            <p className="text-gray-500">{availabilityActor} · {item.provider_response_at ? formatDate(item.provider_response_at) : "—"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Entrega</p>
            <p className="font-semibold text-gray-800">
              {item.delivery_start_at || item.delivery_end_at ? "Programada" : "Sin fecha"}
            </p>
            <p className="text-gray-500">
              {item.delivery_start_at || item.delivery_end_at
                ? `${formatDate(item.delivery_start_at)} → ${formatDate(item.delivery_end_at)}`
                : "—"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-3 bg-white/60">
          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
            <span className="uppercase tracking-wide">Hitos del proceso</span>
            <span className="text-gray-400">Privada</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.offer_document_id ? "bg-emerald-500" : "bg-gray-300"}`} />
              Oferta {item.offer_document_id ? "enviada" : "pendiente"}
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.offer_signed_document_id ? "bg-emerald-500" : "bg-gray-300"}`} />
              Oferta firmada
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.contract_document_id ? "bg-emerald-500" : "bg-gray-300"}`} />
              Contrato borrador
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.contract_signed_document_id ? "bg-emerald-500" : "bg-gray-300"}`} />
              Contrato gerencia
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.delivery_guides_uploaded_at ? "bg-emerald-500" : "bg-gray-300"}`} />
              Guías despacho
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={() => openPrivateDetail(item.id)} className="flex items-center gap-2 justify-center">
          Ver proceso <FiChevronRight />
        </Button>
      </Card>
    );
  };

  const renderPublicCard = (item) => {
    const clientName = resolvePublicClientName(item);
    const availabilityActor = resolvePublicAvailabilityActor(item);
    const providerActor = resolvePublicProviderActor(item);
    return (
      <Card key={`public-${item.id}`} className="p-5 flex flex-col gap-4 bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{clientName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">#{item.id}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                {item.request_type || "purchase"}
              </span>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
            {item.status || "Sin estado"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Solicitud</p>
            <p className="font-semibold text-gray-800 truncate">{item.created_by_email || "N/A"}</p>
            <p className="text-gray-500">{formatDate(item.created_at)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Disponibilidad</p>
            <p className="font-semibold text-gray-800">
              {item.availability_email_sent_at ? "Solicitada" : "Pendiente"}
            </p>
            <p className="text-gray-500">{availabilityActor} · {item.availability_email_sent_at ? formatDate(item.availability_email_sent_at) : "—"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Respuesta</p>
            <p className="font-semibold text-gray-800">{item.provider_response_at ? "Recibida" : "Pendiente"}</p>
            <p className="text-gray-500">{providerActor} · {item.provider_response_at ? formatDate(item.provider_response_at) : "—"}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Inspección</p>
            <p className="font-semibold text-gray-800">{item.inspection_recorded_at ? "Registrada" : "Pendiente"}</p>
            <p className="text-gray-500">
              {item.inspection_min_date ? formatDate(item.inspection_min_date) : "—"}
              {item.inspection_max_date ? ` → ${formatDate(item.inspection_max_date)}` : ""}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 p-3 bg-white/60">
          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-2">
            <span className="uppercase tracking-wide">Hitos del proceso</span>
            <span className="text-gray-400">Pública</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.proforma_requested_at ? "bg-emerald-500" : "bg-gray-300"}`} />
              Proforma solicitada
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.proforma_uploaded_at ? "bg-emerald-500" : "bg-gray-300"}`} />
              Proforma recibida
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.signed_proforma_uploaded_at ? "bg-emerald-500" : "bg-gray-300"}`} />
              Proforma firmada
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.contract_uploaded_at ? "bg-emerald-500" : "bg-gray-300"}`} />
              Contrato subido
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={() => openPublicDetail(item.id)} className="flex items-center gap-2 justify-center">
          Ver proceso <FiChevronRight />
        </Button>
      </Card>
    );
  };

  const detailTitle = detailData?.type === "private"
    ? `Compra privada #${detailData?.id}`
    : `Compra publica #${detailData?.id}`;

  const canUploadGerenciaContract =
    isGerenciaGeneral && detailData?.type === "private" && detailData?.status === "pending_contract_approval";

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const base64 = String(result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleUploadGerenciaContract = async () => {
    if (!detailData?.id) return;
    if (!contractUpload.file) {
      showToast("Selecciona el contrato firmado", "warning");
      return;
    }
    setContractUpload((prev) => ({ ...prev, loading: true }));
    try {
      const base64 = await fileToBase64(contractUpload.file);
      await uploadPrivatePurchaseContract(detailData.id, {
        contract_base64: base64,
        file_name: contractUpload.file.name,
        mime_type: contractUpload.file.type || "application/pdf",
        reason: contractUpload.notes || "Contrato firmado por gerencia",
      });
      showToast("Contrato firmado por gerencia subido", "success");
      setContractUpload({ file: null, notes: "", loading: false });
      await loadPrivateDetail(detailData.id);
    } catch (error) {
      console.error(error);
      showToast("No se pudo subir el contrato", "error");
      setContractUpload((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <DashboardLayout includeWidgets={false}>
      <DashboardHeader
        title="Album de Compras"
        subtitle="Vista unificada de compras privadas y publicas"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex gap-2">
          <Button variant={activeTab === "private" ? "primary" : "secondary"} onClick={() => setActiveTab("private")}>
            <FiPackage /> Privadas
          </Button>
          <Button variant={activeTab === "public" ? "primary" : "secondary"} onClick={() => setActiveTab("public")}>
            <FiClipboard /> Publicas
          </Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente"
              className="pl-9"
            />
          </div>
          {activeTab === "private" && (
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: "Todos los estados", value: "all" },
                ...PRIVATE_PURCHASE_STATUS_DEFINITIONS.map((status) => ({
                  label: status.label,
                  value: status.value,
                })),
              ]}
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeTab === "private"
            ? filteredPrivate.map(renderPrivateCard)
            : filteredPublic.map(renderPublicCard)}
        </div>
      )}

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailTitle}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4">
          <div className="text-sm text-gray-600">
              <p><strong>Cliente:</strong> {detailData?.type === "private" ? resolvePrivateClientName(detailData) : resolvePublicClientName(detailData)}</p>
              <p><strong>Estado:</strong> {detailData?.status || "N/A"}</p>
              {detailData?.type === "private" && (
                <>
                  <p><strong>Tipo de oferta:</strong> {resolveOfferKindLabel(detailData?.offer_kind)}</p>
                  <p><strong>Solicitado por:</strong> {detailData?.created_by_name || detailData?.created_by_email || "N/A"} · {formatDate(detailData?.created_at)}</p>
                </>
              )}
              {detailData?.type === "public" && (
                <>
                  <p><strong>Tipo de solicitud:</strong> {detailData?.request_type || "purchase"}</p>
                  <p><strong>Solicitado por:</strong> {detailData?.created_by_email || "N/A"} · {formatDate(detailData?.created_at)}</p>
                </>
              )}
            </div>

            {detailData?.type === "private" && (
              <div className="rounded-lg border border-gray-100 p-3 text-xs text-gray-600 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Resumen del proceso</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-500">Disponibilidad solicitada</p>
                    <p>{detailData?.availability_email_sent_at ? formatDate(detailData.availability_email_sent_at) : "—"} · Backoffice</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Respuesta disponibilidad</p>
                    <p>
                      {detailData?.provider_response_at ? formatDate(detailData.provider_response_at) : "—"} ·{" "}
                      {detailData?.provider_response?.actor?.name || "ACP"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Oferta enviada</p>
                    <p>{detailData?.offer_document_id ? "Sí" : "Pendiente"} · {detailData?.offer_signed_document_id ? "Firmada" : "Sin firma"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Contrato</p>
                    <p>{detailData?.contract_document_id ? "Borrador" : "Pendiente"} · {detailData?.contract_signed_document_id ? "Firmado gerencia" : "Sin firma"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Aprobación gerencia</p>
                    <p>
                      {detailData?.manager_contract_decision_at ? formatDate(detailData.manager_contract_decision_at) : "—"} ·{" "}
                      {detailData?.manager_contract_decision_by_name || "Gerencia General"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Guías despacho</p>
                    <p>{detailData?.delivery_guides_uploaded_at ? formatDate(detailData.delivery_guides_uploaded_at) : "—"} · Operaciones</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Entrega</p>
                    <p>
                      {detailData?.delivery_start_at || detailData?.delivery_end_at
                        ? `${formatDate(detailData?.delivery_start_at)} → ${formatDate(detailData?.delivery_end_at)}`
                        : "Sin fecha"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {canUploadGerenciaContract && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-900">
                  Subir contrato firmado por gerencia
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) =>
                    setContractUpload((prev) => ({ ...prev, file: e.target.files?.[0] || null }))
                  }
                />
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                  placeholder="Comentario opcional"
                  value={contractUpload.notes}
                  onChange={(e) =>
                    setContractUpload((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
                <Button
                  variant="primary"
                  onClick={handleUploadGerenciaContract}
                  loading={contractUpload.loading}
                  disabled={contractUpload.loading}
                >
                  Subir contrato firmado
                </Button>
              </div>
            )}

            {detailData?.type === "public" && (
              <div className="rounded-lg border border-gray-100 p-3 text-xs text-gray-600 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Resumen del proceso</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <p className="text-gray-500">Disponibilidad solicitada</p>
                    <p>
                      {detailData?.availability_email_sent_at ? formatDate(detailData.availability_email_sent_at) : "—"} ·{" "}
                      {resolvePublicAvailabilityActor(detailData)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Respuesta disponibilidad</p>
                    <p>
                      {detailData?.provider_response_at ? formatDate(detailData.provider_response_at) : "—"} ·{" "}
                      {resolvePublicProviderActor(detailData)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Proforma</p>
                    <p>
                      {detailData?.proforma_requested_at ? "Solicitada" : "Pendiente"} ·{" "}
                      {detailData?.proforma_uploaded_at ? "Recibida" : "Sin proforma"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Proforma firmada</p>
                    <p>{detailData?.signed_proforma_uploaded_at ? "Recibida" : "Pendiente"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Inspección</p>
                    <p>
                      {detailData?.inspection_recorded_at ? "Registrada" : "Pendiente"} ·{" "}
                      {detailData?.inspection_min_date ? formatDate(detailData.inspection_min_date) : "—"}
                      {detailData?.inspection_max_date ? ` → ${formatDate(detailData.inspection_max_date)}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Contrato</p>
                    <p>
                      {detailData?.contract_uploaded_at ? "Subido" : "Pendiente"} ·{" "}
                      {detailData?.contract_uploaded_at ? formatDate(detailData.contract_uploaded_at) : "—"}
                    </p>
                  </div>
                  {detailData?.process_doc_link && (
                    <div>
                      <p className="text-gray-500">Documento de proceso</p>
                      <p>Generado</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Documentos</h4>
              {detailDocs.length === 0 ? (
                <p className="text-xs text-gray-500">Sin documentos disponibles.</p>
              ) : (
                <div className="space-y-2">
                  {detailDocs.map((doc, idx) => (
                    <a
                      key={`${doc.doc_type}-${idx}`}
                      href={doc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                      <FiFileText /> {DOC_LABELS[doc.doc_type] || doc.doc_name || doc.doc_type || "Documento"}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {detailTimeline.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Timeline</h4>
                <div className="space-y-2">
                  {detailTimeline.map((event, idx) => (
                    <div key={idx} className="text-xs text-gray-600 border border-gray-100 rounded-lg p-2">
                      <p className="font-semibold">{event.title || event.event_title || event.type || event.eventType || "Evento"}</p>
                      <p>{event.timestamp ? formatDate(event.timestamp) : event.created_at ? formatDate(event.created_at) : ""}</p>
                      {event.actorName && <p>Actor: {event.actorName}</p>}
                      {event.reason && <p>{event.reason}</p>}
                      {event.description && <p>{event.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
};

export default PurchasesAlbumPage;
