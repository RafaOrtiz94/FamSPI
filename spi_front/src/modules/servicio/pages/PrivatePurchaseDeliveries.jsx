import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "../../../core/ui/components/Card";
import { Button } from "../../../core/ui/components/Button";
import { Select } from "../../../core/ui/components/Select";
import { Badge } from "../../../core/ui/components/Badge";
import { Alert, AlertDescription } from "../../../core/ui/components/Alert";
import { Spinner } from "../../../core/ui/components/Spinner";
import Modal from "../../../core/ui/components/Modal";
import { formatDateEC } from "../../../core/utils/dateUtils";
import { useAuth } from "../../../core/auth/AuthContext";

import PurchaseTimelinePanel from "../../comercial/components/private-purchases/PurchaseTimelinePanel";
import DocumentChecklist from "../../comercial/components/private-purchases/DocumentChecklist";
import InstallationReceptionStepper from "../components/InstallationReceptionStepper";
import DeliveryActPanel from "../components/DeliveryActPanel";
import VerificationResultPanel from "../components/VerificationResultPanel";
import {
  assignPrivatePurchaseDeliveryActTechnician,
  finalizePrivatePurchaseDeliveryAct,
  getPrivatePurchaseById,
  getPrivatePurchaseDocuments,
  getPrivatePurchaseTimeline,
  getPrivatePurchasesByRole,
  updatePrivatePurchaseInstallationWorkflow,
} from "../../../core/api/privatePurchasesApi";
import { usePurchaseSSE } from "../../../core/hooks/usePurchaseSSE";

const ALLOWED_STATUSES = [
  "waiting_dispatch",
  "dispatch_ready",
  "delivery_act_draft_ready",
  "delivery_act_tech_assigned",
  "delivery_act_logistics_signed",
  "delivery_act_generated",
];

const VISUAL_CHECKLIST_LABELS = {
  guide_vs_proforma: "Guia vs proforma",
  packaging_integrity: "Integridad de empaque",
  tilt_indicator: "Indicador de inclinacion",
  handling_indicator: "Indicador de manipulacion",
  serial_match: "Serie coincide",
  accessories_match: "Accesorios completos",
};

const INSTALLATION_BLOCK_LABELS = {
  DISPATCH_REQUEST_PENDING: "Falta registrar solicitud formal de despacho.",
  LOGISTICS_VALIDATION_PENDING: "Falta validacion logistica de guia/proforma.",
  FST14_PENDING: "Falta registrar recepcion visual F.ST-14.",
  FST14_NOT_APPROVED: "F.ST-14 esta no aprobado y requiere correccion.",
  SITE_NOT_READY_FOR_INSTALLATION: "El sitio no esta conforme para instalacion.",
  VERIFICATION_DECISION_PENDING: "Falta decision tecnica de verificacion F.ST-09.",
  VERIFICATION_PENDING: "La verificacion tecnica no esta aprobada.",
  VERIFICATION_EXCEPTION_INCOMPLETE: "La excepcion de verificacion no esta documentada.",
  CU_PARTS_PENDING: "Equipo CU con partes/repuestos pendientes.",
  CU_PROVIDER_REPORT_PENDING: "Falta reporte del proveedor para equipo CU.",
};

const normalizeRoleList = (value) => {
  if (Array.isArray(value)) {
    return value.map((role) => String(role || "").toLowerCase()).filter(Boolean);
  }
  if (!value) return [];
  return String(value)
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
};

const createInitialFst14Draft = () => ({
  guide_reference: "",
  proforma_reference: "",
  result: "pass",
  checklist: {
    guide_vs_proforma: "",
    packaging_integrity: "",
    tilt_indicator: "",
    handling_indicator: "",
    serial_match: "",
    accessories_match: "",
  },
  findings: "",
  corrective_actions: "",
  logistics_chain_notes: "",
  photos: [],
});

const getStatusLabel = (status) => {
  const labels = {
    waiting_dispatch: "Esperando despacho",
    dispatch_ready: "Despacho listo",
    delivery_act_draft_ready: "Acta en borrador",
    delivery_act_tech_assigned: "Tecnico asignado",
    delivery_act_logistics_signed: "Acta firmada por logistica",
    delivery_act_generated: "Acta final firmada",
  };
  return labels[status] || String(status || "").replace(/_/g, " ");
};

const getStatusBadgeVariant = (status) => {
  const variants = {
    waiting_dispatch: "yellow",
    dispatch_ready: "orange",
    delivery_act_draft_ready: "amber",
    delivery_act_tech_assigned: "yellow",
    delivery_act_logistics_signed: "blue",
    delivery_act_generated: "purple",
  };
  return variants[status] || "gray";
};

const mapWorkflowDocLabel = (docType = "") => {
  if (docType === "INSPECTION_ACT") return "F.ST-20";
  if (docType.startsWith("F.ST-09_ATTEMPT_")) {
    const attempt = docType.split("_").pop();
    return `F.ST-09 Intento ${attempt || "-"}`;
  }
  return docType;
};

const PrivatePurchaseDeliveries = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ assignedEmail: "", assignedName: "" });
  const [finalActaFile, setFinalActaFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [installationSaving, setInstallationSaving] = useState(false);
  const [showFst14Modal, setShowFst14Modal] = useState(false);
  const [dispatchDraft, setDispatchDraft] = useState({
    required_date: "",
    requires_notice: true,
    client_address: "",
  });
  const [logisticsDraft, setLogisticsDraft] = useState({
    status: "pending",
    guide_reference: "",
    proforma_reference: "",
    notes: "",
  });
  const [verificationDecisionDraft, setVerificationDecisionDraft] = useState({
    applies: "",
    source_reference: "",
    justification: "",
  });
  const [remediationReviewNotes, setRemediationReviewNotes] = useState("");
  const [fst14Draft, setFst14Draft] = useState(createInitialFst14Draft());
  const [fst14Errors, setFst14Errors] = useState({});
  const [cuReportDraft, setCuReportDraft] = useState({
    requires_parts_request: false,
    parts_request_status: "not_required",
    provider_repair_report_required: false,
    parts_request_notes: "",
    file: null,
  });

  const { user } = useAuth();
  const navigate = useNavigate();

  const roleList = useMemo(() => normalizeRoleList(user?.role), [user?.role]);
  const scopeList = useMemo(() => normalizeRoleList(user?.scope), [user?.scope]);
  const mergedRoles = useMemo(
    () => Array.from(new Set([...roleList, ...scopeList])),
    [roleList, scopeList],
  );
  const isLeadRole = useMemo(
    () =>
      mergedRoles.some(
        (role) => role.includes("jefe_tecnico") || role.includes("jefe_servicio_tecnico"),
      ),
    [mergedRoles],
  );

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const roleParam = isLeadRole ? "jefe_tecnico" : "tecnico";
      const response = await getPrivatePurchasesByRole(roleParam);
      const data = Array.isArray(response) ? response : [];
      const filtered = statusFilter ? data.filter((item) => item.status === statusFilter) : data;
      setPurchases(filtered);
    } catch (err) {
      setError("Error al cargar las compras privadas");
    } finally {
      setLoading(false);
    }
  }, [isLeadRole, statusFilter]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const allowedStatusSet = useMemo(() => new Set(ALLOWED_STATUSES), []);
  usePurchaseSSE({
    type: "private",
    debounceMs: 8000,
    onEvent: loadPurchases,
    filter: (payload) => {
      const status = payload?.request?.status;
      const fromState = payload?.meta?.from;
      const toState = payload?.meta?.to;
      return (
        allowedStatusSet.has(status) ||
        allowedStatusSet.has(fromState) ||
        allowedStatusSet.has(toState)
      );
    },
  });

  const fileToBase64Payload = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = typeof result === "string" ? result.split(",")[1] || "" : "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const hydrateDetailDrafts = useCallback((detailResponse) => {
    const installationWorkflow = detailResponse?.installation_workflow || {};
    const dispatchRequest = installationWorkflow?.dispatch_request || {};
    const logisticsValidation = installationWorkflow?.logistics_validation || {};
    const verificationDecision = installationWorkflow?.verification_decision || {};
    const verificationCycle = installationWorkflow?.verification_cycle || {};
    const visualReception = installationWorkflow?.visual_reception || {};
    const cuFlow = installationWorkflow?.cu_flow || {};

    setAssignmentForm({
      assignedEmail: detailResponse?.delivery_act_assigned_to_email || "",
      assignedName: detailResponse?.delivery_act_assigned_to_name || "",
    });
    setFinalActaFile(null);
    setDispatchDraft({
      required_date: dispatchRequest?.required_date || detailResponse?.delivery_start_at || "",
      requires_notice:
        typeof dispatchRequest?.requires_notice === "boolean"
          ? dispatchRequest.requires_notice
          : true,
      client_address:
        dispatchRequest?.client_address ||
        detailResponse?.client_snapshot?.shipping_address ||
        detailResponse?.client_snapshot?.address ||
        "",
    });
    setLogisticsDraft({
      status: logisticsValidation?.status || "pending",
      guide_reference: logisticsValidation?.guide_reference || "",
      proforma_reference: logisticsValidation?.proforma_reference || "",
      notes: logisticsValidation?.notes || "",
    });
    setVerificationDecisionDraft({
      applies:
        verificationDecision?.applies === true
          ? "true"
          : verificationDecision?.applies === false
            ? "false"
            : "",
      source_reference: verificationDecision?.source_reference || "",
      justification: verificationDecision?.justification || "",
    });
    setRemediationReviewNotes(verificationCycle?.remediation?.review_notes || "");
    setFst14Draft({
      guide_reference: visualReception?.guide_reference || "",
      proforma_reference: visualReception?.proforma_reference || "",
      result: visualReception?.result || "pass",
      checklist: {
        guide_vs_proforma: visualReception?.checklist?.guide_vs_proforma || "",
        packaging_integrity: visualReception?.checklist?.packaging_integrity || "",
        tilt_indicator: visualReception?.checklist?.tilt_indicator || "",
        handling_indicator: visualReception?.checklist?.handling_indicator || "",
        serial_match: visualReception?.checklist?.serial_match || "",
        accessories_match: visualReception?.checklist?.accessories_match || "",
      },
      findings: visualReception?.findings || "",
      corrective_actions: visualReception?.corrective_actions || "",
      logistics_chain_notes: visualReception?.logistics_chain_notes || "",
      photos: [],
    });
    setFst14Errors({});
    setCuReportDraft({
      requires_parts_request: Boolean(cuFlow?.requires_parts_request),
      parts_request_status: cuFlow?.parts_request_status || "not_required",
      provider_repair_report_required: Boolean(cuFlow?.provider_repair_report_required),
      parts_request_notes: cuFlow?.parts_request_notes || "",
      file: null,
    });
  }, []);

  const handleViewDetail = useCallback(
    async (purchase) => {
      try {
        setError(null);
        const [detailResponse, timelineResponse, documentsResponse] = await Promise.all([
          getPrivatePurchaseById(purchase.id),
          getPrivatePurchaseTimeline(purchase.id),
          getPrivatePurchaseDocuments(purchase.id),
        ]);
        const nextSelectedPurchase = {
          ...detailResponse,
          timeline: timelineResponse?.events || [],
          checklist: timelineResponse?.checklist || [],
          documents: documentsResponse || [],
        };
        setSelectedPurchase(nextSelectedPurchase);
        hydrateDetailDrafts(detailResponse);
        setShowDetail(true);
      } catch (err) {
        setError("Error al cargar detalles de la compra");
      }
    },
    [hydrateDetailDrafts],
  );

  const refreshSelectedPurchase = useCallback(async () => {
    if (!selectedPurchase?.id) return;
    const [detailResponse, timelineResponse, documentsResponse] = await Promise.all([
      getPrivatePurchaseById(selectedPurchase.id),
      getPrivatePurchaseTimeline(selectedPurchase.id),
      getPrivatePurchaseDocuments(selectedPurchase.id),
    ]);
    const refreshed = {
      ...detailResponse,
      timeline: timelineResponse?.events || [],
      checklist: timelineResponse?.checklist || [],
      documents: documentsResponse || [],
    };
    setSelectedPurchase(refreshed);
    hydrateDetailDrafts(detailResponse);
  }, [hydrateDetailDrafts, selectedPurchase?.id]);

  const isAssignedTechnician = useCallback(() => {
    if (!selectedPurchase) return false;
    if (selectedPurchase.delivery_act_assigned_to_user_id && user?.id) {
      return selectedPurchase.delivery_act_assigned_to_user_id === user.id;
    }
    if (selectedPurchase.delivery_act_assigned_to_email && user?.email) {
      return selectedPurchase.delivery_act_assigned_to_email === user.email;
    }
    return false;
  }, [selectedPurchase, user?.email, user?.id]);

  const handleAssignTechnician = async () => {
    if (!selectedPurchase) return;
    try {
      setSaving(true);
      setError(null);
      await assignPrivatePurchaseDeliveryActTechnician(selectedPurchase.id, {
        assigned_to_email: assignmentForm.assignedEmail,
        assigned_to_name: assignmentForm.assignedName,
      });
      await refreshSelectedPurchase();
      await loadPurchases();
      window.alert("Tecnico asignado correctamente");
    } catch (err) {
      window.alert(`Error asignando tecnico: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalActaUpload = async () => {
    if (!selectedPurchase || !finalActaFile) return;
    try {
      setSaving(true);
      setError(null);
      const base64 = await fileToBase64Payload(finalActaFile);
      await finalizePrivatePurchaseDeliveryAct(selectedPurchase.id, {
        act_base64: base64,
        file_name: finalActaFile.name,
        mime_type: finalActaFile.type || "application/pdf",
      });
      await refreshSelectedPurchase();
      await loadPurchases();
      window.alert("Acta final subida correctamente");
    } catch (err) {
      window.alert(`Error subiendo acta final: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const runInstallationAction = useCallback(
    async (action, payload, fallbackMessage) => {
      if (!selectedPurchase) return;
      try {
        setInstallationSaving(true);
        setError(null);
        await updatePrivatePurchaseInstallationWorkflow(selectedPurchase.id, {
          action,
          payload,
          expected_updated_at: selectedPurchase?.updated_at || null,
        });
        await refreshSelectedPurchase();
        await loadPurchases();
      } catch (err) {
        setError(err.message || fallbackMessage);
      } finally {
        setInstallationSaving(false);
      }
    },
    [loadPurchases, refreshSelectedPurchase, selectedPurchase],
  );

  const handleSaveDispatchRequest = async () => {
    if (!selectedPurchase) return;
    if (!dispatchDraft.required_date) {
      setError("Debes registrar la fecha requerida de despacho.");
      return;
    }
    if (!dispatchDraft.client_address) {
      setError("Debes registrar la direccion del cliente para despacho.");
      return;
    }
    const dispatchItems = Array.isArray(selectedPurchase?.dispatch_items_json)
      ? selectedPurchase.dispatch_items_json
      : [];
    await runInstallationAction(
      "dispatch_request",
      {
        required_date: dispatchDraft.required_date,
        requires_notice: Boolean(dispatchDraft.requires_notice),
        client_address: dispatchDraft.client_address,
        client_name:
          selectedPurchase?.client_snapshot?.commercial_name ||
          selectedPurchase?.client_snapshot?.client_name ||
          selectedPurchase?.client_snapshot?.name ||
          "Cliente",
        contact_name:
          selectedPurchase?.client_snapshot?.shipping_contact_name ||
          selectedPurchase?.client_snapshot?.contact_name ||
          "",
        contact_phone:
          selectedPurchase?.client_snapshot?.shipping_phone ||
          selectedPurchase?.client_snapshot?.shipping_cellphone ||
          selectedPurchase?.client_snapshot?.phone ||
          "",
        items: dispatchItems,
        notes: selectedPurchase?.dispatch_notes || "",
      },
      "No se pudo actualizar solicitud de despacho",
    );
  };

  const handleValidateLogistics = async () => {
    if (!selectedPurchase) return;
    await runInstallationAction(
      "logistics_validation",
      {
        status: logisticsDraft.status || "validated",
        guide_reference: logisticsDraft.guide_reference,
        proforma_reference: logisticsDraft.proforma_reference,
        notes: logisticsDraft.notes,
      },
      "No se pudo registrar validacion logistica",
    );
  };

  const handleSaveVerificationDecision = async () => {
    if (!selectedPurchase) return;
    if (!verificationDecisionDraft.applies) {
      setError("Debes indicar si la verificacion tecnica aplica.");
      return;
    }
    await runInstallationAction(
      "verification_decision",
      {
        applies: verificationDecisionDraft.applies === "true",
        source_reference: verificationDecisionDraft.source_reference,
        justification: verificationDecisionDraft.justification,
      },
      "No se pudo registrar decision de verificacion",
    );
  };

  const handleSaveRemediationReview = async () => {
    if (!selectedPurchase) return;
    if (!remediationReviewNotes || remediationReviewNotes.trim().length < 6) {
      setError("Debes registrar una nota de revision de remediacion (minimo 6 caracteres).");
      return;
    }
    await runInstallationAction(
      "verification_remediation_review",
      {
        review_notes: remediationReviewNotes.trim(),
      },
      "No se pudo registrar revision de remediacion",
    );
  };

  const handleSaveFst14 = async () => {
    if (!selectedPurchase) return;
    const nextErrors = {};
    Object.keys(VISUAL_CHECKLIST_LABELS).forEach((key) => {
      if (!fst14Draft?.checklist?.[key]) {
        nextErrors[key] = "Campo requerido";
      }
    });
    if (fst14Draft.result === "failed" && !fst14Draft.corrective_actions) {
      nextErrors.corrective_actions = "Debes registrar acciones correctivas cuando no aprueba";
    }
    if (Object.keys(nextErrors).length) {
      setFst14Errors(nextErrors);
      return;
    }
    setFst14Errors({});
    await runInstallationAction(
      "visual_inspection_fst14",
      {
        ...fst14Draft,
        inspection_date: new Date().toISOString(),
      },
      "No se pudo registrar F.ST-14",
    );
    setShowFst14Modal(false);
  };

  const handleSaveCuProviderReport = async () => {
    if (!selectedPurchase) return;
    let fileBase64 = null;
    if (cuReportDraft.file) {
      fileBase64 = await fileToBase64Payload(cuReportDraft.file);
    }
    await runInstallationAction(
      "cu_provider_report",
      {
        requires_parts_request: Boolean(cuReportDraft.requires_parts_request),
        parts_request_status: cuReportDraft.parts_request_status,
        provider_repair_report_required: Boolean(cuReportDraft.provider_repair_report_required),
        parts_request_notes: cuReportDraft.parts_request_notes,
        file_base64: fileBase64,
        file_name: cuReportDraft.file?.name,
        mime_type: cuReportDraft.file?.type || "application/pdf",
      },
      "No se pudo registrar el flujo CU",
    );
    setCuReportDraft((prev) => ({ ...prev, file: null }));
  };

  const openVerificationForm = useCallback(() => {
    if (!selectedPurchase) return;
    const dispatchItems = Array.isArray(selectedPurchase?.dispatch_items_json)
      ? selectedPurchase.dispatch_items_json
      : [];
    const params = new URLSearchParams({
      source_type: "private_purchase",
      source_id: String(selectedPurchase.id),
      client_name:
        selectedPurchase?.client_snapshot?.commercial_name ||
        selectedPurchase?.client_snapshot?.client_name ||
        selectedPurchase?.client_snapshot?.name ||
        "Cliente",
      equipment_name: dispatchItems?.[0]?.equipment_name || "Equipo",
      equipment_serial: dispatchItems?.[0]?.serial || "",
    });
    if (selectedPurchase.inspection_request_id) {
      params.set("request_id", String(selectedPurchase.inspection_request_id));
    }
    navigate(`/dashboard/servicio-tecnico/verificacion?${params.toString()}`);
  }, [navigate, selectedPurchase]);

  const formatDate = (value) => formatDateEC(value, "-");
  const formatClientName = (purchase) => {
    const snapshot = purchase?.client_snapshot || {};
    return snapshot.commercial_name || snapshot.client_name || snapshot.name || "Cliente desconocido";
  };

  const dispatchItems = Array.isArray(selectedPurchase?.dispatch_items_json)
    ? selectedPurchase.dispatch_items_json
    : [];
  const observations = Array.isArray(selectedPurchase?.delivery_act_observations_json)
    ? selectedPurchase.delivery_act_observations_json
    : [];
  const installationWorkflow = selectedPurchase?.installation_workflow || {};
  const closureGate = installationWorkflow?.closure_gate || {};
  const blockedReasons = Array.isArray(selectedPurchase?.installation_blocked_reasons)
    ? selectedPurchase.installation_blocked_reasons
    : Array.isArray(closureGate?.blocked_reasons)
      ? closureGate.blocked_reasons
      : [];
  const canCloseInstallation =
    typeof selectedPurchase?.installation_can_close === "boolean"
      ? selectedPurchase.installation_can_close
      : Boolean(closureGate?.can_close);
  const verificationCycleStatus = installationWorkflow?.verification_cycle?.status || "pending_decision";
  const verificationApplies = installationWorkflow?.verification_decision?.applies === true;
  const hasCuFlow = Boolean(installationWorkflow?.cu_flow?.is_cu);
  const canDecideVerification = isLeadRole;
  const workflowDocuments = useMemo(() => {
    const source = Array.isArray(selectedPurchase?.documents) ? selectedPurchase.documents : [];
    const filtered = source.filter(
      (doc) =>
        String(doc?.doc_type || "").startsWith("F.ST-") || String(doc?.doc_type || "") === "INSPECTION_ACT",
    );
    const uniqueMap = new Map();
    filtered.forEach((doc) => {
      const label = mapWorkflowDocLabel(doc?.doc_type || "");
      const identity = `${label}|${doc?.link || doc?.drive_file_id || ""}`;
      if (!uniqueMap.has(identity)) {
        uniqueMap.set(identity, { ...doc, display_label: label });
      }
    });
    return Array.from(uniqueMap.values());
  }, [selectedPurchase?.documents]);

  const canUploadFinalAct =
    Boolean(finalActaFile) &&
    isAssignedTechnician() &&
    selectedPurchase?.status === "delivery_act_logistics_signed" &&
    canCloseInstallation;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
        <span className="ml-2">Cargando entregas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Entregas de compras privadas</CardTitle>
          <div className="flex items-center space-x-4">
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              placeholder="Filtrar por estado"
              className="w-64"
            >
              <option value="">Todos los estados</option>
              {ALLOWED_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </Select>
            <Button onClick={loadPurchases} variant="outline">
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {purchases.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No hay compras privadas para mostrar</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">Solicitud</p>
                      <p className="font-mono text-sm text-gray-900">{purchase.id.slice(0, 8)}...</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(purchase.status)}>
                      {getStatusLabel(purchase.status)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-gray-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">Cliente</span>
                      <span className="font-medium text-gray-900">{formatClientName(purchase)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">Ultima actualizacion</span>
                      <span>{formatDate(purchase.updated_at)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-500">Estado instalacion</span>
                      <span
                        className={
                          purchase?.installation_can_close
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-amber-700"
                        }
                      >
                        {purchase?.installation_can_close ? "Lista para cerrar" : "Bloqueada"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleViewDetail(purchase)}>
                      Ver detalle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        open={showDetail && Boolean(selectedPurchase)}
        onClose={() => setShowDetail(false)}
        title={selectedPurchase ? `Detalle de compra ${selectedPurchase.id.slice(0, 8)}...` : "Detalle de compra"}
        maxWidth="max-w-6xl"
      >
        {selectedPurchase && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="text-sm font-semibold text-gray-900">{formatClientName(selectedPurchase)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Estado actual</p>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(selectedPurchase.status)}>
                    {getStatusLabel(selectedPurchase.status)}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Numero de acta</p>
                <p className="text-sm text-gray-700">{selectedPurchase.delivery_act_number || "Pendiente"}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs text-gray-500">Cierre instalacion</p>
                <p
                  className={
                    canCloseInstallation ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-amber-700"
                  }
                >
                  {canCloseInstallation ? "Habilitado" : "Bloqueado"}
                </p>
              </div>
            </div>

            {canCloseInstallation ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                <AlertDescription>
                  El workflow tecnico/documental esta completo. La instalacion puede cerrarse.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertDescription>
                  Instalacion bloqueada por prerequisitos pendientes:
                  <ul className="mt-2 list-disc list-inside text-xs">
                    {blockedReasons.length === 0 ? (
                      <li>Sin detalle de bloqueo reportado por backend.</li>
                    ) : (
                      blockedReasons.map((reason) => (
                        <li key={reason}>{INSTALLATION_BLOCK_LABELS[reason] || reason}</li>
                      ))
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)]">
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                  <h4 className="font-semibold">Equipos a entregar</h4>
                  {dispatchItems.length === 0 ? (
                    <p className="text-sm text-gray-500">No hay equipos registrados.</p>
                  ) : (
                    <div className="space-y-3">
                      {dispatchItems.map((item, index) => (
                        <div
                          key={`${item.equipment_name || item.product_code || "item"}-${index}`}
                          className="rounded-lg border border-gray-200 p-3 text-sm"
                        >
                          <div className="flex flex-wrap gap-2 text-gray-600">
                            <span className="font-semibold text-gray-900">
                              {item.equipment_name || "Equipo"}
                            </span>
                            <span>Codigo: {item.product_code || "-"}</span>
                            <span>Cantidad: {item.quantity || 1}</span>
                            <span>Serie: {item.serial || "-"}</span>
                          </div>
                          {item.notes && <p className="mt-2 text-xs text-gray-500">Obs: {item.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <h4 className="font-semibold">Solicitud de despacho y validacion logistica</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Fecha requerida</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={dispatchDraft.required_date || ""}
                        onChange={(event) =>
                          setDispatchDraft((prev) => ({ ...prev, required_date: event.target.value }))
                        }
                        disabled={installationSaving}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Direccion despacho</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={dispatchDraft.client_address || ""}
                        onChange={(event) =>
                          setDispatchDraft((prev) => ({ ...prev, client_address: event.target.value }))
                        }
                        disabled={installationSaving}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(dispatchDraft.requires_notice)}
                      onChange={(event) =>
                        setDispatchDraft((prev) => ({ ...prev, requires_notice: event.target.checked }))
                      }
                      disabled={installationSaving}
                    />
                    Requiere aviso de 15 dias
                  </label>
                  <Button onClick={handleSaveDispatchRequest} disabled={installationSaving}>
                    {installationSaving ? "Guardando..." : "Guardar solicitud de despacho"}
                  </Button>

                  <div className="mt-2 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500">Validacion logistica</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Estado</label>
                        <select
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                          value={logisticsDraft.status}
                          onChange={(event) =>
                            setLogisticsDraft((prev) => ({ ...prev, status: event.target.value }))
                          }
                          disabled={installationSaving}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="validated">Validado</option>
                          <option value="rejected">Rechazado</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Referencia guia</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                          value={logisticsDraft.guide_reference || ""}
                          onChange={(event) =>
                            setLogisticsDraft((prev) => ({ ...prev, guide_reference: event.target.value }))
                          }
                          disabled={installationSaving}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Referencia proforma</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                          value={logisticsDraft.proforma_reference || ""}
                          onChange={(event) =>
                            setLogisticsDraft((prev) => ({ ...prev, proforma_reference: event.target.value }))
                          }
                          disabled={installationSaving}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Notas</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                          value={logisticsDraft.notes || ""}
                          onChange={(event) =>
                            setLogisticsDraft((prev) => ({ ...prev, notes: event.target.value }))
                          }
                          disabled={installationSaving}
                        />
                      </div>
                    </div>
                    <Button
                      className="mt-3"
                      variant="outline"
                      onClick={handleValidateLogistics}
                      disabled={installationSaving}
                    >
                      {installationSaving ? "Guardando..." : "Guardar validacion logistica"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <h4 className="font-semibold">Recepcion visual preinstalacion (F.ST-14)</h4>
                  <div className="grid gap-2 text-xs text-gray-600">
                    <p>
                      Resultado actual:{" "}
                      <span className="font-semibold text-gray-800">
                        {installationWorkflow?.visual_reception?.result === "pass"
                          ? "Aprobado"
                          : installationWorkflow?.visual_reception?.result === "failed"
                            ? "No aprobado"
                            : "Pendiente"}
                      </span>
                    </p>
                    <p>
                      Reporte:{" "}
                      {installationWorkflow?.visual_reception?.report_link ? (
                        <a
                          href={installationWorkflow.visual_reception.report_link}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Ver F.ST-14
                        </a>
                      ) : (
                        <span className="font-semibold text-amber-700">Pendiente</span>
                      )}
                    </p>
                  </div>
                  <Button onClick={() => setShowFst14Modal(true)} disabled={installationSaving}>
                    Registrar / actualizar F.ST-14
                  </Button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <h4 className="font-semibold">Asignacion de tecnico</h4>
                  <p className="text-sm text-gray-500">
                    El acta se asigna primero y luego logistica firma el documento.
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Correo del tecnico asignado</label>
                    <input
                      type="email"
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={assignmentForm.assignedEmail}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({ ...prev, assignedEmail: event.target.value }))
                      }
                      disabled={!isLeadRole || selectedPurchase.status !== "delivery_act_draft_ready"}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Nombre del tecnico</label>
                    <input
                      type="text"
                      className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      value={assignmentForm.assignedName}
                      onChange={(event) =>
                        setAssignmentForm((prev) => ({ ...prev, assignedName: event.target.value }))
                      }
                      disabled={!isLeadRole || selectedPurchase.status !== "delivery_act_draft_ready"}
                    />
                  </div>
                  {observations.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Observaciones del acta:
                      <ul className="mt-2 list-disc list-inside">
                        {observations.map((obs, idx) => (
                          <li key={`${obs}-${idx}`}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button
                    onClick={handleAssignTechnician}
                    disabled={saving || !isLeadRole || selectedPurchase.status !== "delivery_act_draft_ready"}
                  >
                    {saving ? "Asignando..." : "Asignar tecnico"}
                  </Button>
                  {!isLeadRole && <p className="text-xs text-gray-500">Solo jefatura tecnica puede asignar.</p>}
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <h4 className="font-semibold">Decision tecnica y ciclo de verificacion</h4>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Aplica F.ST-09</label>
                      <select
                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={verificationDecisionDraft.applies}
                        onChange={(event) =>
                          setVerificationDecisionDraft((prev) => ({
                            ...prev,
                            applies: event.target.value,
                          }))
                        }
                        disabled={installationSaving}
                      >
                        <option value="">Seleccionar</option>
                        <option value="true">Si aplica</option>
                        <option value="false">No aplica</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Fuente tecnica</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={verificationDecisionDraft.source_reference || ""}
                        onChange={(event) =>
                          setVerificationDecisionDraft((prev) => ({
                            ...prev,
                            source_reference: event.target.value,
                          }))
                        }
                        disabled={installationSaving}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Justificacion</label>
                      <input
                        type="text"
                        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                        value={verificationDecisionDraft.justification || ""}
                        onChange={(event) =>
                          setVerificationDecisionDraft((prev) => ({
                            ...prev,
                            justification: event.target.value,
                          }))
                        }
                        disabled={installationSaving}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveVerificationDecision}
                    disabled={installationSaving || !canDecideVerification}
                  >
                    {installationSaving ? "Guardando..." : "Guardar decision tecnica"}
                  </Button>
                  {!canDecideVerification && (
                    <p className="text-xs text-gray-500">
                      Solo jefatura tecnica puede registrar la decision de verificacion.
                    </p>
                  )}

                  <VerificationResultPanel purchase={selectedPurchase} onOpenVerification={openVerificationForm} />

                  {verificationApplies && verificationCycleStatus === "remediation_pending" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-900">Remediacion pendiente</p>
                      <p className="mt-1 text-xs text-amber-800">
                        Registra revision de remediacion y luego vuelve a ejecutar F.ST-09.
                      </p>
                      <textarea
                        rows={2}
                        className="mt-2 w-full rounded-md border border-amber-200 px-2 py-1 text-sm"
                        value={remediationReviewNotes}
                        onChange={(event) => setRemediationReviewNotes(event.target.value)}
                        disabled={installationSaving}
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSaveRemediationReview}
                          disabled={installationSaving}
                        >
                          Guardar revision
                        </Button>
                        <Button size="sm" onClick={openVerificationForm}>
                          Reintentar F.ST-09
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {hasCuFlow && (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <h4 className="font-semibold">Flujo CU</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(cuReportDraft.requires_parts_request)}
                          onChange={(event) =>
                            setCuReportDraft((prev) => ({
                              ...prev,
                              requires_parts_request: event.target.checked,
                            }))
                          }
                          disabled={installationSaving}
                        />
                        Requiere solicitud de partes
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(cuReportDraft.provider_repair_report_required)}
                          onChange={(event) =>
                            setCuReportDraft((prev) => ({
                              ...prev,
                              provider_repair_report_required: event.target.checked,
                            }))
                          }
                          disabled={installationSaving}
                        />
                        Requiere reporte del proveedor
                      </label>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Estado partes</label>
                        <select
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                          value={cuReportDraft.parts_request_status}
                          onChange={(event) =>
                            setCuReportDraft((prev) => ({
                              ...prev,
                              parts_request_status: event.target.value,
                            }))
                          }
                          disabled={installationSaving}
                        >
                          <option value="not_required">No aplica</option>
                          <option value="pending">Pendiente</option>
                          <option value="requested">Solicitado</option>
                          <option value="received">Recibido</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500">Reporte proveedor (PDF)</label>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                          onChange={(event) =>
                            setCuReportDraft((prev) => ({ ...prev, file: event.target.files?.[0] || null }))
                          }
                          disabled={installationSaving}
                        />
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
                      placeholder="Notas de partes/reparacion"
                      value={cuReportDraft.parts_request_notes}
                      onChange={(event) =>
                        setCuReportDraft((prev) => ({ ...prev, parts_request_notes: event.target.value }))
                      }
                      disabled={installationSaving}
                    />
                    <Button onClick={handleSaveCuProviderReport} disabled={installationSaving}>
                      Guardar flujo CU
                    </Button>
                  </div>
                )}

                <DeliveryActPanel purchase={selectedPurchase} />

                <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                  <h4 className="font-semibold">Carga de acta final F.ST-10</h4>
                  <p className="text-sm text-gray-500">
                    Sube la version final firmada por tecnico y cliente. Solo se habilita cuando el
                    workflow tecnico no tiene bloqueos.
                  </p>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(event) => setFinalActaFile(event.target.files?.[0] || null)}
                    disabled={!isAssignedTechnician() || selectedPurchase.status !== "delivery_act_logistics_signed"}
                  />
                  {finalActaFile && (
                    <p className="text-xs text-gray-500">Archivo seleccionado: {finalActaFile.name}</p>
                  )}
                  <Button
                    onClick={handleFinalActaUpload}
                    disabled={
                      saving ||
                      !canUploadFinalAct ||
                      !isAssignedTechnician() ||
                      selectedPurchase.status !== "delivery_act_logistics_signed"
                    }
                  >
                    {saving ? "Subiendo..." : "Subir acta final"}
                  </Button>
                  {!canCloseInstallation && (
                    <p className="text-xs text-amber-700">
                      El cierre esta bloqueado hasta cumplir los prerequisitos tecnicos/documentales.
                    </p>
                  )}
                  {selectedPurchase.status === "delivery_act_logistics_signed" && !isAssignedTechnician() && (
                    <p className="text-xs text-gray-500">
                      Solo el tecnico asignado puede subir el acta final.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="mb-4 font-semibold">Linea de tiempo del proceso</h4>
                  <PurchaseTimelinePanel requestId={selectedPurchase.id} compact />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="mb-3 font-semibold">Documentos requeridos</h4>
                  <DocumentChecklist checklist={selectedPurchase.checklist || []} readOnly />
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h4 className="mb-3 font-semibold">Expediente ST</h4>
                  {workflowDocuments.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay documentos ST registrados aun.</p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {workflowDocuments.map((doc, index) => (
                        <div
                          key={`${doc.doc_type}-${doc.drive_file_id || doc.link || index}`}
                          className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
                        >
                          <p className="font-semibold text-gray-800">
                            {doc.display_label || mapWorkflowDocLabel(doc.doc_type)}
                          </p>
                          {doc.link ? (
                            <a
                              href={doc.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-700 underline"
                            >
                              Abrir documento
                            </a>
                          ) : (
                            <p className="text-amber-700">Sin enlace disponible</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showFst14Modal}
        onClose={() => setShowFst14Modal(false)}
        title="Registro F.ST-14"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Completa checklist y evidencias de recepcion visual previa a instalacion.
          </p>
          {fst14Errors.corrective_actions && (
            <Alert className="border-rose-200 bg-rose-50 text-rose-800">
              <AlertDescription>{fst14Errors.corrective_actions}</AlertDescription>
            </Alert>
          )}
          <InstallationReceptionStepper
            draft={fst14Draft}
            errors={fst14Errors}
            disabled={installationSaving}
            onChange={(field, value) =>
              setFst14Draft((prev) => ({
                ...prev,
                [field]: value,
              }))
            }
            onChecklistChange={(field, value) =>
              setFst14Draft((prev) => ({
                ...prev,
                checklist: {
                  ...prev.checklist,
                  [field]: value,
                },
              }))
            }
          />
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-semibold text-slate-800">Resumen checklist</p>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.keys(VISUAL_CHECKLIST_LABELS).map((key) => (
                <p key={key}>
                  {VISUAL_CHECKLIST_LABELS[key]}:{" "}
                  <span className="font-semibold">{fst14Draft?.checklist?.[key] || "Pendiente"}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowFst14Modal(false)} disabled={installationSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveFst14} disabled={installationSaving}>
              {installationSaving ? "Guardando..." : "Guardar F.ST-14"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PrivatePurchaseDeliveries;
