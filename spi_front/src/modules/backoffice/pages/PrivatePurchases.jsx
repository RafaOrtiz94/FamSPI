import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import CreateRequestModal from "../../comercial/components/CreateRequestModal";
import {
  forwardPrivatePurchaseToAcp,
  getPrivatePurchaseDocuments,
  listPrivatePurchases,
  checkClientApproval,
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
import { createRequest } from "../../../core/api/requestsApi";
import {
  PRIVATE_PURCHASE_STATUS_DEFINITIONS,
  PRIVATE_PURCHASE_ERROR_CODES,
  PRIVATE_PURCHASE_ERROR_MESSAGES,
  STATES_REQUIRING_DOCS_CHECK,
  PRIVATE_PURCHASE_ACTIONS,
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

const STATUS_DEFINITIONS = PRIVATE_PURCHASE_STATUS_DEFINITIONS;

const statusLookup = STATUS_DEFINITIONS.reduce((acc, def) => {
  acc[def.value] = def;
  return acc;
}, {});

const formatDate = (value) => formatDateTimeEC(value, "Sin fecha");

const PrivatePurchasesPage = () => {
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
  const [inspectionModal, setInspectionModal] = useState({
    open: false,
    requestId: null,
    initialData: null
  });
  const [processingAction, setProcessingAction] = useState(null);
  const [documentLinks, setDocumentLinks] = useState([]);
  const [documentsById, setDocumentsById] = useState({});
  const [documentsLoadingById, setDocumentsLoadingById] = useState({});
  const [lastUpdatedRequestId, setLastUpdatedRequestId] = useState(null);
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
  const isPureCommercial =
    !isBackofficeUser &&
    !isManagerUser &&
    !isAcpUser &&
    (normalizedRole.startsWith("comercial") || normalizedScope.startsWith("comercial"));
  const canManageRequests = isBackofficeUser || isManagerUser || isAcpUser;
  const canViewRequests = canManageRequests || isPureCommercial;
  const statusOwnerLabels = {
    pending_backoffice: "Backoffice Comercial",
    acp_availability_requested: "ACP Comercial",
    acp_availability_confirmed: "Backoffice Comercial",
    acp_availability_rejected: "Backoffice Comercial",
    offer_sent: "Comercial",
    pending_client_signature: "Comercial",
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

  useEffect(() => {
    console.log("[FLOW_PRIVADA][FE][ROLE_CHECK]", {
      roleText,
      normalizedRole,
      normalizedScope,
      isAcpUser,
      isBackofficeUser,
      isManagerUser,
      isGerenciaGeneral,
      isPureCommercial
    });
  }, [roleText, normalizedRole, normalizedScope, isAcpUser, isBackofficeUser, isManagerUser, isGerenciaGeneral, isPureCommercial]);

  const privatePurchasesFetcher = useCallback(
    (params) => listPrivatePurchases(params),
    [],
  );

  const { data, loading, execute: fetchPrivatePurchases, setData: setPrivatePurchasesData } = useApi(
    privatePurchasesFetcher,
    { errorMsg: "No se pudo cargar las solicitudes privadas" },
  );

  const requests = canViewRequests ? data?.rows || data || [] : [];

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

  const buildInspectionInitialData = (request) => {
    const snapshot = request?.client_snapshot || {};
    return {
      cliente_id: snapshot.registered_client_id || snapshot.client_id || "",
      client_id: snapshot.registered_client_id || snapshot.client_id || "",
      nombre_cliente: snapshot.commercial_name || snapshot.name || snapshot.client_name || "",
      direccion_cliente: snapshot.shipping_address || snapshot.address || "",
      persona_contacto: snapshot.shipping_contact_name || snapshot.contact_name || snapshot.legal_rep_name || "",
      celular_contacto: snapshot.shipping_phone || snapshot.shipping_cellphone || snapshot.phone || "",
      email_cliente: snapshot.client_email || snapshot.email || "",
    };
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

          setLastUpdatedRequestId(request.id);
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
    if (!lastUpdatedRequestId) return;
    const updated = requests.find((req) => req.id === lastUpdatedRequestId);
    console.log('[FLOW_PRIVADA][FE][STATUS_CHECK]', {
      requestId: lastUpdatedRequestId,
      found: Boolean(updated),
      status: updated?.status || null
    });
  }, [requests, lastUpdatedRequestId]);

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

    // Log FE: Iniciando subida de oferta
    console.log('[FLOW_PRIVADA][FE][FASE2][OFFER_UPLOAD][START]', {
      requestId: selectedRequest.id,
      fileName: offerModal.file.name,
      fileSize: offerModal.file.size,
      role: 'backoffice_comercial'
    });

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

      // Log FE: Ãƒâ€°xito en subida de oferta
      console.log('[FLOW_PRIVADA][FE][FASE2][OFFER_UPLOAD][SUCCESS]', {
        requestId: selectedRequest.id,
        ok: true,
        code: 'SUCCESS'
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
        console.log('[FLOW_PRIVADA][FE][FASE2][IDEMPOTENCY_UI][BLOCKED]', {
          requestId: selectedRequest.id,
          errorCode,
          action: 'offer_upload',
          existingRef: error.response?.data?.details?.existingRef
        });

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

    // Log FE: Iniciando subida de oferta firmada
    console.log('[FLOW_PRIVADA][FE][FASE2][SIGNED_OFFER_UPLOAD][START]', {
      requestId: selectedRequest.id,
      fileName: signedModal.file.name,
      fileSize: signedModal.file.size,
      role: isManagerUser ? 'gerencia' : 'backoffice_comercial'
    });

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

      // Log FE: Ãƒâ€°xito en subida de oferta firmada
      console.log('[FLOW_PRIVADA][FE][FASE2][SIGNED_OFFER_UPLOAD][SUCCESS]', {
        requestId: selectedRequest.id,
        ok: true,
        code: 'SUCCESS'
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
        console.log('[FLOW_PRIVADA][FE][FASE2][IDEMPOTENCY_UI][BLOCKED]', {
          requestId: selectedRequest.id,
          errorCode,
          action: 'signed_offer_upload',
          existingRef: error.response?.data?.details?.existingRef
        });

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
      console.log('[FLOW_PRIVADA][FE][FASE4][CORRECTION][RESUBMIT][DISABLED_MISSING_DOCS]', {
        requestId: selectedRequest.id,
        missingDocs: missing,
        totalMissing: missing.length
      });
      return;
    }

    setProcessingAction({ id: selectedRequest.id, type: "resubmit" });

    try {
      console.log('[FLOW_PRIVADA][FE][FASE4][CORRECTION][RESUBMIT][API_CALL_START]', {
        requestId: selectedRequest.id,
        fromStatus: selectedRequest.status,
        toStatus: 'pending_contract_client_signature'
      });

      // Use transition API to resubmit
      await transitionPrivatePurchaseState(selectedRequest.id, 'pending_contract_client_signature');

      console.log('[FLOW_PRIVADA][FE][FASE4][CORRECTION][RESUBMIT][API_OK]', {
        requestId: selectedRequest.id,
        ok: true,
        code: 'SUCCESS'
      });

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
        console.log('[FLOW_PRIVADA][FE][FASE4][GERENCIA_DOC_GATE_UI][API_BLOCKED]', {
          requestId: selectedRequest.id,
          errorCode,
          missingDocs,
          totalMissing: missingDocs.length
        });
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

    // Log FE: Iniciando validaciÃƒÂ³n de docs para gerencia
    console.log('[FLOW_PRIVADA][FE][FASE4][GERENCIA_DOC_GATE_UI][API_CALL_START]', {
      requestId: request.id,
      status: request.status,
      flowId,
      role: 'backoffice_comercial',
      action: PRIVATE_PURCHASE_ACTIONS.SEND_TO_ACP
    });

    setProcessingAction({ id: request.id, type: "forward" });
    try {
      const response = await forwardPrivatePurchaseToAcp(request.id, {
        headers: { "x-flow-id": flowId }
      });
      console.log('[FLOW_PRIVADA][FE][ACP_FORWARD][API_RESPONSE]', {
        requestId: request.id,
        flowId,
        response
      });

      // Log FE: Ãƒâ€°xito en envÃƒÂ­o a ACP
      console.log('[FLOW_PRIVADA][FE][FASE4][ACP_FORWARD_SUCCESS]', {
        requestId: request.id,
        flowId,
        ok: true,
        code: 'SUCCESS'
      });

      showToast("Solicitud enviada a ACP", "success");
      setPrivatePurchasesData((prev) => {
        console.log('[FLOW_PRIVADA][FE][ACP_FORWARD][OPTIMISTIC_BEFORE]', {
          requestId: request.id,
          flowId,
          prev
        });
        if (!prev) return prev;
        const rows = Array.isArray(prev.rows) ? prev.rows : Array.isArray(prev) ? prev : [];
        const updatedRows = rows.map((item) =>
          item.id === request.id
            ? { ...item, status: "acp_availability_requested" }
            : item
        );
        const next = Array.isArray(prev.rows) ? { ...prev, rows: updatedRows } : updatedRows;
        console.log('[FLOW_PRIVADA][FE][ACP_FORWARD][OPTIMISTIC_AFTER]', {
          requestId: request.id,
          flowId,
          next
        });
        const updatedItem = (Array.isArray(next.rows) ? next.rows : next).find(
          (item) => item.id === request.id
        );
        console.log('[FLOW_PRIVADA][FE][ACP_FORWARD][OPTIMISTIC_STATUS]', {
          requestId: request.id,
          flowId,
          status: updatedItem?.status
        });
        return next;
      });
      setLastUpdatedRequestId(request.id);
      const nextStatusFilter = statusFilter === "pending_backoffice" ? "all" : statusFilter;
      if (nextStatusFilter !== statusFilter) {
        setStatusFilter(nextStatusFilter);
      }
      console.log('[FLOW_PRIVADA][FE][ACP_FORWARD][REFRESH]', {
        requestId: request.id,
        flowId,
        statusFilter,
        nextStatusFilter
      });
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

        // Log FE: Bloqueado por docs incompletos
        console.log('[FLOW_PRIVADA][FE][FASE4][GERENCIA_DOC_GATE_UI][API_BLOCKED]', {
          requestId: request.id,
          errorCode,
          missingDocs,
          totalMissing: missingDocs.length
        });

        showToast(
          `No se puede enviar a ACP: ${PRIVATE_PURCHASE_ERROR_MESSAGES[errorCode]} (${missingDocs.length} documentos faltantes)`,
          "error"
        );
      } else if (errorCode === PRIVATE_PURCHASE_ERROR_CODES.DOC_ALREADY_EXISTS) {
        console.log('[FLOW_PRIVADA][FE][FASE4][IDEMPOTENCY_UI][BLOCKED]', {
          requestId: request.id,
          errorCode,
          existingRef: error.response?.data?.details?.existingRef
        });

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

    // Log detallado de roles y permisos antes de hacer la llamada
    console.log('[FLOW_PRIVADA][FE][ACP_AVAILABILITY_EMAIL][ROLE_CHECK]', {
      requestId,
      user: {
        id: user?.id,
        email: user?.email,
        rawRoleValue,
        rolesArray,
        roleText,
        normalizedRole,
        normalizedScope
      },
      roleChecks: {
        isAcpUser,
        isBackofficeUser,
        isManagerUser,
        hasRoleToken_acp_comercial: hasRoleToken("acp_comercial"),
        hasRoleToken_acp: hasRoleToken("acp"),
        hasRoleToken_comercial: hasRoleToken("comercial"),
        hasRoleToken_jefe_comercial: hasRoleToken("jefe_comercial")
      },
      requiredRoles: ['acp_comercial', 'jefe_comercial'],
      endpoint: `/private-purchases/${requestId}/start-availability`
    });

    setAcpEmailModal((prev) => ({ ...prev, loading: true }));
    setProcessingAction({ id: requestId, type: "acp_send_email" });
    try {
      console.log('[FLOW_PRIVADA][FE][ACP][EMAIL][START]', {
        requestId,
        providerEmail: providerEmail.trim(),
        userHasRequiredRole: isAcpUser || isManagerUser
      });
      await startPrivatePurchaseAvailability(requestId, {
        provider_email: providerEmail.trim(),
        notes: notes.trim()
      });
      console.log('[FLOW_PRIVADA][FE][ACP][EMAIL][SUCCESS]', {
        requestId
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
        name: item.name || item.label || item.sku || item.id || "Equipo",
        requested_type: item.type,
        available_type: "new", // default to available new
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
      console.log('[FLOW_PRIVADA][FE][ACP][RESPONSE][START]', {
        requestId,
        itemsCount: items?.length || 0
      });

      // Enviar items individuales al backend
      await savePrivatePurchaseProviderResponse(requestId, {
        outcome: "new", // El backend calcula el outcome basado en items
        items: items || [],
        notes: notes.trim()
      });

      console.log('[FLOW_PRIVADA][FE][ACP][RESPONSE][SUCCESS]', {
        requestId
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

  const handleOpenInspectionModal = (requestId) => {
    const request = getRequestById(requestId);
    if (!request) return;

    setInspectionModal({
      open: true,
      requestId,
      initialData: buildInspectionInitialData(request)
    });
  };

  const handleSubmitInspectionRequest = async (data) => {
    if (!inspectionModal.requestId) return;
    try {
      showToast("Enviando solicitud de inspeccion...", "info");

      const { files = [], ...payload } = data || {};
      const payloadToSend = {
        ...payload,
        observaciones: payload?.observacion
      };
      delete payloadToSend.observacion;

      const result = await createRequest({
        request_type_id: "F.ST-20",
        ...payloadToSend,
        files
      });

      const requestId =
        result?.request?.id ||
        result?.request_id ||
        result?.id;
      const actaId =
        result?.document?.id ||
        result?.document?.pdfId ||
        result?.document?.docId ||
        null;

      await savePrivatePurchaseInspectionRequest(inspectionModal.requestId, {
        request_id: requestId,
        acta_document_id: actaId
      });

      showToast("Solicitud de inspeccion enviada correctamente", "success");
      setInspectionModal({ open: false, requestId: null, initialData: null });
      fetchPrivatePurchases({
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
    } catch (error) {
      console.error("[FLOW_PRIVADA][FE][INSPECCION][ERROR]", error);
      showToast("Error al enviar la solicitud de inspeccion", "error");
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
    const flowId = getFlowIdForRequest(request.id) || `pp-${Date.now()}-${request.id}`;

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
    const flowId = getFlowIdForRequest(request.id) || `pp-${Date.now()}-${request.id}`;

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
          title={processingAction.title || "Procesando..."}
          steps={PRIVATE_PURCHASE_PROCESSING_STEPS[processingAction.type] ? [PRIVATE_PURCHASE_PROCESSING_STEPS[processingAction.type]] : []}
          activeStep={processingAction.type}
        />
      )}
      <div className="space-y-6 p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FiFileText className="text-blue-600" />
              Compras Privadas
            </h1>
            <p className="text-sm text-gray-500">
              Gestiona el flujo privado que empieza en comercial y termina en ACP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
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
            >
              Actualizar
            </Button>
          </div>
        </header>

        <Card className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpiRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{row.label}</p>
                <p className="text-2xl font-bold text-gray-900">{row.count}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* SecciÃƒÂ³n de solicitudes con cards modernas */}
        <div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-slate-900 p-2.5 text-white shadow-sm">
                <FiPackage size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Solicitudes de compra privada</h2>
                <p className="text-sm text-slate-500">Gestiona el flujo completo desde comercial hasta ACP</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar por cliente o estado..."
                  className="w-72 rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => fetchPrivatePurchases({
                  status: statusFilter !== "all" ? statusFilter : undefined,
                })}
                variant="ghost"
                className="px-3"
                loading={loading}
              >
                <FiRefreshCw size={14} />
              </Button>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <Card className="p-16 text-center border border-slate-200/70 bg-white/80 shadow-sm">
              <FiPackage className="mx-auto text-slate-300 mb-4" size={48} />
              <p className="text-slate-500 text-lg font-medium">No hay solicitudes registradas</p>
              <p className="text-slate-400 text-sm mt-1">
                {loading ? "Cargando solicitudes..." : "Las nuevas solicitudes aparecerÃƒÂ¡n aquÃƒÂ­"}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRequests.map((req) => {
                const statusConfig = getPrivatePurchaseStatusConfig(req.status);
                const clientInfo = getPrivatePurchaseClientInfo(req.client_snapshot);
                const equipmentInfo = getPrivatePurchaseEquipmentInfo(req);
                const creationInfo = {
                  date: req.created_at ? formatDateTimeEC(req.created_at) : "Fecha no disponible",
                  by: req.created_by_email || req.created_by || "AnÃƒÂ³nimo"
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

                const toggleExpanded = (e) => {
                  e.stopPropagation();
                  setExpandedRequestId(prev => prev === req.id ? null : req.id);
                };

                return (
                  <Card
                    key={req.id}
                    className={`relative h-full flex flex-col rounded-2xl p-5 border transition-all duration-300 transform hover:-translate-y-1 cursor-pointer ${isSelected
                      ? 'border-blue-300 bg-blue-50/50 shadow-lg shadow-blue-200/60 ring-2 ring-blue-200'
                      : `${statusConfig.cardBorder} ${statusConfig.cardBg} shadow-md hover:shadow-lg`
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
                        <h3 className="font-bold text-lg text-gray-900 leading-tight mt-1">{clientInfo.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{clientInfo.email}</p>
                      </div>
                    </div>

                    {/* Equipo solicitado */}
                    <div className="mb-3 flex items-center gap-2 text-sm text-gray-700">
                      <FiPackage className="text-gray-500" size={14} />
                      <span className="font-medium">{equipmentInfo.summary}</span>
                    </div>

                    {/* Metadatos esenciales */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-4">
                      <div className="flex items-center gap-2">
                        <FiUser className="text-gray-400" size={12} />
                        <span className="truncate">{creationInfo.by}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FiUsers className="text-gray-400" size={12} />
                        <span className="truncate">Responsable: {statusOwner}</span>
                      </div>
                    </div>

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
                        handleOpenInspectionModal(id);
                      }}
                    />

                    {/* Indicador de mÃƒÂ¡s acciones */}
                    

                    {/* Contenido expandido */}
                    {expanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                        {/* InformaciÃƒÂ³n detallada del cliente */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Cliente</p>
                          <div className="space-y-1 text-sm">
                            <p><span className="font-medium">Nombre:</span> {clientInfo.name}</p>
                            <p><span className="font-medium">Email:</span> {clientInfo.email}</p>
                            <p><span className="font-medium">ID:</span> {clientInfo.identifier}</p>
                          </div>
                        </div>

                        {/* Equipos */}
                        {equipmentInfo.count > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                              Equipos ({equipmentInfo.count})
                            </p>
                            <div className="space-y-2">
                              {equipmentInfo.details.slice(0, 3).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm">
                                  <span className="font-medium text-gray-900">{item.name}</span>
                                  <span className="text-xs text-gray-500">{item.sku}</span>
                                </div>
                              ))}
                              {equipmentInfo.details.length > 3 && (
                                <p className="text-xs text-gray-500 text-center">
                                  +{equipmentInfo.details.length - 3} equipos mÃƒÂ¡s
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notas */}
                        {req.notes && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Notas</p>
                            <p className="text-sm text-gray-700">{req.notes}</p>
                          </div>
                        )}

                        {/* Respuesta detallada del proveedor */}
                        {req.provider_response && (
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
                                Respuesta detallada del proveedor
                              </p>
                              <span className="text-[10px] text-blue-600">
                                {req.provider_response_at ? formatDateTimeEC(req.provider_response_at, '') : ''}
                              </span>
                            </div>

                            <div className="mb-3">
                              <p className="text-sm font-medium text-blue-900">
                                {req.provider_response.outcome === 'new' ? 'Equipos disponibles para entrega' : 'Equipos no disponibles'}
                              </p>
                              {req.provider_response.notes && (
                                <p className="text-sm text-blue-700 mt-1">{req.provider_response.notes}</p>
                              )}
                            </div>

                            {Array.isArray(req.provider_response.items) && req.provider_response.items.length > 0 && (
                              <div className="space-y-3">
                                <p className="text-[10px] uppercase tracking-wide text-blue-700">Equipos evaluados:</p>
                                <div className="space-y-2">
                                  {req.provider_response.items.map((item, idx) => {
                                    const requestedItem = req.equipment?.find(eq => eq.id === item.id) || {};
                                    const requestedType = item.requested_type || requestedItem.type;
                                    const availableType = item.available_type;
                                    const decision = item.decision;
                                    const hasMismatch = requestedType && availableType && requestedType !== availableType;

                                    const typeBadge = (type, label) => (
                                      <span
                                        className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${type === 'new'
                                          ? 'bg-green-100 text-green-700'
                                          : type === 'cu'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-600'
                                          }`}
                                      >
                                        {label}: {type === 'new' ? 'Nuevo' : type === 'cu' ? 'CU' : 'Sin stock'}
                                      </span>
                                    );

                                    return (
                                      <div key={`${req.id}-${idx}`} className="rounded-lg border border-blue-200 bg-white p-3 shadow-sm">
                                        <p className="font-medium text-gray-900 text-sm">{item.name || requestedItem.name || 'Equipo'}</p>
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
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-wide text-gray-500">Documentos clave</p>
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
                            <p className="text-xs text-gray-500 mt-2">Buscando documentos...</p>
                          ) : docs.length === 0 ? (
                            <p className="text-xs text-gray-500 mt-2">Sin documentos registrados en expediente</p>
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
                );
              })}
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
                        Solicitado: {item.requested_type === "cu" ? "CU" : item.requested_type === "new" ? "Nuevo" : "Sin especificar"}
                      </p>
                    </div>
                    {item.sku && <span className="text-[11px] text-gray-500">SKU: {item.sku}</span>}
                  </div>

                  {/* Opciones de disponibilidad */}
                  <div className="space-y-1 mb-3">
                    {[{ value: "new", label: "Disponible en Nuevo" }, { value: "cu", label: "Disponible en CU" }, { value: "none", label: "Sin stock" }]
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

        <CreateRequestModal
          open={inspectionModal.open}
          onClose={() => setInspectionModal({ open: false, requestId: null, initialData: null })}
          onSubmit={handleSubmitInspectionRequest}
          presetType="inspection"
          initialData={inspectionModal.initialData}
          isEditing={true}
        />

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
                  <p className="text-sm font-semibold text-gray-900 capitalize">{detailModalRequest.offer_kind || "venta"}</p>
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
                      const typeLabel = item?.type === "cu" ? "CU" : item?.type === "new" ? "Nuevo" : (item?.type || "N/D").toUpperCase();
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
                {isBackofficeUser && detailModalRequest.status === "acp_availability_confirmed" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setOfferModal({ open: true, loading: false })}
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
                    <Button
                      variant={detailModalRequest.contract_document_id ? "warning" : "success"}
                      size="sm"
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
                    onClick={() => handleOpenInspectionModal(detailModalRequest.id)}
                  >
                    <FiSearch /> Solicitar inspeccion
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
                      disabled={Boolean(detailModalRequest.provider_response_at)}
                    >
                      <FiFileText /> Registrar respuesta
                    </Button>
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
