import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  Equipment,
  EquipmentTemplate,
  TemplateFunction,
} from "../../entities";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateTemplateDto } from "./dto/create-template.dto";
import {
  CreateTemplateFunctionDto,
  InstantiateTemplateDto,
  RecordTemplateFunctionDto,
  UpdateTemplateFunctionDto,
} from "./dto/template-function.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { TemplatesService } from "./templates.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  // ---------- templates ----------

  @Get("templates")
  list(): Promise<EquipmentTemplate[]> {
    return this.service.list();
  }

  @Get("templates/:id")
  get(@Param("id", ParseUUIDPipe) id: string): Promise<EquipmentTemplate> {
    return this.service.get(id);
  }

  @Post("templates")
  create(@Body() dto: CreateTemplateDto): Promise<EquipmentTemplate> {
    return this.service.create(dto);
  }

  @Patch("templates/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ): Promise<EquipmentTemplate> {
    return this.service.update(id, dto);
  }

  @Delete("templates/:id")
  @HttpCode(204)
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  // ---------- template functions (nested) ----------

  @Get("templates/:id/functions")
  listFunctions(
    @Param("id", ParseUUIDPipe) templateId: string,
  ): Promise<TemplateFunction[]> {
    return this.service.listFunctions(templateId);
  }

  @Post("templates/:id/functions")
  createFunction(
    @Param("id", ParseUUIDPipe) templateId: string,
    @Body() dto: CreateTemplateFunctionDto,
  ): Promise<TemplateFunction> {
    return this.service.createFunction(templateId, dto);
  }

  @Patch("template-functions/:id")
  updateFunction(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateFunctionDto,
  ): Promise<TemplateFunction> {
    return this.service.updateFunction(id, dto);
  }

  @Delete("template-functions/:id")
  @HttpCode(204)
  removeFunction(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.removeFunction(id);
  }

  @Post("template-functions/:id/record")
  recordFunction(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RecordTemplateFunctionDto,
  ): Promise<TemplateFunction> {
    return this.service.recordFunction(id, dto.omnihubId, dto.timeoutMs);
  }

  // ---------- instantiate (Template → Equipment) ----------

  @Post("templates/:id/instantiate")
  instantiate(
    @Param("id", ParseUUIDPipe) templateId: string,
    @Body() dto: InstantiateTemplateDto,
  ): Promise<Equipment> {
    return this.service.instantiate(templateId, dto);
  }
}
