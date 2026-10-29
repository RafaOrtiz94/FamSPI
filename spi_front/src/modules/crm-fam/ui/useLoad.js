import { useCallback, useEffect, useRef, useState } from "react";
import { getUsers } from "../../../core/api/usersApi";
import { errorMessage } from "./format";
import { ADVISOR_ROLES, normalizeRole } from "./roles";

// Carga de datos con estados explícitos (cargando / datos / error) y descarte de respuestas
// obsoletas: si los parámetros cambian mientras llega una respuesta vieja, esa respuesta se ignora.
// `keepData` conserva lo ya mostrado durante una recarga (evita parpadeos al paginar o filtrar).
export function useLoad(fn, deps, { keepData = true, fallback = "No se pudo cargar." } = {}) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestRef.current;
    setState((s) => ({ loading: true, data: keepData ? s.data : null, error: "" }));
    try {
      const data = await fn();
      if (requestId === requestRef.current) setState({ loading: false, data, error: "" });
    } catch (err) {
      if (requestId === requestRef.current) setState({ loading: false, data: null, error: errorMessage(err, fallback) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { reload(); }, [reload]);
  // Al desmontar, cualquier respuesta pendiente queda obsoleta.
  useEffect(() => () => { requestRef.current += 1; }, []);

  return { ...state, reload };
}

export const listOf = (res) => (Array.isArray(res) ? res : res?.data || []);
export const totalOf = (res) => (Array.isArray(res) ? res.length : Number(res?.total ?? listOf(res).length));

// Usuarios con rol comercial, para selectores de asesor/responsable. Si falla, la lista queda vacía
// y el formulario sigue funcionando con "yo mismo".
export function useAdvisors(enabled = true) {
  const [advisors, setAdvisors] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    getUsers()
      .then((users) => {
        if (cancelled) return;
        const list = Array.isArray(users) ? users : (users?.rows || users?.data || []);
        setAdvisors(list.filter((u) => ADVISOR_ROLES.has(normalizeRole(u.role))).sort((a, b) => String(a.fullname || "").localeCompare(String(b.fullname || ""), "es")));
      })
      .catch(() => { if (!cancelled) setAdvisors([]); });
    return () => { cancelled = true; };
  }, [enabled]);
  return advisors;
}

// Texto con pausa: devuelve el valor tras `delay` ms sin cambios (búsquedas).
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
