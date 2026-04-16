import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/areas-calificadas";

export function useListAreas(params = {}) {
  return useQuery({
    queryKey: ["ca0114", "areas", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/areas", { params });
      return data.data || [];
    }
  });
}

export function useCreateArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/areas", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0114"] }); }
  });
}

export function useListQualificationParams(params = {}) {
  return useQuery({
    queryKey: ["ca0114", "params", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/params", { params });
      return data.data || [];
    }
  });
}

export function useCreateQualificationParam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/params", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0114"] }); }
  });
}

export function useListMonitoringResults(params = {}) {
  return useQuery({
    queryKey: ["ca0114", "monitoring", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/monitoring", { params });
      return data.data || [];
    }
  });
}

export function useCreateMonitoringResult() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/monitoring", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0114"] }); }
  });
}

export function useListDeviations(params = {}) {
  return useQuery({
    queryKey: ["ca0114", "deviations", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/deviations", { params });
      return data.data || [];
    }
  });
}

export function useCreateDeviation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/deviations", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0114"] }); }
  });
}

export function useListQualificationDocs(params = {}) {
  return useQuery({
    queryKey: ["ca0114", "docs", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/docs", { params });
      return data.data || [];
    }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.put(ENDPOINT + "/workflows/transition", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0114"] }); }
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0114", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/metrics");
      return data.data;
    }
  });
}