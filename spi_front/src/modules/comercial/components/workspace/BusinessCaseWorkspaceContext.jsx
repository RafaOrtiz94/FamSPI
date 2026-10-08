import { createContext, useContext, useEffect } from "react";

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

/**
 * Hook para secciones: si el workspace señala que esta sección debe abrirse
 * en modo edición (post-save de la sección anterior), activa el callback y
 * limpia la señal para que no se repita.
 *
 * @param {string} sectionId  — id de la sección (e.g. "lab", "requirement")
 * @param {fn}     onActivate — fn() que llama setIsEditing(true) en la sección
 */
/**
 * Hook para secciones: activa modo edición cada vez que esta sección es la
 * "activa" en el workspace (incluye remounts al volver de otra sección).
 * La señal NO se borra aquí — persiste hasta que el workspace la avance a la
 * siguiente sección tras el siguiente save+confirm.
 */
export function useAutoEditSection(sectionId, onActivate) {
  const ctx = useContext(BusinessCaseWorkspaceContext);
  useEffect(() => {
    if (!ctx) return;
    if (ctx.autoEditSection === sectionId) {
      onActivate?.();
    }
  }, [ctx?.autoEditSection, sectionId]); // eslint-disable-line react-hooks/exhaustive-deps
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
