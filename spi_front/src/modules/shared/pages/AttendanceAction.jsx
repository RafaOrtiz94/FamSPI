// src/modules/shared/pages/AttendanceAction.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiCheckCircle, FiAlertCircle, FiLoader, FiMapPin } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { useUI } from "../../../core/ui/UIContext";
import { 
  marcarEntrada, 
  marcarAlmuerzoSalida, 
  marcarAlmuerzoEntrada, 
  marcarSalida 
} from "../../../core/api/attendanceApi";
import Card from "../../../core/ui/components/Card";
import Button from "../../../core/ui/components/Button";

const ACTION_MAP = {
  "entrada": { 
    fn: marcarEntrada, 
    label: "Entrada", 
    color: "blue",
    icon: <FiClock className="text-blue-500" />
  },
  "almuerzo-salida": { 
    fn: marcarAlmuerzoSalida, 
    label: "Salida a Almuerzo", 
    color: "orange",
    icon: <FiClock className="text-orange-500" />
  },
  "salida-almuerzo": { 
    fn: marcarAlmuerzoSalida, 
    label: "Salida a Almuerzo", 
    color: "orange",
    icon: <FiClock className="text-orange-500" />
  },
  "almuerzo": { 
    fn: marcarAlmuerzoSalida, 
    label: "Salida a Almuerzo", 
    color: "orange",
    icon: <FiClock className="text-orange-500" />
  },
  "almuerzo-entrada": { 
    fn: marcarAlmuerzoEntrada, 
    label: "Regreso de Almuerzo", 
    color: "green",
    icon: <FiClock className="text-green-500" />
  },
  "entrada-almuerzo": { 
    fn: marcarAlmuerzoEntrada, 
    label: "Regreso de Almuerzo", 
    color: "green",
    icon: <FiClock className="text-green-500" />
  },
  "salida": { 
    fn: marcarSalida, 
    label: "Salida Final", 
    color: "red",
    icon: <FiClock className="text-red-500" />
  },
  "salida-final": { 
    fn: marcarSalida, 
    label: "Salida Final", 
    color: "red",
    icon: <FiClock className="text-red-500" />
  }
};

const AttendanceAction = () => {
  const { action } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useUI();
  
  const [status, setStatus] = useState("initializing"); // initializing, geolocating, processing, success, error
  const [message, setMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [location, setLocation] = useState(null);
  const processedRef = useRef(false);

  const config = ACTION_MAP[action];

  useEffect(() => {
    if (authLoading || !user || processedRef.current || !config) return;
    
    const performAction = async () => {
      processedRef.current = true;
      setStatus("geolocating");
      
      let currentLoc = null;
      try {
        if (navigator.geolocation) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 300000
            });
          });
          currentLoc = `${pos.coords.latitude},${pos.coords.longitude}`;
          setLocation(currentLoc);
        }
      } catch (err) {
        console.warn("Geolocalizacion fallida o denegada:", err.message);
      }

      setStatus("processing");
      try {
        const response = await config.fn(currentLoc);
        if (response.ok) {
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
  }, [authLoading, user, config, navigate, showToast]);

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
