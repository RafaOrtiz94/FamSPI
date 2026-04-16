import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/riesgos";

export function useListFmea(params = {}) {
  return useQuery({
    queryKey: ["ca0110", "fmea", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/fmea", { params });
      return data.data || [];
    }
  });
}

export function useCreateFmea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/fmea", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0110"] }); }
  });
}

export function useListMitigation(params = {}) {
  return useQuery({
    queryKey: ["ca0110", "mitigation", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/mitigation", { params });
      return data.data || [];
    }
  });
}

export function useCreateMitigation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/mitigation", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0110"] }); }
  });
}

export function useListReviews(params = {}) {
  return useQuery({
    queryKey: ["ca0110", "reviews", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/reviews", { params });
      return data.data || [];
    }
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/reviews", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0110"] }); }
  });
}

export function useListImpactAssessment(params = {}) {
  return useQuery({
    queryKey: ["ca0110", "impact", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/impact", { params });
      return data.data || [];
    }
  });
}

export function useCreateImpactAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/impact", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0110"] }); }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.put(ENDPOINT + "/workflows/transition", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0110"] }); }
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0110", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/metrics");
      return data.data;
    }
  });
}