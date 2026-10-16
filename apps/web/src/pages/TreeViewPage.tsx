import { layoutTree, outsideGenerationsFilter, type Orientation } from '@gia-pha/tree-layout';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useFamily, useSetOutsideGenerations, useTree } from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { lifespanText } from '../people/person-display';
import { FamilyTreeCanvas, type CanvasPerson, type FocusRequest } from '../tree/FamilyTreeCanvas';
import { initialCollapsed } from '../tree/initial-collapsed';
import { PersonSearch } from '../tree/PersonSearch';
import { planReveal } from '../tree/tree-search';
import { AppHeader } from '../ui/AppHeader';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/fields';
import { FullPageMessage } from '../ui/FullPageMessage';

export const TreeViewPage = () => {
  const { treeId = '' } = useParams();
  const { state } = useAuth();
  const email = state.status === 'signed-in' ? state.session.user.email : undefined;
  const tree = useTree(treeId);
  const family = useFamily(treeId);

  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader email={email} />
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        <Link to={`/gia-pha/${treeId}`} className="self-start text-ink-muted hover:text-son">
          ← {tree.data?.name ?? 'Gia phả'}
        </Link>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data && family.data && <TreeExplorer tree={tree.data} graph={family.data} />}
      </main>
    </div>
  );
};

const ORIENTATION_KEY = 'gia-pha:huong-cay';

const readOrientation = (): Orientation => {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === 'left-right' ? 'left-right' : 'top-down';
  } catch {
    return 'top-down';
  }
};

const saveOrientation = (orientation: Orientation) => {
  try {
    localStorage.setItem(ORIENTATION_KEY, orientation);
  } catch {
    // Không lưu được thì chỉ mất ghi nhớ, Cây vẫn đổi hướng bình thường.
  }
};

const OUTSIDE_OPTIONS = [0, 1, 2, 3, 4, 5];
const outsideLabel = (n: number) => (n === 0 ? 'Chỉ đinh' : `Hiện Cháu ngoại ${n} đời`);

const TreeExplorer = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const navigate = useNavigate();
  const saveDefault = useSetOutsideGenerations(tree.id);
  const root = graph.persons.find((person) => person.is_progenitor);

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    root ? initialCollapsed(root.id, graph.parentLinks) : new Set(),
  );
  const [orientation, setOrientation] = useState<Orientation>(readOrientation);
  // null = theo mặc định của Gia phả; người xem đổi tạm thì không lưu.
  const [outsideOverride, setOutsideOverride] = useState<number | null>(null);
  const outsideGenerations = outsideOverride ?? tree.outside_generations;
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(() => (root ? { personId: root.id } : null));
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const layout = useMemo(
    () =>
      root
        ? layoutTree(graph, {
            rootId: root.id,
            collapsed,
            orientation,
            includeChild: outsideGenerationsFilter(outsideGenerations),
          })
        : null,
    [graph, root, collapsed, orientation, outsideGenerations],
  );

  const canvasPersons = useMemo(
    () =>
      new Map<string, CanvasPerson>(
        graph.persons.map((person) => [
          person.id,
          { id: person.id, full_name: person.full_name, gender: person.gender, lifespan: lifespanText(person) },
        ]),
      ),
    [graph],
  );

  const toggle = useCallback((personId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }, []);
  const open = useCallback(
    (personId: string) => navigate(`/gia-pha/${tree.id}/nguoi/${personId}`),
    [navigate, tree.id],
  );

  if (!root || !layout) {
    return <p className="text-ink-muted">Gia phả chưa có Thuỷ tổ, chưa vẽ được cây.</p>;
  }

  const reveal = (personId: string) => {
    const plan = planReveal({
      targetId: personId,
      rootId: root.id,
      genderOf: (id) => graph.person(id)?.gender ?? null,
      parentLinks: graph.parentLinks,
      unions: graph.unions,
      collapsed,
      outsideGenerations,
    });
    if (!plan) {
      setNotice(`${graph.person(personId)?.full_name ?? 'Người này'} chưa nối vào cây nên không hiện trên Cây.`);
      return;
    }
    setNotice(
      plan.outsideGenerations > outsideGenerations ? `Đã chuyển sang ${outsideLabel(plan.outsideGenerations).toLowerCase()} để hiện người này.` : null,
    );
    setCollapsed(plan.collapsed);
    if (plan.outsideGenerations !== outsideGenerations) setOutsideOverride(plan.outsideGenerations);
    setHighlightedId(personId);
    setFocusRequest({ personId });
  };

  const changeOrientation = () => {
    const next: Orientation = orientation === 'top-down' ? 'left-right' : 'top-down';
    setOrientation(next);
    saveOrientation(next);
    setFocusRequest({ personId: highlightedId ?? root.id });
  };

  const isOwner = tree.role === 'owner';
  const differsFromDefault = outsideGenerations !== tree.outside_generations;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <PersonSearch persons={graph.persons} placement={graph.placement} onPick={reveal} />
        </div>
        <label className="flex flex-col">
          <span className="mb-1 font-medium">Hiển thị</span>
          <select
            className="min-h-12 rounded-xl border border-line bg-surface px-3"
            value={outsideGenerations}
            onChange={(event) => setOutsideOverride(Number(event.target.value))}
          >
            {OUTSIDE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {outsideLabel(n)}
                {n === tree.outside_generations ? ' (mặc định)' : ''}
              </option>
            ))}
          </select>
        </label>
        {isOwner && differsFromDefault && (
          <Button
            variant="ghost"
            disabled={saveDefault.isPending}
            onClick={() => saveDefault.mutate(outsideGenerations, { onSuccess: () => setOutsideOverride(null) })}
          >
            Đặt làm mặc định
          </Button>
        )}
        <Button variant="secondary" onClick={changeOrientation}>
          {orientation === 'top-down' ? 'Xếp trái → phải' : 'Xếp trên → dưới'}
        </Button>
      </div>

      {saveDefault.error && <ErrorBanner>{saveDefault.error.message}</ErrorBanner>}
      {notice && (
        <p role="status" className="rounded-xl bg-kim/10 px-4 py-2">
          {notice}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <FamilyTreeCanvas
          layout={layout}
          persons={canvasPersons}
          highlightedId={highlightedId}
          onOpenPerson={open}
          onToggleCollapse={toggle}
          focusRequest={focusRequest}
        />
      </div>
    </div>
  );
};
