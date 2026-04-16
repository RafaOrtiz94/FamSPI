import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/incidentes";

export function useListIncidents(params = {}) {
  return useQuery({
    queryKey: ["ca0111", "incidents", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/incidents", { params });
      return data.data || [];
    }
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/incidents", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0111"] }); }
  });
}

export function useListContainmentActions(params = {}) {
  return useQuery({
    queryKey: ["ca0111", "containment", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/containment", { params });
      return data.data || [];
    }
  });
}

export function useCreateContainmentAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/containment", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0111"] }); }
  });
}

export function useListHazardousMaterials(params = {}) {
  return useQuery({
    queryKey: ["ca0111", "hazardous", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/hazardous", { params });
      return data.data || [];
    }
  });
}

export function useCreateHazardousMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/hazardous", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0111"] }); }
  });
}

export function useListAffected(params = {}) {
  return useQuery({
    queryKey: ["ca0111", "affected", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/affected", { params });
      return data.data || [];
    }
  });
}

export function useCreateAffected() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/affected", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0111"] }); }
  });
}

export function useListCleanupActions(params = {}) {
  return useQuery({
    queryKey: ["ca0111", "cleanup", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/cleanup", { params });
      return data.data || [];
    }
  });
}

export function useCreateCleanupAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/cleanup", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0111"] }); }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.put(ENDPOINT + "/workflows/transition", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0111"] }); }
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0111", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/metrics");
      return data.data;
    }
  });
}