import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/refrigerados";

export function useListPowerOutage(params = {}) {
  return useQuery({ queryKey: ["ca0108", "power-outage", params], queryFn: async () => { const { data } = await api.get(ENDPOINT + "/power-outage", { params }); return data.data || []; }});
}
export function useCreatePowerOutage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/power-outage", p); return data.data; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0108"] }); }
  });
}
export function useListDryIceCalc(params = {}) {
  return useQuery({ queryKey: ["ca0108", "dry-ice", params], queryFn: async () => { const { data } = await api.get(ENDPOINT + "/dry-ice", { params }); return data.data || []; }});
}
export function useCreateDryIceCalc() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/dry-ice", p); return data.data; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0108"] }); }
  });
}
export function useListTransfer(params = {}) {
  return useQuery({ queryKey: ["ca0108", "transfer", params], queryFn: async () => { const { data } = await api.get(ENDPOINT + "/transfer", { params }); return data.data || []; }});
}
export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/transfer", p); return data.data; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0108"] }); }
  });
}
export function useListValidation(params = {}) {
  return useQuery({ queryKey: ["ca0108", "validation", params], queryFn: async () => { const { data } = await api.get(ENDPOINT + "/validation", { params }); return data.data || []; }});
}
export function useCreateValidation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.post(ENDPOINT + "/validation", p); return data.data; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0108"] }); }
  });
}
export function useTransitionWorkflowRecord() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (p) => { const { data } = await api.put(ENDPOINT + "/workflows/transition", p); return data.data; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["ca0108"] }); }
  });
}