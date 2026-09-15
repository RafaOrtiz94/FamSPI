import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../core/api";

const CA0101_KEYS = {
  alarms: ["ca0101", "alarms"],
};

export const useGetActiveAlarms = () => {
  return useQuery({
    queryKey: CA0101_KEYS.alarms,
    queryFn: async () => {
      const { data } = await api.get("/calidad/temperature/alarms");
      return data.data; // Formato estandar {ok: true, data: [...]}
    },
    // ponytail: modulo Calidad sin uso real en produccion todavia (desarrollo
    // pausado) -> 10min en vez de 60s, y por encima del timeout de autosuspend
    // de Neon (~5min) para no gastar compute en un panel que nadie mira.
    // Techo: bajar a 30-60s cuando el modulo entre en uso real, porque una
    // alarma de temperatura si es seguridad-critica.
    refetchInterval: 600000,
  });
};

export const useTransitionAlarm = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ alarmId, toStatus, notes }) => {
      const { data } = await api.put(`/calidad/temperature/alarms/${alarmId}`, {
        toStatus,
        notes,
      });
      return data.data;
    },
    onSuccess: () => {
      // Invalida panel para repintado
      queryClient.invalidateQueries({ queryKey: CA0101_KEYS.alarms });
    },
  });
};

export const useRegisterReading = () => {
   const queryClient = useQueryClient();
   return useMutation({
     mutationFn: async (payload) => {
       const { data } = await api.post("/calidad/temperature/readings", payload);
       return data.data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: CA0101_KEYS.alarms });
     }
   })
}
