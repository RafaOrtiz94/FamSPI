import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../core/api";

const CA0103_KEYS = {
  snapshots: ["ca0103", "snapshots"],
  transitions: ["ca0103", "transitions"],
};

export const useGetWorkflowSnapshot = ({ flowName, record } = {}) =>
  useQuery({
    queryKey: [...CA0103_KEYS.snapshots, flowName, record?.id || record?.status || "empty"],
    queryFn: async () => {
      const { data } = await api.post("/calidad/buenas-practicas/snapshots", {
        flowName,
        record,
      });
      return data.data;
    },
    enabled: Boolean(flowName && record),
  });

export const useValidateTransition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ flowName, record, toStatus, notes }) => {
      const { data } = await api.post("/calidad/buenas-practicas/validate-transition", {
        flowName,
        record,
        toStatus,
        notes,
      });
      return data.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CA0103_KEYS.snapshots }),
  });
};

export const useTransitionWorkflowRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ flowName, record, toStatus, notes }) => {
      const { data } = await api.put("/calidad/buenas-practicas/workflows/transition", {
        flowName,
        record,
        toStatus,
        notes,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CA0103_KEYS.snapshots });
      queryClient.invalidateQueries({ queryKey: CA0103_KEYS.transitions });
    },
  });
};
