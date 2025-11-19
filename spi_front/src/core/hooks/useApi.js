// src/core/hooks/useApi.js
import { useState, useCallback } from "react";
import { useUI } from "../ui/UIContext";

/**
 * Hook genérico para peticiones API
 * ------------------------------------------------------
 * - Maneja estados de loading, error y éxito
 * - Devuelve siempre el último resultado como data
 * - Soporta loaders globales
 */
export const useApi = (apiFunction, options = {}) => {
  const {
    globalLoader = false,
    successMsg = null,
    errorMsg = null,
  } = options;
  const { showToast, showLoader, hideLoader } = useUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (...params) => {
      try {
        setLoading(true);
        setError(null);
        if (globalLoader) showLoader();

        const response = await apiFunction(...params);

        // ⚡️ Asegura que siempre haya data válida
        const normalized =
          response?.rows || response?.result?.rows
            ? response
            : Array.isArray(response)
            ? { rows: response }
            : { rows: [] };

        setData(normalized);
        if (successMsg) showToast(successMsg, "success");
        return normalized;
      } catch (err) {
        console.error("❌ API error:", err);
        setError(err);
        if (errorMsg) showToast(errorMsg, "error");
        throw err;
      } finally {
        setLoading(false);
        if (globalLoader) hideLoader();
      }
    },
    [apiFunction, globalLoader, successMsg, errorMsg, showToast, showLoader, hideLoader]
  );

  return { data, error, loading, execute, setData };
};
