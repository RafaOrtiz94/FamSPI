import React from "react";
import PersonnelWorkspace from "./PersonnelWorkspace";
import Usuarios from "./Usuarios";
import Departamentos from "./Departamentos";

const ColaboradoresHub = ({ initialTab = "solicitudes" }) => {
  if (initialTab === "usuarios") {
    return <Usuarios />;
  }

  if (initialTab === "departamentos") {
    return <Departamentos />;
  }

  return <PersonnelWorkspace initialView={initialTab} />;
};

export default ColaboradoresHub;
