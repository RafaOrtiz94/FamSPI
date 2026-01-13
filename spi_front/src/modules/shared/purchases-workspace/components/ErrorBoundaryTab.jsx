import React from 'react';
import { ErrorBoundary } from '../../../../core/ui/components/ErrorBoundary';

const ErrorBoundaryTab = ({ children, tabName }) => {
  return (
    <ErrorBoundary
      fallback={
        <div className="tab-error-fallback">
          <h3>Error en {tabName}</h3>
          <p>Ha ocurrido un error al cargar esta sección.</p>
          <p>Por favor, recarga la página o contacta al soporte técnico.</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
          >
            Recargar Página
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundaryTab;