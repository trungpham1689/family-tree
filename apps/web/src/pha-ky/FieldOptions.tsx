import { Chip } from '../ui/Chip';
import { ALL_NARRATIVE_FIELDS, NARRATIVE_FIELDS, type NarrativeField } from './narrative';

/** Chọn những nhóm nội dung hiện trong tóm tắt từng Người (web và PDF). */
export const FieldOptions = ({ fields, onChange }: { fields: ReadonlySet<NarrativeField>; onChange: (fields: Set<NarrativeField>) => void }) => {
  const toggle = (id: NarrativeField) => {
    const next = new Set(fields);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <fieldset className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <legend className="px-1 text-sm font-bold uppercase tracking-wider text-ink-muted">Hiển thị trong tóm tắt từng người</legend>
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
      <div className="mt-3 flex gap-4 text-sm">
        <button type="button" className="min-h-9 text-son underline" onClick={() => onChange(new Set(ALL_NARRATIVE_FIELDS))}>
          Chọn tất cả
        </button>
        <button type="button" className="min-h-9 text-son underline" onClick={() => onChange(new Set())}>
          Bỏ hết
        </button>
      </div>
    </fieldset>
  );
};
