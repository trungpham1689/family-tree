type Link = { child_id: string; parent_id: string };
type Union = { partner_a: string; partner_b: string };

export type DeletionImpact = {
  /** Số liên kết (cha mẹ, vợ chồng, con) sẽ mất theo. */
  links: number;
  /** Có con cháu hay không: nếu có, phải gõ tên để xác nhận. */
  hasDescendants: boolean;
  /** Những người đang nối vào cây sẽ thành "chưa nối" sau khi xoá. */
  orphaned: string[];
};

const reachable = (rootId: string | null, links: readonly Link[], excluded: string): Set<string> => {
  const seen = new Set<string>();
  if (rootId === null || rootId === excluded) return seen;
  const children = new Map<string, string[]>();
  for (const link of links) {
    if (link.parent_id === excluded || link.child_id === excluded) continue;
    const list = children.get(link.parent_id);
    if (list) list.push(link.child_id);
    else children.set(link.parent_id, [link.child_id]);
  }
  const stack = [rootId];
  seen.add(rootId);
  while (stack.length > 0) {
    for (const child of children.get(stack.pop()!) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        stack.push(child);
      }
    }
  }
  return seen;
};

/** Hậu quả của việc xoá một Người, để hộp thoại xác nhận nói rõ trước khi xoá. */
export const deletionImpact = (input: {
  personId: string;
  rootId: string | null;
  parentLinks: readonly Link[];
  unions: readonly Union[];
}): DeletionImpact => {
  const { personId, rootId, parentLinks, unions } = input;
  const links =
    parentLinks.filter((link) => link.child_id === personId || link.parent_id === personId).length +
    unions.filter((union) => union.partner_a === personId || union.partner_b === personId).length;
  const hasDescendants = parentLinks.some((link) => link.parent_id === personId);

  // Người đang trong cây: máu mủ tới được từ gốc, cộng vợ/chồng của họ.
  const withSpouses = (blood: Set<string>) => {
    const all = new Set(blood);
    for (const union of unions) {
      if (blood.has(union.partner_a)) all.add(union.partner_b);
      if (blood.has(union.partner_b)) all.add(union.partner_a);
    }
    return all;
  };
  const before = withSpouses(reachable(rootId, parentLinks, ''));
  // Người bị xoá đã bị loại khỏi phép duyệt nên vợ/chồng của họ chỉ còn nếu nối qua người khác.
  const after = withSpouses(reachable(rootId, parentLinks, personId));
  const orphaned = [...before].filter((id) => id !== personId && !after.has(id));
  return { links, hasDescendants, orphaned };
};
