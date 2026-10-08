import React from "react";
import { useAuth } from "../../../core/auth/useAuth";
import useSchedules from "../hooks/useSchedules";
import ScheduleWorkspace from "../components/schedules/ScheduleWorkspace";
import AprobacionCronogramas from "./AprobacionCronogramas";

const PlanificacionMensual = () => {
  const { user } = useAuth();
  const scheduleState = useSchedules({ skipLoad: user?.role === "jefe_comercial" });
  if (user?.role === "jefe_comercial") return <AprobacionCronogramas />;
  return <ScheduleWorkspace {...scheduleState} />;
};

export default PlanificacionMensual;

