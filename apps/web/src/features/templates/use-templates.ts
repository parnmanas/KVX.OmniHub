import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { equipmentsKeys } from "@/features/equipments/use-equipments";
import { omnihubsKeys } from "@/features/omnihubs/use-omnihubs";
import { storesKeys } from "@/features/stores/use-stores";
import type {
  CreateTemplateFunctionInput,
  CreateTemplateInput,
  EquipmentTemplate,
  InstantiateInput,
  TemplateFunction,
  UpdateTemplateFunctionInput,
  UpdateTemplateInput,
} from "./types";

export const templatesKeys = {
  all: ["templates"] as const,
  detail: (id: string) => ["templates", id] as const,
};

// ---------- templates ----------

export function useTemplates() {
  return useQuery({
    queryKey: templatesKeys.all,
    queryFn: async () => {
      const { data } = await api.get<EquipmentTemplate[]>("/templates");
      return data;
    },
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: id ? templatesKeys.detail(id) : ["templates", "none"],
    queryFn: async () => {
      const { data } = await api.get<EquipmentTemplate>(`/templates/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const { data } = await api.post<EquipmentTemplate>("/templates", input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templatesKeys.all }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; input: UpdateTemplateInput }) => {
      const { data } = await api.patch<EquipmentTemplate>(
        `/templates/${vars.id}`,
        vars.input,
      );
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: templatesKeys.all });
      qc.invalidateQueries({ queryKey: templatesKeys.detail(data.id) });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/templates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: templatesKeys.all }),
  });
}

// ---------- template functions ----------

export function useCreateTemplateFunction(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTemplateFunctionInput) => {
      const { data } = await api.post<TemplateFunction>(
        `/templates/${templateId}/functions`,
        input,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKeys.detail(templateId) });
    },
  });
}

export function useUpdateTemplateFunction(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      input: UpdateTemplateFunctionInput;
    }) => {
      const { data } = await api.patch<TemplateFunction>(
        `/template-functions/${vars.id}`,
        vars.input,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKeys.detail(templateId) });
    },
  });
}

export function useDeleteTemplateFunction(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/template-functions/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKeys.detail(templateId) });
    },
  });
}

export function useRecordTemplateFunction(templateId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      id: string;
      omnihubId: string;
      timeoutMs?: number;
    }) => {
      const { data } = await api.post<TemplateFunction>(
        `/template-functions/${vars.id}/record`,
        { omnihubId: vars.omnihubId, timeoutMs: vars.timeoutMs },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templatesKeys.detail(templateId) });
      qc.invalidateQueries({ queryKey: templatesKeys.all });
    },
  });
}

// ---------- instantiate ----------

export function useInstantiateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { templateId: string; input: InstantiateInput }) => {
      const { data } = await api.post(
        `/templates/${vars.templateId}/instantiate`,
        vars.input,
      );
      return data;
    },
    onSuccess: (data: { storeId: string }) => {
      qc.invalidateQueries({ queryKey: equipmentsKeys.byStore(data.storeId) });
      qc.invalidateQueries({ queryKey: storesKeys.detail(data.storeId) });
      qc.invalidateQueries({ queryKey: omnihubsKeys.all });
    },
  });
}
