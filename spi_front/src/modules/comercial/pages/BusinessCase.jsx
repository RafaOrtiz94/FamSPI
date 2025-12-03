import React from "react";
import BusinessCaseCalculator from "../components/BusinessCaseCalculator";
import { useAuth } from "../../../core/auth/AuthContext";

const BusinessCasePage = () => {
  const { user } = useAuth();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Calculadora Business Case Vivo</h1>
        <p className="text-sm text-gray-500">
          Simula costos y requerimientos de reactivos en tiempo real.
        </p>
      </div>

      <BusinessCaseCalculator />
    </div>
  );
};

export default BusinessCasePage;
