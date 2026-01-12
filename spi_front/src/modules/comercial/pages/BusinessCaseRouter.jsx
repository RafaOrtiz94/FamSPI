import React from "react";
import { useParams, useSearchParams, Navigate } from "react-router-dom";

/**
 * BusinessCaseRouter - Smart Router for Business Cases
 *
 * This component acts as a routing entry point for individual business cases.
 * It decides which view to load based on query parameters:
 *
 * - Default: Redirects to /workspace (New Business Case Workspace)
 * - ?mode=wizard: Redirects to /wizard (Legacy Wizard)
 *
 * This ensures backward compatibility while making the Workspace the default.
 */
const BusinessCaseRouter = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const mode = searchParams.get("mode");

  // If mode=wizard, redirect to wizard
  if (mode === "wizard") {
    return <Navigate to={`/dashboard/business-case/${id}/wizard`} replace />;
  }

  // Default: redirect to workspace
  return <Navigate to={`/dashboard/business-case/${id}/workspace`} replace />;
};

export default BusinessCaseRouter;
