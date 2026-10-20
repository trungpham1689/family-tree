import type { ReactNode } from 'react';
import { canEditTree, isTreeOwner } from '../data/permissions';
import { useFamily, useTree } from '../data/tree-queries';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import { AppHeader } from '../ui/AppHeader';
import { ErrorBanner } from '../ui/fields';
import { Footer } from '../ui/Footer';
import { FullPageMessage } from '../ui/FullPageMessage';
import { TreeTabs } from './TreeTabs';

/** Mọi thứ phần thân của một trang theo gia phả cần: đã tải xong, kèm quyền theo Vai trò. */
export type TreePageContext = {
  treeId: string;
  tree: TreeWithRole;
  graph: FamilyGraph<Person>;
  canEdit: boolean;
  isOwner: boolean;
};

/**
 * Khung chung của các trang theo gia phả: tải gia phả + Cây, hiện "Đang tải…" và lỗi, vẽ đầu trang, thanh tab và chân trang.
 * Phần thân chỉ được vẽ khi dữ liệu đã có, nên không phải kiểm `undefined` ở từng trang.
 */
export const TreePageShell = ({
  treeId,
  width = 'max-w-4xl',
  children,
}: {
  treeId: string;
  /** Lớp độ rộng của <main>; mặc định max-w-4xl như thanh đầu trang và thanh tab. */
  width?: string;
  children: (context: TreePageContext) => ReactNode;
}) => {
  const tree = useTree(treeId);
  const family = useFamily(treeId);
  if (tree.isPending || family.isPending) return <FullPageMessage>Đang tải…</FullPageMessage>;
  const error = tree.error ?? family.error;

  return (
    <>
      <AppHeader />
      <TreeTabs treeId={treeId} />
      <main className={`mx-auto ${width} px-4 py-8`}>
        {error && <ErrorBanner>{error.message}</ErrorBanner>}
        {tree.data &&
          family.data &&
          children({
            treeId,
            tree: tree.data,
            graph: family.data,
            canEdit: canEditTree(tree.data.role),
            isOwner: isTreeOwner(tree.data.role),
          })}
      </main>
      <Footer />
    </>
  );
};
