import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/auditorias";

export function useListAudits(params = {}) {
  return useQuery({
    queryKey: ["ca0115", "audits", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/audits`, { params });
      return data.data || [];
    },
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/audits`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0115"] });
    },
  });
}

export function useListFindings(params = {}) {
  return useQuery({
    queryKey: ["ca0115", "findings", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/findings`, { params });
      return data.data || [];
    },
  });
}

export function useCreateFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/findings`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0115"] });
    },
  });
}

export function useListChecklists(params = {}) {
  return useQuery({
    queryKey: ["ca0115", "checklists", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/checklists`, { params });
      return data.data || [];
    },
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put(`${ENDPOINT}/workflows/transition`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0115"] });
    },
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0115", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/metrics`);
      return data.data;
    },
  });
}
