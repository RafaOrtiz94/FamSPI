import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/quejas";

export function useListIntake(params = {}) {
  return useQuery({ queryKey: ["ca0107", "intake", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/intake", { params });
    return data.data || [];
  }});
}

export function useCreateIntake() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/intake", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0107"] }); }
  });
}

export function useListInvestigation(params = {}) {
  return useQuery({ queryKey: ["ca0107", "investigation", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/investigation", { params });
    return data.data || [];
  }});
}

export function useCreateInvestigation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/investigation", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0107"] }); }
  });
}

export function useListRefunds(params = {}) {
  return useQuery({ queryKey: ["ca0107", "refunds", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/refunds", { params });
    return data.data || [];
  }});
}

export function useCreateRefund() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/refunds", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0107"] }); }
  });
}

export function useListCapaLink(params = {}) {
  return useQuery({ queryKey: ["ca0107", "capa-link", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/capa-link", { params });
    return data.data || [];
  }});
}

export function useCreateCapaLink() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/capa-link", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0107"] }); }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.put(ENDPOINT + "/workflows/transition", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0107"] }); }
  });
}