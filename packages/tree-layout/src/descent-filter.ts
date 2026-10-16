import type { ChildFilter, LayoutPerson } from './layout.ts';

/**
 * Số đời "ngoại" của một người tính từ dòng đinh: con của người trong dòng đinh là 0 nếu cha/mẹ
 * máu mủ là nam (hoặc chưa rõ giới tính), là 1 nếu là con gái (Cháu ngoại 1 đời); từ đó mỗi đời
 * xuống thêm cộng 1, bất kể giới tính.
 */
export const outsideDepthOfChild = (parentOutsideDepth: number, parent: Pick<LayoutPerson, 'gender'>): number =>
  parentOutsideDepth > 0 ? parentOutsideDepth + 1 : parent.gender === 'nu' ? 1 : 0;

/**
 * Bộ lọc "chỉ đinh" (maxOutside = 0) hoặc "hiện Cháu ngoại N đời" (maxOutside = N).
 * Con gái vẫn luôn hiện; chỉ con cháu của con gái bị lọc theo N (ADR 0003).
 *
 * Bộ lọc có trạng thái: dùng một bộ lọc mới cho mỗi lần dựng bố cục.
 */
export const outsideGenerationsFilter = (maxOutside: number): ChildFilter => {
  const depthOf = new Map<string, number>();
  return (child, parent) => {
    const depth = outsideDepthOfChild(depthOf.get(parent.id) ?? 0, parent);
    if (depth > maxOutside) return false;
    depthOf.set(child.id, depth);
    return true;
  };
};
