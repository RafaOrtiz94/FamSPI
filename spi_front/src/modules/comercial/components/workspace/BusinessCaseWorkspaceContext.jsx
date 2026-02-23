import { createContext, useContext } from 'react';

export const BusinessCaseWorkspaceContext = createContext(null);

export function useBusinessCaseWorkspace() {
  const ctx = useContext(BusinessCaseWorkspaceContext);
  if (!ctx) {
    throw new Error('useBusinessCaseWorkspace debe usarse dentro de BusinessCaseWorkspaceContext.Provider');
  }
  return ctx;
}

export function useBusinessCaseWorkspaceOptional() {
  return useContext(BusinessCaseWorkspaceContext);
}
