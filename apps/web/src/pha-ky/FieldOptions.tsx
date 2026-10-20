import { Chip } from '../ui/Chip';
import { Collapsible } from '../ui/Collapsible';
import { ALL_NARRATIVE_FIELDS, NARRATIVE_FIELDS, type NarrativeField } from './narrative';

/** Chọn những nhóm nội dung hiện trong tóm tắt từng Người (web và PDF). */
export const FieldOptions = ({ fields, onChange }: { fields: ReadonlySet<NarrativeField>; onChange: (fields: Set<NarrativeField>) => void }) => {
  const toggle = (id: NarrativeField) => {
    const next = new Set(fields);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  // Gập sẵn: 14 chip chiếm cả màn hình điện thoại trước khi tới nội dung Phả ký; dòng tiêu đề vẫn cho biết đang bật mấy mục.
  return (
    <div className="mt-4">
      <Collapsible title={`Hiển thị trong tóm tắt từng người · ${fields.size}/${NARRATIVE_FIELDS.length} mục`}>
        <div className="flex flex-wrap gap-2">
          {NARRATIVE_FIELDS.map(({ id, label }) => {
            const on = fields.has(id);
            return (
              <Chip key={id} on={on} onClick={() => toggle(id)}>
                {label}
              </Chip>
            );
          })}
        </div>
        <div className="flex gap-4 text-sm">
          <button type="button" className="min-h-11 text-son underline" onClick={() => onChange(new Set(ALL_NARRATIVE_FIELDS))}>
            Chọn tất cả
          </button>
          <button type="button" className="min-h-11 text-son underline" onClick={() => onChange(new Set())}>
            Bỏ hết
          </button>
        </div>
      </Collapsible>
    </div>
  );
};
