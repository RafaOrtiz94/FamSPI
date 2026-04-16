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
    refetchInterval: 60000, // Auto refresco cada 60s panel predictivo
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
