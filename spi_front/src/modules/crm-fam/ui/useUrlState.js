import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Filtros, búsqueda, orden y selección viven en la URL: al volver atrás o compartir el enlace
// la bandeja queda como estaba (antes se perdía todo al navegar).
// defaults: { q: "", type: "", sort: "name", dir: "asc" } — solo se escriben los valores no-default.
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const out = {};
    for (const [key, def] of Object.entries(defaults)) out[key] = params.get(key) ?? def;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const set = useCallback((patch, { replace = true } = {}) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "" || value === defaults[key]) next.delete(key);
        else next.set(key, String(value));
      }
      return next;
    }, { replace });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);

  return [state, set];
}

// Campo de búsqueda ligado a un parámetro de la URL: escribe tras una pausa y, si la URL cambia
// desde fuera (paleta de comandos, botón atrás), actualiza el campo sin pisar lo que se está tecleando.
export function useUrlSearch(urlValue, write, delay = 300) {
  const [text, setText] = useState(urlValue);
  const lastWritten = useRef(urlValue);

  useEffect(() => {
    if (text === lastWritten.current) return undefined;
    const t = setTimeout(() => { lastWritten.current = text; write(text); }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay]);

  useEffect(() => {
    if (urlValue !== lastWritten.current) { lastWritten.current = urlValue; setText(urlValue); }
  }, [urlValue]);

  return [text, setText];
}
