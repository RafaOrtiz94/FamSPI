import React, { useState } from "react";
import BusinessCaseWidget from "../../../core/ui/widgets/BusinessCaseWidget";
import BusinessCaseWizard from "./BusinessCaseWizard";
import Button from "../../../core/ui/components/Button";
import { FiList, FiSliders } from "react-icons/fi";
import { useAuth } from "../../../core/auth/AuthContext";
import { RequestActionButton } from "../../../core/ui/components/RequestActionCards";

const BusinessCasePage = () => {
  const { user } = useAuth();
  const normalizedRole = (user?.role || "").toLowerCase();
  const allowCommercialStarts = normalizedRole === "comercial";
  const [activeView, setActiveView] = useState("wizard");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
            Business Case
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Área Comercial</h1>
          <p className="text-sm text-gray-600">
            Gestiona los casos actuales o crea un Business Case moderno con el wizard paso a paso.
          </p>
        </div>
        <div className="flex gap-2">
          <RequestActionButton type="BUSINESS_CASE" size="sm" />
          <Button
            variant={activeView === "wizard" ? "primary" : "ghost"}
            onClick={() => setActiveView("wizard")}
            icon={FiSliders}
          >
            Wizard moderno
          </Button>
          <Button
            variant={activeView === "legacy" ? "primary" : "ghost"}
            onClick={() => setActiveView("legacy")}
            icon={FiList}
          >
            Lista y seguimiento
          </Button>
        </div>
      </div>

      {activeView === "wizard" ? (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Wizard de Business Case Moderno</h2>
              <p className="text-sm text-gray-600">
                Completa los 5 pasos para crear, seleccionar equipo, agregar determinaciones y finalizar tu caso.
              </p>
            </div>
          </div>
          <BusinessCaseWizard />
        </div>
      ) : (
        <BusinessCaseWidget showCommercialStartCards={allowCommercialStarts} />
      )}
    </div>
  );
};

export default BusinessCasePage;
