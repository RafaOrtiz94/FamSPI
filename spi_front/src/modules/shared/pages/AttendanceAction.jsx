// src/modules/shared/pages/AttendanceAction.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
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
  marcarVisitaEntrada,
  marcarVisitaSalida,
  registerException,
  updateExceptionStatus,
  syncAttendanceLocation,
} from "../../../core/api/attendanceApi";
import { getPreciseLocation } from "../../../shared/utils/preciseGeolocation";
import { fetchClients } from "../../../core/api/clientsApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const PRECISE_LOCATION_OPTIONS = Object.freeze({
  desiredAccuracyMeters: 40,
  goodAccuracyMeters: 25,
  highAccuracyTimeoutMs: 7000,
  sampleWindowMs: 4500,
  sampleCount: 2,
});

const getActionLocation = async () => {
  const locationPromise = getPreciseLocation(PRECISE_LOCATION_OPTIONS).then(
    (result) => result?.location || null
  );
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 4200));
  return Promise.race([locationPromise, timeoutPromise]);
};

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
  };
};

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
  const [manualProspectName, setManualProspectName] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualObservations, setManualObservations] = useState("");
  const [manualStepError, setManualStepError] = useState("");
  const [manualSubmitNonce, setManualSubmitNonce] = useState(0);
  const processedRef = useRef(false);
  const actionParams = parseActionParams(location.search);

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
      fn: async (currentLoc) => marcarRegresoImprevisto(currentLoc),
      label: "Entrada inesperada",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "llegada-imprevista": {
      fn: async (currentLoc) => updateExceptionStatus("ON_SITE", currentLoc),
      label: "Llegada al lugar inesperado",
      syncTarget: "onsite",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "retorno-imprevisto": {
      fn: async (currentLoc) => updateExceptionStatus("RETURNING", currentLoc),
      label: "Salida del lugar (retorno oficina)",
      syncTarget: "returning",
      requiresParams: false,
      icon: <FiClock className="text-rose-500" />,
    },
    "salida-oficina": {
      fn: async (currentLoc, params) =>
        registerException("otro", params.description || "Salida de oficina o viaje via atajo", currentLoc),
      label: "Salida oficina o viaje",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "entrada-oficina": {
      fn: async (currentLoc) => updateExceptionStatus("COMPLETED", currentLoc),
      label: "Entrada oficina o viaje",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "salida-campo": {
      fn: async (currentLoc, params) =>
        registerException("otro", params.description || "Salida de campo via atajo", currentLoc),
      label: "Salida de campo",
      syncTarget: "start",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
    },
    "entrada-campo": {
      fn: async (currentLoc) => updateExceptionStatus("COMPLETED", currentLoc),
      label: "Entrada de campo",
      syncTarget: "return",
      requiresParams: false,
      icon: <FiClock className="text-amber-500" />,
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
        if (!params.clientId && !params.prospectName) {
          throw new Error("Para salida cliente debes enviar client_id o prospect_name en la URL.");
        }
        return marcarVisitaSalida({
          location: currentLoc,
          client_id: params.clientId ? Number(params.clientId) : undefined,
          prospect_name: params.prospectName || undefined,
          observations: params.observations || params.description || undefined,
        });
      },
      label: "Salida cliente",
      syncTarget: "departure",
      requiresParams: true,
      icon: <FiClock className="text-violet-500" />,
    },
    "salida-cliente": {
      fn: async (currentLoc, params) => {
        if (!params.clientId && !params.prospectName) {
          throw new Error("Para salida cliente debes enviar client_id o prospect_name en la URL.");
        }
        return marcarVisitaSalida({
          location: currentLoc,
          client_id: params.clientId ? Number(params.clientId) : undefined,
          prospect_name: params.prospectName || undefined,
          observations: params.observations || params.description || undefined,
        });
      },
      label: "Salida cliente",
      syncTarget: "departure",
      requiresParams: true,
      icon: <FiClock className="text-violet-500" />,
    },
  };

  const config = ACTION_MAP[action];
  const needsManualClientStep = Boolean(
    config?.requiresParams && !actionParams.clientId && !actionParams.prospectName
  );
  const effectiveActionParams = useMemo(
    () => ({
      clientId: actionParams.clientId || manualClientId,
      prospectName: actionParams.prospectName || manualProspectName,
      description: actionParams.description || manualReason,
      observations: actionParams.observations || manualObservations,
    }),
    [
      actionParams.clientId,
      actionParams.prospectName,
      actionParams.description,
      actionParams.observations,
      manualClientId,
      manualProspectName,
      manualReason,
      manualObservations,
    ]
  );

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
    if (authLoading || !user || processedRef.current || !config) return;
    if (needsManualClientStep && manualSubmitNonce === 0) return;
    
    const performAction = async () => {
      processedRef.current = true;
      setStatus("geolocating");
      
      let currentLoc = null;
      try {
        currentLoc = await getActionLocation();
      } catch (err) {
        console.warn("Geolocalizacion fallida o denegada:", err.message);
      }

      setStatus("processing");
      try {
        const response = await config.fn(currentLoc, effectiveActionParams);
        if (response.ok) {
          if (config.syncTarget && !currentLoc) {
            Promise.resolve()
              .then(() => getPreciseLocation(PRECISE_LOCATION_OPTIONS))
              .then((result) => {
                if (!result?.location) return null;
                return syncAttendanceLocation(config.syncTarget, result.location);
              })
              .catch(() => null);
          }

          setStatus("success");
          setMessage(response.message || `${config.label} registrada correctamente.`);
          showToast(response.message || `${config.label} registrada`, "success");
          
          // Redirect after 3 seconds
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 3500);
        } else {
          throw new Error(response.message || "Error al procesar la solicitud.");
        }
      } catch (err) {
        setStatus("error");
        setMessage(`No se pudo registrar la ${config.label.toLowerCase()}.`);
        setErrorDetails(err.response?.data?.message || err.message || "Error desconocido");
        showToast(err.response?.data?.message || err.message || "Error de red", "error");
      }
    };

    performAction();
  }, [
    authLoading,
    user,
    config,
    navigate,
    showToast,
    needsManualClientStep,
    manualSubmitNonce,
    effectiveActionParams,
  ]);

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
            Cliente asignado
          </label>
          <select
            value={manualClientId}
            onChange={(e) => {
              setManualClientId(e.target.value);
              if (e.target.value) setManualProspectName("");
            }}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 mb-4"
            disabled={loadingClients}
          >
            <option value="">{loadingClients ? "Cargando clientes..." : "Selecciona un cliente"}</option>
            {availableClients.map((client) => {
              const label =
                client?.name ||
                client?.business_name ||
                client?.nombre ||
                client?.razon_social ||
                `Cliente ${client?.id}`;
              return (
                <option key={client.id} value={String(client.id)}>
                  {label}
                </option>
              );
            })}
          </select>

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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Ups, algo salió mal</h2>
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
