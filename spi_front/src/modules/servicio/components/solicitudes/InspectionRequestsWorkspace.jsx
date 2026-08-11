import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiMapPin,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiUsers,
  FiXCircle,
} from "react-icons/fi";

import Button from "../../../../core/ui/components/Button";
import { useAuth } from "../../../../core/auth/AuthContext";
import { useUI } from "../../../../core/ui/UIContext";
import { listBusinessCases, reviewBcInspectionRequest, registerBcInspectionResult } from "../../../../core/api/businessCaseApi";
import { listEquipmentPurchases, coordinateInspectionDate, reviewInspectionDate, getEquipmentPurchaseMeta } from "../../../../core/api/equipmentPurchasesApi";
import { getPrivatePurchasesByRole, reviewPrivatePurchaseInspectionDate } from "../../../../core/api/privatePurchasesApi";
import { getRequests, registerInspectionResult, getRequestById } from "../../../../core/api/requestsApi";
import { getUsers } from "../../../../core/api/usersApi";
import { approveRequest, rejectRequest } from "../../../../core/api/approvalsApi";
import { getTechnicalScheduleFeed } from "../../../../core/api/availabilityApi";
import { normalizeRoles, isChiefTechnical as isChiefTechnicalRole, isTechnical as isTechnicalRole } from "../../../shared/purchases-workspace/purchaseRoleGroups";
import Fst07ResultPanel from "./Fst07ResultPanel";

const SOURCE_COPY = {
  bc: {
    title: "Inspecciones desde Business Case",
    helper: "Gestiona solicitudes F.ST-20 originadas en business case con una bandeja única y respuesta consistente.",
    empty: "No hay solicitudes de inspección originadas desde business case.",
    accent: "border-blue-200 bg-blue-50 text-blue-700",
    Icon: FiBriefcase,
    sourceLabel: "Business Case",
  },
  compras: {
    title: "Inspecciones desde Compras",
    helper: "Centraliza solicitudes públicas y privadas bajo el mismo expediente operativo para responderlas con coherencia.",
    empty: "No hay solicitudes de inspección pendientes desde compras.",
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: FiClipboard,
    sourceLabel: "Compras",
  },
  independientes: {
    title: "Inspecciones Independientes",
    helper: "Revisa solicitudes F.ST-20 creadas de forma directa con el mismo contexto visual del resto del módulo.",
    empty: "No hay solicitudes independientes registradas.",
    accent: "border-amber-200 bg-amber-50 text-amber-700",
    Icon: FiUsers,
    sourceLabel: "Independiente",
  },
};

const STATUS_META = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-800", Icon: FiClock },
  // "pendiente" es el status real que usa requests.service.js (español) para
  // toda solicitud F.ST-20 recien creada -- sin este alias, las solicitudes
  // independientes nunca mostraban el estado correcto ni el panel de
  // aprobar/rechazar.
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-800", Icon: FiClock },
  pending_review: { label: "Pendiente revisión", className: "bg-orange-100 text-orange-800", Icon: FiClock },
  approved: { label: "Aprobada", className: "bg-emerald-100 text-emerald-800", Icon: FiCheckCircle },
  aprobado: { label: "Aprobada", className: "bg-emerald-100 text-emerald-800", Icon: FiCheckCircle },
  accepted: { label: "Aceptada", className: "bg-emerald-100 text-emerald-800", Icon: FiCheckCircle },
  rejected: { label: "Rechazada", className: "bg-red-100 text-red-800", Icon: FiXCircle },
  rechazado: { label: "Rechazada", className: "bg-red-100 text-red-800", Icon: FiXCircle },
  cancelled: { label: "Cancelada", className: "bg-slate-200 text-slate-700", Icon: FiXCircle },
  cancelado: { label: "Cancelada", className: "bg-slate-200 text-slate-700", Icon: FiXCircle },
  pending_approval: { label: "Pendiente aprobación", className: "bg-amber-100 text-amber-800", Icon: FiClock },
  completado: { label: "Completada", className: "bg-emerald-100 text-emerald-800", Icon: FiCheckCircle },
  completed: { label: "Completada", className: "bg-emerald-100 text-emerald-800", Icon: FiCheckCircle },
  non_compliant_reinspection_pending: { label: "Reinspección pendiente", className: "bg-orange-100 text-orange-800", Icon: FiAlertCircle },
};

const safeJson = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const formatDate = (value, options = { day: "2-digit", month: "short", year: "numeric" }) => {
  if (!value) return "N/D";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-EC", options);
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveBusinessCaseId = (row = {}) =>
  row.business_case_id || row.businessCaseId || row.id || row.business_case?.id || null;

const getStatusMeta = (status) => {
  const key = String(status || "").toLowerCase();
  return STATUS_META[key] || {
    label: status || "Sin estado",
    className: "bg-slate-100 text-slate-700",
    Icon: FiClock,
  };
};

const getPrivateRoleParam = (user) => {
  const roles = normalizeRoles(user);
  if (!isTechnicalRole(roles)) return null;
  if (roles.some((role) => role.includes("jefe_servicio_tecnico"))) return "jefe_servicio_tecnico";
  if (roles.some((role) => role.includes("jefe_servicio"))) return "jefe_servicio";
  return isChiefTechnicalRole(roles) ? "jefe_tecnico" : "tecnico";
};

const loadPrivatePurchasesForInspection = async (roleParam, isChiefTechnical) => {
  if (!roleParam) return [];
  const fallbackRoles = isChiefTechnical ? [roleParam, "tecnico"] : [roleParam];
  let lastError = null;

  for (const candidate of fallbackRoles) {
    try {
      return await getPrivatePurchasesByRole(candidate, { silent: true });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No se pudieron cargar las compras privadas");
};

const normalizeBcItems = (payload) => {
  const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
  return rows
    .filter((row) => row?.modern_bc_metadata?.environment_inspection_request?.request_id)
    .map((row) => {
      const inspection = row.modern_bc_metadata?.environment_inspection_request || {};
      const businessCaseId = resolveBusinessCaseId(row);
      return {
        id: `bc:${businessCaseId || inspection.request_id || "sin-bc"}`,
        sourceType: "bc",
        sourceId: businessCaseId,
        requestId: inspection.request_id || null,
        clientName: row.client_name || "Cliente sin registrar",
        city: row.city || row.main_city || row.province || "",
        status: inspection.status || "pending",
        requestedAt: inspection.requested_at || row.updated_at || row.created_at || null,
        assignedUserId: inspection.assigned_user_id || "",
        assignedUserName: inspection.assigned_user_name || "",
        scheduledDate: inspection.inspection_date || "",
        minDate: inspection.inspection_min_date || "",
        maxDate: inspection.inspection_max_date || "",
        notes: inspection.notes || "",
        reason: inspection.reason || "",
        businessCaseStatus: row.status || "",
        // Fija: toda inspeccion disparada desde Business Case es "por costos"
        // (estimacion de costos/factibilidad), no una eleccion del usuario.
        tipoInspeccion: "costos",
        raw: row,
      };
    })
    .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
};

const normalizePurchaseItems = (publicRows, privateRows) => {
  const normalizedPublic = (Array.isArray(publicRows) ? publicRows : [])
    .filter((row) => row?.inspection_request_id || row?.inspection_scheduled_date || row?.inspection_coordination_status)
    .map((row) => ({
      id: `compras:public:${row.id}`,
      sourceType: "compras",
      purchaseType: "public",
      sourceId: row.id,
      requestId: row.inspection_request_id || null,
      clientName: row.client_name || row.contracting_entity || "Cliente sin registrar",
      city: row.city || row.delivery_city || "",
      status: row.inspection_coordination_status || (row.inspection_scheduled_date ? "accepted" : "pending"),
      requestedAt: row.inspection_requested_at || row.updated_at || row.created_at || null,
      scheduledDate: row.inspection_scheduled_date || "",
      proposedDate: row.inspection_proposed_date || "",
      minDate: row.inspection_min_date || "",
      maxDate: row.inspection_max_date || "",
      notes: row.inspection_coordination_notes || row.inspection_proposed_notes || "",
      assignedTechnicianId: row.inspection_assigned_technician_id || "",
      assignedTechnicianName: row.inspection_assigned_technician_name || "",
      purchaseStatus: row.status || "",
      expectedUpdatedAt: row.updated_at || null,
      // Fija: toda inspeccion disparada desde compras es operativa (instalacion
      // real), no una eleccion del usuario.
      tipoInspeccion: "normal",
      raw: row,
    }));

  const normalizedPrivate = (Array.isArray(privateRows) ? privateRows : [])
    .filter((row) => row?.inspection_request_id || row?.inspection_scheduled_date || row?.inspection_coordination_status)
    .map((row) => {
      const snapshot = row.client_snapshot || {};
      return {
        id: `compras:private:${row.id}`,
        sourceType: "compras",
        purchaseType: "private",
        sourceId: row.id,
        requestId: row.inspection_request_id || null,
        clientName: snapshot.commercial_name || snapshot.client_name || snapshot.name || "Cliente sin registrar",
        city: row.city || row.delivery_city || "",
        status: row.inspection_coordination_status || (row.inspection_scheduled_date ? "accepted" : "pending"),
        requestedAt: row.inspection_requested_at || row.updated_at || row.created_at || null,
        scheduledDate: row.inspection_scheduled_date || "",
        proposedDate: row.inspection_proposed_date || "",
        minDate: row.inspection_min_date || "",
        maxDate: row.inspection_max_date || "",
        notes: row.inspection_coordination_notes || row.inspection_proposed_notes || "",
        assignedTechnicianId: row.inspection_assigned_technician_id || "",
        assignedTechnicianName: row.inspection_assigned_technician_name || "",
        purchaseStatus: row.status || "",
        expectedUpdatedAt: row.updated_at || null,
        tipoInspeccion: "normal",
        raw: row,
      };
    });

  return [...normalizedPublic, ...normalizedPrivate].sort(
    (a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime(),
  );
};

const normalizeIndependentItems = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : [];
  return rows
    .map((row) => {
      const data = safeJson(row.payload);
      return {
        id: `independiente:${row.id}`,
        sourceType: "independientes",
        sourceId: row.id,
        requestId: row.id,
        clientName: data.cliente || data.nombre_cliente || data.client_name || "Cliente sin registrar",
        city: data.ubicacion || data.ciudad || data.sede || "",
        status: row.status || "pending_approval",
        requestedAt: row.created_at || null,
        minDate: data.fecha_instalacion || "",
        maxDate: data.fecha_tope_instalacion || data.fecha_instalacion || "",
        notes: data.observaciones || data.notes || "",
        tipoInspeccion: data.tipo_inspeccion || "normal",
        origen: data.origen || null,
        payload: data,
        raw: row,
      };
    })
    // Las F.ST-20 generadas automaticamente desde Business Case o Compras ya
    // se gestionan en sus propias pestanas ("Business Case" / "De Compras").
    // Sin este filtro se duplicarian aqui, porque ambos flujos crean una fila
    // real en la tabla requests ademas de guardar su propio estado embebido.
    .filter((item) => !["business_case", "compras"].includes(item.origen))
    .sort((a, b) => new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime());
};

const MetricCard = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
  </div>
);

const DetailLine = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
    <div className="shrink-0 rounded-full bg-white p-2 shadow-sm">
      <Icon size={15} className="text-slate-500" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase leading-5 tracking-[0.1em] text-slate-400 break-normal">
        {label}
      </p>
      <p className="mt-1 text-base font-medium leading-7 text-slate-700 break-words">
        {value || "N/D"}
      </p>
    </div>
  </div>
);

const InspectionRequestsWorkspace = ({ source = "bc" }) => {
  const { user } = useAuth();
  const { showToast } = useUI();
  const sourceMeta = SOURCE_COPY[source] || SOURCE_COPY.bc;
  const userRoles = useMemo(() => normalizeRoles(user), [user]);
  const isChiefTechnical = useMemo(() => isChiefTechnicalRole(userRoles), [userRoles]);
  const privateRoleParam = useMemo(() => getPrivateRoleParam(user), [user]);

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [technicalUsers, setTechnicalUsers] = useState([]);
  const [bcUsers, setBcUsers] = useState([]);
  const [coordDrafts, setCoordDrafts] = useState({});
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [scheduleConflict, setScheduleConflict] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (source === "bc") {
        const response = await listBusinessCases({ page: 1, pageSize: 100 });
        setItems(normalizeBcItems(response));
      } else if (source === "compras") {
        const [publicResult, privateResult] = await Promise.allSettled([
          listEquipmentPurchases(),
          loadPrivatePurchasesForInspection(privateRoleParam, isChiefTechnical),
        ]);
        if (publicResult.status !== "fulfilled") {
          throw publicResult.reason || new Error("No se pudieron cargar las compras");
        }
        const publicRows = Array.isArray(publicResult.value) ? publicResult.value : [];
        const privateRows = privateResult.status === "fulfilled" ? privateResult.value : [];
        setItems(normalizePurchaseItems(publicRows, privateRows));
      } else {
        const response = await getRequests({ page: 1, pageSize: 100, type: "F.ST-20" });
        setItems(normalizeIndependentItems(response));
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || "No se pudo cargar la bandeja");
    } finally {
      setLoading(false);
    }
  }, [isChiefTechnical, privateRoleParam, source]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (source !== "compras" && source !== "independientes") return;
    let cancelled = false;
    (async () => {
      try {
        const meta = await getEquipmentPurchaseMeta();
        if (!cancelled) setTechnicalUsers(Array.isArray(meta?.technical_users) ? meta.technical_users : []);
      } catch {
        if (!cancelled) setTechnicalUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source]);

  useEffect(() => {
    if (source !== "bc" || !isChiefTechnical) return;
    let cancelled = false;
    (async () => {
      try {
        const users = await getUsers({ role: "ing_servicio" });
        if (!cancelled) {
          setBcUsers(Array.isArray(users) ? users : []);
        }
      } catch {
        if (!cancelled) setBcUsers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isChiefTechnical, source]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [item.clientName, item.city, item.requestId, item.purchaseType, item.businessCaseStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [items, query]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selected = useMemo(
    () => filteredItems.find((item) => item.id === selectedId) || null,
    [filteredItems, selectedId],
  );

  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  useEffect(() => {
    if (!selected?.requestId) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    setLoadingDocuments(true);
    (async () => {
      try {
        const detail = await getRequestById(selected.requestId);
        if (!cancelled) setDocuments(Array.isArray(detail?.attachments) ? detail.attachments : []);
      } catch {
        if (!cancelled) setDocuments([]);
      } finally {
        if (!cancelled) setLoadingDocuments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.requestId]);

  const draftUserId = coordDrafts[selected?.id]?.assigned_user_id || coordDrafts[selected?.id]?.assigned_technician_id;
  const draftDate = coordDrafts[selected?.id]?.inspection_date;

  useEffect(() => {
    if (!draftUserId || !draftDate) {
      setScheduleConflict(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const feed = await getTechnicalScheduleFeed({ from: draftDate, to: draftDate, scope: "team" });
        if (cancelled) return;
        const rows = (feed?.rows || []).filter(
          (row) => String(row.user_id) === String(draftUserId) && row.activity_date === draftDate,
        );
        setScheduleConflict(rows.length ? { date: draftDate, rows } : null);
      } catch {
        if (!cancelled) setScheduleConflict(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftUserId, draftDate]);

  const pendingCount = useMemo(
    () =>
      items.filter((item) => {
        const key = String(item.status || "").toLowerCase();
        return ["pending", "pendiente", "pending_review", "pending_approval"].includes(key);
      }).length,
    [items],
  );

  const approvedCount = useMemo(
    () =>
      items.filter((item) =>
        ["approved", "aprobado", "accepted", "completado", "completed"].includes(String(item.status || "").toLowerCase()),
      ).length,
    [items],
  );

  const handleBcApprove = async (item) => {
    const draft = coordDrafts[item.id] || {};
    if (!draft.assigned_user_id || !draft.inspection_date) {
      showToast("Selecciona técnico y fecha de inspección", "warning");
      return;
    }
    if (!UUID_REGEX.test(String(item.sourceId || ""))) {
      showToast("No se puede aprobar: la solicitud no tiene un Business Case valido vinculado. Actualiza la bandeja.", "error");
      await loadData();
      return;
    }
    setSaving(true);
    try {
      await reviewBcInspectionRequest(item.sourceId, {
        action: "approve",
        assigned_user_id: Number(draft.assigned_user_id),
        inspection_date: draft.inspection_date,
        notes: draft.notes?.trim() || undefined,
      });
      showToast("Solicitud aprobada y asignada", "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo aprobar la solicitud", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBcReject = async (item) => {
    const draft = reviewDrafts[item.id] || {};
    if (!draft.reason?.trim()) {
      showToast("Ingresa un motivo de rechazo", "warning");
      return;
    }
    if (!UUID_REGEX.test(String(item.sourceId || ""))) {
      showToast("No se puede rechazar: la solicitud no tiene un Business Case valido vinculado. Actualiza la bandeja.", "error");
      await loadData();
      return;
    }
    setSaving(true);
    try {
      await reviewBcInspectionRequest(item.sourceId, {
        action: "reject",
        reason: draft.reason.trim(),
      });
      showToast("Solicitud rechazada", "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo rechazar la solicitud", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBcResult = async (item, payload) => {
    if (!UUID_REGEX.test(String(item.sourceId || ""))) {
      showToast("No se puede registrar el resultado: la solicitud no tiene un Business Case valido vinculado. Actualiza la bandeja.", "error");
      await loadData();
      return;
    }
    setSaving(true);
    try {
      await registerBcInspectionResult(item.sourceId, payload);
      showToast(
        payload.result === "compliant" ? "Inspección conforme registrada. Solicitud completada." : "Reinspección programada",
        "success",
      );
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo registrar el resultado", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePurchaseCoordinate = async (item) => {
    const draft = coordDrafts[item.id] || {};
    if (!draft.inspection_date) {
      showToast("Selecciona la fecha exacta de inspección", "warning");
      return;
    }
    setSaving(true);
    try {
      await coordinateInspectionDate(item.sourceId, {
        inspection_date: draft.inspection_date,
        notes: draft.notes?.trim() || null,
        assigned_technician_id: draft.assigned_technician_id || item.assignedTechnicianId || null,
        expected_updated_at: item.expectedUpdatedAt || undefined,
      });
      showToast("Fecha exacta de inspección coordinada", "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo coordinar la inspección", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePurchaseReview = async (item, decision) => {
    const draft = reviewDrafts[item.id] || {};
    setSaving(true);
    try {
      const payload = {
        decision,
        review_notes: draft.review_notes?.trim() || null,
        expected_updated_at: item.expectedUpdatedAt || undefined,
      };
      if (item.purchaseType === "public") {
        await reviewInspectionDate(item.sourceId, payload);
      } else {
        await reviewPrivatePurchaseInspectionDate(item.sourceId, payload);
      }
      showToast(`Solicitud ${decision === "accept" ? "aceptada" : "rechazada"}`, "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo registrar la decisión", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleIndependentApprove = async (item) => {
    const draft = coordDrafts[item.id] || {};
    if (!draft.assigned_user_id || !draft.inspection_date) {
      showToast("Selecciona técnico y fecha dentro de la ventana solicitada", "warning");
      return;
    }
    setSaving(true);
    try {
      await approveRequest(item.sourceId, {
        assigned_user_id: draft.assigned_user_id,
        inspection_date: draft.inspection_date,
        notes: draft.notes?.trim() || undefined,
      });
      showToast("Solicitud aprobada y asignada", "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo aprobar la solicitud", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleIndependentReject = async (item) => {
    const draft = reviewDrafts[item.id] || {};
    setSaving(true);
    try {
      await rejectRequest(item.sourceId, draft.reason?.trim() || "");
      showToast("Solicitud rechazada", "success");
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo rechazar la solicitud", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleIndependentResult = async (item, payload) => {
    setSaving(true);
    try {
      await registerInspectionResult(item.sourceId, payload);
      showToast(
        payload.result === "compliant" ? "Inspección conforme registrada. Solicitud completada." : "Reinspección programada",
        "success",
      );
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || "No se pudo registrar el resultado", "error");
    } finally {
      setSaving(false);
    }
  };

  const statusMeta = getStatusMeta(selected?.status);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${sourceMeta.accent}`}>
              <sourceMeta.Icon size={14} />
              {sourceMeta.sourceLabel}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{sourceMeta.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{sourceMeta.helper}</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-[420px]">
            <MetricCard label="Solicitudes" value={items.length} />
            <MetricCard label="Pendientes" value={pendingCount} />
            <MetricCard label="Resueltas" value={approvedCount} />
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <aside className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <FiSearch size={16} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar cliente, ciudad o solicitud"
                  className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Bandeja activa</p>
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
                  Actualizar
                </button>
              </div>
            </div>

            <div className="max-h-[65dvh] space-y-3 overflow-y-auto p-4">
              {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {loading && !items.length ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-3xl bg-slate-100" />
                ))
              ) : filteredItems.length ? (
                filteredItems.map((item) => {
                  const meta = getStatusMeta(item.status);
                  const ActiveIcon = meta.Icon;
                  const active = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-[#BFDBFE] bg-[#EFF6FF] text-slate-900 shadow-[0_14px_30px_rgba(37,99,235,0.12)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${active ? "text-slate-900" : "text-slate-900"}`}>
                            {item.clientName}
                          </p>
                          <p className={`mt-1 text-xs ${active ? "text-slate-600" : "text-slate-500"}`}>
                            Solicitud #{item.requestId || item.sourceId}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-white text-slate-700 ring-1 ring-[#DBEAFE]" : meta.className}`}>
                          <ActiveIcon size={11} />
                          {meta.label}
                        </span>
                      </div>

                      <div className={`mt-4 flex flex-wrap gap-2 text-xs ${active ? "text-slate-600" : "text-slate-500"}`}>
                        {item.city ? (
                          <span className="inline-flex items-center gap-1">
                            <FiMapPin size={12} />
                            {item.city}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <FiCalendar size={12} />
                          {formatDate(item.requestedAt)}
                        </span>
                        {item.minDate || item.maxDate ? (
                          <span className="inline-flex items-center gap-1">
                            <FiClock size={12} />
                            {item.minDate ? formatDate(item.minDate) : "N/D"}
                            <FiArrowRight size={10} />
                            {item.maxDate ? formatDate(item.maxDate) : "N/D"}
                          </span>
                        ) : null}
                        {item.purchaseType ? (
                          <span className="rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
                            {item.purchaseType === "public" ? "Pública" : "Privada"}
                          </span>
                        ) : null}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          active
                            ? "bg-white text-slate-700 ring-1 ring-[#DBEAFE]"
                            : item.tipoInspeccion === "costos"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {item.tipoInspeccion === "costos" ? "Por costos" : "Normal"}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                  <p className="text-sm font-medium text-slate-700">{sourceMeta.empty}</p>
                  <p className="mt-2 text-xs text-slate-500">Ajusta la búsqueda o vuelve a cargar la bandeja.</p>
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {!selected ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div className="rounded-full border border-slate-200 bg-white p-4 shadow-sm">
                  <sourceMeta.Icon size={24} className="text-slate-400" />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-800">Selecciona una solicitud</p>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  La gestión operativa y el contexto del expediente se mostrarán aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {sourceMeta.sourceLabel}
                      </span>
                      {selected.purchaseType ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          Compra {selected.purchaseType === "public" ? "pública" : "privada"}
                        </span>
                      ) : null}
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        selected.tipoInspeccion === "costos"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {selected.tipoInspeccion === "costos" ? "Por costos" : "Normal"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{selected.clientName}</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Solicitud #{selected.requestId || selected.sourceId}
                      {selected.businessCaseStatus ? ` · Estado BC: ${selected.businessCaseStatus}` : ""}
                      {selected.purchaseStatus ? ` · Estado compra: ${selected.purchaseStatus}` : ""}
                    </p>
                  </div>

                  <span className={`inline-flex items-center gap-2 self-start rounded-full px-3.5 py-2 text-sm font-semibold ${statusMeta.className}`}>
                    <statusMeta.Icon size={15} />
                    {statusMeta.label}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <DetailLine icon={FiCalendar} label="Solicitud" value={formatDate(selected.requestedAt)} />
                  <DetailLine icon={FiMapPin} label="Ciudad / ubicación" value={selected.city || "No registrada"} />
                  <DetailLine icon={FiUser} label="Técnico asignado" value={selected.assignedUserName || selected.assignedTechnicianName || "Pendiente"} />
                  <DetailLine icon={FiCheckCircle} label="Fecha coordinada" value={selected.scheduledDate ? formatDate(selected.scheduledDate) : "Pendiente"} />
                  <DetailLine
                    icon={FiClock}
                    label="Ventana solicitada (min - max)"
                    value={
                      selected.minDate || selected.maxDate
                        ? `${selected.minDate ? formatDate(selected.minDate) : "N/D"} - ${selected.maxDate ? formatDate(selected.maxDate) : "N/D"}`
                        : "No registrada"
                    }
                  />
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Documentos generados</h4>
                  {loadingDocuments ? (
                    <p className="mt-3 text-sm text-slate-500">Cargando documentos...</p>
                  ) : documents.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {documents.map((doc) => (
                        <a
                          key={doc.id}
                          href={doc.drive_link || `https://drive.google.com/file/d/${doc.drive_file_id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-white"
                        >
                          <FiFileText size={13} />
                          {doc.title || "Documento"}
                          <FiExternalLink size={11} className="text-slate-400" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">Aún no hay documentos generados para esta solicitud.</p>
                  )}
                </div>

                {source === "bc" ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Respuesta operativa</h4>
                    {isChiefTechnical && String(selected.status || "").toLowerCase() === "pending" ? (
                      <div className="mt-4 grid gap-5 xl:grid-cols-2">
                        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Aprobar y asignar</p>
                          <select
                            value={coordDrafts[selected.id]?.assigned_user_id || ""}
                            onChange={(event) =>
                              setCoordDrafts((prev) => ({
                                ...prev,
                                [selected.id]: { ...prev[selected.id], assigned_user_id: event.target.value },
                              }))
                            }
                            className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                          >
                            <option value="">Selecciona técnico</option>
                            {bcUsers.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.fullname || option.name || option.email}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            min={selected.minDate || undefined}
                            max={selected.maxDate || undefined}
                            value={coordDrafts[selected.id]?.inspection_date || ""}
                            onChange={(event) =>
                              setCoordDrafts((prev) => ({
                                ...prev,
                                [selected.id]: { ...prev[selected.id], inspection_date: event.target.value },
                              }))
                            }
                            className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                          />
                          {scheduleConflict ? (
                            <p className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                              <FiAlertCircle className="mt-0.5 shrink-0" size={14} />
                              Este colaborador ya tiene {scheduleConflict.rows.length} actividad(es) el {formatDate(scheduleConflict.date)}:{" "}
                              {scheduleConflict.rows.map((row) => row.title).join(", ")}.
                            </p>
                          ) : null}
                          <textarea
                            rows={4}
                            value={coordDrafts[selected.id]?.notes || ""}
                            onChange={(event) =>
                              setCoordDrafts((prev) => ({
                                ...prev,
                                [selected.id]: { ...prev[selected.id], notes: event.target.value },
                              }))
                            }
                            placeholder="Observaciones internas para la coordinación"
                            className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                          />
                          <Button onClick={() => handleBcApprove(selected)} loading={saving} className="w-full justify-center">
                            Aprobar solicitud
                          </Button>
                        </div>

                        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Rechazar</p>
                          <textarea
                            rows={7}
                            value={reviewDrafts[selected.id]?.reason || ""}
                            onChange={(event) =>
                              setReviewDrafts((prev) => ({
                                ...prev,
                                [selected.id]: { ...prev[selected.id], reason: event.target.value },
                              }))
                            }
                            placeholder="Motivo de rechazo"
                            className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                          />
                          <Button variant="danger" onClick={() => handleBcReject(selected)} loading={saving} className="w-full justify-center">
                            Rechazar solicitud
                          </Button>
                        </div>
                      </div>
                    ) : isChiefTechnical && ["approved", "non_compliant_reinspection_pending"].includes(String(selected.status || "")) ? (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          {selected.status === "non_compliant_reinspection_pending"
                            ? "Sitio no conforme en la visita previa. Registra el resultado de la reinspección."
                            : `Solicitud aprobada para ${formatDate(selected.scheduledDate)}. Registra el resultado tras la visita.`}
                        </div>
                        <Fst07ResultPanel
                          minDate={selected.scheduledDate}
                          saving={saving}
                          onSubmit={(payload) => handleBcResult(selected, payload)}
                        />
                      </div>
                    ) : (
                      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        {!isChiefTechnical
                          ? "Esta solicitud está en modo lectura para tu rol."
                          : selected.status === "completed"
                          ? "Inspección conforme. Solicitud completada."
                          : `Solicitud rechazada${selected.reason ? `: ${selected.reason}` : "."}`}
                      </div>
                    )}
                  </div>
                ) : null}

                {source === "compras" ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Respuesta operativa</h4>
                    {isChiefTechnical && String(selected.status || "").toLowerCase() === "pending_review" ? (
                      <div className="mt-4 space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">Revisión de fecha propuesta</p>
                        <p className="text-sm text-slate-600">
                          Fecha propuesta por el flujo: {selected.proposedDate ? formatDate(selected.proposedDate) : "No registrada"}.
                        </p>
                        <textarea
                          rows={4}
                          value={reviewDrafts[selected.id]?.review_notes || ""}
                          onChange={(event) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [selected.id]: { ...prev[selected.id], review_notes: event.target.value },
                            }))
                          }
                          placeholder="Observaciones de revisión"
                          className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                        />
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button onClick={() => handlePurchaseReview(selected, "accept")} loading={saving} className="w-full justify-center">
                            Aceptar propuesta
                          </Button>
                          <Button variant="danger" onClick={() => handlePurchaseReview(selected, "reject")} loading={saving} className="w-full justify-center">
                            Rechazar propuesta
                          </Button>
                        </div>
                      </div>
                    ) : isChiefTechnical && selected.purchaseType === "public" && !selected.scheduledDate ? (
                      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                          <p className="text-sm font-semibold text-slate-900">Coordinar fecha exacta</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="date"
                              min={selected.minDate || undefined}
                              max={selected.maxDate || undefined}
                              value={coordDrafts[selected.id]?.inspection_date || ""}
                              onChange={(event) =>
                                setCoordDrafts((prev) => ({
                                  ...prev,
                                  [selected.id]: { ...prev[selected.id], inspection_date: event.target.value },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                            />
                            <select
                              value={coordDrafts[selected.id]?.assigned_technician_id || ""}
                              onChange={(event) =>
                                setCoordDrafts((prev) => ({
                                  ...prev,
                                  [selected.id]: { ...prev[selected.id], assigned_technician_id: event.target.value },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                            >
                              <option value="">Sin técnico específico</option>
                              {technicalUsers.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.fullname || option.name || option.email}
                                </option>
                              ))}
                            </select>
                          </div>
                          {scheduleConflict ? (
                            <p className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                              <FiAlertCircle className="mt-0.5 shrink-0" size={14} />
                              Este colaborador ya tiene {scheduleConflict.rows.length} actividad(es) el {formatDate(scheduleConflict.date)}:{" "}
                              {scheduleConflict.rows.map((row) => row.title).join(", ")}.
                            </p>
                          ) : null}
                          <textarea
                            rows={4}
                            value={coordDrafts[selected.id]?.notes || ""}
                            onChange={(event) =>
                              setCoordDrafts((prev) => ({
                                ...prev,
                                [selected.id]: { ...prev[selected.id], notes: event.target.value },
                              }))
                            }
                            placeholder="Observaciones para la coordinación"
                            className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                          />
                          <Button onClick={() => handlePurchaseCoordinate(selected)} loading={saving} className="w-full justify-center">
                            Coordinar inspección
                          </Button>
                        </div>

                        <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">Ventana solicitada</p>
                          <p className="mt-2">
                            {selected.minDate ? formatDate(selected.minDate) : "N/D"} <FiArrowRight className="mx-1 inline-block" size={12} />
                            {selected.maxDate ? formatDate(selected.maxDate) : "N/D"}
                          </p>
                          <p className="mt-3 text-xs leading-5 text-slate-500">
                            Esta bandeja responde la solicitud F.ST-20. El resto del procedimiento técnico continúa en su flujo propio.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        {!isChiefTechnical
                          ? "Esta solicitud está disponible en modo consulta para tu rol."
                          : selected.scheduledDate
                          ? `Inspección coordinada para ${formatDate(selected.scheduledDate)}.`
                          : "Esta solicitud no requiere una acción adicional desde esta bandeja en este momento."}
                      </div>
                    )}
                  </div>
                ) : null}

                {source === "independientes" ? (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Detalle de solicitud</h4>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {Object.entries(selected.payload || {})
                        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
                        .slice(0, 8)
                        .map(([key, value]) => (
                          <div key={key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {String(key).replaceAll("_", " ")}
                            </p>
                            <p className="mt-1 text-sm text-slate-700">{String(value)}</p>
                          </div>
                        ))}
                    </div>
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Respuesta operativa</h4>
                      {isChiefTechnical && ["pending", "pendiente", "pending_approval"].includes(String(selected.status || "").toLowerCase()) ? (
                        <div className="mt-4 grid gap-5 xl:grid-cols-2">
                          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">Aprobar y asignar</p>
                            <p className="text-xs text-slate-500">
                              Ventana solicitada: {selected.minDate ? formatDate(selected.minDate) : "N/D"}{" "}
                              <FiArrowRight className="mx-1 inline-block" size={11} />{" "}
                              {selected.maxDate ? formatDate(selected.maxDate) : "N/D"}
                            </p>
                            <select
                              value={coordDrafts[selected.id]?.assigned_user_id || ""}
                              onChange={(event) =>
                                setCoordDrafts((prev) => ({
                                  ...prev,
                                  [selected.id]: { ...prev[selected.id], assigned_user_id: event.target.value },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                            >
                              <option value="">Selecciona técnico</option>
                              {technicalUsers.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.fullname || option.name || option.email}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              min={selected.minDate || undefined}
                              max={selected.maxDate || undefined}
                              value={coordDrafts[selected.id]?.inspection_date || ""}
                              onChange={(event) =>
                                setCoordDrafts((prev) => ({
                                  ...prev,
                                  [selected.id]: { ...prev[selected.id], inspection_date: event.target.value },
                                }))
                              }
                              className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                            />
                            {scheduleConflict ? (
                              <p className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                                <FiAlertCircle className="mt-0.5 shrink-0" size={14} />
                                Este colaborador ya tiene {scheduleConflict.rows.length} actividad(es) el {formatDate(scheduleConflict.date)}:{" "}
                                {scheduleConflict.rows.map((row) => row.title).join(", ")}.
                              </p>
                            ) : null}
                            <textarea
                              rows={3}
                              value={coordDrafts[selected.id]?.notes || ""}
                              onChange={(event) =>
                                setCoordDrafts((prev) => ({
                                  ...prev,
                                  [selected.id]: { ...prev[selected.id], notes: event.target.value },
                                }))
                              }
                              placeholder="Observaciones internas para la coordinación"
                              className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                            />
                            <Button onClick={() => handleIndependentApprove(selected)} loading={saving} className="w-full justify-center">
                              Aprobar solicitud
                            </Button>
                          </div>

                          <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">Rechazar</p>
                            <textarea
                              rows={4}
                              value={reviewDrafts[selected.id]?.reason || ""}
                              onChange={(event) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [selected.id]: { ...prev[selected.id], reason: event.target.value },
                                }))
                              }
                              placeholder="Motivo de rechazo (opcional)"
                              className="w-full rounded-2xl border border-slate-300 px-3 py-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                            />
                            <Button variant="danger" onClick={() => handleIndependentReject(selected)} loading={saving} className="w-full justify-center">
                              Rechazar solicitud
                            </Button>
                          </div>
                        </div>
                      ) : isChiefTechnical && ["aprobado", "approved"].includes(String(selected.status || "").toLowerCase()) ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            Solicitud aprobada y coordinada. Registra el resultado tras la visita.
                          </div>
                          <Fst07ResultPanel
                            minDate={selected.minDate}
                            saving={saving}
                            onSubmit={(payload) => handleIndependentResult(selected, payload)}
                          />
                        </div>
                      ) : (
                        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          {!isChiefTechnical
                            ? "Esta solicitud está en modo lectura para tu rol."
                            : `Solicitud ${getStatusMeta(selected.status).label.toLowerCase()}.`}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {selected.notes ? (
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Observaciones</h4>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.notes}</p>
                  </div>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
};

export default InspectionRequestsWorkspace;
