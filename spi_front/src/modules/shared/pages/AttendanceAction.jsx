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
  marcarSalidaImprevista,
  marcarRegresoImprevisto,
  marcarLlegadaImprevista,
  marcarRetornoImprevisto,
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
} from "../../../core/api/attendanceApi";
import { getLocationForAction, startLocationPrewarm, stopLocationPrewarm } from "../../../shared/utils/attendanceLocationCache";
import { fetchClients } from "../../../core/api/clientsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";
import { getAttendanceErrorInfo } from "../../../core/ui/attendanceErrorUtils";
import { isOperationalFlow } from "../../../core/ui/attendanceFlowUtils";


const resolveShortcutParam = (params, keys = []) => {
  for (const key of keys) {
    const value = String(params.get(key) || "").trim();
    if (value) return value;
  }
  return "";
};

const parseActionParams = (search) => {
  const params = new URLSearchParams(search || "");
  return {
    clientId: resolveShortcutParam(params, ["client_id", "cliente_id", "clientId"]),
    prospectName: resolveShortcutParam(params, ["prospect_name", "prospecto", "prospectName"]),
    description: resolveShortcutParam(params, ["motivo", "descripcion", "description"]),
    observations: resolveShortcutParam(params, ["observaciones", "observacion", "observations", "obs"]),
    returnToOffice: ["1", "true", "si", "yes"].includes(
      resolveShortcutParam(params, ["return_to_office", "retorno_oficina", "returnToOffice"]).toLowerCase()
    ),
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
  return city ? `${safeName} - ${city} (#${client?.id})` : `${safeName} (#${client?.id})`;
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

const AttendanceAction = () => {
  const { action } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useUI();

  const [status, setStatus] = useState("initializing"); // initializing, geolocating, ready, processing, success, error
  const [message, setMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [availableClients, setAvailableClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [manualClientId, setManualClientId] = useState("");
  const [manualClientSearch, setManualClientSearch] = useState("");
  const [manualProspectName, setManualProspectName] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualObservations, setManualObservations] = useState("");
  const [manualStepError, setManualStepError] = useState("");
  const [manualSubmitNonce, setManualSubmitNonce] = useState(0);
  const processedRef = useRef(false);
  const executionKeyRef = useRef("");
  const actionParams = parseActionParams(location.search);
  const executionKey = `${action || ""}|${location.search || ""}|${location.key || ""}|${user?.id || ""}`;
  const ensureExceptionFlow = async (expectedFlow) => {
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
      throw new Error("No tienes una salida inesperada activa para completar este paso.");
    }
    if (operationalFlow) {
      throw new Error("La salida activa actual es operacional. Usa el flujo operacional para continuar.");
    }
  };

  const resolveVisitExitPayload = async (params = {}) => {
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
  };

  const ACTION_MAP = {
    entrada: {
      fn: async (currentLoc) => marcarEntrada(currentLoc),
      label: "Entrada",
      syncTarget: "entry",
      requiresParams: false,
      icon: <FiClock className="text-blue-500" />,
    },
    "almuerzo-salida": {
      fn: async (currentLoc) => marcarAlmuerzoSalida(currentLoc),
      label: "Salida a almuerzo",
      syncTarget: "lunch_start",
      requiresParams: false,
      icon: <FiClock className="text-orange-500" />,
    },
    "salida-almuerzo": {
      fn: async (currentLoc) => marcarAlmuerzoSalida(currentLoc),
      label: "Salida a almuerzo",
      syncTarget: "lunch_start",
      requiresParams: false,
      icon: <FiClock className="text-orange-500" />,
    },
    almuerzo: {
      fn: async (currentLoc) => marcarAlmuerzoSalida(currentLoc),
      label: "Salida a almuerzo",
      syncTarget: "lunch_start",
      requiresParams: false,
      icon: <FiClock className="text-orange-500" />,
    },
    "almuerzo-entrada": {
      fn: async (currentLoc) => marcarAlmuerzoEntrada(currentLoc),
      label: "Entrada de almuerzo",
      syncTarget: "lunch_end",
      requiresParams: false,
      icon: <FiClock className="text-green-500" />,
    },
    "entrada-almuerzo": {
      fn: async (currentLoc) => marcarAlmuerzoEntrada(currentLoc),
      label: "Entrada de almuerzo",
      syncTarget: "lunch_end",
      requiresParams: false,
      icon: <FiClock className="text-green-500" />,
    },
    salida: {
      fn: async (currentLoc) => marcarSalida(currentLoc),
      label: "Salida final",
      syncTarget: "exit",
      requiresParams: false,
      icon: <FiClock className="text-red-500" />,
    },
    "salida-final": {
      fn: async (currentLoc) => marcarSalida(currentLoc),
      label: "Salida final",
      syncTarget: "exit",
      requiresParams: false,
      icon: <FiClock className="text-red-500" />,
    },
    "salida-imprevista": {
      fn: async (currentLoc, params) =>
        marcarSalidaImprevista(currentLoc, params.description || "Salida imprevista via atajo"),
      label: "Salida inesperada",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "regreso-imprevisto": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("unexpected");
        return marcarRegresoImprevisto(currentLoc);
      },
      label: "Entrada inesperada",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "llegada-imprevista": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("unexpected");
        return marcarLlegadaImprevista(currentLoc);
      },
      label: "Llegada al lugar inesperado",
      syncTarget: "onsite",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "retorno-imprevisto": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("unexpected");
        return marcarRetornoImprevisto(currentLoc);
      },
      label: "Salida del lugar (retorno oficina)",
      syncTarget: "returning",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "salida-oficina": {
      fn: async (currentLoc, params) =>
        marcarSalidaOficina(currentLoc, params.description || "Salida de oficina o viaje via atajo"),
      label: "Salida oficina o viaje",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "entrada-oficina": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("operational");
        return marcarEntradaOficina(currentLoc);
      },
      label: "Entrada oficina o viaje",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "salida-campo": {
      fn: async (currentLoc, params) =>
        marcarSalidaCampo(currentLoc, params.description || "Salida de campo via atajo"),
      label: "Salida de campo",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "entrada-campo": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("operational");
        return marcarEntradaCampo(currentLoc);
      },
      label: "Entrada de campo",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "llegada-destino": {
      fn: async (currentLoc) => {
        await ensureExceptionFlow("operational");
        return marcarLlegadaDestino(currentLoc);
      },
      label: "Llegada a destino",
      syncTarget: "arrival",
      requiresParams: false,
      icon: <FiMapPin className="text-amber-500" />,
    },
    "cierre-viaje": {
      fn: async (currentLoc, params) => {
        await ensureExceptionFlow("operational");
        return marcarCierreViaje(currentLoc, params.description || "Cierre de viaje via atajo");
      },
      label: "Cierre de viaje",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiCheckCircle className="text-amber-500" />,
    },
    "cliente-entrada": {
      fn: async (currentLoc, params) => {
        if (!params.clientId && !params.prospectName) {
          throw new Error("Para entrada cliente debes enviar client_id o prospect_name en la URL.");
        }
        return marcarVisitaEntrada({
          location: currentLoc,
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
      fn: async (currentLoc, params) => {
        if (!params.clientId && !params.prospectName) {
          throw new Error("Para entrada cliente debes enviar client_id o prospect_name en la URL.");
        }
        return marcarVisitaEntrada({
          location: currentLoc,
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
      fn: async (currentLoc, params) => {
        const visitScopePayload = await resolveVisitExitPayload(params);
        return marcarVisitaSalida({
          location: currentLoc,
          ...visitScopePayload,
          observations: params.observations || params.description || undefined,
          return_to_office: params.returnToOffice,
        });
      },
      label: "Salida cliente",
      syncTarget: "departure",
      requiresParams: false,
      icon: <FiClock className="text-violet-500" />,
    },
    "salida-cliente": {
      fn: async (currentLoc, params) => {
        const visitScopePayload = await resolveVisitExitPayload(params);
        return marcarVisitaSalida({
          location: currentLoc,
          ...visitScopePayload,
          observations: params.observations || params.description || undefined,
          return_to_office: params.returnToOffice,
        });
      },
      label: "Salida cliente",
      syncTarget: "departure",
      requiresParams: false,
      icon: <FiClock className="text-violet-500" />,
    },
  };

  const config = ACTION_MAP[action];

  const getNextStepHint = useCallback((currentAction) => {
    const hints = {
      entrada: "Continúa con salida a almuerzo cuando corresponda.",
      "salida-almuerzo": "Continúa con entrada de almuerzo cuando regreses.",
      "almuerzo-salida": "Continúa con entrada de almuerzo cuando regreses.",
      almuerzo: "Continúa con entrada de almuerzo cuando regreses.",
      "entrada-almuerzo": "Continúa con salida final al cerrar tu jornada.",
      "almuerzo-entrada": "Continúa con salida final al cerrar tu jornada.",
      salida: "Tu jornada ya está cerrada.",
      "salida-final": "Tu jornada ya está cerrada.",
      "salida-imprevista": "Continúa con llegada y regreso imprevisto para cerrar el ciclo.",
      "llegada-imprevista": "Continúa con retorno imprevisto al salir del lugar.",
      "retorno-imprevisto": "Continúa con regreso imprevisto al volver a oficina.",
      "regreso-imprevisto": "Ciclo imprevisto cerrado correctamente.",
      "salida-oficina": "Continúa con llegada a destino y luego entrada oficina para cerrar.",
      "salida-campo": "Continúa con llegada a destino y luego entrada campo para cerrar.",
      "llegada-destino": "Continúa con salida/entrada de cliente o cierre de viaje.",
      "entrada-oficina": "Ciclo operacional cerrado correctamente.",
      "entrada-campo": "Ciclo operacional cerrado correctamente.",
      "cierre-viaje": "Viaje cerrado correctamente.",
      "cliente-entrada": "Continúa con salida de cliente al terminar la visita.",
      "entrada-cliente": "Continúa con salida de cliente al terminar la visita.",
      "cliente-salida": "Visita cerrada correctamente.",
      "salida-cliente": "Visita cerrada correctamente.",
    };
    return hints[currentAction] || "Continúa con la siguiente marcación de tu flujo.";
  }, []);

  const resolveFriendlyDuplicateMessage = useCallback(({ currentAction, statusCode, backendCode, backendMessage }) => {
    const msg = String(backendMessage || "").toLowerCase();
    const hasAlreadyMarked =
      msg.includes("ya has marcado") ||
      msg.includes("ya tienes una salida") ||
      msg.includes("ya se encontraba cerrada") ||
      msg.includes("ya estaba cerrada");
    const noActiveButLikelyCompleted =
      (statusCode === 404 && backendCode === "NO_ACTIVE_OPERATIONAL") ||
      (statusCode === 404 && /no se encontro una salida imprevista activa/.test(msg));

    if (!hasAlreadyMarked && !noActiveButLikelyCompleted) {
      return null;
    }

    return `Esta marcación ya estaba registrada. ${getNextStepHint(currentAction)}`;
  }, [getNextStepHint]);
  const needsManualClientStep = Boolean(
    config?.requiresParams && !actionParams.clientId && !actionParams.prospectName
  );
  const effectiveActionParams = useMemo(
    () => ({
      clientId: actionParams.clientId || manualClientId,
      prospectName: actionParams.prospectName || manualProspectName,
      description: actionParams.description || manualReason,
      observations: actionParams.observations || manualObservations,
      returnToOffice: actionParams.returnToOffice,
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
        const response = await fetchClients();
        const clients = Array.isArray(response?.clients) ? response.clients : [];
        if (isMounted) {
          setAvailableClients(clients);
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
    if (executionKeyRef.current !== executionKey) {
      executionKeyRef.current = executionKey;
      processedRef.current = false;
      setStatus("initializing");
      setMessage("");
      setErrorDetails("");
      setResolvedLocation(null);
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

  useEffect(() => {
    if (authLoading || !user || processedRef.current || !config) return;
    if (needsManualClientStep && manualSubmitNonce === 0) return;

    let cancelled = false;
    const resolveLocationOnly = async () => {
      processedRef.current = true;
      setStatus("geolocating");
      try {
        const currentLoc = await withTimeout(
          getLocationForAction(),
          20000,
          "GPS tardó demasiado en responder. Verifica permisos de ubicación y vuelve a intentar."
        );
        if (cancelled) return;
        setResolvedLocation(currentLoc);
        setStatus("ready");
        setMessage("Ubicación lista. Confirma para marcar.");
        setErrorDetails("");
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
    manualSubmitNonce,
    effectiveActionParams,
    actionParams.returnUrl,
    resolveFriendlyDuplicateMessage,
  ]);


  const handleConfirmMark = async () => {
    if (!resolvedLocation || !config) return;
    setStatus("processing");
    try {
      const response = await config.fn(resolvedLocation, effectiveActionParams);
      if (response?.ok) {
        setStatus("success");
        setMessage(response.message || `${config.label} registrada correctamente.`);
        showToast(response.message || `${config.label} registrada`, "success");
        const destination = actionParams.returnUrl || "/dashboard";
        setTimeout(() => {
          navigate(destination, { replace: true });
        }, 3500);
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
  };
  const handleManualClientSubmit = () => {
    setManualStepError("");
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

            {status === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center"
              >
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-6">
                  <FiMapPin className="text-6xl text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Ubicación lista</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Se obtuvo tu ubicación correctamente. Presiona para confirmar la marcación.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleConfirmMark} variant="primary">Marcar ahora</Button>
                  <Button onClick={() => navigate(actionParams.returnUrl || "/dashboard", { replace: true })} variant="ghost">
                    Cancelar
                  </Button>
                </div>
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
                  <Button onClick={() => window.location.reload()} variant="primary">Reintentar</Button>
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
