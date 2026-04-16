import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/higiene";

export function useListEvaluations(params = {}) {
  return useQuery({
    queryKey: ["ca0112", "evaluations", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/evaluations", { params });
      return data.data || [];
    }
  });
}

export function useCreateEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/evaluations", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0112"] }); }
  });
}

export function useListPracticeVerifications(params = {}) {
  return useQuery({
    queryKey: ["ca0112", "practices", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/practices", { params });
      return data.data || [];
    }
  });
}

export function useCreatePracticeVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/practices", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0112"] }); }
  });
}

export function useListNonCompliances(params = {}) {
  return useQuery({
    queryKey: ["ca0112", "non-compliances", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/non-compliances", { params });
      return data.data || [];
    }
  });
}

export function useCreateNonCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/non-compliances", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0112"] }); }
  });
}

export function useListPpeChecks(params = {}) {
  return useQuery({
    queryKey: ["ca0112", "ppe-checks", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/ppe-checks", { params });
      return data.data || [];
    }
  });
}

export function useCreatePpeCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/ppe-checks", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0112"] }); }
  });
}

export function useListTrainings(params = {}) {
  return useQuery({
    queryKey: ["ca0112", "trainings", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/trainings", { params });
      return data.data || [];
    }
  });
}

export function useCreateTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/trainings", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0112"] }); }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.put(ENDPOINT + "/workflows/transition", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0112"] }); }
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0112", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/metrics");
      return data.data;
    }
  });
}