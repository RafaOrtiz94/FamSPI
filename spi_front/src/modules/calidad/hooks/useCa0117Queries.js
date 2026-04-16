import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/tecnovigilancia";

export function useListReports(params = {}) {
  return useQuery({
    queryKey: ["ca0117", "reports", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/reports`, { params });
      return data.data || [];
    },
  });
}

export function useCreateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/reports`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0117"] });
    },
  });
}

export function useTransitionReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put(`${ENDPOINT}/transition`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0117"] });
    },
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0117", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/metrics`);
      return data.data;
    },
  });
}
