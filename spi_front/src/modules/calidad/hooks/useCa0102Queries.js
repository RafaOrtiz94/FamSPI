import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../core/api";

const CA0102_KEYS = {
  areas: ["ca0102", "areas"],
  logs: ["ca0102", "logs"],
};

export const useGetAreas = ({ riskLevel } = {}) =>
  useQuery({
    queryKey: [...CA0102_KEYS.areas, riskLevel],
    queryFn: async () => {
      const params = riskLevel ? { riskLevel } : {};
      const { data } = await api.get("/calidad/cleaning/areas", { params });
      return data.data;
    },
  });

export const useCreateArea = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/calidad/cleaning/areas", payload);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CA0102_KEYS.areas }),
  });
};

export const useGetActiveLogs = () =>
  useQuery({
    queryKey: CA0102_KEYS.logs,
    queryFn: async () => {
      const { data } = await api.get("/calidad/cleaning/logs");
      return data.data;
    },
    refetchInterval: 60000,
  });

export const useRegisterCleaning = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/calidad/cleaning/logs", payload);
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CA0102_KEYS.logs }),
  });
};

export const useTransitionLog = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ logId, toStatus, qaNotes }) => {
      const { data } = await api.put(`/calidad/cleaning/logs/${logId}`, { toStatus, qaNotes });
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CA0102_KEYS.logs }),
  });
};
