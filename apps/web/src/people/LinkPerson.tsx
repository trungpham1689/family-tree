import { useMemo, useState, type FormEvent } from 'react';
import { useLinkParent, useLinkSpouse } from '../data/tree-queries';
import type { Person } from '../data/trees';
import type { FamilyGraph, ParentLinkKind } from '../family/family-graph';
import { LINK_KIND_LABELS } from '../family/labels';
import { searchPersons } from '../tree/tree-search';
import { Button } from '../ui/Button';
import { ErrorBanner, TextField } from '../ui/fields';
import { lifespanText } from './person-display';

type Relation = 'child-of' | 'spouse-of';

type Props = { treeId: string; graph: FamilyGraph<Person>; person: Person; onDone: () => void };

/** Gắn một Người chưa nối vào cây: làm con, hoặc làm vợ/chồng, của một người đã có trong cây. */
export const LinkPerson = ({ treeId, graph, person, onDone }: Props) => {
  const linkParent = useLinkParent(treeId);
  const linkSpouse = useLinkSpouse(treeId);
  const [relation, setRelation] = useState<Relation>('child-of');
  const [kind, setKind] = useState<ParentLinkKind>('ruot');
  const [query, setQuery] = useState('');
  const [targetId, setTargetId] = useState<string | null>(null);

  const candidates = useMemo(
    () => graph.persons.filter((candidate) => candidate.id !== person.id && graph.placement(candidate.id).kind !== 'chua_noi'),
    [graph, person.id],
  );
  const results = useMemo(() => searchPersons(candidates, query, 8), [candidates, query]);
  const target = targetId ? graph.person(targetId) : undefined;
  const pending = linkParent.isPending || linkSpouse.isPending;
  const error = linkParent.error ?? linkSpouse.error;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    if (relation === 'child-of') linkParent.mutate({ childId: person.id, parentId: target.id, kind }, { onSuccess: onDone });
    else linkSpouse.mutate({ personId: target.id, spouseId: person.id }, { onSuccess: onDone });
  };

  const choice = <Value extends string>(value: Value, current: Value, label: string, onPick: (value: Value) => void) => (
    <label
      key={value}
      className={`flex min-h-12 cursor-pointer items-center rounded-xl border px-4 ${
        current === value ? 'border-son bg-son/5 font-semibold text-son' : 'border-line'
      }`}
    >
      <input type="radio" className="sr-only" checked={current === value} onChange={() => onPick(value)} />
      {label}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="mb-1 font-medium">{person.full_name} là…</legend>
        <div className="flex flex-wrap gap-2">
          {choice<Relation>('child-of', relation, 'Con của', setRelation)}
          {choice<Relation>('spouse-of', relation, 'Vợ/chồng của', setRelation)}
        </div>
      </fieldset>

      {target ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-son bg-son/5 px-4 py-3">
          <div>
            <p className="font-semibold">{target.full_name}</p>
            <p className="text-sm text-ink-muted">
              {[`Đời ${graph.placement(target.id).generation ?? '?'}`, lifespanText(target)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <Button variant="ghost" onClick={() => setTargetId(null)}>
            Chọn lại
          </Button>
        </div>
      ) : (
        <div>
          <TextField
            label="Tìm người trong cây"
            placeholder="Gõ tên, có dấu hay không đều được"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query.trim() !== '' && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
              {results.length === 0 && <li className="px-4 py-3 text-ink-muted">Không thấy ai trong cây tên như vậy.</li>}
              {results.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-paper"
                    onClick={() => setTargetId(candidate.id)}
                  >
                    <span className="font-semibold">{candidate.full_name}</span>
                    <span className="text-sm text-ink-muted">
                      {[`Đời ${graph.placement(candidate.id).generation ?? '?'}`, lifespanText(candidate)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {relation === 'child-of' && (
        <fieldset>
          <legend className="mb-1 font-medium">Quan hệ</legend>
          <div className="flex gap-2">
            {(['ruot', 'nuoi'] as const).map((value) => choice(value, kind, LINK_KIND_LABELS[value], setKind))}
          </div>
        </fieldset>
      )}

      {error && <ErrorBanner>{error.message}</ErrorBanner>}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onDone}>
          Huỷ
        </Button>
        <Button type="submit" disabled={!target || pending}>
          {pending ? 'Đang gắn…' : 'Gắn vào cây'}
        </Button>
      </div>
    </form>
  );
};
