import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../core/api";

const CA0104_KEYS = {
  trapsMap: ["ca0104", "traps-map"],
  inspections: ["ca0104", "inspections"],
  vendorApi: ["ca0104", "vendor-api"],
  toxicity: ["ca0104", "toxicity"],
};

const buildParams = (pairs = {}) =>
  Object.fromEntries(Object.entries(pairs).filter(([, value]) => value !== undefined && value !== ""));

export const useGetTrapsMaps = ({ riskLevel, status } = {}) =>
  useQuery({
    queryKey: [...CA0104_KEYS.trapsMap, riskLevel || "", status || ""],
    queryFn: async () => {
      const { data } = await api.get("/calidad/pest-control/traps-map", {
        params: buildParams({ riskLevel, status }),
      });
      return data.data;
    },
    refetchInterval: 600000, // >5min: deja hueco para que Neon autosuspenda entre polls
  });

export const useGetInspections = ({ trapsMapId, status } = {}) =>
  useQuery({
    queryKey: [...CA0104_KEYS.inspections, trapsMapId || "", status || ""],
    queryFn: async () => {
      const { data } = await api.get("/calidad/pest-control/inspections", {
        params: buildParams({ trapsMapId, status }),
      });
      return data.data;
    },
    refetchInterval: 600000, // >5min: deja hueco para que Neon autosuspenda entre polls
  });

export const useGetVendorApis = ({ status } = {}) =>
  useQuery({
    queryKey: [...CA0104_KEYS.vendorApi, status || ""],
    queryFn: async () => {
      const { data } = await api.get("/calidad/pest-control/vendor-api", {
        params: buildParams({ status }),
      });
      return data.data;
    },
    refetchInterval: 600000, // >5min: deja hueco para que Neon autosuspenda entre polls
  });

export const useGetToxicity = ({ inspectionId, status } = {}) =>
  useQuery({
    queryKey: [...CA0104_KEYS.toxicity, inspectionId || "", status || ""],
    queryFn: async () => {
      const { data } = await api.get("/calidad/pest-control/toxicity", {
        params: buildParams({ inspectionId, status }),
      });
      return data.data;
    },
    refetchInterval: 600000, // >5min: deja hueco para que Neon autosuspenda entre polls
  });

export const useTransitionPestControlRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ flowName, recordId, toStatus, qaNotes }) => {
      const { data } = await api.put(`/calidad/pest-control/${flowName}/${recordId}`, {
        flowName,
        toStatus,
        qaNotes,
      });
      return data.data;
    },
    onSuccess: () => {
      Object.values(CA0104_KEYS).forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
};

export const useSoftDeletePestControlRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recordId, flowName }) => {
      const { data } = await api.delete(`/calidad/pest-control/${recordId}`, {
        data: { flowName },
      });
      return data.data;
    },
    onSuccess: () => {
      Object.values(CA0104_KEYS).forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
  });
};
