import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAddChild, usePersonAvatars } from '../data/tree-queries';
import type { Person } from '../data/trees';
import { lifespanText, nameInitial } from '../people/person-display';
import type { FamilyGraph, GenerationGroup } from './family-graph';
import { kindLabel, spouseCountText } from './labels';
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
  const panelRef = useRef<HTMLDivElement>(null);
  // Chọn đời ở cuối cột dọc khi đang cuộn xuống: kéo phần thẻ người lên lại tầm nhìn.
  const selectGeneration = (generation: number) => {
    setSelectedGeneration(generation);
    const panel = panelRef.current;
    if (panel && panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="space-y-8">
      {generations.length > 0 && (
        <section aria-labelledby="cac-doi">
          <h2 id="cac-doi" className="font-serif text-2xl font-bold">
            Các đời
          </h2>
          <div className="mt-3 flex items-start gap-3 sm:gap-6">
            <nav
              aria-label="Chọn đời"
              className="sticky top-2 flex max-h-[calc(100dvh-1rem)] w-14 shrink-0 flex-col gap-2 overflow-y-auto sm:w-44"
            >
              {generations.map((group) => (
                <GenerationTab
                  key={group.generation}
                  group={group}
                  active={group.generation === activeGeneration}
                  onSelect={() => selectGeneration(group.generation)}
                />
              ))}
            </nav>
            <div ref={panelRef} className="min-w-0 flex-1 scroll-mt-2">
              {activeGroup && (
                <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted sm:hidden">
                  <span>
                    <strong className="text-ink">Đời {activeGroup.generation}</strong> · {activeGroup.total} thành viên
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-tram">
                    <GenderIcon gender="nam" />
                    {activeGroup.male}
                    <span className="sr-only">nam</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-hong">
                    <GenderIcon gender="nu" />
                    {activeGroup.female}
                    <span className="sr-only">nữ</span>
                  </span>
                </p>
              )}
              {activeGroup && <GenerationCards treeId={treeId} graph={graph} group={activeGroup} canEdit={canEdit} />}
            </div>
          </div>
        </section>
      )}
      {unconnected.length > 0 && (
        <section aria-labelledby="chua-noi">
          <h2 id="chua-noi" className="font-serif text-2xl font-bold">
            Chưa nối vào cây
            <span className="ml-3 font-sans text-base font-normal text-ink-muted">{unconnected.length} thành viên</span>
          </h2>
          <p className="mt-1 text-ink-muted">Những thành viên chưa xác định được cha/mẹ trong gia phả.</p>
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

/** Biểu tượng giới tính vẽ bằng SVG (ký tự ♂♀ tuỳ font nên hay lệch dòng); màu theo `currentColor`. */
const GenderIcon = ({ gender, className = 'size-4' }: { gender: 'nam' | 'nu'; className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    {gender === 'nam' ? (
      <>
        <circle cx="10" cy="14" r="5" />
        <path d="M14 10l6-6M15 4h5v5" />
      </>
    ) : (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="M12 14v7M9 18h6" />
      </>
    )}
  </svg>
);

// Cột dọc ở mọi khổ màn hình: mobile chỉ "Đời" + số (cột hẹp để thẻ thành viên còn rộng; số thành viên, nam, nữ nằm ở dòng trên danh sách), từ sm có thêm số thành viên và số nam, nữ.
const GenerationTab = ({ group, active, onSelect }: { group: GenerationGroup<Person>; active: boolean; onSelect: () => void }) => (
  <button
    type="button"
    aria-current={active || undefined}
    aria-label={`Đời ${group.generation}, ${group.total} thành viên, ${group.male} nam, ${group.female} nữ`}
    onClick={onSelect}
    className={`flex min-h-14 shrink-0 flex-col items-center justify-center rounded-xl border px-1 py-2 transition-colors sm:flex-row sm:justify-between sm:gap-3 sm:px-4 sm:py-3 ${
      active ? 'border-son bg-son text-white' : 'border-line bg-surface text-ink-muted hover:bg-paper'
    }`}
  >
    <span className="flex flex-col items-center leading-tight sm:flex-row sm:gap-1.5">
      <span className={`text-xs font-semibold sm:font-serif sm:text-xl sm:font-bold ${active ? 'text-white/85 sm:text-white' : 'sm:text-ink'}`}>Đời</span>
      <span className={`font-serif text-xl font-bold ${active ? '' : 'text-ink'}`}>{group.generation}</span>
    </span>
    <span className={`hidden flex-col items-end text-sm leading-tight sm:flex ${active ? 'text-white/85' : ''}`}>
      <span className="whitespace-nowrap">{group.total} thành viên</span>
      <span className="mt-1 flex items-center gap-3 font-semibold">
        <span className={`inline-flex items-center gap-1 ${active ? '' : 'text-tram'}`}>
          <GenderIcon gender="nam" className="size-3.5" />
          {group.male}
          <span className="sr-only">nam</span>
        </span>
        <span className={`inline-flex items-center gap-1 ${active ? '' : 'text-hong'}`}>
          <GenderIcon gender="nu" className="size-3.5" />
          {group.female}
          <span className="sr-only">nữ</span>
        </span>
      </span>
    </span>
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
  const spouseText = spouseCountText(graph.spousesOf(person.id).map((spouse) => spouse.person.gender));
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
        <Link to={`/gia-pha/${treeId}/nguoi/${person.id}`} className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3.5 hover:bg-son-strong sm:px-4">
          <span className="grid size-10 shrink-0 place-items-center sm:size-12 overflow-hidden rounded-xl bg-paper text-lg font-bold text-son">
            {avatarUrl ? <img src={avatarUrl} alt="" className="size-full object-cover" /> : initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold leading-snug">{person.full_name}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold leading-5 ${
                  person.gender === 'nam' ? 'bg-kim-soft text-tram' : person.gender === 'nu' ? 'bg-white text-hong' : 'border border-white/40 text-white/90'
                }`}
              >
                {person.gender === 'nam' || person.gender === 'nu' ? (
                  <>
                    <GenderIcon gender={person.gender} className="size-3.5" />
                    {person.gender === 'nam' ? 'Nam' : 'Nữ'}
                  </>
                ) : (
                  'Chưa rõ giới tính'
                )}
              </span>
              {kind !== 'dinh' && (
                <span className="rounded-full border border-white/50 px-2.5 py-px text-sm font-semibold leading-5 text-white">
                  {kindLabel(kind, person.gender)}
                </span>
              )}
              {adopted && <span className="rounded-full border border-white/50 px-2.5 py-px text-sm font-semibold leading-5 text-white">Con nuôi</span>}
            </span>
            {(spouseText !== '' || childCount > 0) && (
              <span className="mt-2 flex flex-wrap gap-x-3 text-sm font-semibold text-kim-soft">
                {spouseText !== '' && <span>{spouseText}</span>}
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
            className="grid w-11 shrink-0 place-items-center sm:w-13 border-l border-white/15 text-2xl font-bold hover:bg-son-strong"
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
            mutation={addChild}
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
