import type { FamilyGraph, GraphPerson } from './family-graph';
import { spouseLabel } from './labels';

/**
 * "A gọi B là gì?" — suy từ Cha mẹ/Vợ chồng đã lưu, không cần dữ liệu thêm.
 * Chỉ đặt tên riêng cho các quan hệ gần (tới cô/dì/chú/bác/cậu và anh/em họ đời 2);
 * xa hơn thì trả lời chung chung theo tổ tiên gần nhất và số đời — vẫn đúng, chỉ không có tên riêng.
 * ponytail: bỏ qua phân biệt Bác (lớn tuổi hơn cha/mẹ) với Chú/Cô/Cậu/Dì vì cần so tuổi đáng tin cậy
 * giữa hai đời khác nhau; nâng cấp khi có yêu cầu và dữ liệu năm sinh đủ đầy hơn.
 */

type Side = 'nam' | 'nu' | null;

const asSide = (gender: string | null | undefined): Side => (gender === 'nam' || gender === 'nu' ? gender : null);

/** Từ `id`, mọi tổ tiên tới được cùng đường đi (gần nhất) qua Cha mẹ. */
export const ancestorPaths = <P extends GraphPerson>(graph: FamilyGraph<P>, startId: string): Map<string, P[]> => {
  const result = new Map<string, P[]>();
  const visited = new Set([startId]);
  let frontier: { id: string; path: P[] }[] = [{ id: startId, path: [] }];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const { id, path } of frontier) {
      for (const { person: parent } of graph.parentsOf(id)) {
        if (visited.has(parent.id)) continue;
        visited.add(parent.id);
        const parentPath = [...path, parent];
        result.set(parent.id, parentPath);
        next.push({ id: parent.id, path: parentPath });
      }
    }
    frontier = next;
  }
  return result;
};

const UP_NAMES = ['', '', '', 'Cụ', 'Kỵ'];
const DOWN_NAMES = ['', '', 'Cháu', 'Chắt', 'Chút'];

/** "Cha"/"Mẹ", "Ông nội"/"Bà ngoại", "Cụ"… — `target` là tổ tiên cách `generations` đời. */
export const lineageTermUp = (generations: number, targetGender: string | null, side: Side, fatherWord = 'Cha'): string => {
  if (generations === 1) return targetGender === 'nam' ? fatherWord : targetGender === 'nu' ? 'Mẹ' : `${fatherWord}/Mẹ`;
  if (generations === 2) {
    const grand = targetGender === 'nam' ? 'Ông' : targetGender === 'nu' ? 'Bà' : 'Ông/Bà';
    return side ? `${grand} ${side === 'nam' ? 'nội' : 'ngoại'}` : grand;
  }
  return generations <= 4 ? UP_NAMES[generations]! : `Tổ tiên đời thứ ${generations}`;
};

/** "Con"/"Cháu nội"/"Chắt"… — `target` là hậu duệ cách `generations` đời. */
const lineageTermDown = (generations: number, targetGender: string | null, side: Side): string => {
  if (generations === 1) return targetGender === 'nam' ? 'Con trai' : targetGender === 'nu' ? 'Con gái' : 'Con';
  const base = generations <= 4 ? DOWN_NAMES[generations]! : `Hậu duệ đời thứ ${generations}`;
  const sided = generations === 2 && side ? `${base} ${side === 'nam' ? 'nội' : 'ngoại'}` : base;
  if (targetGender === 'nam') return `${sided} (trai)`;
  if (targetGender === 'nu') return `${sided} (gái)`;
  return sided;
};

/**
 * So ngày sinh khi cả hai đều biết: năm, rồi tháng, rồi ngày (chỉ so tiếp khi phần trước bằng nhau và phần đó cả hai đều biết).
 * Âm: a sinh trước; dương: b sinh trước; 0 hoặc null: chưa đủ dữ liệu để phân biệt.
 */
const knownBirthComparison = (a: GraphPerson, b: GraphPerson): number | null => {
  for (const [x, y] of [
    [a.birth_year, b.birth_year],
    [a.birth_month ?? null, b.birth_month ?? null],
    [a.birth_day ?? null, b.birth_day ?? null],
  ] as const) {
    if (x === null || y === null) return null;
    if (x !== y) return x - y;
  }
  return null;
};

/**
 * `a` lớn tuổi hơn (sinh trước) `b` không; null khi chưa đủ dữ liệu để biết.
 * Anh chị em cùng cha mẹ (`siblings`): Thứ tự con đã ghi quyết định trước, như danh sách con; còn lại, và với họ hàng khác nhánh
 * (Thứ tự con chỉ có nghĩa giữa anh chị em), so ngày sinh. Cùng năm thì so tiếp tháng, ngày; bằng nhau hoặc thiếu thì null, không đoán.
 */
export const isOlder = (a: GraphPerson, b: GraphPerson, siblings = false): boolean | null => {
  if (siblings && a.birth_order !== null && b.birth_order !== null && a.birth_order !== b.birth_order) return a.birth_order < b.birth_order;
  const comparison = knownBirthComparison(a, b);
  return comparison === null || comparison === 0 ? null : comparison < 0;
};

const siblingTerm = (target: GraphPerson, viewer: GraphPerson): string => {
  const older = isOlder(target, viewer, true);
  if (target.gender === 'nam') return older === false ? 'Em trai' : older === true ? 'Anh trai' : 'Anh/Em trai';
  if (target.gender === 'nu') return older === false ? 'Em gái' : older === true ? 'Chị gái' : 'Chị/Em gái';
  return older === false ? 'Em' : older === true ? 'Anh/Chị' : 'Anh/Chị/Em';
};

/** Cô/chú/bác/cậu/dì — Cha mẹ ruột của người hỏi nối sang `side` (nam = bên nội, nu = bên ngoại). */
const auntUncleTerm = (target: GraphPerson, side: Side): string => {
  if (side === 'nam') return target.gender === 'nam' ? 'Chú' : target.gender === 'nu' ? 'Cô' : 'Chú/Cô';
  if (side === 'nu') return target.gender === 'nam' ? 'Cậu' : target.gender === 'nu' ? 'Dì' : 'Cậu/Dì';
  return 'Cô/Chú/Bác/Cậu/Dì';
};

const cousinTerm = (target: GraphPerson, viewer: GraphPerson): string => {
  const older = isOlder(target, viewer);
  if (target.gender === 'nam') return older === false ? 'Em họ (trai)' : older === true ? 'Anh họ' : 'Anh/Em họ (trai)';
  if (target.gender === 'nu') return older === false ? 'Em họ (gái)' : older === true ? 'Chị họ' : 'Chị/Em họ (gái)';
  return 'Anh/Chị/Em họ';
};

/** "`toId` là gì của `fromId`?" — null khi hai người không có quan hệ huyết thống hay hôn phối nào tìm được. */
export const relationTerm = <P extends GraphPerson>(graph: FamilyGraph<P>, fromId: string, toId: string): string | null => {
  const from = graph.person(fromId);
  const to = graph.person(toId);
  if (!from || !to) return null;
  if (fromId === toId) return 'Chính là người này';

  const spouse = graph.spousesOf(fromId).find((s) => s.person.id === toId);
  if (spouse) return spouseLabel(to.gender, spouse.order);

  const fromAncestors = ancestorPaths(graph, fromId);
  const toAncestors = ancestorPaths(graph, toId);

  const upPath = fromAncestors.get(toId);
  if (upPath) return lineageTermUp(upPath.length, to.gender, asSide(upPath[0]?.gender));

  const downPath = toAncestors.get(fromId);
  if (downPath) return lineageTermDown(downPath.length, to.gender, asSide(downPath[0]?.gender));

  let best: { lcaId: string; fromPath: P[]; toPath: P[] } | null = null;
  for (const [ancestorId, fromPath] of fromAncestors) {
    const toPath = toAncestors.get(ancestorId);
    if (!toPath) continue;
    if (!best || fromPath.length + toPath.length < best.fromPath.length + best.toPath.length) {
      best = { lcaId: ancestorId, fromPath, toPath };
    }
  }
  if (!best) return null;

  const { lcaId, fromPath, toPath } = best;
  const dFrom = fromPath.length;
  const dTo = toPath.length;

  if (dFrom === 1 && dTo === 1) return siblingTerm(to, from);
  if (dFrom === 2 && dTo === 1) return auntUncleTerm(to, asSide(fromPath[0]?.gender));
  if (dFrom === 1 && dTo === 2) return to.gender === 'nam' ? 'Cháu trai' : to.gender === 'nu' ? 'Cháu gái' : 'Cháu';
  if (dFrom === 2 && dTo === 2) return cousinTerm(to, from);

  const lca = graph.person(lcaId);
  return `Họ hàng (tổ tiên chung là ${lca?.full_name ?? '—'}; cách ${dFrom} đời bên ${from.full_name}, ${dTo} đời bên ${to.full_name})`;
};
