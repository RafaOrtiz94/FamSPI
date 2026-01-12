import React from "react";
import BusinessCaseWorkspace from "./BusinessCaseWorkspace";
import { RequestActionButton } from "../../../core/ui/components/RequestActionCards";

const BusinessCasePage = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm uppercase tracking-wide text-gray-500 font-semibold">
            Business Case
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Área Comercial</h1>
          <p className="text-sm text-gray-600">
            Gestiona los casos de negocio de forma colaborativa y organizada.
          </p>
        </div>
        <div className="flex gap-2">
          <RequestActionButton type="BUSINESS_CASE" size="sm" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Workspace de Business Case Moderno</h2>
            <p className="text-sm text-gray-600">
              Gestiona todas las secciones de tu caso de negocio de forma colaborativa y organizada.
            </p>
          </div>
        </div>
        <BusinessCaseWorkspace />
      </div>
    </div>
  );
};

export default BusinessCasePage;
