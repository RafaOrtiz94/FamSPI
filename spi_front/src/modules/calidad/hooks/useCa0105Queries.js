import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../../config/api";

const ENDPOINT = "/api/v1/calidad/documentos";

export function useListFolders(params = {}) {
  return useQuery({
    queryKey: ["ca0105", "folders", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/folders", { params });
      return data.data || [];
    },
  });
}

export function useGetFolder(id) {
  return useQuery({
    queryKey: ["ca0105", "folders", id],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + `/folders/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(ENDPOINT + "/folders", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "folders"] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.put(ENDPOINT + `/folders/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "folders"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(ENDPOINT + `/folders/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "folders"] });
    },
  });
}

export function useListDocuments(params = {}) {
  return useQuery({
    queryKey: ["ca0105", "documents", params],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/documents", { params });
      return data.data || [];
    },
  });
}

export function useGetDocument(id) {
  return useQuery({
    queryKey: ["ca0105", "documents", id],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + `/documents/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(ENDPOINT + "/documents", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "documents"] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.put(ENDPOINT + `/documents/${id}`, payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "documents"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(ENDPOINT + `/documents/${id}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "documents"] });
    },
  });
}

export function useListDocumentVersions(documentId) {
  return useQuery({
    queryKey: ["ca0105", "versions", documentId],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/versions", { params: { documentId } });
      return data.data || [];
    },
    enabled: !!documentId,
  });
}

export function useCreateDocumentVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(ENDPOINT + "/versions", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "versions"] });
    },
  });
}

export function useListDocumentPermissions(documentId) {
  return useQuery({
    queryKey: ["ca0105", "permissions", documentId],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINT + "/permissions", { params: { documentId } });
      return data.data || [];
    },
    enabled: !!documentId,
  });
}

export function useCreateDocumentPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(ENDPOINT + "/permissions", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105", "permissions"] });
    },
  });
}

export function useTransitionWorkflowRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put(ENDPOINT + "/workflows/transition", payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ca0105"] });
    },
  });
}

export function useValidateTransition() {
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post(ENDPOINT + "/validate-transition", payload);
      return data.data;
    },
  });
}