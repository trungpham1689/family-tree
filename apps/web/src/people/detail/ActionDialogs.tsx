import { useState } from 'react';
import { useAddChild, useAddParent, useAddSpouse, useLinkCoParent, useUpdateParentLinkKind } from '../../data/tree-queries';
import type { Person } from '../../data/trees';
import type { FamilyGraph, ParentLinkKind, SpouseRelative } from '../../family/family-graph';
import { LINK_KIND_LABELS, spouseLabel } from '../../family/labels';
import { DeletePerson } from '../DeletePerson';
import { EditPerson } from '../EditPerson';
import { EMPTY_PERSON_FORM, type PersonFields } from '../person-form';
import { PersonForm } from '../PersonForm';
import { childrenWithoutCoParent, coParentWord } from '../../family/co-parent';
import { Button } from '../../ui/Button';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { Dialog } from '../../ui/Dialog';
import { ErrorBanner, Select } from '../../ui/fields';

const NO_CO_PARENT = 'none';

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
  spouses: SpouseRelative<Person>[];
  action: Action;
  onClose: () => void;
}) => {
  const addChild = useAddChild(treeId);
  const addParent = useAddParent(treeId);
  const addSpouse = useAddSpouse(treeId);
  const linkCoParent = useLinkCoParent(treeId);
  // null = chưa chọn: có đúng một vợ/chồng thì mặc định là người đó; từ hai vợ/chồng trở lên thì PHẢI chọn (không tự lấy người đầu, dễ ghi nhầm).
  // NO_CO_PARENT = chủ động chọn "không rõ".
  const [chosenOtherParent, setOtherParentId] = useState<string | null>(null);
  const mustChoose = spouses.length >= 2;
  const otherParentId = chosenOtherParent ?? (mustChoose ? '' : (spouses[0]?.person.id ?? NO_CO_PARENT));
  const [otherParentMissing, setOtherParentMissing] = useState(false);
  // Sau khi thêm vợ/chồng cho người đã có con chưa rõ cha/mẹ còn lại: hỏi có ghi người mới là cha/mẹ của các con đó không.
  const [followUp, setFollowUp] = useState<{ spouseId: string; name: string; checked: Set<string> } | null>(null);
  const orphans = childrenWithoutCoParent(graph, person.id);
  const [linkKind, setLinkKind] = useState<ParentLinkKind>('ruot');
  // Thêm con liên tiếp: form được dựng lại (key đổi) cho người kế, giữ nguyên cha/mẹ còn lại và loại quan hệ đã chọn.
  const [childFormKey, setChildFormKey] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const finish = () => {
    for (const mutation of [addChild, addParent, addSpouse]) mutation.reset();
    setOtherParentId(null);
    setOtherParentMissing(false);
    setFollowUp(null);
    linkCoParent.reset();
    setLinkKind('ruot');
    setChildFormKey(0);
    setJustAdded(null);
    onClose();
  };

  const titles: Record<Action, string> = {
    none: '',
    edit: `Sửa: ${person.full_name}`,
    'add-child': `Thêm con của ${person.full_name}`,
    'add-parent': `Thêm cha/mẹ của ${person.full_name}`,
    'add-spouse': followUp ? `Ghi ${followUp.name} là ${coParentWord(person.gender).toLowerCase()} của các con?` : `Thêm vợ/chồng của ${person.full_name}`,
    delete: 'Xoá Người',
  };

  const submitChild = (fields: PersonFields, onSuccess: () => void) => {
    if (otherParentId === '') return setOtherParentMissing(true);
    addChild.mutate({ parentId: person.id, otherParentId: otherParentId === NO_CO_PARENT ? null : otherParentId, kind: linkKind, fields }, { onSuccess });
  };

  const kindPicker = (
    <fieldset>
      <legend className="mb-1 font-medium">Quan hệ</legend>
      <div className="flex gap-2">
        {(['ruot', 'nuoi'] as const).map((kind) => (
          <ChoiceChip key={kind} name="link-kind" checked={linkKind === kind} onChange={() => setLinkKind(kind)}>
            {LINK_KIND_LABELS[kind]}
          </ChoiceChip>
        ))}
      </div>
    </fieldset>
  );

  const otherParentPicker = spouses.length > 0 && (
    <label className="block">
      <span className="mb-1 block font-medium">{person.gender === 'nu' ? 'Cha của con' : 'Mẹ của con'}</span>
      <Select
        className="w-full"
        value={otherParentId}
        onChange={(event) => {
          setOtherParentId(event.target.value);
          setOtherParentMissing(false);
        }}
      >
        {mustChoose && <option value="">Chọn {coParentWord(person.gender).toLowerCase()} của con…</option>}
        {spouses.map((spouse) => (
          <option key={spouse.person.id} value={spouse.person.id}>
            {person.gender === 'nu' && spouses.length >= 2 ? `${spouseLabel(spouse.person.gender, spouse.order)}: ${spouse.person.full_name}` : spouse.person.full_name}
          </option>
        ))}
        <option value={NO_CO_PARENT}>Không rõ / không ghi</option>
      </Select>
      {otherParentMissing && <span className="mt-1 block text-sm text-danger">Hãy chọn {coParentWord(person.gender).toLowerCase()} của con (hoặc “Không rõ”).</span>}
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
          // Chủ sở hữu xoá ngay: trang này tự quay về trang trước khi Người biến mất khỏi gia phả (xem PersonPage).
          onDeleted={finish}
        />
      )}
      {action === 'add-child' && (
        <>
          {justAdded && (
            <p role="status" className="mb-4 rounded-xl bg-la/10 px-4 py-3 text-la">
              Đã thêm {justAdded}. Nhập tiếp người con kế.
            </p>
          )}
          <PersonForm
            key={childFormKey}
            initial={EMPTY_PERSON_FORM}
            graph={graph}
            extra={
              <>
                {otherParentPicker}
                {kindPicker}
              </>
            }
            submitLabel="Thêm con"
            submitAndAddLabel="Lưu và thêm con tiếp"
            mutation={addChild}
            onCancel={finish}
            onSubmit={(fields) => submitChild(fields, finish)}
            onSubmitAndAdd={(fields) =>
              submitChild(fields, () => {
                addChild.reset();
                setJustAdded(fields.full_name);
                setChildFormKey((key) => key + 1);
              })
            }
          />
        </>
      )}
      {action === 'add-parent' && (
        <PersonForm
          initial={EMPTY_PERSON_FORM}
          showBirthOrder={false}
          graph={graph}
          extra={kindPicker}
          submitLabel="Thêm"
          mutation={addParent}
          onCancel={finish}
          onSubmit={(fields) => addParent.mutate({ childId: person.id, kind: linkKind, fields }, { onSuccess: finish })}
        />
      )}
      {action === 'add-spouse' && followUp && (
        <div className="space-y-4">
          <p>
            {person.full_name} đã có {orphans.length} con chưa ghi {coParentWord(person.gender).toLowerCase()}. Chọn những con là con của {followUp.name}:
          </p>
          <ul className="space-y-1">
            {orphans.map((child) => (
              <li key={child.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 accent-son"
                    checked={followUp.checked.has(child.id)}
                    onChange={(event) => {
                      const next = new Set(followUp.checked);
                      if (event.target.checked) next.add(child.id);
                      else next.delete(child.id);
                      setFollowUp({ ...followUp, checked: next });
                    }}
                  />
                  {child.full_name}
                </label>
              </li>
            ))}
          </ul>
          {linkCoParent.isError && <ErrorBanner>{linkCoParent.error.message}</ErrorBanner>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={linkCoParent.isPending} onClick={finish}>
              Để sau
            </Button>
            <Button
              disabled={linkCoParent.isPending || followUp.checked.size === 0}
              onClick={() =>
                linkCoParent.mutate({ parentId: person.id, coParentId: followUp.spouseId, childIds: [...followUp.checked] }, { onSuccess: finish })
              }
            >
              {linkCoParent.isPending ? 'Đang ghi…' : `Ghi ${followUp.checked.size} con`}
            </Button>
          </div>
        </div>
      )}
      {action === 'add-spouse' && !followUp && (
        <PersonForm
          initial={{ ...EMPTY_PERSON_FORM, gender: person.gender === 'nam' ? 'nu' : person.gender === 'nu' ? 'nam' : '' }}
          showBirthOrder={false}
          graph={graph}
          submitLabel="Thêm"
          mutation={addSpouse}
          onCancel={finish}
          onSubmit={(fields) =>
            addSpouse.mutate(
              { personId: person.id, order: null, fields },
              {
                onSuccess: (spouseId) => {
                  if (orphans.length === 0) return finish();
                  // Vợ/chồng đầu tiên: mặc định ghi cho mọi con chưa rõ; từ vợ/chồng thứ hai, con có thể là của người trước nên để người dùng tự tích.
                  setFollowUp({ spouseId, name: fields.full_name, checked: new Set(spouses.length === 0 ? orphans.map((child) => child.id) : []) });
                },
              },
            )
          }
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
