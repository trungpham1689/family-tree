import { layoutTree } from '@gia-pha/tree-layout';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useFamily, useTree } from '../data/tree-queries';
import type { Person } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { lifespanText } from '../people/person-display';
import { FamilyTreeCanvas, type CanvasPerson } from '../tree/FamilyTreeCanvas';
import { initialCollapsed } from '../tree/initial-collapsed';
import { AppHeader } from '../ui/AppHeader';
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={`/gia-pha/${treeId}`} className="text-ink-muted hover:text-son">
            ← {tree.data?.name ?? 'Gia phả'}
          </Link>
        </div>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {family.data && <TreeExplorer treeId={treeId} graph={family.data} />}
      </main>
    </div>
  );
};

const TreeExplorer = ({ treeId, graph }: { treeId: string; graph: FamilyGraph<Person> }) => {
  const navigate = useNavigate();
  const root = graph.persons.find((person) => person.is_progenitor);
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    root ? initialCollapsed(root.id, graph.parentLinks) : new Set(),
  );

  const layout = useMemo(
    () => (root ? layoutTree(graph, { rootId: root.id, collapsed }) : null),
    [graph, root, collapsed],
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

  const hasChildren = useCallback((personId: string) => graph.childrenOf(personId).length > 0, [graph]);
  const toggle = useCallback((personId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }, []);
  const open = useCallback((personId: string) => navigate(`/gia-pha/${treeId}/nguoi/${personId}`), [navigate, treeId]);

  if (!root || !layout) {
    return <p className="text-ink-muted">Gia phả chưa có Thuỷ tổ, chưa vẽ được cây.</p>;
  }

  return (
    <div className="min-h-0 flex-1">
      <FamilyTreeCanvas
        layout={layout}
        persons={canvasPersons}
        hasChildren={hasChildren}
        onOpenPerson={open}
        onToggleCollapse={toggle}
        focusPersonId={root.id}
      />
    </div>
  );
};
