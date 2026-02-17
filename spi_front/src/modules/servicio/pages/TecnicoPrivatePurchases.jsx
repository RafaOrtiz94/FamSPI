import React from 'react';
import { Navigate } from "react-router-dom";

const TecnicoPrivatePurchases = () => (
  <Navigate to="/dashboard/servicio-tecnico/workspace-procedimiento?tab=private" replace />
);

export default TecnicoPrivatePurchases;
