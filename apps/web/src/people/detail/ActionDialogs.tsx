import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAddChild, useAddParent, useAddSpouse, useUpdateParentLinkKind } from '../../data/tree-queries';
import type { Person } from '../../data/trees';
import type { FamilyGraph, ParentLinkKind } from '../../family/family-graph';
import { LINK_KIND_LABELS } from '../../family/labels';
import { DeletePerson } from '../DeletePerson';
import { EditPerson } from '../EditPerson';
import { EMPTY_PERSON_FORM } from '../person-form';
import { PersonForm } from '../PersonForm';
import { Dialog } from '../../ui/Dialog';
import { Select } from '../../ui/fields';

export type Action = 'none' | 'edit' | 'add-child' | 'add-parent' | 'add-spouse' | 'delete';

export const ActionDialogs = ({
  treeId,
  graph,
  person,
  isOwner,
  spouses,
  action,
  onClose,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  isOwner: boolean;
  spouses: Person[];
  action: Action;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const addChild = useAddChild(treeId);
  const addParent = useAddParent(treeId);
  const addSpouse = useAddSpouse(treeId);
  // null = chưa chọn: mặc định là vợ/chồng thứ nhất *tại lúc mở form* (danh sách có thể vừa thay đổi).
  const [chosenOtherParent, setOtherParentId] = useState<string | null>(null);
  const otherParentId = chosenOtherParent ?? spouses[0]?.id ?? '';
  const [linkKind, setLinkKind] = useState<ParentLinkKind>('ruot');

  const existing = graph.persons.filter((other) => other.id !== person.id);

  const finish = () => {
    for (const mutation of [addChild, addParent, addSpouse]) mutation.reset();
    setOtherParentId(null);
    setLinkKind('ruot');
    onClose();
  };

  const titles: Record<Action, string> = {
    none: '',
    edit: `Sửa: ${person.full_name}`,
    'add-child': `Thêm con của ${person.full_name}`,
    'add-parent': `Thêm cha/mẹ của ${person.full_name}`,
    'add-spouse': `Thêm vợ/chồng của ${person.full_name}`,
    delete: 'Xoá Người',
  };

  const kindPicker = (
    <fieldset>
      <legend className="mb-1 font-medium">Quan hệ</legend>
      <div className="flex gap-2">
        {(['ruot', 'nuoi'] as const).map((kind) => (
          <label
            key={kind}
            className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
              linkKind === kind ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
            }`}
          >
            <input type="radio" className="sr-only" checked={linkKind === kind} onChange={() => setLinkKind(kind)} />
            {LINK_KIND_LABELS[kind]}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const otherParentPicker = spouses.length > 0 && (
    <label className="block">
      <span className="mb-1 block font-medium">{person.gender === 'nu' ? 'Cha của con' : 'Mẹ của con'}</span>
      <Select className="w-full" value={otherParentId} onChange={(event) => setOtherParentId(event.target.value)}>
        {spouses.map((spouse) => (
          <option key={spouse.id} value={spouse.id}>
            {spouse.full_name}
          </option>
        ))}
        <option value="">Không rõ / không ghi</option>
      </Select>
    </label>
  );

  return (
    <Dialog open={action !== 'none'} title={titles[action]} onClose={finish}>
      {action === 'edit' && <EditPerson treeId={treeId} person={person} graph={graph} onDone={finish} />}
      {action === 'delete' && (
        <DeletePerson
          treeId={treeId}
          graph={graph}
          person={person}
          isOwner={isOwner}
          onCancel={finish}
          onDeleted={() => (isOwner ? navigate(`/gia-pha/${treeId}`, { replace: true }) : finish())}
        />
      )}
      {action === 'add-child' && (
        <PersonForm
          initial={EMPTY_PERSON_FORM}
          existing={existing}
          graph={graph}
          extra={
            <>
              {otherParentPicker}
              {kindPicker}
            </>
          }
          submitLabel="Thêm con"
          busy={addChild.isPending}
          serverError={addChild.error?.message ?? null}
          onCancel={finish}
          onSubmit={(fields) =>
            addChild.mutate(
              { parentId: person.id, otherParentId: otherParentId || null, kind: linkKind, fields },
              { onSuccess: finish },
            )
          }
        />
      )}
      {action === 'add-parent' && (
        <PersonForm
          initial={EMPTY_PERSON_FORM}
          showBirthOrder={false}
          existing={existing}
          graph={graph}
          extra={kindPicker}
          submitLabel="Thêm"
          busy={addParent.isPending}
          serverError={addParent.error?.message ?? null}
          onCancel={finish}
          onSubmit={(fields) => addParent.mutate({ childId: person.id, kind: linkKind, fields }, { onSuccess: finish })}
        />
      )}
      {action === 'add-spouse' && (
        <PersonForm
          initial={{ ...EMPTY_PERSON_FORM, gender: person.gender === 'nam' ? 'nu' : person.gender === 'nu' ? 'nam' : '' }}
          showBirthOrder={false}
          existing={existing}
          graph={graph}
          submitLabel="Thêm"
          busy={addSpouse.isPending}
          serverError={addSpouse.error?.message ?? null}
          onCancel={finish}
          onSubmit={(fields) => addSpouse.mutate({ personId: person.id, order: null, fields }, { onSuccess: finish })}
        />
      )}
    </Dialog>
  );
};

export const LinkKindSelect = ({ treeId, childId, parentId, value }: { treeId: string; childId: string; parentId: string; value: ParentLinkKind }) => {
  const update = useUpdateParentLinkKind(treeId);
  return (
    <div>
      <Select
        aria-label="Loại quan hệ"
        className="min-h-11"
        value={value}
        disabled={update.isPending}
        onChange={(event) => update.mutate({ childId, parentId, kind: event.target.value === 'nuoi' ? 'nuoi' : 'ruot' })}
      >
        <option value="ruot">Ruột</option>
        <option value="nuoi">Nuôi</option>
      </Select>
      {update.isError && <p className="mt-1 text-sm text-danger">{update.error.message}</p>}
    </div>
  );
};
