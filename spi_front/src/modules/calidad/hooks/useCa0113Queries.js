import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/comunicaciones";

export function useListCommunications(params = {}) {
  return useQuery({
    queryKey: ["ca0113", "communications", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/communications", { params });
      return data.data || [];
    }
  });
}

export function useCreateCommunication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/communications", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0113"] }); }
  });
}

export function useListRecipients(params = {}) {
  return useQuery({
    queryKey: ["ca0113", "recipients", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/recipients", { params });
      return data.data || [];
    }
  });
}

export function useCreateRecipient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/recipients", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0113"] }); }
  });
}

export function useListAttachments(params = {}) {
  return useQuery({
    queryKey: ["ca0113", "attachments", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/attachments", { params });
      return data.data || [];
    }
  });
}

export function useCreateAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/attachments", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0113"] }); }
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/read", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0113"] }); }
  });
}

export function useListReadLogs(params = {}) {
  return useQuery({
    queryKey: ["ca0113", "read-logs", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/read-logs", { params });
      return data.data || [];
    }
  });
}

export function useListTemplates(params = {}) {
  return useQuery({
    queryKey: ["ca0113", "templates", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/templates", { params });
      return data.data || [];
    }
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.post(ENDPOINT + "/templates", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0113"] }); }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p) => {
      const { data } = await api.put(ENDPOINT + "/workflows/transition", p);
      return data.data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0113"] }); }
  });
}

export function useGetMetrics() {
  return useQuery({
    queryKey: ["ca0113", "metrics"],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/metrics");
      return data.data;
    }
  });
}