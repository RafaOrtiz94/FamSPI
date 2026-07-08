// src/modules/shared/pages/AttendanceAction.jsx
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCheckCircle, FiAlertCircle, FiLoader, FiMapPin } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import {
  marcarEntrada,
  marcarAlmuerzoSalida,
  marcarAlmuerzoEntrada,
  marcarSalida,
  marcarSalidaOficina,
  marcarEntradaOficina,
  marcarSalidaCampo,
  marcarEntradaCampo,
  marcarLlegadaDestino,
  marcarCierreViaje,
  marcarVisitaEntrada,
  marcarVisitaSalida,
  getTodayAttendance,
  getActiveException,
  updateExceptionStatus,
} from "../../../core/api/attendanceApi";
import { getLocationForAction, startLocationPrewarm, stopLocationPrewarm } from "../../../shared/utils/attendanceLocationCache";
import { fetchClients } from "../../../core/api/clientsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import CameraCaptureField from "../../../core/ui/components/CameraCaptureField";
import { getAttendanceErrorInfo } from "../../../core/ui/attendanceErrorUtils";
import {
  isOperationalFlow,
  getAttendanceNextStepHint,
  getAttendanceHelpHint,
  validateOperationalCategoryStep,
  validateOperationalVehicleStart,
  validateOperationalVehicleClosure,
  buildOperationalStartPayload,
  buildOperationalClosurePayload,
  buildOperationalTripClosePayload,
} from "../../../core/ui/attendanceFlowUtils";


const resolveShortcutParam = (params, keys = []) => {
  for (const key of keys) {
    const value = String(params.get(key) || "").trim();
    if (value) return value;
  }
  return "";
};

const parseOptionalBooleanParam = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "si", "sí", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
};

const parseActionParams = (search) => {
  const params = new URLSearchParams(search || "");
  const returnToOfficeParam = resolveShortcutParam(params, ["return_to_office", "retorno_oficina", "returnToOffice"]);
  return {
    clientId: resolveShortcutParam(params, ["client_id", "cliente_id", "clientId"]),
    prospectName: resolveShortcutParam(params, ["prospect_name", "prospecto", "prospectName"]),
    description: resolveShortcutParam(params, ["motivo", "descripcion", "description"]),
    observations: resolveShortcutParam(params, ["observaciones", "observacion", "observations", "obs"]),
    returnToOffice: parseOptionalBooleanParam(returnToOfficeParam),
    returnUrl: resolveShortcutParam(params, ["return_url", "returnUrl", "redirect"]),
  };
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const buildClientDisplayLabel = (client = {}) => {
  const rawName = String(
    client?.commercial_name ||
    client?.business_name ||
    client?.name ||
    client?.nombre ||
    client?.razon_social ||
    ""
  ).trim();
  const safeName = rawName.length >= 3 ? rawName : `Cliente #${client?.id || ""}`;
  const city = String(client?.city || client?.ciudad || "").trim();
  const scheduleInfo = client?.scheduled_info || {};
  const isScheduledToday = Boolean(
    scheduleInfo?.is_planned_commercial || scheduleInfo?.is_planned_technical || scheduleInfo?.is_planned
  );
  const base = city ? `${safeName} - ${city} (#${client?.id})` : `${safeName} (#${client?.id})`;
  return isScheduledToday ? `${base} · Programado hoy` : base;
};

const withTimeout = (promise, ms, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage || "Operacion agotada por tiempo"));
    }, ms);
    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const OPERATIONAL_CATEGORY_OPTIONS = [
  { value: "cliente", label: "Cliente" },
  { value: "reunion", label: "Reunion" },
  { value: "banco", label: "Banco" },
  { value: "ministerio", label: "Ministerio" },
  { value: "proveedor", label: "Proveedor" },
  { value: "gestion_oficina", label: "Gestion operativa" },
  { value: "otro", label: "Otro" },
];

const AttendanceAction = () => {
  const { action } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useUI();

  const [status, setStatus] = useState("initializing"); // initializing, geolocating, processing, success, error
  const [message, setMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [availableClients, setAvailableClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [manualClientId, setManualClientId] = useState("");
  const [manualClientSearch, setManualClientSearch] = useState("");
  const [manualProspectName, setManualProspectName] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualObservations, setManualObservations] = useState("");
  const [manualPostVisitAction, setManualPostVisitAction] = useState("");
  const [manualStepError, setManualStepError] = useState("");
  const [activeOperationalException, setActiveOperationalException] = useState(null);
  const [operationalCategory, setOperationalCategory] = useState("");
  const [operationalDetail, setOperationalDetail] = useState("");
  const [usesPersonalVehicle, setUsesPersonalVehicle] = useState("no");
  const [startOdometerKm, setStartOdometerKm] = useState("");
  const [endOdometerKm, setEndOdometerKm] = useState("");
  const [startOdometerPhoto, setStartOdometerPhoto] = useState(null);
  const [endOdometerPhoto, setEndOdometerPhoto] = useState(null);
  const [manualSubmitNonce, setManualSubmitNonce] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const processedRef = useRef(false);
  const executionKeyRef = useRef("");
  const actionParams = parseActionParams(location.search);
  const executionKey = `${action || ""}|${location.search || ""}|${location.key || ""}|${user?.id || ""}`;
  const ensureExceptionFlow = useCallback(async (expectedFlow) => {
    const activeResponse = await getActiveException();
    const activeException = activeResponse?.data;
    const operationalFlow = isOperationalFlow(activeException);

    if (expectedFlow === "operational") {
      if (!activeException) {
        throw new Error("No tienes una salida operacional activa para cerrar.");
      }
      if (!operationalFlow) {
        throw new Error("La salida activa actual es inesperada. Usa el flujo de regreso imprevisto.");
      }
      return;
    }

    if (!activeException) {
      throw new Error("La marcacion solicitada ya no esta disponible en la interfaz.");
    }
    if (operationalFlow) {
      throw new Error("La salida activa actual es operacional. Usa el flujo operacional para continuar.");
    }
  }, []);

  const resolveVisitExitPayload = useCallback(async (params = {}) => {
    const directClientId = params.clientId ? Number(params.clientId) : null;
    const directProspectName = String(params.prospectName || "").trim();
    if (directClientId || directProspectName) {
      return {
        client_id: Number.isFinite(directClientId) && directClientId > 0 ? directClientId : undefined,
        prospect_name: directProspectName || undefined,
      };
    }

    try {
      const today = await getTodayAttendance();
      const activeVisit = today?.active_field_visit || null;
      const activeClientId = Number(activeVisit?.client_id);
      const activeProspectName = String(activeVisit?.prospect_name || "").trim();

      return {
        client_id: Number.isFinite(activeClientId) && activeClientId > 0 ? activeClientId : undefined,
        prospect_name: activeProspectName || undefined,
      };
    } catch {
      // Allow backend auto-resolution of latest active visit.
      return {};
    }
  }, []);

  const ACTION_MAP = useMemo(() => ({
    entrada: {
      fn: async (currentLoc, _params, markMeta) => marcarEntrada(currentLoc, markMeta),
      label: "Entrada",
      syncTarget: "entry",
      requiresParams: false,
      icon: <FiClock className="text-blue-500" />,
    },
    "almuerzo-salida": {
      fn: async (currentLoc, _params, markMeta) => marcarAlmuerzoSalida(currentLoc, markMeta),
      label: "Salida a almuerzo",
      syncTarget: "lunch_start",
      requiresParams: false,
      icon: <FiClock className="text-orange-500" />,
    },
    "salida-almuerzo": {
      fn: async (currentLoc, _params, markMeta) => marcarAlmuerzoSalida(currentLoc, markMeta),
      label: "Salida a almuerzo",
      syncTarget: "lunch_start",
      requiresParams: false,
      icon: <FiClock className="text-orange-500" />,
    },
    almuerzo: {
      fn: async (currentLoc, _params, markMeta) => marcarAlmuerzoSalida(currentLoc, markMeta),
      label: "Salida a almuerzo",
      syncTarget: "lunch_start",
      requiresParams: false,
      icon: <FiClock className="text-orange-500" />,
    },
    "almuerzo-entrada": {
      fn: async (currentLoc, _params, markMeta) => marcarAlmuerzoEntrada(currentLoc, markMeta),
      label: "Entrada de almuerzo",
      syncTarget: "lunch_end",
      requiresParams: false,
      icon: <FiClock className="text-green-500" />,
    },
    "entrada-almuerzo": {
      fn: async (currentLoc, _params, markMeta) => marcarAlmuerzoEntrada(currentLoc, markMeta),
      label: "Entrada de almuerzo",
      syncTarget: "lunch_end",
      requiresParams: false,
      icon: <FiClock className="text-green-500" />,
    },
    salida: {
      fn: async (currentLoc, _params, markMeta) => marcarSalida(currentLoc, markMeta),
      label: "Salida final",
      syncTarget: "exit",
      requiresParams: false,
      icon: <FiClock className="text-red-500" />,
    },
    "salida-final": {
      fn: async (currentLoc, _params, markMeta) => marcarSalida(currentLoc, markMeta),
      label: "Salida final",
      syncTarget: "exit",
      requiresParams: false,
      icon: <FiClock className="text-red-500" />,
    },
    "salida-oficina": {
      fn: async (currentLoc, params, markMeta) =>
        marcarSalidaOficina(currentLoc, buildOperationalStartPayload({
          description: params.description,
          category: params.operationalCategory,
          usesPersonalVehicle: params.usesPersonalVehicle,
          startKm: params.startOdometerKm,
          startPhoto: params.startOdometerPhoto,
        }), markMeta),
      label: "Salida operacional",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "entrada-oficina": {
      fn: async (currentLoc, _params, markMeta) => {
        await ensureExceptionFlow("operational");
        return marcarEntradaOficina(currentLoc, buildOperationalClosurePayload({
          endKm: _params.endOdometerKm,
          endPhoto: _params.endOdometerPhoto,
        }), markMeta);
      },
      label: "Cierre operacional",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "salida-campo": {
      fn: async (currentLoc, params, markMeta) =>
        marcarSalidaCampo(currentLoc, buildOperationalStartPayload({
          description: params.description,
          category: params.operationalCategory,
          usesPersonalVehicle: params.usesPersonalVehicle,
          startKm: params.startOdometerKm,
          startPhoto: params.startOdometerPhoto,
        }), markMeta),
      label: "Salida operacional",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "entrada-campo": {
      fn: async (currentLoc, _params, markMeta) => {
        await ensureExceptionFlow("operational");
        return marcarEntradaCampo(currentLoc, buildOperationalClosurePayload({
          endKm: _params.endOdometerKm,
          endPhoto: _params.endOdometerPhoto,
        }), markMeta);
      },
      label: "Cierre operacional",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "llegada-destino": {
      fn: async (currentLoc, _params, markMeta) => {
        await ensureExceptionFlow("operational");
        return marcarLlegadaDestino(currentLoc, markMeta);
      },
      label: "Llegada a destino",
      syncTarget: "arrival",
      requiresParams: false,
      icon: <FiMapPin className="text-amber-500" />,
    },
    "cierre-viaje": {
      fn: async (currentLoc, params, markMeta) => {
        await ensureExceptionFlow("operational");
        return marcarCierreViaje(currentLoc, buildOperationalTripClosePayload({
          closureReason: params.description,
          endKm: params.endOdometerKm,
          endPhoto: params.endOdometerPhoto,
        }), markMeta);
      },
      label: "Cierre de viaje",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiCheckCircle className="text-amber-500" />,
    },
    "retorno-operacional": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("operational");
        return updateExceptionStatus("RETURNING", currentLoc);
      },
      label: "Retorno operacional",
      syncTarget: "returning",
      requiresParams: false,
      icon: <FiMapPin className="text-amber-500" />,
    },
    "regreso-operacional": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("operational");
        return updateExceptionStatus("RETURNING", currentLoc);
      },
      label: "Retorno operacional",
      syncTarget: "returning",
      requiresParams: false,
      icon: <FiMapPin className="text-amber-500" />,
    },
    "cliente-entrada": {
      fn: async (currentLoc, params, markMeta) => {
        if (!params.clientId && !params.prospectName) {
          throw new Error("Para entrada cliente debes enviar client_id o prospect_name en la URL.");
        }
        return marcarVisitaEntrada({
          location: currentLoc,
          occurred_at: markMeta?.occurred_at,
          client_id: params.clientId ? Number(params.clientId) : undefined,
          prospect_name: params.prospectName || undefined,
          observations: params.observations || params.description || undefined,
        });
      },
      label: "Entrada cliente",
      syncTarget: "arrival",
      requiresParams: true,
      icon: <FiClock className="text-violet-500" />,
    },
    "entrada-cliente": {
      fn: async (currentLoc, params, markMeta) => {
        if (!params.clientId && !params.prospectName) {
          throw new Error("Para entrada cliente debes enviar client_id o prospect_name en la URL.");
        }
        return marcarVisitaEntrada({
          location: currentLoc,
          occurred_at: markMeta?.occurred_at,
          client_id: params.clientId ? Number(params.clientId) : undefined,
          prospect_name: params.prospectName || undefined,
          observations: params.observations || params.description || undefined,
        });
      },
      label: "Entrada cliente",
      syncTarget: "arrival",
      requiresParams: true,
      icon: <FiClock className="text-violet-500" />,
    },
    "cliente-salida": {
      fn: async (currentLoc, params, markMeta) => {
        const visitScopePayload = await resolveVisitExitPayload(params);
        return marcarVisitaSalida({
          location: currentLoc,
          occurred_at: markMeta?.occurred_at,
          ...visitScopePayload,
          observations: params.observations || params.description || undefined,
          return_to_office: params.returnToOffice,
          post_visit_action: params.postVisitAction,
        });
      },
      label: "Salida cliente",
      syncTarget: "departure",
      requiresParams: false,
      icon: <FiClock className="text-violet-500" />,
    },
    "salida-cliente": {
      fn: async (currentLoc, params, markMeta) => {
        const visitScopePayload = await resolveVisitExitPayload(params);
        return marcarVisitaSalida({
          location: currentLoc,
          occurred_at: markMeta?.occurred_at,
          ...visitScopePayload,
          observations: params.observations || params.description || undefined,
          return_to_office: params.returnToOffice,
          post_visit_action: params.postVisitAction,
        });
      },
      label: "Salida cliente",
      syncTarget: "departure",
      requiresParams: false,
      icon: <FiClock className="text-violet-500" />,
    },
  }), [ensureExceptionFlow, resolveVisitExitPayload]);

  const config = ACTION_MAP[action];
  // Fase 8 (Plan Maestro Asistencia): ayuda contextual breve antes de pedir GPS.
  const helpHint = useMemo(() => getAttendanceHelpHint(action), [action]);
  const operationalPhase = action === "salida-oficina" || action === "salida-campo"
    ? "start"
    : action === "entrada-oficina" || action === "entrada-campo"
      ? "end"
      : action === "cierre-viaje"
        ? "close"
        : null;
  const requiresOperationalStep = Boolean(operationalPhase);
  const activeOperationalUsesPersonalVehicle = Boolean(activeOperationalException?.uses_personal_vehicle);

  const getNextStepHint = useCallback((currentAction) => getAttendanceNextStepHint(currentAction), []);

  const resolveFriendlyDuplicateMessage = useCallback(({ currentAction, statusCode, backendCode, backendMessage }) => {
    const msg = String(backendMessage || "").toLowerCase();
    const hasAlreadyMarked =
      msg.includes("ya has marcado") ||
      msg.includes("ya tienes una salida") ||
      msg.includes("ya se encontraba cerrada") ||
      msg.includes("ya estaba cerrada");
    const noActiveButLikelyCompleted = statusCode === 404 && backendCode === "NO_ACTIVE_OPERATIONAL";

    if (!hasAlreadyMarked && !noActiveButLikelyCompleted) {
      return null;
    }

    return `Esta marcación ya estaba registrada. ${getNextStepHint(currentAction)}`;
  }, [getNextStepHint]);
  const needsManualClientStep = Boolean(
    config?.requiresParams && !actionParams.clientId && !actionParams.prospectName
  );
  const isClientExitAction = action === "cliente-salida" || action === "salida-cliente";
  const needsPostVisitDecisionStep = Boolean(
    isClientExitAction && actionParams.returnToOffice === null && !manualPostVisitAction
  );
  const effectiveActionParams = useMemo(
    () => ({
      clientId: actionParams.clientId || manualClientId,
      prospectName: actionParams.prospectName || manualProspectName,
      description: actionParams.description || operationalDetail || manualReason,
      observations: actionParams.observations || manualObservations,
      returnToOffice: actionParams.returnToOffice ?? (manualPostVisitAction === "return_to_office"),
      // El backend (clockOutField) solo acepta "continue_operation"/"return_to_office"
      // en post_visit_action (ver INVALID_POST_VISIT_ACTION) -- "end_jornada" es una
      // decision puramente de frontend (encadenar a cierre-viaje despues), nunca se
      // manda tal cual al backend.
      postVisitAction: actionParams.returnToOffice === null
        ? (manualPostVisitAction === "end_jornada" ? "continue_operation" : manualPostVisitAction || undefined)
        : (actionParams.returnToOffice ? "return_to_office" : "continue_operation"),
      operationalCategory,
      usesPersonalVehicle: usesPersonalVehicle === "si",
      startOdometerKm,
      endOdometerKm,
      startOdometerPhoto,
      endOdometerPhoto,
    }),
    [
      actionParams.clientId,
      actionParams.prospectName,
      actionParams.description,
      actionParams.observations,
      actionParams.returnToOffice,
      manualClientId,
      manualProspectName,
      manualReason,
      manualObservations,
      manualPostVisitAction,
      operationalCategory,
      operationalDetail,
      usesPersonalVehicle,
      startOdometerKm,
      endOdometerKm,
      startOdometerPhoto,
      endOdometerPhoto,
    ]
  );

  const filteredClients = useMemo(() => {
    const term = normalizeText(manualClientSearch);
    if (!term) return availableClients.slice(0, 80);
    return availableClients.filter((client) => {
      const label = normalizeText(buildClientDisplayLabel(client));
      const idText = String(client?.id || "");
      return label.includes(term) || idText.includes(term);
    }).slice(0, 120);
  }, [availableClients, manualClientSearch]);

  const resolveClientIdFromSearch = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d+$/.test(raw)) return raw;

    const normalized = normalizeText(raw);
    const exact = availableClients.find((client) => normalizeText(buildClientDisplayLabel(client)) === normalized);
    if (exact?.id) return String(exact.id);

    const startsWith = availableClients.find((client) =>
      normalizeText(buildClientDisplayLabel(client)).startsWith(normalized)
    );
    if (startsWith?.id) return String(startsWith.id);
    return "";
  };

  useEffect(() => {
    if (!needsManualClientStep || !user || authLoading) return;

    let isMounted = true;
    const loadClients = async () => {
      setLoadingClients(true);
      try {
        // Fase 5 (Plan Maestro Asistencia): trae info de cronograma para priorizar
        // en la lista a los clientes ya planificados para hoy (contexto conocido).
        const response = await fetchClients({ include_schedule_info: true, schedule_scope: "mine" });
        const clients = Array.isArray(response?.clients) ? response.clients : [];
        const isScheduledToday = (client) => {
          const info = client?.scheduled_info || {};
          return Boolean(info?.is_planned_commercial || info?.is_planned_technical || info?.is_planned);
        };
        const sorted = [...clients].sort((a, b) => Number(isScheduledToday(b)) - Number(isScheduledToday(a)));
        if (isMounted) {
          setAvailableClients(sorted);
          setStatus("initializing");
        }
      } catch (err) {
        if (isMounted) {
          setManualStepError("No se pudo cargar la lista de clientes. Intenta recargar.");
        }
      } finally {
        if (isMounted) {
          setLoadingClients(false);
        }
      }
    };

    loadClients();
    return () => {
      isMounted = false;
    };
  }, [needsManualClientStep, user, authLoading]);

  useEffect(() => {
    if (!requiresOperationalStep || operationalPhase === "start" || !user || authLoading) return;

    let cancelled = false;
    const loadActiveOperational = async () => {
      try {
        const response = await getActiveException();
        if (cancelled) return;
        const activeException = response?.data || null;
        setActiveOperationalException(activeException);
        if (activeException?.description && !operationalDetail) {
          setOperationalDetail(String(activeException.description).split("\n")[0] || "");
        }
      } catch {
        if (!cancelled) {
          setManualStepError("No se pudo cargar la salida operacional activa. Reintenta.");
        }
      }
    };

    loadActiveOperational();
    return () => {
      cancelled = true;
    };
  }, [authLoading, operationalDetail, operationalPhase, requiresOperationalStep, user]);

  useEffect(() => {
    if (executionKeyRef.current !== executionKey) {
      executionKeyRef.current = executionKey;
      processedRef.current = false;
      setStatus("initializing");
      setMessage("");
      setErrorDetails("");
      setManualPostVisitAction("");
      setManualStepError("");
      setActiveOperationalException(null);
      setOperationalCategory("");
      setOperationalDetail("");
      setUsesPersonalVehicle("no");
      setStartOdometerKm("");
      setEndOdometerKm("");
      setStartOdometerPhoto(null);
      setEndOdometerPhoto(null);
      setManualSubmitNonce(0);
    }
  }, [executionKey]);

  useEffect(() => {
    if (status !== "geolocating") return undefined;
    const timer = setTimeout(() => {
      if (status === "geolocating") {
        processedRef.current = false;
        setStatus("error");
        setMessage("No se pudo obtener tu ubicación a tiempo.");
        setErrorDetails("El GPS tardó demasiado. Reintenta y verifica permisos de ubicación para este sitio.");
      }
    }, 22000);
    return () => clearTimeout(timer);
  }, [status]);

  // Prewarm GPS as soon as the page loads so cache is warm when needed
  useEffect(() => {
    startLocationPrewarm();
    return () => stopLocationPrewarm();
  }, []);

  const handleConfirmMark = useCallback(async (currentLoc, occurredAt) => {
    if (!currentLoc || !config) return;
    setStatus("processing");
    try {
      const response = await config.fn(currentLoc, effectiveActionParams, { occurred_at: occurredAt || new Date().toISOString() });
      if (response?.ok) {
        setStatus("success");
        setMessage(response.message || `${config.label} registrada correctamente.`);
        showToast(response.message || `${config.label} registrada`, "success");
        // Si el usuario eligio "Terminar operación aquí" al salir del cliente,
        // encadenamos directo a cierre-viaje en vez de volver al dashboard --
        // igual que el widget, que abre el modal de cierre inmediatamente
        // despues de cerrar la visita (ver handleFieldVisitMark).
        const shouldChainToTripClose = isClientExitAction && manualPostVisitAction === "end_jornada";
        const destination = shouldChainToTripClose
          ? `/asistencia/marcar/cierre-viaje${actionParams.returnUrl ? `?return_url=${encodeURIComponent(actionParams.returnUrl)}` : ""}`
          : actionParams.returnUrl || "/dashboard";
        setTimeout(() => {
          navigate(destination, { replace: true });
        }, shouldChainToTripClose ? 1200 : 3500);
        return;
      }
      throw new Error(response?.message || "Error al procesar la solicitud.");
    } catch (err) {
      const statusCode = Number(err?.response?.status || 0);
      const backendCode = String(err?.response?.data?.code || "").trim();
      const backendMessage = String(err?.response?.data?.message || "").trim();
      const isClientExitAction = action === "cliente-salida" || action === "salida-cliente";
      if (
        isClientExitAction &&
        statusCode === 404 &&
        (backendCode === "NO_ACTIVE_VISIT" || /no se encontró una visita activa/i.test(backendMessage))
      ) {
        setStatus("success");
        setMessage("La salida cliente ya estaba cerrada o no tenía una visita activa pendiente.");
        setErrorDetails("");
        showToast("No había visita activa pendiente. Estado sincronizado.", "info");
        setTimeout(() => {
          navigate(actionParams.returnUrl || "/dashboard", { replace: true });
        }, 2500);
        return;
      }

      const duplicateMessage = resolveFriendlyDuplicateMessage({
        currentAction: action,
        statusCode,
        backendCode,
        backendMessage,
      });
      if (duplicateMessage) {
        setStatus("success");
        setMessage(duplicateMessage);
        setErrorDetails("");
        showToast("Marcación ya registrada. Continuando flujo.", "info");
        setTimeout(() => {
          navigate(actionParams.returnUrl || "/dashboard", { replace: true });
        }, 2500);
        return;
      }

      const info = getAttendanceErrorInfo(err, "No se pudo completar la marcacion.", "error");
      setStatus("error");
      setMessage(`No se pudo registrar la ${config.label.toLowerCase()}.`);
      setErrorDetails(info.message || "Error desconocido");
      showToast(info.message || "Error de red", info.type || "error");
    }
  }, [
    action,
    actionParams.returnUrl,
    config,
    effectiveActionParams,
    isClientExitAction,
    manualPostVisitAction,
    navigate,
    resolveFriendlyDuplicateMessage,
    showToast,
  ]);

  useEffect(() => {
    if (authLoading || !user || processedRef.current || !config) return;
    if (needsManualClientStep && manualSubmitNonce === 0) return;
    if (needsPostVisitDecisionStep) return;
    if (requiresOperationalStep && manualSubmitNonce === 0) return;

    let cancelled = false;
    const resolveLocationOnly = async () => {
      processedRef.current = true;
      const intentAt = new Date().toISOString();
      setStatus("geolocating");
      try {
        const currentLoc = await withTimeout(
          getLocationForAction(),
          20000,
          "GPS tardó demasiado en responder. Verifica permisos de ubicación y vuelve a intentar."
        );
        if (cancelled) return;
        setStatus("processing");
        setMessage("Ubicación lista. Registrando marcación.");
        setErrorDetails("");
        await handleConfirmMark(currentLoc, intentAt);
      } catch (err) {
        if (!cancelled) {
          const info = getAttendanceErrorInfo(err, "No se pudo obtener la ubicacion.", "error");
          setStatus("error");
          setMessage("No se pudo obtener tu ubicación.");
          setErrorDetails(info.message || "Error desconocido");
          showToast(info.message || "Error de red", info.type || "error");
          processedRef.current = false;
        }
      }
    };

    resolveLocationOnly();
    return () => { cancelled = true; };
  }, [
    action,
    authLoading,
    user,
    config,
    navigate,
    showToast,
    needsManualClientStep,
    needsPostVisitDecisionStep,
    requiresOperationalStep,
    manualSubmitNonce,
    retryTick,
    effectiveActionParams,
    actionParams.returnUrl,
    handleConfirmMark,
    resolveFriendlyDuplicateMessage,
  ]);

  // Fase 3 (Plan Maestro Asistencia): reintento sin recargar la pagina, para no
  // perder el contexto ya ingresado (cliente, motivo, kilometraje) en el paso manual.
  const handleRetry = useCallback(() => {
    processedRef.current = false;
    setStatus("initializing");
    setMessage("");
    setErrorDetails("");
    setRetryTick((tick) => tick + 1);
  }, []);


  const handleManualClientSubmit = () => {
    setManualStepError("");
    if (requiresOperationalStep) {
      // Mitigacion D1: regla compartida con AttendanceWidget.submitOperationalModal
      // via attendanceFlowUtils.js (misma logica, un solo lugar para mantenerla).
      if (operationalPhase === "start") {
        const categoryCheck = validateOperationalCategoryStep(operationalCategory);
        if (!categoryCheck.ok) {
          setManualStepError(categoryCheck.error);
          return;
        }
        const vehicleStartCheck = validateOperationalVehicleStart({
          usesPersonalVehicle: usesPersonalVehicle === "si",
          startKm: startOdometerKm,
          startPhoto: startOdometerPhoto,
        });
        if (!vehicleStartCheck.ok) {
          setManualStepError(vehicleStartCheck.error);
          return;
        }
      }
      if (operationalPhase === "end" || operationalPhase === "close") {
        const vehicleClosureCheck = validateOperationalVehicleClosure({
          requiresClosure: activeOperationalUsesPersonalVehicle,
          endKm: endOdometerKm,
          endPhoto: endOdometerPhoto,
        });
        if (!vehicleClosureCheck.ok) {
          setManualStepError(vehicleClosureCheck.error);
          return;
        }
      }
      setManualSubmitNonce(Date.now());
      return;
    }

    if (!manualClientId && !manualProspectName.trim()) {
      setManualStepError("Selecciona un cliente o escribe el nombre del prospecto.");
      return;
    }
    if (!manualReason.trim()) {
      setManualStepError("El motivo es obligatorio para registrar esta marcacion.");
      return;
    }
    setManualSubmitNonce(Date.now());
  };

  const handlePostVisitDecision = (nextAction) => {
    setManualStepError("");
    setManualPostVisitAction(nextAction);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md w-full text-center py-10">
          <FiAlertCircle className="mx-auto text-red-500 text-5xl mb-4" />
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Acción no válida</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">La ruta de asistencia solicitada no existe.</p>
          <Button onClick={() => navigate("/dashboard")} variant="primary">Volver al Dashboard</Button>
        </Card>
      </div>
    );
  }

  if (needsPostVisitDecisionStep) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-xl w-full py-8 px-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            Salida cliente: siguiente paso
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Selecciona que ocurrira despues de cerrar la visita.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              onClick={() => handlePostVisitDecision("continue_operation")}
              variant="primary"
              className="min-h-[96px] flex-col items-start justify-center text-left"
            >
              <span className="font-semibold">Continuar operacion</span>
              <span className="text-xs opacity-90">Mantiene el viaje abierto para otro cliente.</span>
            </Button>
            <Button
              onClick={() => handlePostVisitDecision("return_to_office")}
              variant="secondary"
              className="min-h-[96px] flex-col items-start justify-center text-left"
            >
              <span className="font-semibold">Iniciar retorno</span>
              <span className="text-xs opacity-90">Cambia el viaje a estado de regreso.</span>
            </Button>
            <Button
              onClick={() => handlePostVisitDecision("end_jornada")}
              variant="warning"
              className="min-h-[96px] flex-col items-start justify-center text-left"
            >
              <span className="font-semibold">Terminar operación aquí</span>
              <span className="text-xs opacity-90">Cierra la operación en este mismo destino, sin volver a oficina.</span>
            </Button>
          </div>

          <Button onClick={() => navigate("/dashboard")} variant="ghost" className="mt-6">
            Cancelar
          </Button>
        </Card>
      </div>
    );
  }

  if (needsManualClientStep && manualSubmitNonce === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-xl w-full py-8 px-6">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            {config?.label}: selecciona cliente y motivo
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Este atajo requiere identificar el cliente para completar la marcacion.
          </p>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Buscar cliente por coincidencia
          </label>
          <input
            type="text"
            value={manualClientSearch}
            list="attendance-shortcut-clients-list"
            onChange={(e) => {
              const value = e.target.value;
              setManualClientSearch(value);
              const resolvedId = resolveClientIdFromSearch(value);
              setManualClientId(resolvedId);
              if (resolvedId) setManualProspectName("");
            }}
            placeholder={loadingClients ? "Cargando clientes..." : "Escribe nombre, ciudad o ID del cliente"}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 mb-2"
            disabled={loadingClients}
          />
          <datalist id="attendance-shortcut-clients-list">
            {filteredClients.map((client) => (
              <option key={client.id} value={buildClientDisplayLabel(client)}>{buildClientDisplayLabel(client)}</option>
            ))}
          </datalist>
          {manualClientId ? (
            <p className="mb-4 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Cliente seleccionado: #{manualClientId}
            </p>
          ) : (
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              {loadingClients ? "Cargando clientes..." : "Selecciona una coincidencia de la lista sugerida."}
            </p>
          )}

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            O prospecto manual (si no existe en la lista)
          </label>
          <input
            type="text"
            value={manualProspectName}
            onChange={(e) => {
              setManualProspectName(e.target.value);
              if (e.target.value.trim()) setManualClientId("");
            }}
            placeholder="Nombre de prospecto"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Motivo (obligatorio)
          </label>
          <input
            type="text"
            value={manualReason}
            onChange={(e) => setManualReason(e.target.value)}
            placeholder="Ejemplo: visita por emergencia"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 mb-4"
          />

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Observaciones
          </label>
          <textarea
            value={manualObservations}
            onChange={(e) => setManualObservations(e.target.value)}
            placeholder="Detalle adicional (opcional)"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 mb-4 min-h-[88px]"
          />

          {manualStepError ? (
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{manualStepError}</p>
          ) : null}

          <div className="flex gap-3">
            <Button onClick={handleManualClientSubmit} variant="primary">
              Continuar y registrar
            </Button>
            <Button onClick={() => navigate("/dashboard")} variant="ghost">
              Cancelar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (requiresOperationalStep && manualSubmitNonce === 0) {
    const requiresVehicleClosure = operationalPhase !== "start" && activeOperationalUsesPersonalVehicle;
    const vehicleBadgeText = operationalPhase === "start"
      ? "Define si la salida sera en vehiculo personal."
      : (requiresVehicleClosure ? "Esta salida activa requiere kilometraje final y foto." : "Esta salida no requiere control de kilometraje.");

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] p-4">
        <Card className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-0 shadow-[0_15px_35px_rgba(15,23,42,0.08)]">
          <div className="border-b border-slate-100 bg-[#1E293B] px-6 py-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-200">Asistencia</p>
            <h2 className="mt-1 text-2xl font-bold">
              {operationalPhase === "start" ? "Registrar salida o visita" : "Cerrar salida o visita"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              Usa este flujo para visitas a clientes, reuniones, bancos, proveedores y cualquier otra gestion laboral externa.
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            {operationalPhase === "start" ? (
              <>
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Tipo de salida</span>
                  <select
                    value={operationalCategory}
                    onChange={(e) => setOperationalCategory(e.target.value)}
                    className="min-h-[44px] rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  >
                    <option value="">Selecciona una categoria</option>
                    {OPERATIONAL_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Detalle</span>
                  <textarea
                    value={operationalDetail}
                    onChange={(e) => setOperationalDetail(e.target.value)}
                    rows={3}
                    placeholder="Ejemplo: reunion externa, salida al banco o gestion ministerial"
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  />
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Movilidad</p>
                  <p className="mt-1 text-sm text-slate-600">{vehicleBadgeText}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setUsesPersonalVehicle("no")}
                      className={`min-h-[52px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.97] ${usesPersonalVehicle === "no" ? "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]" : "border-slate-200 bg-white text-slate-700"}`}
                    >
                      Sin vehiculo personal
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsesPersonalVehicle("si")}
                      className={`min-h-[52px] rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition active:scale-[0.97] ${usesPersonalVehicle === "si" ? "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]" : "border-slate-200 bg-white text-slate-700"}`}
                    >
                      Con vehiculo personal
                    </button>
                  </div>
                </div>

                {usesPersonalVehicle === "si" ? (
                  <div className="grid gap-5">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kilometraje inicial</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={startOdometerKm}
                        onChange={(e) => setStartOdometerKm(e.target.value)}
                        className="min-h-[44px] rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                        placeholder="Ejemplo: 152340"
                      />
                    </label>
                    <CameraCaptureField
                      label="Foto de kilometraje inicial"
                      hint="La foto debe tomarse en el momento de la salida."
                      value={startOdometerPhoto}
                      onChange={setStartOdometerPhoto}
                      fileNamePrefix="odometro_inicio"
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Estado del cierre</p>
                  <p className="mt-1 text-sm text-slate-600">{vehicleBadgeText}</p>
                </div>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {operationalPhase === "close" ? "Motivo del cierre fuera de oficina" : "Observacion de cierre"}
                  </span>
                  <textarea
                    value={operationalDetail}
                    onChange={(e) => setOperationalDetail(e.target.value)}
                    rows={3}
                    placeholder="Detalle final de la salida operacional"
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  />
                </label>

                {requiresVehicleClosure ? (
                  <>
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Kilometraje final</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={endOdometerKm}
                        onChange={(e) => setEndOdometerKm(e.target.value)}
                        className="min-h-[44px] rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:border-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                        placeholder="Ejemplo: 152380"
                      />
                    </label>
                    <CameraCaptureField
                      label="Foto de kilometraje final"
                      hint="La foto debe tomarse en el momento del cierre."
                      value={endOdometerPhoto}
                      onChange={setEndOdometerPhoto}
                      fileNamePrefix="odometro_fin"
                    />
                  </>
                ) : null}
              </div>
            )}

            {manualStepError ? <p className="text-sm text-[#DC2626]">{manualStepError}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleManualClientSubmit} variant="primary">
                Continuar con la marcacion
              </Button>
              <Button onClick={() => navigate("/dashboard")} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <Card className="text-center py-12 px-8 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {(status === "initializing") && (
              <motion.div
                key="initializing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center"
              >
                <FiLoader className="text-5xl text-gray-400 animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Verificando sesión</h2>
                <p className="text-gray-500 dark:text-gray-400 italic">Un momento...</p>
              </motion.div>
            )}

            {status === "geolocating" && (
              <motion.div
                key="geolocating"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-6">
                  <FiMapPin className="text-5xl text-blue-500 animate-bounce" />
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping scale-150" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Obteniendo ubicación</h2>
                <p className="text-gray-500 dark:text-gray-400 italic">Un momento, por favor...</p>
                {helpHint && (
                  <p className="mt-4 max-w-xs text-xs text-gray-400 dark:text-gray-500">{helpHint}</p>
                )}
              </motion.div>
            )}

            {status === "processing" && (
              <motion.div
                key="processing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center"
              >
                <FiLoader className="text-5xl text-primary animate-spin mb-6" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Registrando {config.label}</h2>
                <p className="text-gray-500 dark:text-gray-400 italic">Comunicando con el servidor...</p>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full mb-6">
                  <FiCheckCircle className="text-6xl text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">¡Listo!</h2>
                <p className="text-green-600 dark:text-green-400 font-medium mb-8">{message}</p>
                <p className="text-sm text-gray-400 mb-6 italic">Redirigiendo al portal...</p>
                <Button onClick={() => navigate("/dashboard")} variant="secondary" size="sm">Ir ahora</Button>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full mb-6">
                  <FiAlertCircle className="text-6xl text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Ups, algo salio mal</h2>
                <p className="text-red-600 dark:text-red-400 font-medium mb-4">{message}</p>
                <div className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg text-xs text-gray-500 dark:text-gray-400 mb-8 w-full">
                  {errorDetails}
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleRetry} variant="primary">Reintentar</Button>
                  <Button onClick={() => navigate("/dashboard")} variant="ghost">Ir al Dashboard</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
    </div>
  );
};

export default AttendanceAction;
