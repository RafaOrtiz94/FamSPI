import React, { createContext, useCallback, useContext, useState } from 'react';

const ExpedienteContext = createContext(null);

export const ExpedienteProvider = ({ children }) => {
  const [expediente, setExpediente] = useState(null);

  const openExpediente = useCallback((id, type) => {
    if (!id || !type) return;
    setExpediente({ id, type });
  }, []);

  const closeExpediente = useCallback(() => {
    setExpediente(null);
  }, []);

  return (
    <ExpedienteContext.Provider value={{ expediente, openExpediente, closeExpediente }}>
      {children}
    </ExpedienteContext.Provider>
  );
};

export const useExpediente = () => {
  const ctx = useContext(ExpedienteContext);
  if (!ctx) throw new Error('useExpediente must be used inside <ExpedienteProvider>');
  return ctx;
};
