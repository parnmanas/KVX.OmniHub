import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { EquipmentType } from "@omnihub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  useCreateTemplate,
  useDeleteTemplate,
  useTemplates,
} from "@/features/templates/use-templates";

const TYPE_LABELS: Record<string, string> = {
  AC: "에어컨",
  PROJECTOR: "프로젝터",
  TV: "TV",
  LIGHT: "조명",
  DOOR_LOCK: "도어락",
  PC: "컴퓨터",
  OTHER: "기타",
};

export default function TemplatesPage() {
  const templates = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">장비 관리</h1>
          <p className="text-sm text-muted-foreground">
            제조사/모델 단위로 장비 템플릿을 정의합니다. 매장에 장비를 추가할 때 여기서 고른 템플릿이 사용돼요.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>+ 템플릿 추가</Button>
      </div>

      {templates.isLoading && (
        <p className="text-sm text-muted-foreground">로딩 중…</p>
      )}

      {templates.data && templates.data.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          아직 등록된 템플릿이 없어요. 첫 템플릿을 추가해보세요.
        </Card>
      )}

      {templates.data && templates.data.length > 0 && (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">종류</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">제조사 · 모델</th>
                <th className="px-4 py-3">기능 수</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.data.map((tpl) => (
                <tr
                  key={tpl.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                      {TYPE_LABELS[tpl.type] ?? tpl.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to={`/templates/${tpl.id}`}
                      className="hover:underline"
                    >
                      {tpl.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tpl.manufacturer} · {tpl.model}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tpl.functions?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/templates/${tpl.id}`}>
                        <Button variant="outline" size="sm">
                          편집
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              `템플릿 "${tpl.name}" 을 삭제할까요? 이미 매장에 등록된 장비는 영향받지 않아요.`,
                            )
                          ) {
                            deleteTemplate.mutate(tpl.id);
                          }
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateTemplateModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
      />
    </div>
  );
}

function CreateTemplateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const createTemplate = useCreateTemplate();
  const [type, setType] = useState<string>(EquipmentType.AC);
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [name, setName] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await createTemplate.mutateAsync({
      type: type as EquipmentType,
      manufacturer,
      model,
      name,
    });
    setManufacturer("");
    setModel("");
    setName("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="장비 템플릿 추가"
      description="제조사/모델 단위로 한 번만 등록하면 여러 매장에서 재사용할 수 있어요."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>종류</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {Object.values(EquipmentType).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>표시 이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: LG 휘센 인버터"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>제조사</Label>
            <Input
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="예: LG"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>모델</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="예: S-Q07"
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={createTemplate.isPending}>
            {createTemplate.isPending ? "저장 중…" : "추가"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
