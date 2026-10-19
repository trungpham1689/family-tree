import { useCallback } from 'react';
import { useParams } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { useFamily, useSetOutsideGenerations, useTree } from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { TreeExplorer } from '../tree/TreeExplorer';
import { TreeTabs } from '../tree/TreeTabs';
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
      <TreeTabs treeId={treeId} />
      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data && family.data && <OwnTreeExplorer tree={tree.data} graph={family.data} />}
      </main>
    </div>
  );
};

const OwnTreeExplorer = ({ tree, graph }: { tree: TreeWithRole; graph: FamilyGraph<Person> }) => {
  const saveDefault = useSetOutsideGenerations(tree.id);
  const personHref = useCallback((personId: string) => `/gia-pha/${tree.id}/nguoi/${personId}`, [tree.id]);
  return (
    <TreeExplorer
      graph={graph}
      defaultOutside={tree.outside_generations}
      personHref={personHref}
      allowAvatars
      saveDefault={
        tree.role === 'owner'
          ? {
              busy: saveDefault.isPending,
              error: saveDefault.error?.message ?? null,
              save: (value, onSaved) => saveDefault.mutate(value, { onSuccess: onSaved }),
            }
          : undefined
      }
    />
  );
};
