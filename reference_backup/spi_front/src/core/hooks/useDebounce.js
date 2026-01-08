// src/hooks/useDebounce.js
import { useEffect, useState } from "react";

/**
 * Retorna un valor "debounced" (con retraso controlado)
 * Ideal para inputs de búsqueda.
 */
export const useDebounce = (value, delay = 400) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debounced;
};
