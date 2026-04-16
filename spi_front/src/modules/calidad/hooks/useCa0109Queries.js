import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/capa";

export function useListRca(params = {}) {
  return useQuery({
    queryKey: ["ca0109", "rca", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/rca`, { params });
      return data.data || [];
    },
  });
}

export function useCreateRca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/rca`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0109"] });
    },
  });
}

export function useListActionPlan(params = {}) {
  return useQuery({
    queryKey: ["ca0109", "action-plan", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/action-plan`, { params });
      return data.data || [];
    },
  });
}

export function useCreateActionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/action-plan`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0109"] });
    },
  });
}

export function useListEscalation(params = {}) {
  return useQuery({
    queryKey: ["ca0109", "escalation", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/escalation`, { params });
      return data.data || [];
    },
  });
}

export function useCreateEscalation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/escalation`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0109"] });
    },
  });
}

export function useListEffectiveness(params = {}) {
  return useQuery({
    queryKey: ["ca0109", "effectiveness", params],
    queryFn: async () => {
      const { data } = await api.get(`${ENDPOINT}/effectiveness`, { params });
      return data.data || [];
    },
  });
}

export function useCreateEffectiveness() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(`${ENDPOINT}/effectiveness`, payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca0109"] });
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
      qc.invalidateQueries({ queryKey: ["ca0109"] });
    },
  });
}
