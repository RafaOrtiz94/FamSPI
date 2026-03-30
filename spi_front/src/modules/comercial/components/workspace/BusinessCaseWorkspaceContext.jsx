import { createContext, useContext } from "react";

export const BusinessCaseWorkspaceContext = createContext(null);
export const BusinessCaseDocumentsContext = createContext(null);
export const BusinessCaseCalculationsContext = createContext(null);

export function useBusinessCaseWorkspace() {
  const ctx = useContext(BusinessCaseWorkspaceContext);
  if (!ctx) {
    throw new Error("useBusinessCaseWorkspace debe usarse dentro de BusinessCaseWorkspaceContext.Provider");
  }
  return ctx;
}

export function useBusinessCaseWorkspaceOptional() {
  return useContext(BusinessCaseWorkspaceContext);
}

export function useBusinessCaseDocuments() {
  const ctx = useContext(BusinessCaseDocumentsContext);
  if (!ctx) {
    throw new Error("useBusinessCaseDocuments debe usarse dentro de BusinessCaseDocumentsContext.Provider");
  }
  return ctx;
}

export function useBusinessCaseDocumentsOptional() {
  return useContext(BusinessCaseDocumentsContext);
}

export function useBusinessCaseCalculations() {
  const ctx = useContext(BusinessCaseCalculationsContext);
  if (!ctx) {
    throw new Error(
      "useBusinessCaseCalculations debe usarse dentro de BusinessCaseCalculationsContext.Provider",
    );
  }
  return ctx;
}

export function useBusinessCaseCalculationsOptional() {
  return useContext(BusinessCaseCalculationsContext);
}

export function BusinessCaseWorkspaceProviders({
  workspaceValue,
  documentsValue,
  calculationsValue,
  children,
}) {
  return (
    <BusinessCaseWorkspaceContext.Provider value={workspaceValue}>
      <BusinessCaseDocumentsContext.Provider value={documentsValue}>
        <BusinessCaseCalculationsContext.Provider value={calculationsValue}>
          {children}
        </BusinessCaseCalculationsContext.Provider>
      </BusinessCaseDocumentsContext.Provider>
    </BusinessCaseWorkspaceContext.Provider>
  );
}
