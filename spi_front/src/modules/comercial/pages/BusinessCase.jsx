import React from "react";
import BusinessCaseWidget from "../../shared/components/BusinessCaseWidget";

const BusinessCasePage = () => (
  <div className="p-6 space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900">Business Case</h1>
    </div>

    <BusinessCaseWidget showCommercialStartCards={false} />
  </div>
);

export default BusinessCasePage;
