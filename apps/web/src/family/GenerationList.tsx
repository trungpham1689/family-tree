import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAddChild, usePersonAvatars } from '../data/tree-queries';
import type { Person } from '../data/trees';
import { lifespanText, nameInitial } from '../people/person-display';
import type { FamilyGraph, GenerationGroup } from './family-graph';
import { kindLabel } from './labels';
import { EMPTY_PERSON_FORM } from '../people/person-form';
import { LinkPerson } from '../people/LinkPerson';
import { PersonForm } from '../people/PersonForm';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

export const GenerationList = ({ treeId, graph, canEdit }: { treeId: string; graph: FamilyGraph<Person>; canEdit: boolean }) => {
  const generations = graph.generations();
  const unconnected = graph.unconnected();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const linking = linkingId ? graph.person(linkingId) : undefined;
  // Mặc định Đời 1; nếu chọn một đời rồi mất đi (gia phả đổi) thì quay lại Đời 1.
  const [selectedGeneration, setSelectedGeneration] = useState<number | null>(null);
  const activeGeneration =
    selectedGeneration !== null && generations.some((group) => group.generation === selectedGeneration)
      ? selectedGeneration
      : (generations[0]?.generation ?? null);
  const activeGroup = generations.find((group) => group.generation === activeGeneration);

  return (
    <div className="space-y-8">
      {generations.length > 0 && (
        <section aria-labelledby="cac-doi">
          <h2 id="cac-doi" className="font-serif text-2xl font-bold">
            Các đời
          </h2>
          <div className="mt-3 flex items-start gap-4">
            <nav aria-label="Chọn đời" className="flex w-20 shrink-0 flex-col gap-2 sm:w-28">
              {generations.map((group) => (
                <GenerationTab
                  key={group.generation}
                  group={group}
                  active={group.generation === activeGeneration}
                  onSelect={() => setSelectedGeneration(group.generation)}
                />
              ))}
            </nav>
            <div className="min-w-0 flex-1">
              {activeGroup && <GenerationCards treeId={treeId} graph={graph} group={activeGroup} canEdit={canEdit} />}
            </div>
          </div>
        </section>
      )}
      {unconnected.length > 0 && (
        <section aria-labelledby="chua-noi">
          <h2 id="chua-noi" className="font-serif text-2xl font-bold">
            Chưa nối vào cây
            <span className="ml-3 font-sans text-base font-normal text-ink-muted">{unconnected.length} người</span>
          </h2>
          <p className="mt-1 text-ink-muted">Những người chưa xác định được cha/mẹ trong gia phả.</p>
          <PersonList
            treeId={treeId}
            graph={graph}
            persons={unconnected}
            action={
              canEdit
                ? (person) => (
                    <Button variant="ghost" onClick={() => setLinkingId(person.id)}>
                      Gắn vào cây
                    </Button>
                  )
                : undefined
            }
          />
        </section>
      )}
      <Dialog open={linking !== undefined} title={`Gắn ${linking?.full_name ?? ''} vào cây`} onClose={() => setLinkingId(null)}>
        {linking && <LinkPerson treeId={treeId} graph={graph} person={linking} onDone={() => setLinkingId(null)} />}
      </Dialog>
    </div>
  );
};

type PersonListProps = {
  treeId: string;
  graph: FamilyGraph<Person>;
  persons: Person[];
  action?: ((person: Person) => ReactNode) | undefined;
};

const PersonList = ({ treeId, graph, persons, action }: PersonListProps) => (
  <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
    {persons.map((person) => {
      const { kind } = graph.placement(person.id);
      return (
        <li key={person.id} className="flex items-center gap-2 hover:bg-paper">
          <Link
            to={`/gia-pha/${treeId}/nguoi/${person.id}`}
            className="flex flex-1 items-center justify-between gap-4 px-5 py-4"
          >
            <div>
              <p className="text-lg font-semibold">{person.full_name}</p>
              <p className="text-ink-muted">{lifespanText(person) || 'Chưa rõ năm sinh'}</p>
            </div>
            {kind !== 'dinh' && (
              <span className="rounded-full bg-paper px-3 py-1 text-sm text-ink-muted">{kindLabel(kind, person.gender)}</span>
            )}
          </Link>
          {action && <div className="pr-3">{action(person)}</div>}
        </li>
      );
    })}
  </ul>
);

const GenerationTab = ({ group, active, onSelect }: { group: GenerationGroup<Person>; active: boolean; onSelect: () => void }) => (
  <button
    type="button"
    aria-current={active || undefined}
    onClick={onSelect}
    className={`rounded-xl px-2 py-2 text-center transition-colors ${
      active ? 'bg-son text-white' : 'bg-surface text-ink-muted hover:bg-paper'
    }`}
  >
    <p className={`text-xs font-semibold uppercase tracking-wide ${active ? 'text-white/80' : 'text-ink-muted'}`}>Đời thứ</p>
    <p className="font-serif text-2xl font-bold">{group.generation}</p>
    <p className={`text-xs ${active ? 'text-white/85' : 'text-ink-muted'}`}>
      ♂{group.male} ♀{group.female}
    </p>
    <p className={`text-xs ${active ? 'text-white/70' : 'text-ink-muted'}`}>Tổng {group.total}</p>
  </button>
);

const GenerationCards = ({
  treeId,
  graph,
  group,
  canEdit,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  group: GenerationGroup<Person>;
  canEdit: boolean;
}) => {
  const avatars = usePersonAvatars(group.persons, true);
  return (
    <ul className="space-y-3">
      {group.persons.map((person) => (
        <GenerationCard
          key={person.id}
          treeId={treeId}
          graph={graph}
          person={person}
          canEdit={canEdit}
          avatarUrl={avatars.data?.get(person.id)}
        />
      ))}
    </ul>
  );
};

const GenerationCard = ({
  treeId,
  graph,
  person,
  canEdit,
  avatarUrl,
}: {
  treeId: string;
  graph: FamilyGraph<Person>;
  person: Person;
  canEdit: boolean;
  avatarUrl: string | undefined;
}) => {
  const { kind } = graph.placement(person.id);
  const parents = graph.parentsOf(person.id);
  const primaryParent = parents[0];
  const adopted = parents.some((parent) => parent.kind === 'nuoi');
  const spouseCount = graph.spousesOf(person.id).length;
  const childCount = graph.childrenOf(person.id).length;
  const [adding, setAdding] = useState(false);
  const addChild = useAddChild(treeId);
  const initial = nameInitial(person.full_name);

  return (
    <li>
      {primaryParent && (
        <p className="mb-1 pl-1 text-sm text-ink-muted">
          {primaryParent.person.gender === 'nu' ? 'Mẹ' : 'Cha'} {primaryParent.person.full_name}
        </p>
      )}
      <div className="flex items-stretch overflow-hidden rounded-2xl bg-son text-white">
        <Link to={`/gia-pha/${treeId}/nguoi/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-son-strong">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-paper text-lg font-bold text-son">
            {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold">{person.full_name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  person.gender === 'nam' ? 'bg-kim-soft text-ink' : person.gender === 'nu' ? 'bg-white text-son' : 'border border-white/40 text-white/90'
                }`}
              >
                {person.gender === 'nam' ? '♂ Nam' : person.gender === 'nu' ? '♀ Nữ' : 'Chưa rõ giới tính'}
              </span>
              {kind !== 'dinh' && (
                <span className="rounded-full border border-white/50 px-2.5 py-0.5 text-xs font-semibold text-white">
                  {kindLabel(kind, person.gender)}
                </span>
              )}
              {adopted && <span className="rounded-full border border-white/50 px-2.5 py-0.5 text-xs font-semibold text-white">Con nuôi</span>}
            </span>
            {(spouseCount > 0 || childCount > 0) && (
              <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm font-semibold text-kim-soft">
                {spouseCount > 0 && <span>{spouseCount} vợ/chồng</span>}
                {spouseCount > 0 && childCount > 0 && <span aria-hidden="true">·</span>}
                {childCount > 0 && <span>{childCount} con</span>}
              </span>
            )}
          </span>
        </Link>
        {canEdit && (
          <button
            type="button"
            aria-label={`Thêm con cho ${person.full_name}`}
            onClick={() => setAdding(true)}
            className="grid w-12 shrink-0 place-items-center border-l border-white/15 text-xl font-bold hover:bg-son-strong"
          >
            +
          </button>
        )}
      </div>
      <Dialog open={adding} title={`Thêm con cho ${person.full_name}`} onClose={() => setAdding(false)}>
        {adding && (
          <PersonForm
            initial={EMPTY_PERSON_FORM}
            graph={graph}
            currentPersonId={person.id}
            submitLabel="Thêm"
            busy={addChild.isPending}
            serverError={addChild.isError ? addChild.error.message : null}
            onCancel={() => setAdding(false)}
            onSubmit={(fields) =>
              addChild.mutate(
                { parentId: person.id, otherParentId: null, kind: 'ruot', fields },
                { onSuccess: () => setAdding(false) },
              )
            }
          />
        )}
      </Dialog>
    </li>
  );
};
