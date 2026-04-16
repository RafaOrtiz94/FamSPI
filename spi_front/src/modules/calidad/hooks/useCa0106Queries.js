import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/recall";

export function useListTraceability(params = {}) {
  return useQuery({ queryKey: ["ca0106", "traceability", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/traceability", { params });
    return data.data || [];
  }});
}

export function useCreateTraceability() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/traceability", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0106"] }); }
  });
}

export function useListCommunications(params = {}) {
  return useQuery({ queryKey: ["ca0106", "communications", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/communications", { params });
    return data.data || [];
  }});
}

export function useCreateCommunication() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/communications", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0106"] }); }
  });
}

export function useListQuarantine(params = {}) {
  return useQuery({ queryKey: ["ca0106", "quarantine", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/quarantine", { params });
    return data.data || [];
  }});
}

export function useCreateQuarantine() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/quarantine", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0106"] }); }
  });
}

export function useListLogistics(params = {}) {
  return useQuery({ queryKey: ["ca0106", "logistics", params], queryFn: async () => {
    const { data } = await api.get(ENDPOINT + "/logistics", { params });
    return data.data || [];
  }});
}

export function useCreateLogistics() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/logistics", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0106"] }); }
  });
}

export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.put(ENDPOINT + "/workflows/transition", p); return data.data; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0106"] }); }
  });
}