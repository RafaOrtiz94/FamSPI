import React from 'react';
import { ErrorBoundary } from '../../../../core/ui/components/ErrorBoundary';
import { FiAlertTriangle } from 'react-icons/fi';

const ErrorBoundaryTab = ({ children, tabName }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center min-h-[40vh] p-8">
          <div className="max-w-sm w-full text-center">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-3 bg-amber-50 rounded-xl w-fit mx-auto mb-4">
                <FiAlertTriangle className="text-amber-600 text-xl" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Error en {tabName}
              </h3>
              <p className="text-sm text-slate-500 mb-5">
                Ocurrió un error inesperado al cargar esta sección. Recarga la página para continuar.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-700 active:scale-[0.97] transition-colors duration-150"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundaryTab;
