type Link = { child_id: string; parent_id: string };

/**
 * Tập người cần thu gọn để Cây chỉ mở sẵn `openGenerations` đời tính từ gốc:
 * những người ở đời cuối cùng được mở mà còn có con.
 */
export const initialCollapsed = (rootId: string, parentLinks: Link[], openGenerations = 4): Set<string> => {
  const children = new Map<string, string[]>();
  for (const link of parentLinks) {
    const list = children.get(link.parent_id);
    if (list) list.push(link.child_id);
    else children.set(link.parent_id, [link.child_id]);
  }

  const collapsed = new Set<string>();
  const seen = new Set([rootId]);
  let level = [rootId];
  for (let generation = 1; generation < openGenerations && level.length > 0; generation += 1) {
    level = level.flatMap((id) => (children.get(id) ?? []).filter((child) => !seen.has(child) && seen.add(child)));
  }
  for (const id of level) if ((children.get(id) ?? []).length > 0) collapsed.add(id);
  return collapsed;
};
