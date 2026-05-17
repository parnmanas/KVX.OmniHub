import type {
  ControlType,
  EquipmentType,
  FunctionPayload,
} from "@omnihub/shared";

export interface TemplateFunction {
  id: string;
  templateId: string;
  name: string;
  icon: string | null;
  controlType: ControlType;
  payload: FunctionPayload;
  order: number;
}

export interface EquipmentTemplate {
  id: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  name: string;
  isPublic: boolean;
  createdByStoreId: string | null;
  functions?: TemplateFunction[];
  createdAt: string;
}

export interface CreateTemplateInput {
  type: EquipmentType;
  manufacturer: string;
  model: string;
  name: string;
  isPublic?: boolean;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export interface CreateTemplateFunctionInput {
  name: string;
  icon?: string;
  controlType: ControlType;
  payload: FunctionPayload;
  order?: number;
}

export type UpdateTemplateFunctionInput = Partial<CreateTemplateFunctionInput>;

export interface InstantiateInput {
  storeId: string;
  name: string;
  omnihubId?: string;
}
