import { describe, expect, it } from 'vitest';
import type { Person } from '../data/trees';
import { blankPerson } from '../test-support/person';
import { buildFamilyGraph } from '../family/family-graph';
import type { NarrativeItem } from './narrative';
import { ALL_NARRATIVE_FIELDS, DEFAULT_NARRATIVE_FIELDS, NARRATIVE_FIELDS, branchSummaries, buildNarrative, closingNote, notablePersons, originSummary } from './narrative';

const sample = () =>
  buildFamilyGraph({
    persons: [
      blankPerson({
        id: 'to',
        full_name: 'Nguyễn Văn Tổ',
        gender: 'nam',
        birth_year: 1850,
        is_deceased: true,
        death_year: 1920,
        hometown: 'Làng Đông, Thái Bình',
        anniversary_day: 12,
        anniversary_month: 3,
        worship_place: 'Nhà thờ họ Nguyễn',
        worship_keeper: 'Nguyễn Văn Trưởng',
        burial_place: 'Nghĩa trang dòng họ',
      }),
      blankPerson({ id: 'vo', full_name: 'Trần Thị Hoa', gender: 'nu', birth_year: 1855 }),
      blankPerson({
        id: 'con',
        full_name: 'Nguyễn Văn An',
        gender: 'nam',
        birth_year: 1875,
        birth_order: 1,
        occupation: 'Lý trưởng',
        title: 'Liệt sĩ chống Pháp',
        role_note: 'Trưởng chi 1',
        education: 'Cử nhân Nho học',
        residence: 'Hà Nội',
        biography: 'Người có công khai khẩn đất làng.',
      }),
      blankPerson({ id: 'con2', full_name: 'Nguyễn Văn Bình', gender: 'nam', birth_year: 1878, birth_order: 2 }),
    ],
    parentLinks: [
      { child_id: 'con', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con', parent_id: 'vo', kind: 'ruot' },
      { child_id: 'con2', parent_id: 'to', kind: 'ruot' },
      { child_id: 'con2', parent_id: 'vo', kind: 'ruot' },
    ],
    unions: [{ id: 'u1', partner_a: 'to', partner_b: 'vo', order_for_a: 1, order_for_b: 1, status: 'con' }],
    positions: [
      { person_id: 'to', generation: 1, branch_id: null, kind: 'thuy_to' },
      { person_id: 'vo', generation: 1, branch_id: null, kind: 'dau_re' },
      { person_id: 'con', generation: 2, branch_id: 'con', kind: 'dinh' },
      { person_id: 'con2', generation: 2, branch_id: 'con2', kind: 'dinh' },
    ],
  });

/** Tiêu đề + các dòng mô tả nối thành một đoạn văn, như đọc liền. */
const textOf = (item: NarrativeItem) => [`${item.name}${item.lifespan ? ` (${item.lifespan})` : ''}.`, ...item.lines].join(' ');
const detailOf = (item: NarrativeItem) => item.lines.join(' ');

describe('buildNarrative', () => {
  it('nhóm theo Đời, đúng thứ tự', () => {
    const generations = buildNarrative(sample());
    expect(generations.map((g) => g.generation)).toEqual([1, 2]);
    expect(generations[0]!.items.map((i) => i.personId)).toEqual(['to', 'vo']);
  });

  it('Thuỷ tổ: lifespan, câu Thuỷ tổ, hưởng thọ', () => {
    const generations = buildNarrative(sample());
    const text = textOf(generations[0]!.items.find((i) => i.personId === 'to')!);
    expect(text).toContain('Nguyễn Văn Tổ (1850 – 1920).');
    expect(text).toContain('Thuỷ tổ của dòng họ');
    expect(text).toContain('hưởng thọ 71 tuổi');
    expect(text).toContain('Kết hôn với Trần Thị Hoa');
  });

  it('con: thứ tự con, cha mẹ, chức tước, vai vế, học vấn, nơi ở, nghề nghiệp, tiểu sử', () => {
    const generations = buildNarrative(sample());
    const text = textOf(generations[1]!.items[0]!);
    expect(text).toContain('Con trưởng.');
    expect(text).toContain('Con của Nguyễn Văn Tổ và Trần Thị Hoa.');
    expect(text).toContain('Liệt sĩ chống Pháp.');
    expect(text).toContain('Trưởng chi 1.');
    expect(text).toContain('Nghề nghiệp: Lý trưởng.');
    expect(text).toContain('Học vấn: Cử nhân Nho học.');
    expect(text).toContain('Sinh sống tại Hà Nội.');
    expect(text).toContain('Người có công khai khẩn đất làng.');
  });

  it('Thuỷ tổ: quê quán, mộ tổ, nơi thờ', () => {
    const generations = buildNarrative(sample());
    const text = textOf(generations[0]!.items.find((i) => i.personId === 'to')!);
    expect(text).toContain('Nguyên quán: Làng Đông, Thái Bình.');
    expect(text).toContain('An táng tại Nghĩa trang dòng họ.');
    expect(text).toContain('Thờ phụng tại Nhà thờ họ Nguyễn.');
  });
});

describe('mục hồ sơ có nhãn riêng, không dính chùm', () => {
  const detailFor = (fields: Partial<Person>) => {
    const graph = buildFamilyGraph({
      persons: [blankPerson({ ...fields, id: 'p', full_name: 'Phạm Tổ', gender: 'nam', is_progenitor: true })],
      parentLinks: [],
      unions: [],
      positions: [{ person_id: 'p', generation: 1, branch_id: null, kind: 'thuy_to' }],
    });
    return detailOf(buildNarrative(graph)[0]!.items[0]!);
  };

  it('Nguyên quán và Sinh sống tại là hai câu riêng, mỗi câu có nhãn', () => {
    const detail = detailFor({ hometown: 'Làng Đông, Thái Bình', residence: 'Hà Nội' });
    expect(detail).toContain('Nguyên quán: Làng Đông, Thái Bình. Sinh sống tại Hà Nội.');
  });

  it('mỗi nội dung một dòng riêng (lines), nối lại thành detail', () => {
    const graph = buildFamilyGraph({
      persons: [blankPerson({ id: 'p', full_name: 'Phạm Tổ', gender: 'nam', is_progenitor: true, hometown: 'Làng Đông', residence: 'Hà Nội', occupation: 'Nông dân' })],
      parentLinks: [],
      unions: [],
      positions: [{ person_id: 'p', generation: 1, branch_id: null, kind: 'thuy_to' }],
    });
    const item = buildNarrative(graph)[0]!.items[0]!;
    expect(item.lines).toEqual([
      'Thuỷ tổ của dòng họ, người đời đầu tiên còn ghi lại được.',
      'Nguyên quán: Làng Đông.',
      'Sinh sống tại Hà Nội.',
      'Nghề nghiệp: Nông dân.',
    ]);
      });

  it('chỉ có Nguyên quán thì không thêm Sinh sống tại; trùng nơi ở thì không lặp', () => {
    expect(detailFor({ hometown: 'Làng Đông' })).toContain('Nguyên quán: Làng Đông.');
    expect(detailFor({ hometown: 'Làng Đông' })).not.toContain('Sinh sống tại');
    expect(detailFor({ hometown: 'Làng Đông', residence: ' làng Đông '.trim() })).toContain('Sinh sống tại làng Đông.');
    expect(detailFor({ hometown: 'Làng Đông', residence: 'Làng Đông.' })).not.toContain('Sinh sống tại');
  });

  it('chỉ có nơi ở thì không có nhãn Nguyên quán', () => {
    const detail = detailFor({ residence: 'Hà Nội' });
    expect(detail).toContain('Sinh sống tại Hà Nội.');
    expect(detail).not.toContain('Nguyên quán');
  });

  it('dấu câu cuối do người dùng gõ không sinh ".." hay dính vào câu sau', () => {
    const detail = detailFor({ hometown: 'Làng Đông.  ', residence: 'Hà Nội;', occupation: 'Nông dân,', title: 'Lý trưởng.', role_note: 'Trưởng chi 1' });
    expect(detail).not.toMatch(/\.\.|[,;:]\./);
    expect(detail).toContain('Nguyên quán: Làng Đông. Sinh sống tại Hà Nội.');
    expect(detail).toContain('Chức vụ / danh hiệu: Lý trưởng. Vai vế: Trưởng chi 1. Nghề nghiệp: Nông dân.');
  });

  it('Nơi sinh, Tên tự / hiệu, nơi an táng và thờ phụng đều có nhãn và không bị bỏ sót', () => {
    const detail = detailFor({ birth_place: 'Huế', courtesy_name: 'Văn Tổ', common_name: 'Cậu Tổ', is_deceased: true, burial_place: 'Nghĩa trang X.', worship_place: 'Từ đường' });
    expect(detail).toContain('Còn gọi là Cậu Tổ. Tên tự / hiệu: Văn Tổ.');
    expect(detail).toContain('Nơi sinh: Huế.');
    expect(detail).toContain('An táng tại Nghĩa trang X. Thờ phụng tại Từ đường.');
  });
});

describe('tuỳ chọn nội dung tóm tắt', () => {
  const linesOf = (fields?: Parameters<typeof buildNarrative>[1], id = 'to') =>
    buildNarrative(sample(), fields)
      .flatMap((g) => g.items)
      .find((item) => item.personId === id)!.lines;

  it('mặc định hiện tất cả; mỗi nhóm có đúng một nhãn', () => {
    expect(linesOf()).toEqual(linesOf(ALL_NARRATIVE_FIELDS));
    expect(new Set(NARRATIVE_FIELDS.map((f) => f.id)).size).toBe(NARRATIVE_FIELDS.length);
  });

  it('mặc định trên trang: Tên gọi khác, Cha mẹ, Chức vụ & vai vế (không có Thứ tự con)', () => {
    expect(DEFAULT_NARRATIVE_FIELDS).toEqual(['names', 'parents', 'role']);
    // Các nút chọn xếp nhóm mặc định lên đầu, đúng thứ tự đó.
    expect(NARRATIVE_FIELDS.slice(0, 3).map((field) => field.id)).toEqual([...DEFAULT_NARRATIVE_FIELDS]);
  });

  it('chỉ chọn một nhóm thì chỉ còn đúng nhóm đó', () => {
    expect(linesOf(['hometown'])).toEqual(['Nguyên quán: Làng Đông, Thái Bình.']);
    expect(linesOf(['marriage'])).toEqual(['Kết hôn với Trần Thị Hoa.']);
    expect(linesOf(['death'])).toEqual(['Mất, hưởng thọ 71 tuổi.']);
    expect(linesOf(['burial'])).toEqual(['An táng tại Nghĩa trang dòng họ.']);
    expect(linesOf(['worship'])).toEqual(['Thờ phụng tại Nhà thờ họ Nguyễn.']);
    expect(linesOf(['occupation'], 'con')).toEqual(['Nghề nghiệp: Lý trưởng.']);
    expect(linesOf(['role'], 'con')).toEqual(['Chức vụ / danh hiệu: Liệt sĩ chống Pháp.', 'Vai vế: Trưởng chi 1.']);
    expect(linesOf(['order'], 'con')).toEqual(['Con trưởng.']);
    expect(linesOf(['parents'], 'con')).toEqual(['Con của Nguyễn Văn Tổ và Trần Thị Hoa.']);
    expect(linesOf(['parents'])).toEqual(['Thuỷ tổ của dòng họ, người đời đầu tiên còn ghi lại được.']);
    expect(linesOf(['order'])).toEqual([]);
    expect(linesOf([])).toEqual([]);
  });

  it('bỏ Nguyên quán thì Nơi ở vẫn hiện dù trùng; còn Nguyên quán thì không lặp', () => {
    const graph = buildFamilyGraph({
      persons: [blankPerson({ id: 'p', full_name: 'Phạm Tổ', gender: 'nam', hometown: 'Hà Nội', residence: 'Hà Nội' })],
      parentLinks: [],
      unions: [],
      positions: [{ person_id: 'p', generation: 1, branch_id: null, kind: 'thuy_to' }],
    });
    const lines = (fields: Parameters<typeof buildNarrative>[1]) => buildNarrative(graph, fields)[0]!.items[0]!.lines;
    expect(lines(['hometown', 'residence'])).toEqual(['Nguyên quán: Hà Nội.']);
    expect(lines(['residence'])).toEqual(['Sinh sống tại Hà Nội.']);
  });

  it('Hôn nhân ghi tình trạng: ly hôn, góa', () => {
    const graph = buildFamilyGraph({
      persons: [
        blankPerson({ id: 'a', full_name: 'Phạm A', gender: 'nam' }),
        blankPerson({ id: 'b', full_name: 'Vợ Một', gender: 'nu' }),
        blankPerson({ id: 'c', full_name: 'Vợ Hai', gender: 'nu' }),
        blankPerson({ id: 'd', full_name: 'Vợ Ba', gender: 'nu' }),
      ],
      parentLinks: [],
      unions: [
        { id: 'u1', partner_a: 'a', partner_b: 'b', order_for_a: 1, order_for_b: 1, status: 'ly_hon' },
        { id: 'u2', partner_a: 'a', partner_b: 'c', order_for_a: 2, order_for_b: 1, status: 'goa' },
        { id: 'u3', partner_a: 'a', partner_b: 'd', order_for_a: 3, order_for_b: 1, status: 'con' },
      ],
      positions: [{ person_id: 'a', generation: 1, branch_id: null, kind: 'thuy_to' }],
    });
    const item = buildNarrative(graph, ['marriage']).flatMap((g) => g.items).find((i) => i.personId === 'a')!;
    expect(item.lines).toEqual(['Kết hôn với Vợ Một (đã ly hôn), Vợ Hai (góa), Vợ Ba.']);
  });
});

describe('notablePersons', () => {
  it('chỉ lấy người có điền Chức vụ/danh hiệu, kèm Đời', () => {
    const result = notablePersons(sample());
    expect(result).toEqual([{ personId: 'con', fullName: 'Nguyễn Văn An', title: 'Liệt sĩ chống Pháp', generation: 2 }]);
  });
});

describe('originSummary', () => {
  it('suy từ hồ sơ Thuỷ tổ: quê quán, giỗ, nơi thờ, mộ tổ', () => {
    expect(originSummary(sample())).toEqual({
      progenitorId: 'to',
      progenitorName: 'Nguyễn Văn Tổ',
      hometown: 'Làng Đông, Thái Bình',
      anniversaryDay: 12,
      anniversaryMonth: 3,
      worshipPlace: 'Nhà thờ họ Nguyễn',
      worshipKeeper: 'Nguyễn Văn Trưởng',
      burialPlace: 'Nghĩa trang dòng họ',
    });
  });
});

describe('branchSummaries', () => {
  it('mỗi con Đời 2 của Thuỷ tổ lập một chi, kèm số người', () => {
    const result = branchSummaries(sample());
    expect(result).toEqual(
      expect.arrayContaining([
        { branchId: 'con', founderName: 'Nguyễn Văn An', memberCount: 1 },
        { branchId: 'con2', founderName: 'Nguyễn Văn Bình', memberCount: 1 },
      ]),
    );
    expect(result).toHaveLength(2);
  });
});

describe('closingNote', () => {
  it('kèm ngày xem, nhắn gửi con cháu bổ sung', () => {
    const text = closingNote({ day: 19, month: 10, year: 2026 });
    expect(text).toContain('19/10/2026');
    expect(text).toContain('Gia phả điện tử');
  });
});
