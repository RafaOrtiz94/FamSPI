// src/contexts/UIContext.jsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  Fragment,
} from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiInfo,
  FiAlertTriangle,
  FiLoader,
} from "react-icons/fi";

/**
 * UIContext centraliza:
 * - Toasts globales
 * - Loader global
 * - Confirm dialogs
 * - Tema oscuro/claro
 */

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  // ======= Estado general =======
  const [toast, setToast] = useState(null); // { message, type }
  const [loading, setLoading] = useState(false); // loader global
  const [confirm, setConfirm] = useState(null); // { message, onConfirm }
  const [theme, setTheme] = useState(
    localStorage.getItem("theme") || "light"
  );

  // ======= Tema persistente =======
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  // ======= Toasts =======
  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const toastIcons = {
    success: <FiCheckCircle className="text-green-500" />,
    error: <FiAlertCircle className="text-red-500" />,
    info: <FiInfo className="text-blue-500" />,
    warning: <FiAlertTriangle className="text-yellow-500" />,
  };

  // ======= Confirmación modal =======
  const askConfirm = useCallback((message, onConfirm) => {
    setConfirm({ message, onConfirm });
  }, []);

  const handleConfirm = (confirmed) => {
    if (confirmed && confirm?.onConfirm) confirm.onConfirm();
    setConfirm(null);
  };

  // ======= Loader =======
  const showLoader = useCallback(() => setLoading(true), []);
  const hideLoader = useCallback(() => setLoading(false), []);

  // ======= Contexto =======
  const value = {
    showToast,
    showLoader,
    hideLoader,
    askConfirm,
    toggleTheme,
    theme,
  };

  // ======= Render global =======
  return (
    <UIContext.Provider value={value}>
      {children}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-lg transition-all
            ${
              toast.type === "success"
                ? "bg-green-50 border-green-400 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200"
                : toast.type === "error"
                ? "bg-red-50 border-red-400 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
                : toast.type === "warning"
                ? "bg-amber-50 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-200"
                : "bg-blue-50 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-200"
            }`}
        >
          {toastIcons[toast.type] || toastIcons.info}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      {/* Loader Global */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center">
          <FiLoader className="animate-spin text-5xl text-white mb-2" />
          <p className="text-white text-sm">Procesando...</p>
        </div>
      )}

      {/* Confirm Dialog */}
      <Transition.Root show={!!confirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setConfirm(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Confirmar acción
              </Dialog.Title>
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                {confirm?.message || "¿Deseas continuar con esta acción?"}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => handleConfirm(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Confirmar
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition.Root>
    </UIContext.Provider>
  );
};

export const useUI = () => useContext(UIContext);
