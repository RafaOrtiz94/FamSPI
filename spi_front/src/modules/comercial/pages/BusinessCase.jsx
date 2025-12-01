import React from "react";
import BusinessCaseWidget from "../../shared/components/BusinessCaseWidget";

import NewBusinessCaseCard from "../components/NewBusinessCaseCard";

const BusinessCasePage = () => {
  const handleCreate = () => {
    // TODO: Implement creation logic
    console.log("Create Business Case");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Business Case</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <NewBusinessCaseCard onClick={handleCreate} />
        </div>
      </div>

      <BusinessCaseWidget showCommercialStartCards={false} />
    </div>
  );
};

export default BusinessCasePage;
