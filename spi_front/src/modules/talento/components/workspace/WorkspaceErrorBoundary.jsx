import React from "react";

class WorkspaceErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("WorkspaceErrorBoundary:", error, errorInfo);
  }

  handleRetry() {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="rounded-2xl border border-hr-warning/40 bg-hr-warning-soft/40 p-4">
        <h3 className="text-sm font-semibold text-hr-warning-muted">
          {this.props.title || "No se pudo cargar este bloque"}
        </h3>
        <p className="mt-1 text-sm text-brand-hr-primary-muted">
          {this.props.message ||
            "Ocurrio un problema inesperado. Puedes intentar cargar nuevamente."}
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          aria-label="Reintentar carga del componente"
          className="mt-3 rounded-lg border border-brand-hr-primary/25 bg-brand-hr-primary-contrast px-3 py-2 text-sm font-semibold text-brand-hr-primary transition hover:bg-brand-hr-primary-soft"
        >
          Reintentar carga
        </button>
      </div>
    );
  }
}

export default WorkspaceErrorBoundary;
