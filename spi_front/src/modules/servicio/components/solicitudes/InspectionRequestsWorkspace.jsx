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
import AssignInspectionPanel from "./AssignInspectionPanel";
import ServicioWorkspaceShell from "../../design/ServicioWorkspaceShell";
import ServicioRailItem from "../../design/ServicioRailItem";
import ServicioBadge from "../../design/ServicioBadge";
import ServicioCard from "../../design/ServicioCard";
import ServicioEmptyState from "../../design/ServicioEmptyState";

const SOURCE_COPY = {
  bc: {
    title: "Inspecciones desde Business Case",
    helper: "Solicitudes F.ST-20 originadas en business case.",
    empty: "No hay solicitudes de inspección originadas desde business case.",
    Icon: FiBriefcase,
    sourceLabel: "Business Case",
  },
  compras: {
    title: "Inspecciones desde Compras",
    helper: "Solicitudes públicas y privadas originadas en compras.",
    empty: "No hay solicitudes de inspección pendientes desde compras.",
    Icon: FiClipboard,
    sourceLabel: "Compras",
  },
  independientes: {
    title: "Inspecciones Independientes",
    helper: "Solicitudes F.ST-20 creadas de forma directa.",
    empty: "No hay solicitudes independientes registradas.",
    Icon: FiUsers,
    sourceLabel: "Independiente",
  },
};

const SOURCE_FILTERS = [
  { id: "all", label: "Todas" },
  { id: "bc", label: "Business Case" },
  { id: "compras", label: "Compras" },
  { id: "independientes", label: "Independientes" },
];

// Una solicitud pendiente hace mas de 3 dias sin decision es la misma señal
// de urgencia que usa la cola de Inicio (actionQueue.service.js) para
// backlog viejo -- mismo criterio, aplicado aqui a nivel de fila individual
// en vez de a nivel de cola agregada.
const PENDING_STATUS_KEYS = ["pending", "pendiente", "pending_review", "pending_approval"];
const isPendingStatus = (status) => PENDING_STATUS_KEYS.includes(String(status || "").toLowerCase());

const computeUrgency = (item) => {
  const status = String(item.status || "").toLowerCase();
  if (status === "non_compliant_reinspection_pending") return "urgent";
  if (!isPendingStatus(status)) return "resolved";
  const requestedAt = item.requestedAt ? new Date(item.requestedAt).getTime() : null;
  const daysOld = requestedAt ? Math.floor((Date.now() - requestedAt) / 86400000) : 0;
  return daysOld > 3 ? "urgent" : "normal";
};

const URGENCY_RANK = { urgent: 0, normal: 1, resolved: 2 };

const STATUS_META = {
  pending: { label: "Pendiente", tone: "warning", Icon: FiClock },
  // "pendiente" es el status real que usa requests.service.js (español) para
  // toda solicitud F.ST-20 recien creada -- sin este alias, las solicitudes
  // independientes nunca mostraban el estado correcto ni el panel de
  // aprobar/rechazar.
  pendiente: { label: "Pendiente", tone: "warning", Icon: FiClock },
  pending_review: { label: "Pendiente revisión", tone: "warning", Icon: FiClock },
  approved: { label: "Aprobada", tone: "success", Icon: FiCheckCircle },
  aprobado: { label: "Aprobada", tone: "success", Icon: FiCheckCircle },
  accepted: { label: "Aceptada", tone: "success", Icon: FiCheckCircle },
  rejected: { label: "Rechazada", tone: "danger", Icon: FiXCircle },
  rechazado: { label: "Rechazada", tone: "danger", Icon: FiXCircle },
  cancelled: { label: "Cancelada", tone: "neutral", Icon: FiXCircle },
  cancelado: { label: "Cancelada", tone: "neutral", Icon: FiXCircle },
  pending_approval: { label: "Pendiente aprobación", tone: "warning", Icon: FiClock },
  completado: { label: "Completada", tone: "success", Icon: FiCheckCircle },
  completed: { label: "Completada", tone: "success", Icon: FiCheckCircle },
  non_compliant_reinspection_pending: { label: "Reinspección pendiente", tone: "warning", Icon: FiAlertCircle },
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
  return STATUS_META[key] || { label: status || "Sin estado", tone: "neutral", Icon: FiClock };
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

const DetailLine = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 items-start gap-3 rounded-[var(--st-radius-md)] border px-4 py-4" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
    <div className="shrink-0 rounded-full p-2" style={{ background: "var(--st-surface)" }}>
      <Icon size={15} style={{ color: "var(--st-text-muted)" }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase leading-5 tracking-[0.1em] break-normal" style={{ color: "var(--st-text-faint)" }}>
        {label}
      </p>
      <p className="mt-1 text-base font-medium leading-7 break-words" style={{ color: "var(--st-text)" }}>
        {value || "N/D"}
      </p>
    </div>
  </div>
);

const InspectionRequestsWorkspace = ({ initialSourceFilter = "all" }) => {
  const { user } = useAuth();
  const { showToast } = useUI();
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
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState(
    SOURCE_FILTERS.some((s) => s.id === initialSourceFilter) ? initialSourceFilter : "all",
  );
  const currentUserId = Number(user?.id) || null;

  // Antes esta bandeja se montaba 3 veces (una por pestaña de fuente) y cada
  // instancia solo cargaba su propia fuente. Ahora es una sola instancia que
  // trae las 3 en paralelo -- el jefe ya no tiene que recorrer pestañas para
  // saber que necesita su decision, la fuente pasa a ser un filtro
  // secundario dentro de una unica lista ordenada por urgencia.
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bcResult, purchasesResult, independentResult] = await Promise.allSettled([
        listBusinessCases({ page: 1, pageSize: 100 }),
        Promise.allSettled([
          listEquipmentPurchases(),
          loadPrivatePurchasesForInspection(privateRoleParam, isChiefTechnical),
        ]),
        getRequests({ page: 1, pageSize: 100, type: "F.ST-20" }),
      ]);

      const bcItems = bcResult.status === "fulfilled" ? normalizeBcItems(bcResult.value) : [];

      let purchaseItems = [];
      if (purchasesResult.status === "fulfilled") {
        const [publicResult, privateResult] = purchasesResult.value;
        const publicRows = publicResult.status === "fulfilled" && Array.isArray(publicResult.value) ? publicResult.value : [];
        const privateRows = privateResult.status === "fulfilled" ? privateResult.value : [];
        purchaseItems = normalizePurchaseItems(publicRows, privateRows);
      }

      const independentItems = independentResult.status === "fulfilled" ? normalizeIndependentItems(independentResult.value) : [];

      setItems([...bcItems, ...purchaseItems, ...independentItems]);

      if (bcResult.status !== "fulfilled" && purchasesResult.status !== "fulfilled" && independentResult.status !== "fulfilled") {
        throw new Error("No se pudo cargar ninguna fuente de inspección");
      }
    } catch (loadError) {
      setError(loadError?.response?.data?.message || loadError?.message || "No se pudo cargar la bandeja");
    } finally {
      setLoading(false);
    }
  }, [isChiefTechnical, privateRoleParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isChiefTechnical) return;
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
  }, [isChiefTechnical]);

  const itemsWithAssignment = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        // "independientes" (F.ST-20 nativo) no trae el tecnico asignado de
        // vuelta en el payload -- vive solo en el cronograma compartido, no
        // en la fila de `requests`. assignedToMe siempre da false ahi, lo
        // cual es correcto (no hay dato que fabricar), no un bug.
        assignedToMe:
          Boolean(currentUserId) &&
          (Number(item.assignedUserId) === currentUserId || Number(item.assignedTechnicianId) === currentUserId),
        urgency: computeUrgency(item),
      })),
    [items, currentUserId],
  );

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return itemsWithAssignment
      .filter((item) => {
        const matchesQuery =
          !normalized ||
          [item.clientName, item.city, item.requestId, item.purchaseType, item.businessCaseStatus]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalized));
        const matchesAssigned = !assignedToMeOnly || item.assignedToMe;
        const matchesSource = sourceFilter === "all" || item.sourceType === sourceFilter;
        return matchesQuery && matchesAssigned && matchesSource;
      })
      .sort((a, b) => {
        const rankDiff = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.requestedAt || 0).getTime() - new Date(a.requestedAt || 0).getTime();
      });
  }, [itemsWithAssignment, query, assignedToMeOnly, sourceFilter]);

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
  const inputClass = "w-full rounded-[var(--st-radius-md)] border px-3 py-3 text-sm outline-none";
  const inputStyle = { borderColor: "var(--st-border)", color: "var(--st-text)", background: "var(--st-surface)" };

  const railContent = (
    <>
      <div className="border-b p-4" style={{ borderColor: "var(--st-border)" }}>
        <div className="flex items-center gap-3 rounded-[var(--st-radius-md)] border px-3 py-2.5" style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)" }}>
          <FiSearch size={16} style={{ color: "var(--st-text-faint)" }} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar cliente, ciudad o solicitud"
            className="w-full border-0 bg-transparent text-sm outline-none"
            style={{ color: "var(--st-text)" }}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--st-text-muted)" }}>
          <input type="checkbox" checked={assignedToMeOnly} onChange={(event) => setAssignedToMeOnly(event.target.checked)} />
          Solo asignadas a mí
        </label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SOURCE_FILTERS.map((filterOption) => (
            <button
              key={filterOption.id}
              type="button"
              onClick={() => setSourceFilter(filterOption.id)}
              className="rounded-[var(--st-radius-pill)] border px-2.5 py-1 text-[11px] font-semibold transition"
              style={
                sourceFilter === filterOption.id
                  ? { borderColor: "var(--st-accent)", background: "var(--st-accent-soft)", color: "var(--st-accent-strong)" }
                  : { borderColor: "var(--st-border)", color: "var(--st-text-muted)" }
              }
            >
              {filterOption.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Bandeja activa</p>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-[var(--st-radius-sm)] border px-3 py-2 text-xs font-semibold transition disabled:opacity-60"
            style={{ borderColor: "var(--st-border)", color: "var(--st-text-muted)", background: "var(--st-surface)" }}
          >
            <FiRefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="max-h-[65dvh] space-y-3 overflow-y-auto p-4">
        {error ? (
          <div className="flex items-start gap-2 rounded-[var(--st-radius-md)] border px-4 py-3 text-sm" style={{ borderColor: "var(--st-danger)", background: "var(--st-danger-soft)", color: "var(--st-danger)" }}>
            <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading && !items.length ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-[var(--st-radius-lg)]" style={{ background: "var(--st-surface-sunken)" }} />
          ))
        ) : filteredItems.length ? (
          filteredItems.map((item) => {
            const meta = getStatusMeta(item.status);
            const active = item.id === selectedId;
            return (
              <ServicioRailItem
                key={item.id}
                active={active}
                onClick={() => setSelectedId(item.id)}
                title={
                  <>
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                      style={{
                        background:
                          item.urgency === "urgent"
                            ? "var(--st-danger)"
                            : item.urgency === "normal"
                            ? "var(--st-warning)"
                            : "var(--st-text-faint)",
                      }}
                      aria-hidden="true"
                    />
                    {item.clientName}
                    {item.assignedToMe && <ServicioBadge tone="success" className="ml-2">Asignada a mí</ServicioBadge>}
                  </>
                }
                subtitle={
                  <>
                    Solicitud <span className="font-mono-data">#{item.requestId || item.sourceId}</span>
                  </>
                }
                badge={<ServicioBadge tone={meta.tone} icon={meta.Icon}>{meta.label}</ServicioBadge>}
                meta={
                  <>
                    <ServicioBadge tone="neutral">{SOURCE_COPY[item.sourceType]?.sourceLabel || item.sourceType}</ServicioBadge>
                    {item.city ? (
                      <span className="inline-flex items-center gap-1"><FiMapPin size={12} />{item.city}</span>
                    ) : null}
                    <span className="inline-flex items-center gap-1"><FiCalendar size={12} />{formatDate(item.requestedAt)}</span>
                    {item.minDate || item.maxDate ? (
                      <span className="inline-flex items-center gap-1">
                        <FiClock size={12} />
                        {item.minDate ? formatDate(item.minDate) : "N/D"}
                        <FiArrowRight size={10} />
                        {item.maxDate ? formatDate(item.maxDate) : "N/D"}
                      </span>
                    ) : null}
                    {item.purchaseType ? (
                      <ServicioBadge tone="neutral">{item.purchaseType === "public" ? "Pública" : "Privada"}</ServicioBadge>
                    ) : null}
                    <ServicioBadge tone={item.tipoInspeccion === "costos" ? "accent" : "neutral"}>
                      {item.tipoInspeccion === "costos" ? "Por costos" : "Normal"}
                    </ServicioBadge>
                  </>
                }
              />
            );
          })
        ) : (
          <ServicioEmptyState icon={FiClipboard} title="No hay solicitudes de inspección" description="Ajusta la búsqueda, el filtro de fuente o vuelve a cargar la bandeja." />
        )}
      </div>
    </>
  );

  const selectedSourceMeta = SOURCE_COPY[selected?.sourceType] || SOURCE_COPY.bc;

  const detailContent = !selected ? (
    <ServicioEmptyState icon={FiClipboard} title="Selecciona una solicitud" description="La gestión operativa y el contexto del expediente se mostrarán aquí." />
  ) : (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ServicioBadge tone="neutral">{selectedSourceMeta.sourceLabel}</ServicioBadge>
            {selected.purchaseType ? (
              <ServicioBadge tone="neutral">Compra {selected.purchaseType === "public" ? "pública" : "privada"}</ServicioBadge>
            ) : null}
            <ServicioBadge tone={selected.tipoInspeccion === "costos" ? "accent" : "neutral"}>
              {selected.tipoInspeccion === "costos" ? "Por costos" : "Normal"}
            </ServicioBadge>
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--st-text)", fontFamily: "var(--st-font-display)" }}>
            {selected.clientName}
          </h3>
          <p className="mt-2 text-sm" style={{ color: "var(--st-text-muted)" }}>
            Solicitud <span className="font-mono-data">#{selected.requestId || selected.sourceId}</span>
            {selected.businessCaseStatus ? ` · Estado BC: ${selected.businessCaseStatus}` : ""}
            {selected.purchaseStatus ? ` · Estado compra: ${selected.purchaseStatus}` : ""}
          </p>
        </div>

        <ServicioBadge tone={statusMeta.tone} icon={statusMeta.Icon} className="self-start !px-3.5 !py-2 !text-sm">
          {statusMeta.label}
        </ServicioBadge>
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

      <ServicioCard className="p-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Documentos generados</h4>
        {loadingDocuments ? (
          <p className="mt-3 text-sm" style={{ color: "var(--st-text-muted)" }}>Cargando documentos...</p>
        ) : documents.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {documents.map((doc) => (
              <a
                key={doc.id}
                href={doc.drive_link || `https://drive.google.com/file/d/${doc.drive_file_id}/view`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-[var(--st-radius-md)] border px-3.5 py-2 text-xs font-semibold transition"
                style={{ borderColor: "var(--st-border)", background: "var(--st-surface-sunken)", color: "var(--st-text)" }}
              >
                <FiFileText size={13} />
                {doc.title || "Documento"}
                <FiExternalLink size={11} style={{ color: "var(--st-text-faint)" }} />
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm" style={{ color: "var(--st-text-muted)" }}>Aún no hay documentos generados para esta solicitud.</p>
        )}
      </ServicioCard>

      {selected.sourceType === "bc" ? (
        <ServicioCard className="p-5" style={{ background: "var(--st-surface-sunken)" }}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Respuesta operativa</h4>
          {isChiefTechnical && String(selected.status || "").toLowerCase() === "pending" ? (
            <div className="mt-4">
              <AssignInspectionPanel
                minDate={selected.minDate}
                maxDate={selected.maxDate}
                technicians={bcUsers}
                technicianValue={coordDrafts[selected.id]?.assigned_user_id || ""}
                onTechnicianChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], assigned_user_id: value } }))}
                dateValue={coordDrafts[selected.id]?.inspection_date || ""}
                onDateChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], inspection_date: value } }))}
                notesValue={coordDrafts[selected.id]?.notes || ""}
                onNotesChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], notes: value } }))}
                scheduleConflict={scheduleConflict}
                onAssign={() => handleBcApprove(selected)}
                saving={saving}
                onReject={() => handleBcReject(selected)}
                rejectValue={reviewDrafts[selected.id]?.reason || ""}
                onRejectChange={(value) => setReviewDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], reason: value } }))}
              />
            </div>
          ) : isChiefTechnical && ["approved", "non_compliant_reinspection_pending"].includes(String(selected.status || "")) ? (
            <div className="mt-4 space-y-3">
              <ServicioCard className="p-4 text-sm" style={{ color: "var(--st-text-muted)" }}>
                {selected.status === "non_compliant_reinspection_pending"
                  ? "Sitio no conforme en la visita previa. Registra el resultado de la reinspección."
                  : `Solicitud aprobada para ${formatDate(selected.scheduledDate)}. Registra el resultado tras la visita.`}
              </ServicioCard>
              <Fst07ResultPanel minDate={selected.scheduledDate} saving={saving} onSubmit={(payload) => handleBcResult(selected, payload)} />
            </div>
          ) : (
            <ServicioCard className="mt-4 p-4 text-sm" style={{ color: "var(--st-text-muted)" }}>
              {!isChiefTechnical
                ? "Esta solicitud está en modo lectura para tu rol."
                : selected.status === "completed"
                ? "Inspección conforme. Solicitud completada."
                : `Solicitud rechazada${selected.reason ? `: ${selected.reason}` : "."}`}
            </ServicioCard>
          )}
        </ServicioCard>
      ) : null}

      {selected.sourceType === "compras" ? (
        <ServicioCard className="p-5" style={{ background: "var(--st-surface-sunken)" }}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Respuesta operativa</h4>
          {isChiefTechnical && String(selected.status || "").toLowerCase() === "pending_review" ? (
            <ServicioCard className="mt-4 space-y-3 p-4">
              <p className="text-sm font-semibold" style={{ color: "var(--st-text)" }}>Revisión de fecha propuesta</p>
              <p className="text-sm" style={{ color: "var(--st-text-muted)" }}>
                Fecha propuesta por el flujo: {selected.proposedDate ? formatDate(selected.proposedDate) : "No registrada"}.
              </p>
              <textarea
                rows={4}
                value={reviewDrafts[selected.id]?.review_notes || ""}
                onChange={(event) => setReviewDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], review_notes: event.target.value } }))}
                placeholder="Observaciones de revisión"
                className={inputClass}
                style={inputStyle}
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => handlePurchaseReview(selected, "accept")} loading={saving} className="w-full justify-center">Aceptar propuesta</Button>
                <Button variant="danger" onClick={() => handlePurchaseReview(selected, "reject")} loading={saving} className="w-full justify-center">Rechazar propuesta</Button>
              </div>
            </ServicioCard>
          ) : isChiefTechnical && selected.purchaseType === "public" && !selected.scheduledDate ? (
            <div className="mt-4">
              <AssignInspectionPanel
                minDate={selected.minDate}
                maxDate={selected.maxDate}
                technicians={technicalUsers}
                technicianRequired={false}
                technicianValue={coordDrafts[selected.id]?.assigned_technician_id || ""}
                onTechnicianChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], assigned_technician_id: value } }))}
                dateValue={coordDrafts[selected.id]?.inspection_date || ""}
                onDateChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], inspection_date: value } }))}
                notesValue={coordDrafts[selected.id]?.notes || ""}
                onNotesChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], notes: value } }))}
                scheduleConflict={scheduleConflict}
                onAssign={() => handlePurchaseCoordinate(selected)}
                saving={saving}
              />
            </div>
          ) : (
            <ServicioCard className="mt-4 p-4 text-sm" style={{ color: "var(--st-text-muted)" }}>
              {!isChiefTechnical
                ? "Esta solicitud está disponible en modo consulta para tu rol."
                : selected.scheduledDate
                ? `Inspección coordinada para ${formatDate(selected.scheduledDate)}.`
                : "Esta solicitud no requiere una acción adicional desde esta bandeja en este momento."}
            </ServicioCard>
          )}
        </ServicioCard>
      ) : null}

      {selected.sourceType === "independientes" ? (
        <ServicioCard className="p-5" style={{ background: "var(--st-surface-sunken)" }}>
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Detalle de solicitud</h4>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(selected.payload || {})
              .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
              .slice(0, 8)
              .map(([key, value]) => (
                <ServicioCard key={key} className="px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--st-text-faint)" }}>{String(key).replaceAll("_", " ")}</p>
                  <p className="mt-1 text-sm" style={{ color: "var(--st-text)" }}>{String(value)}</p>
                </ServicioCard>
              ))}
          </div>
          <div className="mt-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Respuesta operativa</h4>
            {isChiefTechnical && ["pending", "pendiente", "pending_approval"].includes(String(selected.status || "").toLowerCase()) ? (
              <div className="mt-4">
                <AssignInspectionPanel
                  minDate={selected.minDate}
                  maxDate={selected.maxDate}
                  technicians={technicalUsers}
                  technicianValue={coordDrafts[selected.id]?.assigned_user_id || ""}
                  onTechnicianChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], assigned_user_id: value } }))}
                  dateValue={coordDrafts[selected.id]?.inspection_date || ""}
                  onDateChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], inspection_date: value } }))}
                  notesValue={coordDrafts[selected.id]?.notes || ""}
                  onNotesChange={(value) => setCoordDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], notes: value } }))}
                  scheduleConflict={scheduleConflict}
                  onAssign={() => handleIndependentApprove(selected)}
                  saving={saving}
                  onReject={() => handleIndependentReject(selected)}
                  rejectValue={reviewDrafts[selected.id]?.reason || ""}
                  onRejectChange={(value) => setReviewDrafts((prev) => ({ ...prev, [selected.id]: { ...prev[selected.id], reason: value } }))}
                  rejectPlaceholder="Motivo de rechazo (opcional)"
                  rejectRequired={false}
                />
              </div>
            ) : isChiefTechnical && ["aprobado", "approved"].includes(String(selected.status || "").toLowerCase()) ? (
              <div className="mt-4 space-y-3">
                <ServicioCard className="p-4 text-sm" style={{ color: "var(--st-text-muted)" }}>
                  Solicitud aprobada y coordinada. Registra el resultado tras la visita.
                </ServicioCard>
                <Fst07ResultPanel minDate={selected.minDate} saving={saving} onSubmit={(payload) => handleIndependentResult(selected, payload)} />
              </div>
            ) : (
              <ServicioCard className="mt-4 p-4 text-sm" style={{ color: "var(--st-text-muted)" }}>
                {!isChiefTechnical
                  ? "Esta solicitud está en modo lectura para tu rol."
                  : `Solicitud ${getStatusMeta(selected.status).label.toLowerCase()}.`}
              </ServicioCard>
            )}
          </div>
        </ServicioCard>
      ) : null}

      {selected.notes ? (
        <ServicioCard className="p-5">
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--st-text-faint)" }}>Observaciones</h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6" style={{ color: "var(--st-text-muted)" }}>{selected.notes}</p>
        </ServicioCard>
      ) : null}
    </div>
  );

  return (
    <ServicioWorkspaceShell
      eyebrow="Inspección de ambiente"
      eyebrowIcon={FiClipboard}
      title="Inspecciones de ambiente"
      description="Business Case, Compras e Independientes en una sola bandeja, priorizada por urgencia."
      metrics={[
        { label: "Solicitudes", value: items.length },
        { label: "Pendientes", value: pendingCount },
        { label: "Resueltas", value: approvedCount },
      ]}
      rail={railContent}
      detail={detailContent}
    />
  );
};

export default InspectionRequestsWorkspace;
