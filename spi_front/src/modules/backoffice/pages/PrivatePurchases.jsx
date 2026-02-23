import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FiChevronDown,
  FiClock,
  FiCheckCircle,
  FiDownload,
  FiFileText,
  FiRefreshCw,
  FiSend,
  FiShare,
  FiUpload,
  FiUsers,
  FiX,
  FiPackage,
  FiSearch,
  FiUser,
} from "react-icons/fi";
import Button from "../../../core/ui/components/Button";
import Card from "../../../core/ui/components/Card";
import Modal from "../../../core/ui/components/Modal";
import ProcessingOverlay from "../../../core/ui/components/ProcessingOverlay";
import { useAuth } from "../../../core/auth/useAuth";
import { useApi } from "../../../core/hooks/useApi";
import { useUI } from "../../../core/ui/useUI";
import { formatDateTimeEC } from "../../../core/utils/dateUtils";
import NewClientRequestForm from "../../comercial/components/NewClientRequestForm";
import {
  forwardPrivatePurchaseToAcp,
  getPrivatePurchaseDocuments,
  listPrivatePurchases,
  getMyPrivatePurchases,
  checkClientApproval,
  coordinatePrivatePurchaseInspectionDate,
  reviewPrivatePurchaseInspectionDate,
  requestDeliveryDates,
  requestClientRegistration,
  savePrivatePurchaseInspectionRequest,
  sendPrivatePurchaseOffer,
  savePrivatePurchaseProviderResponse,
  startPrivatePurchaseAvailability,
  submitDeliveryDates,
  transitionPrivatePurchaseState,
  updateClientRegistration,
  uploadPrivatePurchaseContract,
  uploadPrivatePurchaseClientSignedContract,
  uploadPrivateSignedOffer,
} from "../../../core/api/privatePurchasesApi";
import {
  PRIVATE_PURCHASE_STATUS_DEFINITIONS,
  PRIVATE_PURCHASE_ERROR_CODES,
  PRIVATE_PURCHASE_ERROR_MESSAGES,
  STATES_REQUIRING_DOCS_CHECK,
} from "../../shared/constants/privatePurchaseConstants";
import {
  PRIVATE_PURCHASE_STATUS_CONFIG,
  PRIVATE_PURCHASE_PROCESSING_STEPS,
  PRIVATE_PURCHASE_SUCCESS_MESSAGES,
  PRIVATE_PURCHASE_EMPTY_STATES,
  PRIVATE_PURCHASE_LOADING_MESSAGES,
  PRIVATE_PURCHASE_MODAL_TITLES,
  PRIVATE_PURCHASE_FILE_LABELS,
} from "./PrivatePurchasesWidget.constants";
import {
  getPrivatePurchaseStatusConfig,
  formatPrivatePurchaseDate,
  calculateMissingDocuments,
  getPrivatePurchaseSummary,
  filterPrivatePurchaseRequests,
  getPrivatePurchaseEquipmentInfo,
  getPrivatePurchaseClientInfo,
  buildUnsignedFolderPath,
  fileToBase64,
  validatePrivatePurchaseFile,
  getPrivatePurchasePaginationInfo,
  canPerformPrivatePurchaseAction,
} from "./PrivatePurchasesWidget.utils";
import PrivatePurchaseActions from "./PrivatePurchaseActions";
import { usePurchaseSSE } from "../../../core/hooks/usePurchaseSSE";

const STATUS_DEFINITIONS = PRIVATE_PURCHASE_STATUS_DEFINITIONS;

const statusLookup = STATUS_DEFINITIONS.reduce((acc, def) => {
  acc[def.value] = def;
  return acc;
}, {});

const formatDate = (value) => formatDateTimeEC(value, "Sin fecha");
const OFFER_KIND_LABELS = {
  venta: "Venta directa",
  alquiler: "Alquiler",
  alquiler_transferencia_dominio: "Alquiler con transferencia de dominio",
  alquiler_con_transferencia_de_dominio: "Alquiler con transferencia de dominio",
  prestamo: "Alquiler",
  comodato: "Comodato",
};
const resolveOfferKindLabel = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return OFFER_KIND_LABELS[key] || "Venta directa";
};
const formatChecklistActionLabel = (checklistState = {}) => {
  if (checklistState?.action_label) return checklistState.action_label;
  const raw = String(checklistState?.action || "")
    .replace(/_/g, " ")
    .trim();
  if (!raw) return "Paso no definido";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const PrivatePurchasesPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useUI();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [listQuery, setListQuery] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [offerModal, setOfferModal] = useState({
    open: false,
    loading: false,
    file: null,
  });
  const [signedModal, setSignedModal] = useState({
    open: false,
    loading: false,
    file: null,
  });
  const [contractModal, setContractModal] = useState({
    open: false,
    loading: false,
    file: null,
    reason: "",
    mode: "draft"
  });
  const [deliveryDateModal, setDeliveryDateModal] = useState({
    open: false,
    loading: false,
    start: "",
    end: "",
    notes: ""
  });
  const [inspectionCoordinationDraft, setInspectionCoordinationDraft] = useState({
    inspection_date: "",
    notes: "",
    loading: false,
  });
  const [processingAction, setProcessingAction] = useState(null);
  const [documentLinks, setDocumentLinks] = useState([]);
  const [documentsById, setDocumentsById] = useState({});
  const [documentsLoadingById, setDocumentsLoadingById] = useState({});
  const [acpEmailModal, setAcpEmailModal] = useState({
    open: false,
    loading: false,
    requestId: null,
    providerEmail: "",
    notes: ""
  });
  const [acpResponseModal, setAcpResponseModal] = useState({
    open: false,
    loading: false,
    requestId: null,
    outcome: "available",
    notes: "",
    items: []
  });
  const [clientRegistrationModal, setClientRegistrationModal] = useState({
    open: false,
    loading: false,
    requestId: null,
    clientData: null,
    documents: []
  });
  const autoClientRegistrationInFlight = useRef(new Map());

  // Gating state for resubmit functionality
  const [missingDocsList, setMissingDocsList] = useState([]);
  const [isResubmitDisabled, setIsResubmitDisabled] = useState(false);
  const { role, user } = useAuth();
  const rawRoleValue = role || user?.role || user?.role_name || user?.scope || "";
  const rolesArray = Array.isArray(user?.roles) ? user.roles.join(" ") : "";
  const roleText = [rawRoleValue, rolesArray].filter(Boolean).join(" ");
  const normalizedRole = (roleText || "").toLowerCase();
  const normalizedScope = (user?.scope || "").toLowerCase();
  const hasRoleToken = (token) => normalizedRole.includes(token) || normalizedScope.includes(token);
  const isBackofficeUser = hasRoleToken("backoffice");
  const isAcpUser =
    hasRoleToken("acp_comercial") ||
    (hasRoleToken("acp") && hasRoleToken("comercial")) ||
    hasRoleToken("acp-comercial") ||
    hasRoleToken("acp comercial");
  const isManagerUser =
    normalizedRole.includes("gerencia") ||
    normalizedRole.includes("jefe_comercial");
  const isGerenciaGeneral = hasRoleToken("gerencia_general");
  const isChiefCommercial = hasRoleToken("jefe_comercial");
  const isTechnicalCoordinator =
    hasRoleToken("jefe_tecnico") ||
    hasRoleToken("jefe_servicio_tecnico") ||
    hasRoleToken("tecnico");
  const isPureCommercial =
    !isBackofficeUser &&
    !isManagerUser &&
    !isAcpUser &&
    (normalizedRole.startsWith("comercial") || normalizedScope.startsWith("comercial"));
  const canCoordinatePrivateInspection =
    isPureCommercial || hasRoleToken("jefe_comercial") || hasRoleToken("acp_comercial");
  const canReviewPrivateInspectionCoordination =
    hasRoleToken("jefe_tecnico") || hasRoleToken("jefe_servicio_tecnico");
  const canManageRequests = isBackofficeUser || isManagerUser || isAcpUser || isTechnicalCoordinator;
  const canViewRequests = canManageRequests || isPureCommercial;
  const statusOwnerLabels = {
    pending_backoffice: "Backoffice Comercial",
    acp_availability_requested: "ACP Comercial",
    acp_availability_confirmed: "Backoffice Comercial",
    acp_availability_rejected: "Backoffice Comercial",
    offer_sent: "Comercial",
    pending_client_signature: "Comercial",
    offer_rejected_by_commercial: "Jefe Comercial",
    price_improvement_requested: "ACP Comercial",
    offer_signed: "Backoffice Comercial",
    client_registration_requested: "Comercial",
    client_registered: "Backoffice Comercial",
    inspection_requested: "Comercial",
    pending_contract_client_signature: "Comercial",
    pending_contract_approval: "Gerencia",
    contract_available: "Operaciones",
  };
  const contractMode = contractModal.mode || "draft";
  const contractModalTitle =
    contractMode === "client_signed"
      ? "Subir contrato firmado por cliente"
      : contractMode === "manager_signed"
        ? "Subir contrato firmado por gerencia"
        : "Subir contrato borrador";
  const contractModalHint =
    contractMode === "client_signed"
      ? "Adjunta el contrato firmado por el cliente para enviarlo a gerencia."
      : contractMode === "manager_signed"
        ? "Adjunta el contrato firmado por gerencia para dejarlo disponible en operaciones."
        : "Adjunta el contrato sin firmar para solicitar la firma del cliente.";
  const showContractReason = contractMode === "manager_signed";
  const contractModalButtonLabel =
    contractMode === "client_signed"
      ? "Subir contrato firmado"
      : contractMode === "manager_signed"
        ? "Subir contrato firmado"
        : "Subir contrato";
  const processingActionTypeMap = {
    register: "clientRegistration",
    client_registration: "clientRegistration",
    forward: "sendingToAcp",
    resubmit: "resubmit",
    request_dates: "requestDates",
    reject: "reject",
    acp_send_email: "acpSendEmail",
    acp_response: "acpResponse",
    availability_accept: "availabilityAccept",
    availability_reject: "availabilityReject",
    offer_upload: "offerUpload",
    signed_upload: "signedUpload",
    commercial_reject_accept: "reject",
    price_improvement_request: "forward",
    offer_reject_by_commercial: "reject",
  };
  const processingConfigKey =
    processingAction ? processingActionTypeMap[processingAction.type] || null : null;
  const processingStep = processingConfigKey
    ? PRIVATE_PURCHASE_PROCESSING_STEPS[processingConfigKey]
    : null;
  const processingTitle = processingConfigKey
    ? PRIVATE_PURCHASE_MODAL_TITLES.processing?.[processingConfigKey]
    : null;

  const privatePurchasesFetcher = useCallback(
    (params) => {
      if (isPureCommercial) {
        return getMyPrivatePurchases();
      }
      return listPrivatePurchases(params);
    },
    [isPureCommercial],
  );

  const { data, loading, execute: fetchPrivatePurchases, setData: setPrivatePurchasesData } = useApi(
    privatePurchasesFetcher,
    { errorMsg: "No se pudo cargar las solicitudes privadas" },
  );

  const rawRequests = canViewRequests ? data?.rows || data || [] : [];
  const userEmail = (user?.email || "").toLowerCase();
  const userId = user?.id ? String(user.id) : "";
  const userFullname = (user?.fullname || user?.name || "").toLowerCase();
  const isOwnedRequest = useCallback(
    (req) => {
      if (!req) return false;
      const createdBy = req.created_by;
      const createdById = req.created_by_id;
      const createdByEmail = (req.created_by_email || "").toLowerCase();
      const createdByName = (req.created_by_name || req.created_by_fullname || "").toLowerCase();

      if (userId) {
        if (createdById && String(createdById) === userId) return true;
        if (createdBy && String(createdBy) === userId) return true;
      }
      if (userEmail) {
        if (createdByEmail && createdByEmail === userEmail) return true;
        if (typeof createdBy === "string" && createdBy.toLowerCase() === userEmail) return true;
      }
      if (userFullname) {
        if (createdByName && createdByName === userFullname) return true;
        if (typeof createdBy === "string" && createdBy.toLowerCase() === userFullname) return true;
      }
      return false;
    },
    [userEmail, userFullname, userId]
  );

  const requests = useMemo(() => {
    if (!isPureCommercial) return rawRequests;
    return rawRequests.filter(isOwnedRequest);
  }, [isOwnedRequest, isPureCommercial, rawRequests]);

  const filteredRequests = useMemo(
    () => filterPrivatePurchaseRequests(requests, statusFilter, listQuery),
    [requests, statusFilter, listQuery]
  );

  const selectedRequest = useMemo(
    () => requests.find((req) => req.id === selectedId) || null,
    [requests, selectedId],
  );
  const getRequestById = useCallback(
    (requestId) => requests.find((req) => req.id === requestId) || null,
    [requests]
  );
  const [detailModalRequest, setDetailModalRequest] = useState(null);
  const isComodatoRequest = Boolean(detailModalRequest?.offer_kind === "comodato");
  const comodatoChecklistStatus = isComodatoRequest
    ? {
      bcReady: Boolean(detailModalRequest.business_case_id),
      acpReady: Boolean(detailModalRequest.provider_response_at),
      sendOfferBlocked:
        detailModalRequest.status !== "acp_availability_confirmed" ||
        !detailModalRequest.business_case_id ||
        !detailModalRequest.provider_response_at,
    }
    : {
      bcReady: false,
      acpReady: false,
      sendOfferBlocked: false,
    };
  const sendOfferBlocked = Boolean(comodatoChecklistStatus.sendOfferBlocked);

  const handleDetailOpen = (req) => {
    setSelectedId(req.id);
    setDetailModalRequest(req);
  };

  const handleDetailClose = () => setDetailModalRequest(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        if (!detailModalRequest?.id) {
          setDocumentLinks([]);
          return;
        }
        const docs = await getPrivatePurchaseDocuments(detailModalRequest.id);
        setDocumentLinks(Array.isArray(docs) ? docs : []);
      } catch (error) {
        console.error('[FLOW_PRIVADA][FE][EXPEDIENTE][ERROR]', error);
        setDocumentLinks([]);
      }
    };
    loadDocuments();
  }, [detailModalRequest]);

  const handlePrivatePurchaseEvent = useCallback(({ request }) => {
    if (!request) return;
    if (isPureCommercial && !isOwnedRequest(request)) return;
    setPrivatePurchasesData((prev) => {
      const rows = Array.isArray(prev?.rows) ? [...prev.rows] : [];
      const idx = rows.findIndex((item) => item.id === request.id);
      if (idx >= 0) {
        rows[idx] = {
          ...rows[idx],
          ...request,
          checklist_state: request.checklist_state || rows[idx]?.checklist_state || null,
        };
      } else {
        rows.unshift(request);
      }
      return { ...prev, rows };
    });
  }, [isOwnedRequest, isPureCommercial, setPrivatePurchasesData]);

  usePurchaseSSE({
    type: "private",
    onEvent: handlePrivatePurchaseEvent,
    debounceMs: 1200,
    enabled: canViewRequests,
  });

  const visibleDocumentLinks = useMemo(() => {
    if (isGerenciaGeneral) return documentLinks;
    const allowedDocTypes = new Set([
      "OFFER",
      "SIGNED_OFFER",
      "CONTRACT_DRAFT",
      "CONTRACT_CLIENT_SIGNED",
      "CONTRACT_SIGNED",
      "DELIVERY_ACT",
      "COMODATO"
    ]);
    return documentLinks.filter((doc) => allowedDocTypes.has(doc.doc_type));
  }, [documentLinks, isGerenciaGeneral]);

  const loadDocumentsForRequest = useCallback(
    async (requestId) => {
      if (!requestId) return;
      if (documentsById[requestId]) return;
      setDocumentsLoadingById((prev) => ({ ...prev, [requestId]: true }));
      try {
        const docs = await getPrivatePurchaseDocuments(requestId);
        setDocumentsById((prev) => ({
          ...prev,
          [requestId]: Array.isArray(docs) ? docs : []
        }));
      } catch (error) {
        console.error('[FLOW_PRIVADA][FE][DOCS_CARD][ERROR]', error);
        setDocumentsById((prev) => ({ ...prev, [requestId]: [] }));
      } finally {
        setDocumentsLoadingById((prev) => ({ ...prev, [requestId]: false }));
      }
    },
    [documentsById]
  );

  useEffect(() => {
    if (!expandedRequestId) return;
    if (documentsById[expandedRequestId]) return;
    loadDocumentsForRequest(expandedRequestId);
  }, [expandedRequestId, documentsById, loadDocumentsForRequest]);

  const getDocumentLink = (docs, docType) => {
    if (!Array.isArray(docs)) return null;
    const match = docs.find((doc) => doc.doc_type === docType);
    return match?.link || null;
  };

  const getFlowIdForRequest = (requestId) => {
    if (!requestId) return null;
    return localStorage.getItem(`private_purchase_flow_${requestId}`);
  };


  useEffect(() => {
    if (!canViewRequests) return;
    fetchPrivatePurchases({
      status: statusFilter !== "all" ? statusFilter : undefined,
    });
  }, [fetchPrivatePurchases, statusFilter, canViewRequests]);

  useEffect(() => {
    if (!isBackofficeUser || !requests.length) return;

    const pendingRequests = requests.filter(
      (req) => req.status === "client_registration_requested"
    );

    if (pendingRequests.length === 0) return;

    const now = Date.now();
    const shouldCheck = (requestId) => {
      const lastCheck = autoClientRegistrationInFlight.current.get(requestId);
      return !lastCheck || now - lastCheck > 60000;
    };

    const checkAndSyncApprovals = async () => {
      for (const request of pendingRequests) {
        if (!shouldCheck(request.id)) continue;
        autoClientRegistrationInFlight.current.set(request.id, now);

        try {
          const approval = await checkClientApproval(request.id);
          if (!approval?.isApproved) continue;

          const updated = await updateClientRegistration(
            request.id,
            approval.clientId
          );

          setPrivatePurchasesData((prev) => {
            const rows = Array.isArray(prev?.rows) ? prev.rows : Array.isArray(prev) ? prev : [];
            const updatedRows = rows.map((row) =>
              row.id === request.id ? { ...row, ...updated } : row
            );
            return Array.isArray(prev) ? updatedRows : { ...prev, rows: updatedRows };
          });

        } catch (error) {
          console.error("[FLOW_PRIVADA][FE][CLIENT_APPROVAL][ERROR]", {
            requestId: request.id,
            error: error.response?.data || error.message
          });
        }
      }
    };

    checkAndSyncApprovals();
  }, [isBackofficeUser, requests, setPrivatePurchasesData]);

  useEffect(() => {
    if (!requests.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !requests.some((req) => req.id === selectedId)) {
      setSelectedId(requests[0].id);
    }
  }, [requests, selectedId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const purchaseId = params.get("purchaseId");
    if (!purchaseId || !requests.length) return;

    const target = requests.find((req) => String(req.id) === String(purchaseId));
    if (!target) return;

    setSelectedId(target.id);
    setDetailModalRequest(target);
  }, [location.search, requests]);

  useEffect(() => {
    if (!detailModalRequest?.id) return;
    const updated = requests.find((req) => req.id === detailModalRequest.id);
    if (!updated) return;
    setDetailModalRequest(updated);
  }, [detailModalRequest?.id, requests]);

  useEffect(() => {
    if (!detailModalRequest?.id) return;
    setInspectionCoordinationDraft((prev) => ({
      ...prev,
      inspection_date: detailModalRequest.inspection_proposed_date || "",
      notes: detailModalRequest.inspection_proposed_notes || detailModalRequest.inspection_coordination_notes || "",
      review_notes: detailModalRequest.inspection_review_notes || "",
    }));
  }, [
    detailModalRequest?.id,
    detailModalRequest?.inspection_proposed_date,
    detailModalRequest?.inspection_proposed_notes,
    detailModalRequest?.inspection_coordination_notes,
    detailModalRequest?.inspection_review_notes,
  ]);

  // Calculate missing documents for resubmit gating
  useEffect(() => {
    if (selectedRequest?.status === 'contract_rejected') {
      const missing = calculateMissingDocuments(selectedRequest);
      setMissingDocsList(missing);
      setIsResubmitDisabled(missing.length > 0);
    } else {
      setMissingDocsList([]);
      setIsResubmitDisabled(false);
    }
  }, [selectedRequest]);

  const statusCounts = useMemo(() => {
    const counts = STATUS_DEFINITIONS.reduce((acc, def) => {
      acc[def.value] = 0;
      return acc;
    }, {});
    requests.forEach((req) => {
      counts[req.status] = (counts[req.status] || 0) + 1;
    });
    return counts;
  }, [requests]);

  const kpiRows = useMemo(() => {
    const sum = (statuses) =>
      statuses.reduce((acc, status) => acc + (statusCounts[status] || 0), 0);

    return [
      { key: "total", label: "Total", count: requests.length },
      {
        key: "pending",
        label: "Pendientes",
        count: sum(["pending_commercial", "pending_backoffice"]),
      },
      {
        key: "offer_contract",
        label: "Oferta/Contrato",
        count: sum([
          "offer_sent",
          "pending_client_signature",
          "offer_rejected_by_commercial",
          "offer_signed",
          "client_registration_requested",
          "client_registered",
          "inspection_requested",
          "pending_contract_approval",
          "contract_rejected",
          "contract_available",
        ]),
      },
      {
        key: "acp_ops",
        label: "ACP/Operaciones/Logistica",
        count: sum([
          "sent_to_acp",
          "acp_availability_requested",
          "acp_availability_confirmed",
          "acp_availability_rejected",
          "price_improvement_requested",
          "business_case_in_progress",
          "business_case_under_review",
          "business_case_feasibility_approved",
          "business_case_rejected",
          "delivery_dates_requested",
          "delivery_dates_submitted",
          "calendar_events_created",
          "waiting_dispatch",
          "dispatch_ready",
          "delivery_act_generated",
          "delivered_signed",
        ]),
      },
      {
        key: "rejected",
        label: "Rechazadas",
        count: sum(["rejected"]),
      },
    ];
  }, [requests.length, statusCounts]);

  const buildUnsignedFolderPath = () => {
    const commercial =
      selectedRequest?.created_by_email ||
      selectedRequest?.created_by ||
      user?.email ||
      "comercial";
    const client = selectedRequest?.client_snapshot?.commercial_name || "cliente";
    return `/Ofertas Sin Firmar/${commercial}/${client}`;
  };

  const handleOfferSubmit = async () => {
    if (!selectedRequest) return;
    if (!offerModal.file) {
      showToast("Selecciona un archivo de oferta", "warning");
      return;
    }

    setOfferModal((prev) => ({ ...prev, loading: true }));

    try {
      const base64 = await fileToBase64(offerModal.file);
      if (!base64 || !base64.includes(",")) {
        showToast("No se pudo leer el archivo, intenta nuevamente", "error");
        setOfferModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      const base64payload = base64.split(",")[1];
      if (!base64payload || !base64payload.trim()) {
        showToast("El archivo de oferta estÃƒÂ¡ vacÃƒÂ­o o no se pudo procesar", "error");
        setOfferModal((prev) => ({ ...prev, loading: false }));
        return;
      }

      await sendPrivatePurchaseOffer(selectedRequest.id, {
        offer_base64: base64payload,
        file_name: offerModal.file.name,
        folder_path: buildUnsignedFolderPath(),
      });

      showToast("Oferta registrada y enviada", "success");
      setOfferModal({ open: false, loading: false, file: null });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][FASE2][OFFER_UPLOAD][ERROR]', {
        requestId: selectedRequest.id,
        error: error.response?.data || error.message,
        ok: false
      });

      // Manejo especÃƒÂ­fico de errores BE
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        showToast(PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode], "warning");
      } else {
        showToast("No se pudo enviar la oferta", "error");
      }

      setOfferModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSignedUpload = async () => {
    if (!selectedRequest || !signedModal.file) {
      showToast("Selecciona un archivo firmado", "warning");
      return;
    }
    setSignedModal((prev) => ({ ...prev, loading: true }));

    try {
      const base64 = await fileToBase64(signedModal.file);
      if (!base64 || !base64.includes(",")) {
        showToast("No se pudo leer el archivo, intenta nuevamente", "error");
        setSignedModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      const base64payload = base64.split(",")[1];
      if (!base64payload || !base64payload.trim()) {
        showToast("El archivo estÃƒÂ¡ vacÃƒÂ­o o no se pudo procesar", "error");
        setSignedModal((prev) => ({ ...prev, loading: false }));
        return;
      }

      await uploadPrivateSignedOffer(selectedRequest.id, {
        signed_offer_base64: base64payload,
        file_name: signedModal.file.name,
      });

      showToast("Oferta firmada registrada", "success");
      setSignedModal({ open: false, loading: false, file: null });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][FASE2][SIGNED_OFFER_UPLOAD][ERROR]', {
        requestId: selectedRequest.id,
        error: error.response?.data || error.message,
        ok: false
      });

      // Manejo especÃƒÂ­fico de errores BE
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        showToast(PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode], "warning");
      } else {
        showToast("No se pudo subir la oferta firmada", "error");
      }

      setSignedModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRegisterClient = async () => {
    if (!selectedRequest) return;
    setProcessingAction({ id: selectedRequest.id, type: "register" });
    try {
      await requestClientRegistration(selectedRequest.id);
      showToast("Solicitud de registro enviada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar la solicitud de registro", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleRegisterClientForPurchase = async (purchaseId) => {
    setProcessingAction({ id: purchaseId, type: "register" });
    try {
      await requestClientRegistration(purchaseId);
      showToast("Solicitud de registro enviada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar la solicitud de registro", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleManagerReject = async () => {
    if (!selectedRequest) return;
    setProcessingAction({ id: selectedRequest.id, type: "reject" });
    try {
      const reason = window.prompt("Motivo de rechazo (obligatorio):", "") || "";
      if (!reason.trim()) {
        showToast("Motivo de rechazo es obligatorio", "warning");
        setProcessingAction(null);
        return;
      }
      await transitionPrivatePurchaseState(selectedRequest.id, "contract_rejected", reason.trim());
      showToast("Contrato rechazado", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo rechazar el contrato", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCommercialRejectOffer = async (requestId) => {
    const request = requestId ? getRequestById(requestId) : selectedRequest;
    if (!request) return;
    setProcessingAction({ id: request.id, type: "offer_reject_by_commercial" });
    try {
      const reason = window.prompt("Motivo de rechazo (opcional):", "") || "";
      await transitionPrivatePurchaseState(
        request.id,
        "offer_rejected_by_commercial",
        reason.trim(),
      );
      showToast("Oferta rechazada por comercial", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo rechazar la oferta", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleManagerAcceptCommercialReject = async (requestId) => {
    const request = requestId ? getRequestById(requestId) : selectedRequest;
    if (!request) return;
    if (!window.confirm("¿Confirmas finalizar esta solicitud por rechazo comercial?")) {
      return;
    }
    setProcessingAction({ id: request.id, type: "commercial_reject_accept" });
    try {
      await transitionPrivatePurchaseState(request.id, "rejected");
      showToast("Solicitud finalizada por rechazo comercial", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo finalizar la solicitud", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleManagerRequestPriceImprovement = async (requestId) => {
    const request = requestId ? getRequestById(requestId) : selectedRequest;
    if (!request) return;
    setProcessingAction({ id: request.id, type: "price_improvement_request" });
    try {
      const reason = window.prompt("Detalle de mejora de precio (opcional):", "") || "";
      await transitionPrivatePurchaseState(
        request.id,
        "price_improvement_requested",
        reason.trim(),
      );
      showToast("Se solicitó mejora de precios a ACP Comercial", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo solicitar la mejora de precios", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const openContractModal = (mode) => {
    setContractModal({ open: true, loading: false, file: null, reason: "", mode });
  };

  const handleContractUpload = async () => {
    if (!selectedRequest) {
      return;
    }
    const mode = contractModal.mode || "draft";
    if (mode === "draft" && selectedRequest.contract_document_id) {
      showToast("Contrato ya fue subido anteriormente", "warning");
      setContractModal({ open: false, loading: false, file: null, reason: "", mode });
      return;
    }
    if (mode === "client_signed" && selectedRequest.contract_client_signed_document_id) {
      showToast("Contrato firmado por cliente ya fue subido", "warning");
      setContractModal({ open: false, loading: false, file: null, reason: "", mode });
      return;
    }
    if (mode === "manager_signed" && selectedRequest.contract_signed_document_id) {
      showToast("Contrato firmado por gerencia ya fue subido", "warning");
      setContractModal({ open: false, loading: false, file: null, reason: "", mode });
      return;
    }
    if (!contractModal.file) {
      showToast("Selecciona un contrato", "warning");
      return;
    }

    setContractModal((prev) => ({ ...prev, loading: true }));

    try {
      const base64 = await fileToBase64(contractModal.file);
      if (!base64 || !base64.includes(",")) {
        showToast("No se pudo leer el archivo, intenta nuevamente", "error");
        setContractModal((prev) => ({ ...prev, loading: false }));
        return;
      }

      const base64payload = base64.split(",")[1];
      if (!base64payload || !base64payload.trim()) {
        showToast("El archivo de contrato esta vacio o no se pudo procesar", "error");
        setContractModal((prev) => ({ ...prev, loading: false }));
        return;
      }
      if (mode === "client_signed") {
        await uploadPrivatePurchaseClientSignedContract(selectedRequest.id, {
          contract_base64: base64payload,
          file_name: contractModal.file.name,
          mime_type: contractModal.file.type || "application/pdf"
        });
      } else {
        await uploadPrivatePurchaseContract(selectedRequest.id, {
          contract_base64: base64payload,
          file_name: contractModal.file.name,
          mime_type: contractModal.file.type || "application/pdf",
          reason: mode === "manager_signed" ? contractModal.reason || "" : ""
        });
      }

      showToast("Contrato subido correctamente", "success");
      setContractModal({ open: false, loading: false, file: null, reason: "", mode });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        showToast(PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode], "warning");
      } else {
        showToast("No se pudo subir el contrato", "error");
      }
    } finally {
      setContractModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleRequestDeliveryDates = async () => {
    if (!selectedRequest) return;
    setProcessingAction({ id: selectedRequest.id, type: "request_dates" });
    try {
      await requestDeliveryDates(selectedRequest.id);
      showToast("Fecha de entrega solicitada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo solicitar la fecha", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleSubmitDeliveryDates = async () => {
    if (!selectedRequest) return;
    if (!deliveryDateModal.start) {
      showToast("Selecciona una fecha de entrega", "warning");
      return;
    }

    setDeliveryDateModal((prev) => ({ ...prev, loading: true }));
    try {
      const payload = {
        start: deliveryDateModal.start,
        end: deliveryDateModal.end || deliveryDateModal.start
      };

      await submitDeliveryDates(selectedRequest.id, payload, deliveryDateModal.notes || "");
      showToast("Fecha de entrega registrada", "success");
      setDeliveryDateModal({ open: false, loading: false, start: "", end: "", notes: "" });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error(error);
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        showToast(PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode], "warning");
      } else {
        showToast("No se pudo guardar la fecha", "error");
      }
    } finally {
      setDeliveryDateModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Calculate missing documents for resubmit gating
  const calculateMissingDocuments = (request) => {
    const missing = [];
    // Check based on BE validation logic (FE only has partial data)
    if (!request.client_registered_at) {
      missing.push("Registro de cliente completado");
    }

    if (!request.inspection_acta_document_id) {
      missing.push("Acta de inspeccion de ambiente");
    }

    if (!request.offer_document_id) {
      missing.push("Oferta enviada");
    }

    if (!request.offer_signed_document_id) {
      missing.push("Oferta firmada");
    }

    if (!request.contract_document_id) {
      missing.push("Contrato generado");
    }

    return missing;
  };

  const handleResubmitToGerencia = async () => {
    if (!selectedRequest) return;

    // Check missing documents first
    const missing = calculateMissingDocuments(selectedRequest);
    if (missing.length > 0) {
      return;
    }

    setProcessingAction({ id: selectedRequest.id, type: "resubmit" });

    try {
      // Use transition API to resubmit
      await transitionPrivatePurchaseState(selectedRequest.id, 'pending_contract_client_signature');

      showToast("Solicitud reenviada a gerencia para revisiÃƒÂ³n", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][FASE4][CORRECTION][RESUBMIT][API_ERROR]', {
        requestId: selectedRequest.id,
        error: error.response?.data || error.message,
        ok: false
      });

      // Handle specific BE errors
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOCS_INCOMPLETE_FOR_GERENCIA) {
        const missingDocs = error.response?.data?.details?.missingDocs || [];
        showToast(`Faltan documentos para reenviar: ${missingDocs.join(', ')}`, "error");
      } else {
        showToast("No se pudo reenviar la solicitud", "error");
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handleForwardToAcp = async (requestId) => {
    const request = requestId ? getRequestById(requestId) : selectedRequest;
    if (!request) return;
    const flowId = getFlowIdForRequest(request.id) || `pp-${Date.now()}-${request.id}`;
    if (!getFlowIdForRequest(request.id)) {
      localStorage.setItem(`private_purchase_flow_${request.id}`, flowId);
    }

    setProcessingAction({ id: request.id, type: "forward" });
    try {
      await forwardPrivatePurchaseToAcp(request.id, {
        headers: { "x-flow-id": flowId }
      });

      showToast("Solicitud enviada a ACP", "success");
      setPrivatePurchasesData((prev) => {
        if (!prev) return prev;
        const rows = Array.isArray(prev.rows) ? prev.rows : Array.isArray(prev) ? prev : [];
        const updatedRows = rows.map((item) =>
          item.id === request.id
            ? { ...item, status: "acp_availability_requested" }
            : item
        );
        const next = Array.isArray(prev.rows) ? { ...prev, rows: updatedRows } : updatedRows;
        return next;
      });
      const nextStatusFilter = statusFilter === "pending_backoffice" ? "all" : statusFilter;
      if (nextStatusFilter !== statusFilter) {
        setStatusFilter(nextStatusFilter);
      }
      fetchPrivatePurchases({
        status: nextStatusFilter !== "all" ? nextStatusFilter : undefined,
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][FASE4][ACP_FORWARD_ERROR]', {
        requestId: request.id,
        flowId,
        error: error.response?.data || error.message,
        ok: false
      });

      // Manejo especÃƒÂ­fico de errores BE
      const errorCode = error.response?.data?.code;
      const errorMessage = error.response?.data?.message;

      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOCS_INCOMPLETE_FOR_GERENCIA) {
        const missingDocs = error.response?.data?.details?.missingDocs || [];
        showToast(
          `No se puede enviar a ACP: ${PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode]} (${missingDocs.length} documentos faltantes)`,
          "error"
        );
      } else if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        showToast(PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode], "warning");
      } else {
        showToast(errorMessage || "No se pudo enviar a ACP", "error");
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handleOpenAcpEmailModal = (requestId) => {
    setAcpEmailModal({
      open: true,
      loading: false,
      requestId,
      providerEmail: "",
      notes: ""
    });
  };

  const handleSubmitAcpEmail = async () => {
    const { requestId, providerEmail, notes } = acpEmailModal;
    if (!requestId) return;
    if (!providerEmail.trim()) {
      showToast("El correo del proveedor es obligatorio", "warning");
      return;
    }

    setAcpEmailModal((prev) => ({ ...prev, loading: true }));
    setProcessingAction({ id: requestId, type: "acp_send_email" });
    try {
      await startPrivatePurchaseAvailability(requestId, {
        provider_email: providerEmail.trim(),
        notes: notes.trim()
      });
      showToast("Correo de disponibilidad enviado", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setAcpEmailModal({
        open: false,
        loading: false,
        requestId: null,
        providerEmail: "",
        notes: ""
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][ACP_AVAILABILITY_EMAIL][ERROR]', {
        requestId,
        error: error.response?.data || error.message,
        errorStatus: error.response?.status,
        userHasRequiredRole: isAcpUser || isManagerUser,
        requiredRoles: ['acp_comercial', 'jefe_comercial'],
        ok: false
      });
      showToast("No se pudo enviar el correo al proveedor", "error");
      setAcpEmailModal((prev) => ({ ...prev, loading: false }));
    } finally {
      setProcessingAction(null);
    }
  };

  const handleOpenAcpResponseModal = (requestId) => {
    const request = getRequestById(requestId);
    if (!request) return;

    // Normalizar items para el modal (similar a EquipmentPurchaseWidget)
    const normalizedItems = Array.isArray(request.equipment)
      ? request.equipment.map((item) => ({
        id: item.id,
        name: item.name || item.label || item.sku || "Equipo",
        requested_type: item.type,
        available_type: "new_available",
        decision: "accept", // default to accept
        sku: item.sku
      }))
      : [];

    setAcpResponseModal({
      open: true,
      loading: false,
      requestId,
      outcome: "available",
      notes: "",
      items: normalizedItems
    });
  };

  const handleSubmitAcpResponse = async () => {
    const { requestId, items, notes } = acpResponseModal;
    if (!requestId) return;
    if (!notes.trim()) {
      showToast("La respuesta del proveedor es obligatoria", "warning");
      return;
    }

    const request = getRequestById(requestId);
    if (request?.provider_response_at) {
      showToast("La respuesta del proveedor ya fue registrada", "warning");
      setAcpResponseModal({
        open: false,
        loading: false,
        requestId: null,
        outcome: "available",
        notes: "",
        items: []
      });
      return;
    }
    if (request && request.status !== "acp_availability_requested") {
      showToast("La solicitud no esta en disponibilidad ACP", "warning");
      setAcpResponseModal({
        open: false,
        loading: false,
        requestId: null,
        outcome: "available",
        notes: "",
        items: []
      });
      return;
    }

    setAcpResponseModal((prev) => ({ ...prev, loading: true }));
    setProcessingAction({ id: requestId, type: "acp_response" });
    try {
      // Enviar items individuales al backend
      await savePrivatePurchaseProviderResponse(requestId, {
        outcome: "new", // El backend calcula el outcome basado en items
        items: items || [],
        notes: notes.trim()
      });
      showToast("Respuesta del proveedor registrada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setAcpResponseModal({
        open: false,
        loading: false,
        requestId: null,
        outcome: "available",
        notes: "",
        items: []
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][ACP_PROVIDER_RESPONSE][ERROR]', {
        requestId,
        error: error.response?.data || error.message,
        ok: false
      });
      const errorCode = error.response?.data?.code;
      if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        showToast(PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode], "warning");
      } else {
        showToast(error.message || "No se pudo registrar la respuesta del proveedor", "error");
      }
      setAcpResponseModal((prev) => ({ ...prev, loading: false }));
    } finally {
      setProcessingAction(null);
    }
  };

  const updateAcpResponseItem = (itemId, field, value) => {
    setAcpResponseModal((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleOpenClientRegistrationModal = (requestId) => {
    const request = getRequestById(requestId);
    if (!request) return;

    setClientRegistrationModal({
      open: true,
      loading: false,
      requestId,
      clientData: request.client_snapshot || {},
      documents: []
    });
  };


  const handleAutoInspectionRequest = async (requestId) => {
    if (!requestId) return;
    try {
      setProcessingAction({ id: requestId, type: "inspection_auto" });
      showToast("Generando inspección de ambiente...", "info");
      await savePrivatePurchaseInspectionRequest(requestId, {});
      showToast("Inspección de ambiente creada automáticamente", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error("[FLOW_PRIVADA][FE][INSPECCION_AUTO][ERROR]", error);
      showToast(error?.message || "No se pudo generar la inspección automática", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCoordinateInspectionDate = async () => {
    if (!detailModalRequest?.id) return;
    if (!inspectionCoordinationDraft.inspection_date) {
      showToast("Selecciona la fecha coordinada de inspección", "warning");
      return;
    }
    try {
      setInspectionCoordinationDraft((prev) => ({ ...prev, loading: true }));
      await coordinatePrivatePurchaseInspectionDate(detailModalRequest.id, {
        inspection_date: inspectionCoordinationDraft.inspection_date,
        notes: inspectionCoordinationDraft.notes || "",
      });
      showToast("Fecha propuesta enviada. Pendiente validación de Jefe Técnico", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error("[FLOW_PRIVADA][FE][COORD_INSPECCION][ERROR]", error);
      showToast(error?.message || "No se pudo coordinar la inspección", "error");
    } finally {
      setInspectionCoordinationDraft((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleReviewInspectionDate = async (decision) => {
    if (!detailModalRequest?.id) return;
    try {
      setInspectionCoordinationDraft((prev) => ({ ...prev, loading: true }));
      await reviewPrivatePurchaseInspectionDate(detailModalRequest.id, {
        decision,
        review_notes: inspectionCoordinationDraft.review_notes || "",
      });
      showToast(
        decision === "accept"
          ? "Fecha de inspección aprobada por Jefe Técnico"
          : "Fecha propuesta rechazada. Comercial debe proponer otra fecha",
        "success",
      );
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error("[FLOW_PRIVADA][FE][REVIEW_INSPECCION][ERROR]", error);
      showToast(error?.message || "No se pudo revisar la propuesta de inspección", "error");
    } finally {
      setInspectionCoordinationDraft((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleSubmitClientRegistration = async () => {
    const { requestId, clientData, documents } = clientRegistrationModal;
    if (!requestId || !clientData) return;

    setClientRegistrationModal((prev) => ({ ...prev, loading: true }));
    setProcessingAction({ id: requestId, type: "client_registration" });

    try {
      await requestClientRegistration(requestId);
      showToast("Solicitud de registro de cliente enviada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setClientRegistrationModal({
        open: false,
        loading: false,
        requestId: null,
        clientData: null,
        documents: []
      });
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar la solicitud de registro", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBackofficeAcceptAvailability = async (requestId) => {
    const request = requestId ? getRequestById(requestId) : selectedRequest;
    if (!request) return;

    setProcessingAction({ id: request.id, type: "availability_accept" });
    try {
      await transitionPrivatePurchaseState(request.id, "acp_availability_confirmed");
      showToast("Disponibilidad aceptada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][BACKOFFICE_AVAILABILITY_ACCEPT][ERROR]', {
        requestId: request.id,
        error: error.response?.data || error.message,
        ok: false
      });
      showToast("No se pudo aceptar la disponibilidad", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleBackofficeRejectAvailability = async (requestId) => {
    const request = requestId ? getRequestById(requestId) : selectedRequest;
    if (!request) return;

    const reason = window.prompt("Motivo de rechazo de disponibilidad:", "") || "";
    if (!reason.trim()) {
      showToast("Motivo de rechazo es obligatorio", "warning");
      return;
    }

    setProcessingAction({ id: request.id, type: "availability_reject" });
    try {
      await transitionPrivatePurchaseState(request.id, "acp_availability_rejected", reason.trim());
      showToast("Disponibilidad rechazada", "success");
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error('[FLOW_PRIVADA][FE][BACKOFFICE_AVAILABILITY_REJECT][ERROR]', {
        requestId: request.id,
        error: error.response?.data || error.message,
        ok: false
      });
      showToast("No se pudo rechazar la disponibilidad", "error");
    } finally {
      setProcessingAction(null);
    }
  };

  return (
    <>
      {processingAction && (
        <ProcessingOverlay
          className="z-[1010]"
          title={processingTitle || processingAction.title || "Procesando..."}
          steps={processingStep ? [processingStep] : []}
          activeStep={processingStep?.id}
        />
      )}
      <div className="space-y-4 sm:space-y-5 pb-6 px-3 sm:px-0">
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
              <FiFileText className="text-slate-600" />
              Compras Privadas
            </h1>
            <p className="text-xs text-gray-500 max-w-xl">
              Flujo privado desde comercial hasta aprobación operativa.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 sm:w-auto"
            >
              <option value="all">Todos los estados</option>
              {STATUS_DEFINITIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={FiRefreshCw}
              loading={loading}
              onClick={() =>
                fetchPrivatePurchases({
                  status: statusFilter !== "all" ? statusFilter : undefined,
                })
              }
              className="w-full sm:w-auto"
            >
              Actualizar
            </Button>
          </div>
        </header>

        <Card className="rounded-none border border-gray-200 border-x-0 bg-white p-4 shadow-none sm:rounded-2xl sm:border sm:p-5 sm:shadow-sm">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpiRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{row.label}</p>
                <p className="text-2xl font-bold text-gray-900">{row.count}</p>
              </div>
            ))}
          </div>
        </Card>

        <div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
            <div className="flex items-start gap-2">
              <FiPackage className="text-slate-500 mt-0.5" size={16} />
              <div>
                <h2 className="text-base font-semibold text-slate-900">Solicitudes de compra privada</h2>
                <p className="text-xs text-slate-500">Stream operativo con seguimiento por estado</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative w-full sm:w-auto">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o estado..."
                  className="w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-72"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => fetchPrivatePurchases({
                  status: statusFilter !== "all" ? statusFilter : undefined,
                })}
                variant="ghost"
                className="w-full px-3 sm:w-auto"
                loading={loading}
              >
                <FiRefreshCw size={14} />
              </Button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <Card className="rounded-none border border-slate-200/70 border-x-0 bg-white/80 p-8 text-center shadow-none sm:rounded-2xl sm:border sm:p-16 sm:shadow-sm">
              <FiPackage className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500 text-lg font-medium">No hay solicitudes registradas</p>
              <p className="text-slate-400 text-sm mt-1">
                {loading ? "Cargando solicitudes..." : "Las nuevas solicitudes aparecerán aquí"}
              </p>
            </Card>
          ) : (
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredRequests.map((req) => {
                const statusConfig = getPrivatePurchaseStatusConfig(req.status);
                const clientInfo = getPrivatePurchaseClientInfo(req.client_snapshot);
                const equipmentInfo = getPrivatePurchaseEquipmentInfo(req);
                const creationInfo = {
                  date: req.created_at ? formatDateTimeEC(req.created_at) : "Fecha no disponible",
                  by: req.created_by_email || req.created_by || "Anónimo"
                };
                const isSelected = req.id === selectedId;
                const expanded = expandedRequestId === req.id;
                const docs = documentsById[req.id] || [];
                const docsLoading = documentsLoadingById[req.id];
                const offerLink = getDocumentLink(docs, "OFFER");
                const signedOfferLink = getDocumentLink(docs, "SIGNED_OFFER");
                const contractDraftLink = getDocumentLink(docs, "CONTRACT_DRAFT");
                const contractClientSignedLink = getDocumentLink(docs, "CONTRACT_CLIENT_SIGNED");
                const contractSignedLink = getDocumentLink(docs, "CONTRACT_SIGNED");
                const deliveryActLink = getDocumentLink(docs, "DELIVERY_ACT");
                const comodatoLink = getDocumentLink(docs, "COMODATO");
                const reservationSent = Boolean(req.reservation_email_sent_at);
                const statusOwner = statusOwnerLabels[req.status] || "Equipo interno";
                const equipmentById = new Map(
                  (Array.isArray(req.equipment) ? req.equipment : [])
                    .filter(Boolean)
                    .map((eq) => [String(eq.id || eq.equipment_id || eq.inventory_id || ""), eq]),
                );

                const resolveProviderItemName = (item, index) => {
                  const rawItemId = item?.id ?? item?.equipment_id ?? item?.inventory_id ?? "";
                  const normalizedId = String(rawItemId || "").trim();
                  const requestedItem = equipmentById.get(normalizedId) || {};

                  const preferred = [
                    item?.name,
                    item?.label,
                    requestedItem?.name,
                    requestedItem?.item_name,
                    requestedItem?.model,
                    requestedItem?.sku,
                  ]
                    .map((value) => String(value || "").trim())
                    .find((value) => value.length > 0);

                  if (!preferred) return `Equipo ${index + 1}`;
                  if (normalizedId && preferred === normalizedId) {
                    const fallback = [requestedItem?.name, requestedItem?.model, requestedItem?.sku]
                      .map((value) => String(value || "").trim())
                      .find((value) => value.length > 0 && value !== normalizedId);
                    return fallback || `Equipo ${index + 1}`;
                  }
                  return preferred;
                };

                const toggleExpanded = (e) => {
                  e.stopPropagation();
                  setExpandedRequestId(prev => prev === req.id ? null : req.id);
                };

                return (
                  <div key={req.id}>
                    <Card
                      className={`relative flex h-full w-full max-w-sm mx-auto flex-col rounded-lg border p-4 shadow-sm transition-colors cursor-pointer ${isSelected
                        ? 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-200'
                        : `${statusConfig.cardBorder} bg-white hover:bg-slate-50/80`
                        }`}
                      onClick={() => setSelectedId(req.id)}
                    >
                    {/* Header compacto */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
                            <span className={`h-2 w-2 rounded-full ${statusConfig.ledColor}`}></span>
                            {statusConfig.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {req.id}
                          </span>
                          <span className="text-[11px] text-slate-400">{creationInfo.date}</span>
                          {reservationSent && (
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Reserva enviada
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-base text-slate-900 leading-tight mt-1">{clientInfo.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">{clientInfo.email}</p>
                      </div>
                    </div>

                    {/* Equipo solicitado */}
                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-700">
                      <FiPackage className="text-slate-400" size={14} />
                      <span className="font-medium">{equipmentInfo.summary}</span>
                    </div>

                    {/* Metadatos esenciales */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-4">
                      <div className="flex items-center gap-2">
                        <FiUser className="text-slate-400" size={12} />
                        <span className="truncate">{creationInfo.by}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiUsers className="text-slate-400" size={12} />
                        <span className="truncate">Responsable: {statusOwner}</span>
                      </div>
                    </div>

                    {(req.inspection_request_id || req.inspection_scheduled_date || req.inspection_proposed_date) && (
                      <div className="mb-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                        <p className="font-semibold">Inspección de ambiente</p>
                        <p>
                          Ventana: {req.inspection_min_date || "Pendiente"} - {req.inspection_max_date || "Pendiente"}
                        </p>
                        <p>
                          Propuesta: {req.inspection_proposed_date || "Pendiente"}
                        </p>
                        <p>
                          Coordinación final: {req.inspection_scheduled_date || "Pendiente"}
                        </p>
                        <p>
                          Estado: {req.inspection_coordination_status === "accepted"
                            ? "Aprobada"
                            : req.inspection_coordination_status === "pending_review"
                              ? "Pendiente validación jefe técnico"
                              : req.inspection_coordination_status === "rejected"
                                ? "Rechazada"
                                : "Pendiente propuesta"}
                        </p>
                      </div>
                    )}

                    {req.checklist_state?.action && (
                      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Checklist automático</p>
                          <span className="text-[11px] text-slate-500">
                            {(req.checklist_state.pending || []).length > 0
                              ? `${(req.checklist_state.pending || []).length} pendiente(s)`
                              : "Completo"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-700">
                          Paso: {formatChecklistActionLabel(req.checklist_state)}
                        </p>
                        <div className="mt-2 space-y-1">
                          {(req.checklist_state.items || []).map((item) => (
                            <div key={`${req.id}-check-${item.key}`} className="flex items-center gap-2 text-xs">
                              <input type="checkbox" checked={Boolean(item.checked)} readOnly disabled />
                              <span className={item.checked ? "text-emerald-700" : "text-slate-700"}>
                                {item.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Boton de expandir/colapsar */}
                    <div className="mt-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-center text-xs"
                        onClick={toggleExpanded}
                        leftIcon={
                          <FiChevronDown
                            size={12}
                            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                          />
                        }
                      >
                        {expanded ? 'Mostrar menos' : 'Mostrar mas'}
                      </Button>
                    </div>
                    {/* Acciones usando el componente PrivatePurchaseActions */}
                    <PrivatePurchaseActions
                      request={req}
                      isBackofficeUser={isBackofficeUser}
                      isManagerUser={isManagerUser}
                      isChiefCommercial={isChiefCommercial}
                      isAcpUser={isAcpUser}
                      isPureCommercial={isPureCommercial}
                      processingAction={processingAction}
                      onSendOffer={(id) => {
                        setSelectedId(id);
                        setOfferModal({ open: true, loading: false });
                      }}
                      onUploadSigned={(id) => {
                        setSelectedId(id);
                        setSignedModal({ open: true, loading: false, file: null });
                      }}
                      onRegisterClient={(id) => {
                        setSelectedId(id);
                        handleRegisterClient();
                      }}
                      onRequestAcpAvailability={(id) => {
                        setSelectedId(id);
                        handleForwardToAcp(id);
                      }}
                      onAcceptAvailability={(id) => {
                        setSelectedId(id);
                        handleBackofficeAcceptAvailability(id);
                      }}
                      onRejectAvailability={(id) => {
                        setSelectedId(id);
                        handleBackofficeRejectAvailability(id);
                      }}
                      onSendAvailabilityEmail={(id) => {
                        setSelectedId(id);
                        handleOpenAcpEmailModal(id);
                      }}
                      onRegisterProviderResponse={(id) => {
                        setSelectedId(id);
                        handleOpenAcpResponseModal(id);
                      }}
                      onResubmitToGerencia={(id) => {
                        setSelectedId(id);
                        handleResubmitToGerencia();
                      }}
                      onManagerReject={(id) => {
                        setSelectedId(id);
                        handleManagerReject();
                      }}
                      onUploadContract={(id) => {
                        setSelectedId(id);
                        openContractModal(isManagerUser ? "manager_signed" : "draft");
                      }}
                      onUploadClientSignedContract={(id) => {
                        setSelectedId(id);
                        openContractModal("client_signed");
                      }}
                      onSubmitDeliveryDates={(id) => {
                        setSelectedId(id);
                        setDeliveryDateModal({ open: true, loading: false, start: "", end: "", notes: "" });
                      }}
                      onOpenClientRegistrationModal={(id) => {
                        setSelectedId(id);
                        handleOpenClientRegistrationModal(id);
                      }}
                      onOpenInspectionModal={(id) => {
                        setSelectedId(id);
                        handleAutoInspectionRequest(id);
                      }}
                      onCommercialRejectOffer={(id) => {
                        setSelectedId(id);
                        handleCommercialRejectOffer(id);
                      }}
                      onManagerAcceptCommercialReject={(id) => {
                        setSelectedId(id);
                        handleManagerAcceptCommercialReject(id);
                      }}
                      onManagerRequestPriceImprovement={(id) => {
                        setSelectedId(id);
                        handleManagerRequestPriceImprovement(id);
                      }}
                    />

                    {/* Indicador de mÃƒÂ¡s acciones */}


                    {/* Contenido expandido */}
                    {expanded && (
                      <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                        {/* InformaciÃƒÂ³n detallada del cliente */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Cliente</p>
                          <div className="space-y-1 text-sm">
                            <p className="text-slate-700"><span className="font-medium text-slate-900">Nombre:</span> {clientInfo.name}</p>
                            <p className="text-slate-700"><span className="font-medium text-slate-900">Email:</span> {clientInfo.email}</p>
                            <p className="text-slate-700"><span className="font-medium text-slate-900">ID:</span> {clientInfo.identifier}</p>
                          </div>
                        </div>

                        {/* Equipos */}
                        {equipmentInfo.count > 0 && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                              Equipos ({equipmentInfo.count})
                            </p>
                            <div className="space-y-2">
                              {equipmentInfo.details.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="font-medium text-slate-900">{item.name}</span>
                                  <span className="text-xs text-slate-500">{item.sku}</span>
                                </div>
                              ))}
                              {equipmentInfo.details.length > 3 && (
                                <p className="text-xs text-slate-500 text-center">
                                  +{equipmentInfo.details.length - 3} equipos mÃƒÂ¡s
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notas */}
                        {req.notes && (
                          <div className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Notas</p>
                            <p className="text-sm text-slate-700">{req.notes}</p>
                          </div>
                        )}

                        {/* Respuesta detallada del proveedor */}
                        {req.provider_response && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                Respuesta detallada del proveedor
                              </p>
                              <span className="text-[10px] text-slate-500">
                                {req.provider_response_at ? formatDateTimeEC(req.provider_response_at, '') : ''}
                              </span>
                            </div>

                            <div className="mb-3">
                              <p className="text-sm font-medium text-slate-900">
                                {req.provider_response.outcome === 'new' ? 'Equipos disponibles para entrega' : 'Equipos no disponibles'}
                              </p>
                              {req.provider_response.notes && (
                                <p className="text-sm text-slate-700 mt-1">{req.provider_response.notes}</p>
                              )}
                            </div>

                            {Array.isArray(req.provider_response.items) && req.provider_response.items.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] uppercase tracking-wide text-slate-500">Equipos evaluados:</p>
                                <div className="space-y-2">
                                  {req.provider_response.items.map((item, idx) => {
                                    const requestedItem = equipmentById.get(String(item?.id ?? item?.equipment_id ?? item?.inventory_id ?? "")) || {};
                                    const requestedType = item.requested_type || requestedItem.type;
                                    const availableType = item.available_type;
                                    const decision = item.decision;
                                    const hasMismatch = requestedType && availableType && requestedType !== availableType;
                                    const displayName = resolveProviderItemName(item, idx);

                                    const typeBadge = (type, label) => (
                                      <span
                                        className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${type === 'new_available'
                                          ? 'bg-green-100 text-green-700'
                                          : type === 'new_import'
                                            ? 'bg-amber-100 text-amber-700'
                                          : type === 'cu'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-600'
                                          }`}
                                      >
                                        {label}: {type === 'new_available'
                                          ? 'Nuevo disponible'
                                          : type === 'new_import'
                                            ? 'Nuevo para importación'
                                            : type === 'cu'
                                              ? 'CU'
                                              : 'Sin stock'}
                                      </span>
                                    );

                                    return (
                                      <div key={`${req.id}-${idx}`} className="rounded-md border border-slate-200 bg-white p-2.5">
                                        <p className="font-medium text-slate-900 text-sm">{displayName}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {requestedType && typeBadge(requestedType, "Solicitado")}
                                          {availableType && typeBadge(availableType, "Disponible")}
                                          {decision && (
                                            <span
                                              className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${decision === 'reject'
                                                ? 'bg-red-100 text-red-700 border border-red-200'
                                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                }`}
                                            >
                                              {decision === "reject" ? "Rechazado" : "Aceptado"}
                                            </span>
                                          )}
                                          {hasMismatch && (
                                            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                              Diferente a lo solicitado
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {req.reservation_email_sent_at && (
                          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                              Reserva solicitada al proveedor
                            </p>
                            <p className="text-xs text-emerald-700 mt-1">
                              {formatDateTimeEC(req.reservation_email_sent_at, "Sin fecha")}
                            </p>
                          </div>
                        )}

                        {/* Documentos clave */}
                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-wide text-slate-500">Documentos clave</p>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadDocumentsForRequest(req.id);
                              }}
                              disabled={docsLoading}
                            >
                              {docsLoading ? "Cargando..." : "Actualizar"}
                            </Button>
                          </div>
                          {docsLoading ? (
                            <p className="text-xs text-slate-500 mt-2">Buscando documentos...</p>
                          ) : docs.length === 0 ? (
                            <p className="text-xs text-slate-500 mt-2">Sin documentos registrados en expediente</p>
                          ) : (
                            <div className="mt-3 grid gap-2 text-xs">
                              {offerLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700 hover:underline"
                                  href={offerLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Oferta enviada
                                  <FiDownload size={14} />
                                </a>
                              )}
                              {signedOfferLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700 hover:underline"
                                  href={signedOfferLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Oferta firmada
                                  <FiDownload size={14} />
                                </a>
                              )}
                              {contractSignedLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700 hover:underline"
                                  href={contractSignedLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Contrato firmado
                                  <FiDownload size={14} />
                                </a>
                              )}
                              {contractClientSignedLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700 hover:underline"
                                  href={contractClientSignedLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Contrato firmado por cliente
                                  <FiDownload size={14} />
                                </a>
                              )}
                              {contractDraftLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-amber-700 hover:underline"
                                  href={contractDraftLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Contrato sin firmar
                                  <FiDownload size={14} />
                                </a>
                              )}
                              {deliveryActLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-indigo-700 hover:underline"
                                  href={deliveryActLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Acta de entrega
                                  <FiDownload size={14} />
                                </a>
                              )}
                              {comodatoLink && (
                                <a
                                  className="inline-flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-slate-600 hover:underline"
                                  href={comodatoLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Documento comodato
                                  <FiDownload size={14} />
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDetailOpen(req);
                          }}
                        >
                          Ver detalle completo
                        </Button>
                      </div>
                    )}
                    </Card>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>



        <Modal
          open={offerModal.open}
          onClose={() => setOfferModal({ open: false, loading: false, file: null })}
          title="Enviar oferta"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              Sube el documento de oferta sin firma de cliente. Se guardara en Drive en{" "}
              <span className="font-semibold">/Ofertas Sin Firmar/&lt;comercial&gt;/&lt;cliente&gt;</span> y se notificara a comercial/jefe.
            </p>
            <div className="text-[11px] text-gray-500">
              Ruta destino: <span className="font-mono">{buildUnsignedFolderPath()}</span>
            </div>
            <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
              Archivo de oferta (PDF, PNG o JPG)
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) =>
                  setOfferModal((prev) => ({
                    ...prev,
                    file: event.target.files?.[0] || null,
                  }))
                }
                className="mt-1 cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-gray-600"
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setOfferModal({ open: false, loading: false, file: null })}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleOfferSubmit}
                loading={offerModal.loading}
                disabled={!offerModal.file}
              >
                Guardar oferta
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={signedModal.open}
          onClose={() => setSignedModal({ open: false, loading: false, file: null })}
          title="Subir oferta firmada"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="text-xs text-gray-500">
              {isManagerUser
                ? "Adjunta el documento firmado por jefe comercial para pasar a la firma del cliente."
                : "Adjunta el documento firmado por el cliente para cerrar el flujo interno."}
            </p>
            <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
              Selecciona archivo (PDF, PNG o JPG)
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) =>
                  setSignedModal((prev) => ({
                    ...prev,
                    file: event.target.files?.[0] || null,
                  }))
                }
                className="mt-1 cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-gray-600"
              />
            </label>
            {signedModal.file && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-600">
                <p className="font-semibold text-gray-900">{signedModal.file.name}</p>
                <p>{(signedModal.file.size / 1024).toFixed(1)} KB</p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setSignedModal({ open: false, loading: false, file: null })}
              >
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleSignedUpload}
                disabled={!signedModal.file}
                loading={signedModal.loading}
              >
                Subir documento
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={contractModal.open}
          onClose={() => setContractModal({ open: false, loading: false, file: null, reason: "", mode: "draft" })}
          title={contractModalTitle}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="text-xs text-gray-500">
              {contractModalHint}
            </p>
            <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
              Selecciona archivo (PDF, PNG o JPG)
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) =>
                  setContractModal((prev) => ({
                    ...prev,
                    file: event.target.files?.[0] || null,
                  }))
                }
                className="mt-1 cursor-pointer rounded-lg border border-dashed border-gray-300 bg-white px-3 py-3 text-xs text-gray-600"
              />
            </label>
            {showContractReason && (
              <textarea
                className="w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-700"
                rows={3}
                placeholder="Observaciones (opcional)"
                value={contractModal.reason}
                onChange={(event) =>
                  setContractModal((prev) => ({ ...prev, reason: event.target.value }))
                }
              />
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setContractModal({ open: false, loading: false, file: null, reason: "", mode: "draft" })}
              >
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleContractUpload}
                disabled={!contractModal.file}
                loading={contractModal.loading}
              >
                {contractModalButtonLabel}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={deliveryDateModal.open}
          onClose={() => setDeliveryDateModal({ open: false, loading: false, start: "", end: "", notes: "" })}
          title="Registrar fecha de entrega"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-gray-500">Fecha y hora inicio</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
                  value={deliveryDateModal.start}
                  onChange={(event) =>
                    setDeliveryDateModal((prev) => ({ ...prev, start: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Fecha y hora fin</label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
                  value={deliveryDateModal.end}
                  onChange={(event) =>
                    setDeliveryDateModal((prev) => ({ ...prev, end: event.target.value }))
                  }
                />
              </div>
            </div>
            <textarea
              className="w-full rounded-lg border border-gray-200 p-2 text-xs text-gray-700"
              rows={3}
              placeholder="Notas opcionales"
              value={deliveryDateModal.notes}
              onChange={(event) =>
                setDeliveryDateModal((prev) => ({ ...prev, notes: event.target.value }))
              }
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setDeliveryDateModal({ open: false, loading: false, start: "", end: "", notes: "" })}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitDeliveryDates}
                disabled={!deliveryDateModal.start}
                loading={deliveryDateModal.loading}
              >
                Guardar fecha
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={acpEmailModal.open}
          onClose={() =>
            setAcpEmailModal({
              open: false,
              loading: false,
              requestId: null,
              providerEmail: "",
              notes: ""
            })
          }
          title="Enviar correo de disponibilidad"
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="text-xs text-gray-500">
              Registra el correo del proveedor y las notas que se enviaran con la solicitud.
            </p>
            <label className="flex flex-col gap-2 text-xs font-semibold text-gray-600">
              Correo del proveedor
              <input
                type="email"
                placeholder="correo@proveedor.com"
                value={acpEmailModal.providerEmail}
                onChange={(event) =>
                  setAcpEmailModal((prev) => ({
                    ...prev,
                    providerEmail: event.target.value
                  }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-gray-600">
              Notas al proveedor (opcional)
              <textarea
                rows={4}
                placeholder="Notas adicionales..."
                value={acpEmailModal.notes}
                onChange={(event) =>
                  setAcpEmailModal((prev) => ({
                    ...prev,
                    notes: event.target.value
                  }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
              />
            </label>
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  setAcpEmailModal({
                    open: false,
                    loading: false,
                    requestId: null,
                    providerEmail: "",
                    notes: ""
                  })
                }
              >
                Cancelar
              </Button>
              <Button
                variant="success"
                onClick={handleSubmitAcpEmail}
                loading={acpEmailModal.loading}
              >
                Enviar correo
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={acpResponseModal.open}
          onClose={() =>
            setAcpResponseModal({
              open: false,
              loading: false,
              requestId: null,
              outcome: "available",
              notes: "",
              items: []
            })
          }
          title="Registrar respuesta del proveedor"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-sm text-gray-700">
            <p className="text-xs text-gray-500">
              Selecciona la disponibilidad para cada equipo segÃƒÂºn la respuesta del proveedor.
            </p>

            {/* Lista de equipos con opciones individuales */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {acpResponseModal.items.map((item, idx) => (
                <div key={item.id || idx} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        Solicitado: {
                          item.requested_type === "cu"
                            ? "CU"
                            : item.requested_type === "new_import"
                              ? "Nuevo para importación"
                              : item.requested_type === "new_available" || item.requested_type === "new"
                                ? "Nuevo disponible"
                                : "Sin especificar"
                        }
                      </p>
                    </div>
                    {item.sku && <span className="text-[11px] text-gray-500">SKU: {item.sku}</span>}
                  </div>

                  {/* Opciones de disponibilidad */}
                  <div className="space-y-1 mb-3">
                    {[
                      { value: "new_available", label: "Nuevo disponible" },
                      { value: "new_import", label: "Nuevo para importación" },
                      { value: "cu", label: "CU" },
                      { value: "none", label: "Sin stock" },
                    ]
                      .map((option) => (
                        <label key={option.value} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`availability-${item.id}`}
                            checked={item.available_type === option.value}
                            onChange={() => updateAcpResponseItem(item.id, 'available_type', option.value)}
                          />
                          {option.label}
                        </label>
                      ))}
                  </div>

                  {/* DecisiÃƒÂ³n de aceptaciÃƒÂ³n */}
                  <div className="flex flex-wrap gap-2">
                    {[{ value: "accept", label: "Aceptar producto" }, { value: "reject", label: "Rechazar producto" }]
                      .map((option) => {
                        const disabled = option.value === "accept" && item.available_type === "none";
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              if (!disabled) {
                                updateAcpResponseItem(item.id, 'decision', option.value);
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${item.decision === option.value
                              ? option.value === "accept"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-red-100 text-red-700 border-red-200"
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}
                            ${disabled ? " opacity-50 cursor-not-allowed" : ""}`}
                            disabled={disabled}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            <label className="flex flex-col gap-2 text-xs font-semibold text-gray-600">
              Notas adicionales del proveedor (obligatoria)
              <textarea
                rows={3}
                placeholder="Detalle de la respuesta del proveedor..."
                value={acpResponseModal.notes}
                onChange={(event) =>
                  setAcpResponseModal((prev) => ({
                    ...prev,
                    notes: event.target.value
                  }))
                }
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
              />
            </label>

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  setAcpResponseModal({
                    open: false,
                    loading: false,
                    requestId: null,
                    outcome: "available",
                    notes: "",
                    items: []
                  })
                }
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmitAcpResponse}
                loading={acpResponseModal.loading}
              >
                Guardar respuesta
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={clientRegistrationModal.open}
          onClose={() => setClientRegistrationModal({
            open: false,
            loading: false,
            requestId: null,
            clientData: null,
            documents: []
          })}
          title="Registrar cliente para compra privada"
          maxWidth="max-w-5xl"
        >
          <NewClientRequestForm
            initialData={{
              ...clientRegistrationModal.clientData,
              commercial_name: clientRegistrationModal.clientData?.commercial_name || clientRegistrationModal.clientData?.name,
              ruc_cedula: clientRegistrationModal.clientData?.client_identifier,
              client_email: clientRegistrationModal.clientData?.client_email,
              client_type: clientRegistrationModal.clientData?.client_type || "persona_juridica",
              establishment_country: clientRegistrationModal.clientData?.establishment_country || "Ecuador",
              shipping_country: clientRegistrationModal.clientData?.shipping_country || "Ecuador"
            }}
            onCancel={() => setClientRegistrationModal({
              open: false,
              loading: false,
              requestId: null,
              clientData: null,
              documents: []
            })}
            onSuccess={async () => {
              // DespuÃƒÂ©s de registrar exitosamente al cliente, marcar como registrado en la compra privada
              if (clientRegistrationModal.requestId) {
                await handleRegisterClientForPurchase(clientRegistrationModal.requestId);
              }
              setClientRegistrationModal({
                open: false,
                loading: false,
                requestId: null,
                clientData: null,
                documents: []
              });
            }}
            showIntro={false}
            successMessage="Cliente registrado exitosamente. El flujo de compra privada puede continuar."
          />
        </Modal>

        <Modal
          open={Boolean(detailModalRequest)}
          onClose={handleDetailClose}
          title="Detalle de solicitud privada"
          maxWidth="max-w-3xl"
        >
          {detailModalRequest ? (
            <div className="space-y-5 text-sm text-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Solicitud</p>
                  <p className="text-sm font-semibold text-gray-900 break-all">{detailModalRequest.id}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusLookup[detailModalRequest.status]?.accent || "bg-gray-100 text-gray-500"
                    }`}
                >
                  {statusLookup[detailModalRequest.status]?.label || detailModalRequest.status}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500">Cliente</p>
                  <p className="text-lg font-semibold text-gray-900">{detailModalRequest.client_snapshot?.commercial_name || "Cliente temporal"}</p>
                  <p className="text-xs text-gray-500">{detailModalRequest.client_snapshot?.client_identifier || "Sin identificador"}</p>
                  <p className="text-xs text-gray-500">{detailModalRequest.client_snapshot?.client_email || "Sin correo"}</p>
                  <p className="text-xs text-gray-500">
                    {detailModalRequest.client_snapshot?.first_name} {detailModalRequest.client_snapshot?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500">Fecha</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(detailModalRequest.created_at)}</p>
                  <p className="text-xs text-gray-500">
                    Creado por {detailModalRequest.created_by_email || detailModalRequest.created_by || "An+Ã¯Â¿Â½nimo"}
                  </p>
                  {detailModalRequest.client_registered_at && (
                    <p className="text-xs text-emerald-600">Cliente registrado el {formatDate(detailModalRequest.client_registered_at)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-gray-500">Tipo de oferta</p>
                  <p className="text-sm font-semibold text-gray-900">{resolveOfferKindLabel(detailModalRequest.offer_kind)}</p>
                  <p className="text-xs text-gray-500">
                    Vigente hasta {formatDate(detailModalRequest.offer_valid_until)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Equipos ({Array.isArray(detailModalRequest.equipment) ? detailModalRequest.equipment.length : 0})</p>
                {Array.isArray(detailModalRequest.equipment) && detailModalRequest.equipment.length ? (
                  <ul className="space-y-2">
                    {detailModalRequest.equipment.map((item, idx) => {
                      const typeLabel = item?.type === "cu"
                        ? "CU"
                        : item?.type === "new_import"
                          ? "Nuevo para importación"
                          : item?.type === "new_available" || item?.type === "new"
                            ? "Nuevo disponible"
                            : (item?.type || "N/D").toUpperCase();
                      return (
                        <li
                          key={item?.id || item?.sku || idx}
                          className="flex items-start justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item?.name || item?.label || "Equipo sin nombre"}</p>
                            <p className="text-xs text-gray-500">{item?.sku || "SKU sin datos"}</p>
                          </div>
                          <span className="rounded-full bg-gray-100 px-2 py-[2px] text-[11px] font-semibold text-gray-600">
                            {typeLabel}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500">Sin equipos registrados en esta solicitud</p>
                )}
              </div>

              <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                <p className="text-xs uppercase tracking-widest text-gray-500">Notas y documentos</p>
                <p>{detailModalRequest.notes || "Sin notas adicionales"}</p>
                {detailModalRequest.comodato_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.comodato_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <FiFileText /> Documento estadÃƒÂ­stico (comodato)
                  </a>
                )}
                {detailModalRequest.offer_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.offer_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    <FiFileText /> Oferta enviada
                  </a>
                )}
                {detailModalRequest.offer_signed_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.offer_signed_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-green-600 hover:underline"
                  >
                    <FiUpload /> Oferta firmada
                  </a>
                )}
                {detailModalRequest.contract_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.contract_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-amber-600 hover:underline"
                  >
                    <FiFileText /> Contrato sin firmar
                  </a>
                )}
                {detailModalRequest.contract_client_signed_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.contract_client_signed_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <FiFileText /> Contrato firmado cliente
                  </a>
                )}
                {detailModalRequest.contract_signed_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.contract_signed_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    <FiFileText /> Contrato firmado gerencia
                  </a>
                )}
                {detailModalRequest.reservation_email_file_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.reservation_email_file_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    <FiFileText /> Reserva enviada al proveedor
                  </a>
                )}
                {detailModalRequest.delivery_act_document_id && (
                  <a
                    href={`https://drive.google.com/file/d/${detailModalRequest.delivery_act_document_id}/view`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    <FiFileText /> Acta de entrega
                  </a>
                )}
              </div>

              {(detailModalRequest.provider_response_at || detailModalRequest.provider_response) && (
                <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                  <p className="text-xs uppercase tracking-widest text-gray-500">Respuesta ACP</p>
                  {detailModalRequest.provider_response_at && (
                    <p><span className="font-medium">Registrada:</span> {formatDate(detailModalRequest.provider_response_at)}</p>
                  )}
                  {detailModalRequest.reservation_email_sent_at && (
                    <p><span className="font-medium">Reserva solicitada:</span> {formatDate(detailModalRequest.reservation_email_sent_at)}</p>
                  )}
                  {detailModalRequest.provider_response?.outcome && (
                    <p><span className="font-medium">Resultado:</span> {detailModalRequest.provider_response.outcome}</p>
                  )}
                  {detailModalRequest.provider_response?.notes && (
                    <p className="text-xs text-gray-600">{detailModalRequest.provider_response.notes}</p>
                  )}
                </div>
              )}

              {detailModalRequest.offer_kind === "comodato" && (
                (() => {
                  const bcReady = Boolean(detailModalRequest.business_case_id);
                  const acpReady = Boolean(detailModalRequest.provider_response_at);
                  const sendOfferBlocked =
                    detailModalRequest.status !== "acp_availability_confirmed" || !bcReady || !acpReady;
                  return (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2 mb-2">
                      <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold">
                        Checklist de comodato
                      </p>
                      <div className="flex gap-2 items-center text-[13px]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${bcReady ? "bg-emerald-500" : "bg-gray-300"}`}
                        />
                        <span>{bcReady ? "Business case creado" : "Pendiente de business case"}</span>
                      </div>
                      <div className="flex gap-2 items-center text-[13px]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${acpReady ? "bg-emerald-500" : "bg-gray-300"}`}
                        />
                        <span>{acpReady ? "Respuesta ACP registrada" : "Respuesta ACP pendiente"}</span>
                      </div>
                      <div className="flex gap-2 items-center text-[13px]">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${detailModalRequest.status === "acp_availability_confirmed" ? "bg-emerald-500" : "bg-gray-300"}`}
                        />
                        <span>{detailModalRequest.status === "acp_availability_confirmed" ? "Disponibilidad confirmada" : "Disponibilidad sin confirmar"}</span>
                      </div>
                      <div className="text-[12px] text-amber-800">
                        {sendOfferBlocked && (
                          <span>Subir oferta disponible cuando todos los pasos anteriores estén completos.</span>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}

              {detailModalRequest.checklist_state?.action && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Checklist automático</p>
                    <span className="text-[11px] text-slate-500">
                      {(detailModalRequest.checklist_state.pending || []).length > 0
                        ? `${(detailModalRequest.checklist_state.pending || []).length} pendiente(s)`
                        : "Completo"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    Paso: {formatChecklistActionLabel(detailModalRequest.checklist_state)}
                  </p>
                  <div className="space-y-1">
                    {(detailModalRequest.checklist_state.items || []).map((item) => (
                      <div key={`detail-check-${item.key}`} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={Boolean(item.checked)} readOnly disabled />
                        <span className={item.checked ? "text-emerald-700" : "text-slate-700"}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                  {(detailModalRequest.checklist_state.pending || []).length > 0 && (
                    <p className="text-xs text-amber-700">
                      El checklist se marca automáticamente según los datos y documentos del proceso.
                    </p>
                  )}
                </div>
              )}

              {(detailModalRequest.inspection_request_id || detailModalRequest.status === "inspection_requested") && (
                <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                  <p className="text-xs uppercase tracking-widest text-cyan-700">Inspección de ambiente</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p>
                      <span className="font-medium">Ventana:</span>{" "}
                      {detailModalRequest.inspection_min_date || "Pendiente"} - {detailModalRequest.inspection_max_date || "Pendiente"}
                    </p>
                    <p>
                      <span className="font-medium">Fecha propuesta:</span>{" "}
                      {detailModalRequest.inspection_proposed_date || "Pendiente"}
                    </p>
                    <p>
                      <span className="font-medium">Fecha coordinada final:</span>{" "}
                      {detailModalRequest.inspection_scheduled_date || "Pendiente"}
                    </p>
                    <p>
                      <span className="font-medium">Estado:</span>{" "}
                      {detailModalRequest.inspection_coordination_status === "accepted"
                        ? "Aprobada por jefe técnico"
                        : detailModalRequest.inspection_coordination_status === "pending_review"
                          ? "Pendiente validación jefe técnico"
                          : detailModalRequest.inspection_coordination_status === "rejected"
                            ? "Rechazada por jefe técnico"
                            : "Pendiente propuesta"}
                    </p>
                  </div>
                  {detailModalRequest.inspection_coordinated_by_email && (
                    <p className="text-xs text-cyan-700">
                      Coordinado por {detailModalRequest.inspection_coordinated_by_email}
                    </p>
                  )}
                  {detailModalRequest.inspection_request_id && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/dashboard/servicio-tecnico/desinfeccion?source_type=private_purchase&source_id=${encodeURIComponent(
                              detailModalRequest.id,
                            )}&request_id=${encodeURIComponent(detailModalRequest.inspection_request_id)}`,
                          )
                        }
                        className="rounded-md border border-cyan-200 bg-white px-2 py-1 text-[11px] font-medium text-cyan-900 hover:bg-cyan-100"
                      >
                        F.ST-02 Desinfección
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/dashboard/servicio-tecnico/aplicaciones?source_type=private_purchase&source_id=${encodeURIComponent(
                              detailModalRequest.id,
                            )}&request_id=${encodeURIComponent(detailModalRequest.inspection_request_id)}`,
                          )
                        }
                        className="rounded-md border border-cyan-200 bg-white px-2 py-1 text-[11px] font-medium text-cyan-900 hover:bg-cyan-100"
                      >
                        F.ST-04 Entrenamiento
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/dashboard/servicio-tecnico/verificacion?source_type=private_purchase&source_id=${encodeURIComponent(
                              detailModalRequest.id,
                            )}&request_id=${encodeURIComponent(detailModalRequest.inspection_request_id)}`,
                          )
                        }
                        className="rounded-md border border-cyan-200 bg-white px-2 py-1 text-[11px] font-medium text-cyan-900 hover:bg-cyan-100"
                      >
                        F.ST-09 Verificación
                      </button>
                    </div>
                  )}
                  {canCoordinatePrivateInspection && detailModalRequest.status === "inspection_requested" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="date"
                          className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-700"
                          min={detailModalRequest.inspection_min_date || undefined}
                          max={detailModalRequest.inspection_max_date || undefined}
                          value={inspectionCoordinationDraft.inspection_date}
                          onChange={(event) =>
                            setInspectionCoordinationDraft((prev) => ({
                              ...prev,
                              inspection_date: event.target.value,
                            }))
                          }
                        />
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border border-cyan-200 bg-white px-3 py-2 text-sm text-slate-700"
                          value={inspectionCoordinationDraft.notes}
                          onChange={(event) =>
                            setInspectionCoordinationDraft((prev) => ({
                              ...prev,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="Notas de coordinación (opcional)"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleCoordinateInspectionDate}
                        loading={inspectionCoordinationDraft.loading}
                        disabled={!detailModalRequest.inspection_request_id}
                      >
                        Proponer fecha a Jefe Técnico
                      </Button>
                    </div>
                  )}
                  {canReviewPrivateInspectionCoordination &&
                    detailModalRequest.status === "inspection_requested" &&
                    detailModalRequest.inspection_coordination_status === "pending_review" && (
                    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700"
                        value={inspectionCoordinationDraft.review_notes || ""}
                        onChange={(event) =>
                          setInspectionCoordinationDraft((prev) => ({
                            ...prev,
                            review_notes: event.target.value,
                          }))
                        }
                        placeholder="Comentario de validación (opcional)"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleReviewInspectionDate("accept")}
                          loading={inspectionCoordinationDraft.loading}
                        >
                          Aprobar fecha
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleReviewInspectionDate("reject")}
                          loading={inspectionCoordinationDraft.loading}
                        >
                          Rechazar fecha
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
                <p className="text-xs uppercase tracking-widest text-gray-500">Expediente</p>
                {!isGerenciaGeneral && documentLinks.length > visibleDocumentLinks.length && (
                  <p className="text-xs text-amber-600">
                    Documentos adicionales disponibles solo para Gerencia General.
                  </p>
                )}
                {visibleDocumentLinks.length === 0 ? (
                  <p className="text-xs text-gray-500">Sin documentos registrados en expediente</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {visibleDocumentLinks.map((doc) => (
                      <a
                        key={`${doc.doc_type}-${doc.drive_file_id}`}
                        href={doc.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:underline"
                      >
                        <FiDownload />
                        {doc.doc_type || "Documento"}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isBackofficeUser &&
                  detailModalRequest.status === "pending_backoffice" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleForwardToAcp(detailModalRequest.id)}
                      loading={processingAction?.type === "forward" && processingAction?.id === detailModalRequest.id}
                    >
                      <FiShare /> Solicitar disponibilidad ACP
                    </Button>
                  )}
                {isBackofficeUser && detailModalRequest.status === "acp_availability_requested" && (
                  detailModalRequest.provider_response_at ? (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleBackofficeAcceptAvailability(detailModalRequest.id)}
                        loading={processingAction?.type === "availability_accept" && processingAction?.id === detailModalRequest.id}
                      >
                        <FiCheckCircle /> Aceptar disponibilidad
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleBackofficeRejectAvailability(detailModalRequest.id)}
                        loading={processingAction?.type === "availability_reject" && processingAction?.id === detailModalRequest.id}
                      >
                        <FiX /> Rechazar disponibilidad
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      Esperando respuesta proveedor
                    </Button>
                  )
                )}
                {isComodatoRequest && (
                  (() => {
                    const { bcReady, acpReady } = comodatoChecklistStatus;
                    const availabilityConfirmed = detailModalRequest.status === "acp_availability_confirmed";

                    return (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-2 mb-2">
                        <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold">
                          Checklist de comodato
                        </p>
                        <div className="flex gap-2 items-center text-[13px]">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${bcReady ? "bg-emerald-500" : "bg-gray-300"}`}
                          />
                          <span>{bcReady ? "Business case creado" : "Pendiente de business case"}</span>
                        </div>
                        <div className="flex gap-2 items-center text-[13px]">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${acpReady ? "bg-emerald-500" : "bg-gray-300"}`}
                          />
                          <span>{acpReady ? "Respuesta ACP registrada" : "Respuesta ACP pendiente"}</span>
                        </div>
                        <div className="flex gap-2 items-center text-[13px]">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${availabilityConfirmed ? "bg-emerald-500" : "bg-gray-300"}`}
                          />
                          <span>{availabilityConfirmed ? "Disponibilidad confirmada" : "Disponibilidad sin confirmar"}</span>
                        </div>
                        {!availabilityConfirmed && (
                          <div className="text-[12px] text-amber-800">
                            Subir oferta disponible cuando todos los pasos anteriores estén completos.
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
                {isBackofficeUser && detailModalRequest.status === "acp_availability_confirmed" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setOfferModal({ open: true, loading: false })}
                    disabled={sendOfferBlocked}
                    title={sendOfferBlocked ? "Espera a que Business Case y ACP confirmen la disponibilidad" : undefined}
                  >
                    <FiSend /> Enviar oferta
                  </Button>
                )}
                {isManagerUser &&
                  detailModalRequest.status === "pending_contract_approval" && (
                    <>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => openContractModal("manager_signed")}
                        disabled={Boolean(detailModalRequest.contract_signed_document_id)}
                      >
                        <FiUpload /> {detailModalRequest.contract_signed_document_id ? "Contrato ya subido" : "Subir contrato"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleManagerReject}
                        loading={processingAction?.type === "reject" && processingAction?.id === detailModalRequest.id}
                      >
                        Rechazar
                      </Button>
                    </>
                  )}
                {isBackofficeUser &&
                  detailModalRequest.status === "inspection_requested" && (
                    <div className="space-y-1">
                      <Button
                        variant={detailModalRequest.contract_document_id ? "warning" : "success"}
                        size="sm"
                        disabled={!detailModalRequest.inspection_scheduled_date}
                        onClick={() => {
                          if (detailModalRequest.contract_document_id) {
                            setSelectedId(detailModalRequest.id);
                            handleResubmitToGerencia();
                            return;
                          }
                          openContractModal("draft");
                        }}
                      >
                        <FiUpload /> {detailModalRequest.contract_document_id ? "Enviar a gerencia" : "Subir contrato"}
                      </Button>
                      {!detailModalRequest.inspection_scheduled_date && (
                        <p className="text-xs text-amber-700">
                          Debes coordinar la fecha de inspección antes de continuar con contrato.
                        </p>
                      )}
                    </div>
                  )}
                {isPureCommercial && detailModalRequest.status === "pending_contract_client_signature" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => openContractModal("client_signed")}
                  >
                    <FiUpload /> Subir contrato firmado cliente
                  </Button>
                )}
                {isPureCommercial && detailModalRequest.status === "client_registered" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAutoInspectionRequest(detailModalRequest.id)}
                    loading={processingAction?.type === "inspection_auto" && processingAction?.id === detailModalRequest.id}
                  >
                    <FiSearch /> Generar inspección automática
                  </Button>
                )}
                {isPureCommercial && detailModalRequest.status === "delivery_dates_requested" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setDeliveryDateModal({ open: true, loading: false, start: "", end: "", notes: "" })}
                  >
                    <FiClock /> Ingresar fecha
                  </Button>
                )}
                {isPureCommercial && (detailModalRequest.status === "offer_signed" || detailModalRequest.status === "client_registration_requested") && !detailModalRequest.client_registered_at && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenClientRegistrationModal(detailModalRequest.id)}
                    loading={processingAction?.type === "client_registration" && processingAction?.id === detailModalRequest.id}
                  >
                    <FiUsers /> Solicitar registro cliente
                  </Button>
                )}
                {isAcpUser && detailModalRequest.status === "acp_availability_requested" && (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleOpenAcpEmailModal(detailModalRequest.id)}
                      loading={processingAction?.type === "acp_send_email" && processingAction?.id === detailModalRequest.id}
                      disabled={Boolean(detailModalRequest.availability_email_sent_at)}
                    >
                      <FiSend /> Enviar correo proveedor
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleOpenAcpResponseModal(detailModalRequest.id)}
                      loading={processingAction?.type === "acp_response" && processingAction?.id === detailModalRequest.id}
                      disabled={
                        Boolean(detailModalRequest.provider_response_at) ||
                        !detailModalRequest.availability_email_sent_at
                      }
                    >
                      <FiFileText /> Registrar respuesta
                    </Button>
                    {!detailModalRequest.availability_email_sent_at && (
                      <p className="text-xs text-amber-600">
                        Debes enviar el correo al proveedor antes de registrar respuesta.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Selecciona una solicitud para ver sus detalles.</p>
          )}
        </Modal>
      </div>
    </>
  );
};

export default PrivatePurchasesPage;
