import React from "react";
import { FiAlertTriangle } from "react-icons/fi";

class ScheduleMapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Evita que errores de Google Maps rompan todo el workspace.
    // eslint-disable-next-line no-console
    console.error("ScheduleMapErrorBoundary", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
        <div className="flex items-start gap-2">
          <FiAlertTriangle className="mt-0.5" size={16} />
          <div>
            <p className="text-sm font-semibold">No se pudo renderizar el mapa</p>
            <p className="text-xs">El calendario sigue disponible y puedes continuar operando.</p>
          </div>
        </div>
      </div>
    );
  }
}

export default ScheduleMapErrorBoundary;

