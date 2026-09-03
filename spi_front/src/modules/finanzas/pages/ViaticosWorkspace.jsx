import React, { useMemo } from "react";
import { useAuth } from "../../../core/auth/AuthContext";
import ViaticosDeclarant from "./ViaticosDeclarant";
import ViaticosRevisionTalento from "./ViaticosRevisionTalento";
import ViaticosRevisionFinanzas from "./ViaticosRevisionFinanzas";

const FINANCE_ROLES    = ["finanzas", "financiero", "jefe_finanzas", "jefe_financiero", "gerencia", "gerencia_general", "admin", "administrador"];
const TALENTO_ROLES    = ["talento_humano", "jefe_talento_humano"];
const SUPERVISOR_ROLES = ["jefe_comercial", "jefe_tecnico", "jefe_servicio", "jefe_servicio_tecnico", "jefe_operaciones", "jefe_inmediato", "gerencia", "gerencia_general"];

function normalizeRoles(user) {
  const raw = user?.roles ?? user?.role_name ?? user?.role ?? [];
  return (Array.isArray(raw) ? raw : [raw])
    .map((r) => String(r || "").toLowerCase().trim())
    .filter(Boolean);
}

const ViaticosWorkspace = () => {
  const { user } = useAuth();

  const { isFinance, isTalento, isSupervisor } = useMemo(() => {
    const roles = normalizeRoles(user);
    return {
      isFinance:    roles.some((r) => FINANCE_ROLES.includes(r)),
      isTalento:    roles.some((r) => TALENTO_ROLES.includes(r)),
      isSupervisor: roles.some((r) => SUPERVISOR_ROLES.includes(r)),
    };
  }, [user]);

  if (isFinance)  return <ViaticosRevisionFinanzas />;
  if (isTalento)  return <ViaticosRevisionTalento />;
  return <ViaticosDeclarant isSupervisor={isSupervisor} />;
};

export default ViaticosWorkspace;
