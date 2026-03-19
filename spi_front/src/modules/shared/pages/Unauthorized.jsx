import React from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FiLock } from "react-icons/fi";
import { useAuth } from "../../../core/auth/useAuth";

const Unauthorized = () => {
 const { user, loading } = useAuth();
 const navigate = useNavigate();

 // Roles que se consideran "activos" en el sistema.
 // Si el usuario tiene uno de estos roles, ve la pantalla de "Acceso Denegado" (candado)
 // porque significa que tiene rol pero no permisos para ESTA ruta específica.
 // Si NO tiene uno de estos roles, se asume que está en proceso de registro.
 const ACTIVE_ROLES = [
 'gerencia', 'gerencia_general', 'gerente_general', 'director',
 'finanzas', 'jefe_finanzas', 'jefe_financiero',
 'comercial', 'jefe_comercial', 'backoffice_comercial', 'acp_comercial', 'asesor_comercial',
 'servicio_tecnico', 'jefe_tecnico', 'jefe_servicio_tecnico',
 'talento_humano', 'recursos_humanos',
 'ti', 'admin', 'administrador',
 'operaciones', 'jefe_operaciones',
 'jefe_logistica', 'logistica',
 'calidad'
 ];

 const roleRaw = user?.role ?? '';
 const scopeRaw = user?.scope ?? '';
 const roleList = Array.isArray(roleRaw)
 ? roleRaw
 : String(roleRaw)
 .split(',')
 .map((r) => r.trim())
 .filter(Boolean);
 const scopeList = Array.isArray(scopeRaw)
 ? scopeRaw
 : String(scopeRaw)
 .split(',')
 .map((s) => s.trim())
 .filter(Boolean);
 const normalizedRoles = roleList.map((r) => r.toLowerCase());
 const normalizedScopes = scopeList.map((s) => s.toLowerCase());
 const userRole = normalizedRoles[0] || normalizedScopes[0] || '';
 
 // Es "pendiente" si no tiene rol, o el rol no está en la lista de activos
 const hasActiveRole = ACTIVE_ROLES.some((r) => normalizedRoles.includes(r) || normalizedScopes.includes(r));
 const hasPendingFlag =
 normalizedRoles.some((r) => r.includes("pending") || r.includes("pendiente")) ||
 normalizedScopes.some((s) => s.includes("pending") || s.includes("pendiente"));
 if (hasPendingFlag || !userRole || !hasActiveRole) {
 return <Navigate to="/registro-en-proceso" replace />;
 }

 console.log("🔍 Unauthorized Page Debug:", {
 user, 
 role: userRole, 
 roles: normalizedRoles,
 scopes: normalizedScopes,
 hasPendingFlag,
 hasActiveRole 
 });

 console.log("🔍 Unauthorized Render Snapshot:", {
 loading,
 user,
 role: userRole,
 roles: normalizedRoles,
 scopes: normalizedScopes,
 hasPendingFlag,
 hasActiveRole,
 });

 if (loading) {
 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-6 text-center">
 <div className="animate-spin h-10 w-10 rounded-full border-4 border-blue-400 border-t-transparent mb-4"></div>
 <p className="text-sm text-slate-300">Verificando acceso...</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-500 to-orange-600 dark:from-gray-900 dark:to-gray-800 text-white px-6 text-center">
 {/* Ícono con animación */}
 <motion.div
 initial={{ scale: 0.8, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ duration: 0.5 }}
 className="flex flex-col items-center"
 >
 <FiLock className="text-6xl text-white drop-shadow-lg mb-4" />
 <h1 className="text-4xl font-bold mb-2">Acceso Denegado</h1>
 <p className="text-white/90 dark:text-gray-300 mb-8 max-w-md">
 🚫 No tienes los permisos necesarios para ver esta página o realizar
 esta acción.
 </p>

 {/* Botón de regreso */}
 <Link
 to="/dashboard"
 className="inline-flex items-center gap-2 bg-white text-yellow-700 dark:bg-gray-700 dark:text-white px-6 py-2 rounded-full font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
 >
 Volver al Dashboard
 </Link>
 </motion.div>

 {/* Firma inferior */}
 <p className="absolute bottom-6 text-sm text-white/70 dark:text-gray-400">
 © {new Date().getFullYear()} FamProject
 </p>
 </div>
 );
};

export default Unauthorized;
