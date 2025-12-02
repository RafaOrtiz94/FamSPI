import React from "react";
import BusinessCaseWidget from "../../core/ui/widgets/BusinessCaseWidget";
import { useAuth } from "../../../core/auth/AuthContext";

const BusinessCasePage = () => {
  const { user } = useAuth();
  const normalizedRole = (user?.role || "").toLowerCase();
  const allowCommercialStarts = normalizedRole === "comercial";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Case</h1>
      </div>

      <BusinessCaseWidget showCommercialStartCards={allowCommercialStarts} />
    </div>
  );
};

export default BusinessCasePage;
