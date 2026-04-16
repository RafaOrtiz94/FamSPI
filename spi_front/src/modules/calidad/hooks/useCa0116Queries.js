import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/muestreo";

export function useListBatches(params = {}) {
  return useQuery({
    queryKey: ["ca0116", "batches", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/batches`, { params });
      return data.data || [];
    },
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/batches`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0116"] });
    },
  });
}

export function useTransitionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put(`${ENDPOINT}/transition`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0116"] });
    },
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0116", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/metrics`);
      return data.data;
    },
  });
}
