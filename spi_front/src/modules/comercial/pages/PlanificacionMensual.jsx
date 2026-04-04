import React from "react";
import useSchedules from "../hooks/useSchedules";
import ScheduleWorkspace from "../components/schedules/ScheduleWorkspace";

const PlanificacionMensual = () => {
  const scheduleState = useSchedules({ skipLoad: false });
  return <ScheduleWorkspace {...scheduleState} />;
};

export default PlanificacionMensual;

