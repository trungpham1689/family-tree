/**
 * Dữ liệu có thể sai: những năm sinh, năm mất, năm cưới không thể cùng đúng (con sinh trước cha mẹ, cưới sau khi mất…).
 * Chỉ so theo năm, vì nhiều hồ sơ chỉ biết năm; bỏ qua năm ghi "khoảng". Năm âm và năm dương lệch nhau tối đa 1 năm quanh Tết,
 * nên khi hai năm khác lịch thì nới thêm 1 năm để không báo nhầm.
 */

type Calendar = string;

export type CheckedPerson = {
  id: string;
  full_name: string;
  gender: string | null;
  is_deceased: boolean;
  birth_year: number | null;
  birth_calendar: Calendar;
  birth_approx: boolean;
  death_year: number | null;
  death_calendar: Calendar;
  death_approx: boolean;
};

type Link = { child_id: string; parent_id: string; kind: string };
/** Ngày cưới luôn là dương lịch. */
type Union = { partner_a: string; partner_b: string; marriage_year?: number | null };

export type Inconsistency<P> = { person: P; problems: string[] };

/** Cha mẹ ruột ít nhất bao nhiêu tuổi khi sinh con; cưới ít nhất bao nhiêu tuổi. */
const MIN_PARENT_AGE = 13;
const MAX_MOTHER_AGE = 55;
const MAX_FATHER_AGE = 80;
const MIN_MARRIAGE_AGE = 13;
/** Còn sống mà quá tuổi này thì gần như chắc là quên đánh dấu đã mất (thông tin người còn sống bị ẩn khỏi link công khai). */
const MAX_LIVING_AGE = 110;

type Dated = { year: number; calendar: Calendar };

const birthOf = (person: CheckedPerson): Dated | null =>
  person.birth_year === null || person.birth_approx ? null : { year: person.birth_year, calendar: person.birth_calendar };
const deathOf = (person: CheckedPerson): Dated | null =>
  person.death_year === null || person.death_approx ? null : { year: person.death_year, calendar: person.death_calendar };

/** Khoảng cách năm `later − earlier`, nới về phía "hợp lý" thêm 1 năm khi hai năm khác lịch. */
const gap = (earlier: Dated, later: Dated, towards: 'larger' | 'smaller'): number => {
  const slack = earlier.calendar === later.calendar ? 0 : 1;
  return later.year - earlier.year + (towards === 'larger' ? slack : -slack);
};

export const findInconsistencies = <P extends CheckedPerson>(
  persons: readonly P[],
  parentLinks: readonly Link[],
  unions: readonly Union[],
  currentYear: number,
): Inconsistency<P>[] => {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const problems = new Map<string, string[]>();
  const report = (person: P, text: string) => problems.set(person.id, [...(problems.get(person.id) ?? []), text]);

  // "Mất trước khi sinh" không cần xét: database đã chặn năm mất nhỏ hơn năm sinh.
  for (const person of persons) {
    const birth = birthOf(person);
    if (birth && !person.is_deceased && currentYear - birth.year > MAX_LIVING_AGE) {
      report(person, `Đang ghi còn sống nhưng đã ${currentYear - birth.year} tuổi: có thể quên đánh dấu đã mất`);
    }
  }

  for (const link of parentLinks) {
    if (link.kind !== 'ruot') continue;
    const child = byId.get(link.child_id);
    const parent = byId.get(link.parent_id);
    if (!child || !parent) continue;
    const childBirth = birthOf(child);
    if (!childBirth) continue;
    const role = parent.gender === 'nu' ? 'mẹ' : parent.gender === 'nam' ? 'cha' : 'cha/mẹ';
    const parentBirth = birthOf(parent);
    if (parentBirth) {
      if (gap(parentBirth, childBirth, 'larger') < MIN_PARENT_AGE) {
        report(child, `Sinh năm ${childBirth.year}, khi ${role} ${parent.full_name} (sinh ${parentBirth.year}) chưa tới ${MIN_PARENT_AGE} tuổi`);
      }
      const maxAge = parent.gender === 'nu' ? MAX_MOTHER_AGE : parent.gender === 'nam' ? MAX_FATHER_AGE : null;
      if (maxAge !== null && gap(parentBirth, childBirth, 'smaller') > maxAge) {
        report(child, `Sinh năm ${childBirth.year}, khi ${role} ${parent.full_name} (sinh ${parentBirth.year}) đã ngoài ${maxAge} tuổi`);
      }
    }
    // Cha có thể mất khi con còn trong bụng mẹ, nên nới thêm 1 năm.
    const parentDeath = deathOf(parent);
    if (parentDeath && gap(parentDeath, childBirth, 'smaller') > 1) {
      report(child, `Sinh năm ${childBirth.year}, sau khi ${role} ${parent.full_name} mất (${parentDeath.year})`);
    }
  }

  for (const union of unions) {
    if (union.marriage_year === null || union.marriage_year === undefined) continue;
    const marriage: Dated = { year: union.marriage_year, calendar: 'duong' };
    for (const id of [union.partner_a, union.partner_b]) {
      const partner = byId.get(id);
      if (!partner) continue;
      const birth = birthOf(partner);
      if (birth && gap(birth, marriage, 'larger') < MIN_MARRIAGE_AGE) {
        report(partner, `Cưới năm ${marriage.year}, khi chưa tới ${MIN_MARRIAGE_AGE} tuổi (sinh ${birth.year})`);
      }
      const death = deathOf(partner);
      if (death && gap(death, marriage, 'smaller') > 0) report(partner, `Cưới năm ${marriage.year}, sau năm mất (${death.year})`);
    }
  }

  return persons.flatMap((person) => {
    const list = problems.get(person.id);
    return list ? [{ person, problems: list }] : [];
  });
};
