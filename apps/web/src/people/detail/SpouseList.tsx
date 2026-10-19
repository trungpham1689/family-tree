import { useState } from 'react';
import { Link } from 'react-router';
import { useReorderUnions, useUpdateUnion } from '../../data/tree-queries';
import type { Person } from '../../data/trees';
import type { MarriageDate, SpouseRelative, UnionStatus } from '../../family/family-graph';
import { spouseLabel, UNION_STATUS_LABELS } from '../../family/labels';
import { lifespanText, marriageText } from '../person-display';
import { Button } from '../../ui/Button';
import { Select, TextField } from '../../ui/fields';
import { Tag } from './detail-bits';
import { useDragReorder } from './use-drag-reorder';

const STATUS_VALUES: UnionStatus[] = ['con', 'ly_hon', 'goa'];

const UnionStatusSelect = ({
  treeId,
  viewerId,
  unionId,
  status,
}: {
  treeId: string;
  viewerId: string;
  unionId: string;
  status: UnionStatus;
}) => {
  const update = useUpdateUnion(treeId);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Trạng thái hôn phối"
        className="min-h-11"
        value={status}
        disabled={update.isPending}
        onChange={(event) => {
          const next = STATUS_VALUES.find((value) => value === event.target.value);
          if (next) update.mutate({ unionId, viewerId, status: next });
        }}
      >
        {STATUS_VALUES.map((value) => (
          <option key={value} value={value}>
            {UNION_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>
      {update.isError && <p className="w-full text-sm text-danger">{update.error.message}</p>}
    </div>
  );
};

const toNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value));

/** Ngày cưới của một cuộc hôn phối (biết năm, năm-tháng hoặc đủ ngày); đủ ngày thì có Kỷ niệm cưới hằng năm. */
const MarriageDateRow = ({
  treeId,
  viewerId,
  unionId,
  marriage,
  canEdit,
}: {
  treeId: string;
  viewerId: string;
  unionId: string;
  marriage: MarriageDate;
  canEdit: boolean;
}) => {
  const update = useUpdateUnion(treeId);
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const text = marriageText(marriage);
  const parsed = { day: toNumber(day), month: toNumber(month), year: toNumber(year) };
  const valid =
    (parsed.year === null ? parsed.month === null && parsed.day === null : Number.isInteger(parsed.year) && parsed.year >= 1 && parsed.year <= 2200) &&
    (parsed.month === null || (Number.isInteger(parsed.month) && parsed.month >= 1 && parsed.month <= 12)) &&
    (parsed.day === null || (parsed.month !== null && Number.isInteger(parsed.day) && parsed.day >= 1 && parsed.day <= 31));

  if (!canEdit) return text ? <p className="basis-full text-sm text-ink-muted">{text}</p> : null;

  const open = () => {
    setDay(marriage.day?.toString() ?? '');
    setMonth(marriage.month?.toString() ?? '');
    setYear(marriage.year?.toString() ?? '');
    setEditing(true);
  };

  if (!editing) {
    return (
      <p className="basis-full text-sm text-ink-muted">
        {text ?? 'Chưa có ngày cưới'}{' '}
        <button type="button" className="font-semibold text-son hover:underline" onClick={open}>
          {text ? 'Sửa' : 'Thêm ngày cưới'}
        </button>
      </p>
    );
  }

  return (
    <form
      className="basis-full space-y-2 rounded-xl bg-paper px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) update.mutate({ unionId, viewerId, marriage: parsed }, { onSuccess: () => setEditing(false) });
      }}
    >
      <div className="grid grid-cols-3 gap-2">
        <TextField label="Ngày" inputMode="numeric" value={day} onChange={(event) => setDay(event.target.value)} />
        <TextField label="Tháng" inputMode="numeric" value={month} onChange={(event) => setMonth(event.target.value)} />
        <TextField label="Năm" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
      </div>
      <p className="text-sm text-ink-muted">Dương lịch. Biết đủ ngày-tháng-năm thì có nhắc Kỷ niệm cưới hằng năm; chỉ biết năm cũng được.</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Huỷ
        </Button>
        <Button type="submit" disabled={update.isPending || !valid}>
          Lưu
        </Button>
      </div>
      {update.isError && <p className="text-sm text-danger">{update.error.message}</p>}
    </form>
  );
};

/** Danh sách vợ/chồng kéo thả được để đổi Thứ tự hôn phối; "Vợ cả/Vợ hai…" tự đánh lại khi thả. */
export const ReorderableSpouses = ({
  treeId,
  viewerId,
  items,
  canEdit,
}: {
  treeId: string;
  viewerId: string;
  items: SpouseRelative<Person>[];
  canEdit: boolean;
}) => {
  const reorder = useReorderUnions(treeId);
  const byId = new Map(items.map((spouse) => [spouse.unionId, spouse]));
  const sourceOrder = items.map((spouse) => spouse.unionId);
  const { order, canDrag, setRef, dragHandleProps } = useDragReorder(sourceOrder, canEdit, (next) =>
    reorder.mutate({ viewerId, orderedUnionIds: next }),
  );

  return (
    <>
      {order.flatMap((unionId, index) => {
        const spouse = byId.get(unionId);
        if (!spouse) return [];
        return (
          <li key={unionId} ref={(element) => setRef(unionId, element)} className="flex flex-wrap items-center gap-3 px-5 py-3">
            {canDrag && (
              <button
                type="button"
                aria-label="Kéo để đổi thứ tự vợ/chồng"
                className="cursor-grab touch-none select-none px-1 text-xl text-ink-muted active:cursor-grabbing"
                {...dragHandleProps(unionId)}
              >
                ⠿
              </button>
            )}
            <Link to={`/gia-pha/${treeId}/nguoi/${spouse.person.id}`} className="group min-w-0 flex-1">
              <span className="block text-sm text-ink-muted">{spouseLabel(spouse.person.gender, index + 1)}</span>
              <span className="text-lg font-semibold group-hover:text-son group-hover:underline">{spouse.person.full_name}</span>
              <span className="ml-2 text-ink-muted">{lifespanText(spouse.person)}</span>
            </Link>
            {canEdit ? (
              <UnionStatusSelect treeId={treeId} viewerId={viewerId} unionId={spouse.unionId} status={spouse.status} />
            ) : (
              spouse.status !== 'con' && <Tag>{UNION_STATUS_LABELS[spouse.status]}</Tag>
            )}
            <MarriageDateRow treeId={treeId} viewerId={viewerId} unionId={spouse.unionId} marriage={spouse.marriage} canEdit={canEdit} />
          </li>
        );
      })}
      {reorder.isError && <li className="px-5 py-3 text-sm text-danger">{reorder.error.message}</li>}
    </>
  );
};
