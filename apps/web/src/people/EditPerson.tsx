import { useState } from 'react';
import { useUpdatePerson } from '../data/tree-queries';
import type { Person } from '../data/trees';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { diffPersonFields } from './person-conflict';
import { personToFormValues, type PersonFields } from './person-form';
import { PersonForm } from './PersonForm';

type Conflict = { fields: PersonFields; current: Person };

/**
 * Sửa hồ sơ một Người với kiểm tra xung đột: version được chụp lúc mở form, nên dữ liệu tải lại
 * ngầm trong lúc đang sửa không làm mất dấu "bản mình đã đọc".
 */
export const EditPerson = ({ treeId, person, onDone }: { treeId: string; person: Person; onDone: () => void }) => {
  const update = useUpdatePerson(treeId);
  const [baseVersion] = useState(person.version);
  const [initial] = useState(() => personToFormValues(person));
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const save = (fields: PersonFields, version: number) =>
    update.mutate(
      { personId: person.id, fields, version },
      {
        onSuccess: (result) => {
          if (result.status === 'saved') onDone();
          else setConflict({ fields, current: result.current });
        },
      },
    );

  if (conflict) {
    const differences = diffPersonFields(conflict.fields, conflict.current);
    return (
      <div className="space-y-4">
        <p role="alert" className="rounded-xl bg-kim/10 px-4 py-3">
          <strong>Đã có người sửa trước bạn.</strong> Trong lúc bạn đang sửa, một Biên tập viên khác đã lưu hồ sơ này.
          {differences.length === 0 ? ' Hai bản giống nhau, không có gì bị mất.' : ' Các chỗ khác nhau:'}
        </p>
        {differences.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line text-sm text-ink-muted">
                  <th className="py-2 pr-3 font-medium">Mục</th>
                  <th className="py-2 pr-3 font-medium">Bản của bạn</th>
                  <th className="py-2 font-medium">Bản mới nhất</th>
                </tr>
              </thead>
              <tbody>
                {differences.map((row) => (
                  <tr key={row.label} className="border-b border-line align-top">
                    <th scope="row" className="py-2 pr-3 font-medium">
                      {row.label}
                    </th>
                    <td className="py-2 pr-3 whitespace-pre-wrap">{row.mine}</td>
                    <td className="py-2 whitespace-pre-wrap">{row.theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {update.isError && <ErrorBanner>{update.error.message}</ErrorBanner>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onDone}>
            Lấy bản mới nhất
          </Button>
          <Button disabled={update.isPending} onClick={() => save(conflict.fields, conflict.current.version)}>
            {update.isPending ? 'Đang lưu…' : 'Giữ bản của tôi'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PersonForm
      initial={initial}
      submitLabel="Lưu thay đổi"
      busy={update.isPending}
      serverError={update.error?.message ?? null}
      onCancel={onDone}
      onSubmit={(fields) => save(fields, baseVersion)}
    />
  );
};
