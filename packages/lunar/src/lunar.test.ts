import * as reference from 'amlich';
import { describe, expect, it } from 'vitest';
import {
  anniversariesBetween,
  anniversaryFromDeath,
  anniversaryInLunarYear,
  dayCanChi,
  formatPartialDate,
  fromJulianDay,
  holidaysOn,
  julianDay,
  leapMonthOf,
  lunarMonthLength,
  lunarToSolar,
  monthCanChi,
  nextAnniversary,
  solarTermStartingOn,
  solarToLunar,
  toOtherCalendar,
  validatePartialDate,
  yearCanChi,
  zodiacHours,
  type SolarDate,
} from './index.ts';

const TZ = 7;
const d = (day: number, month: number, year: number): SolarDate => ({ day, month, year });

/** Đổi dương → âm bằng bản gốc của tác giả thuật toán. */
const referenceLunar = ({ day, month, year }: SolarDate) => {
  const [lunarDay, lunarMonth, lunarYear, leap] = reference.convertSolar2Lunar(day, month, year, TZ);
  return { year: lunarYear, month: lunarMonth, day: lunarDay, leap: leap === 1 };
};

const tetOf = (lunarYear: number) => lunarToSolar({ year: lunarYear, month: 1, day: 1, leap: false });

describe('đối chiếu với bản gốc Hồ Ngọc Đức, từng ngày 1900–2100', () => {
  it('dương → âm khớp mọi ngày và âm → dương trả về đúng ngày ban đầu', () => {
    const start = julianDay(d(1, 1, 1900));
    const end = julianDay(d(31, 12, 2100));
    const mismatches: string[] = [];

    let referenceBugDays = 0;
    for (let jd = start; jd <= end; jd += 1) {
      const solar = fromJulianDay(jd);
      const lunar = solarToLunar(solar);
      const expected = referenceLunar(solar);
      // Bản gốc trả "ngày 0" ở vài ngày hiếm (đã sửa ở convert.ts); khi đó ta phải ra
      // đúng ngày cuối của tháng trước, kiểm bằng cách so với ngày hôm trước.
      if (expected.day < 1) {
        referenceBugDays += 1;
        const yesterday = solarToLunar(fromJulianDay(jd - 1));
        expect(lunar).toEqual({ ...yesterday, day: yesterday.day + 1 });
      } else if (JSON.stringify(lunar) !== JSON.stringify(expected)) {
        mismatches.push(`${JSON.stringify(solar)}: ${JSON.stringify(lunar)} ≠ ${JSON.stringify(expected)}`);
      }
      const back = lunarToSolar(lunar);
      if (!back || julianDay(back) !== jd) mismatches.push(`khứ hồi ${JSON.stringify(solar)} → ${JSON.stringify(back)}`);
      if (mismatches.length > 5) break;
    }

    expect(mismatches).toEqual([]);
    expect(referenceBugDays).toBe(2);
  });
});

describe('các mốc thực tế', () => {
  it.each([
    // Lệch với lịch Trung Quốc do múi giờ, theo trang của Hồ Ngọc Đức.
    [1985, d(21, 1, 1985)],
    [2007, d(17, 2, 2007)],
    [2030, d(2, 2, 2030)],
    [2053, d(18, 2, 2053)],
    // Các năm gần đây.
    [2024, d(10, 2, 2024)],
    [2025, d(29, 1, 2025)],
    [2026, d(17, 2, 2026)],
  ])('Tết Nguyên Đán năm %i', (year, expected) => {
    expect(tetOf(year)).toEqual(expected);
  });

  it.each([
    [2017, 6],
    [2020, 4],
    [2023, 2],
    [2025, 6],
    [2033, 11],
  ])('năm %i nhuận tháng %i', (year, month) => {
    expect(leapMonthOf(year)).toBe(month);
  });

  it('năm không nhuận', () => {
    expect(leapMonthOf(2024)).toBeNull();
    expect(leapMonthOf(2026)).toBeNull();
  });

  it('độ dài tháng âm khớp bản gốc (đủ 30 / thiếu 29) cho 2000–2050', () => {
    for (let year = 2000; year <= 2050; year += 1) {
      const leapMonth = leapMonthOf(year);
      const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, leap: false }));
      if (leapMonth) months.push({ month: leapMonth, leap: true });
      for (const { month, leap } of months) {
        const [day30, m30, y30] = reference.convertLunar2Solar(30, month, year, leap ? 1 : 0, TZ);
        const hasDay30 = referenceLunar(d(day30, m30, y30)).day === 30;
        expect(lunarMonthLength(month, year, leap), `${month}${leap ? ' nhuận' : ''}/${year}`).toBe(hasDay30 ? 30 : 29);
      }
    }
  });

  it('không có tháng nhuận sai năm hoặc ngày 30 của tháng thiếu', () => {
    expect(lunarToSolar({ year: 2026, month: 6, day: 1, leap: true })).toBeNull();
    const shortMonth = Array.from({ length: 12 }, (_, i) => i + 1).find((month) => lunarMonthLength(month, 2026) === 29)!;
    expect(lunarToSolar({ year: 2026, month: shortMonth, day: 30, leap: false })).toBeNull();
  });
});

describe('can chi', () => {
  it.each([
    [1945, 'Ất Dậu'],
    [1968, 'Mậu Thân'],
    [2024, 'Giáp Thìn'],
    [2026, 'Bính Ngọ'],
  ])('năm %i là %s', (year, name) => {
    expect(yearCanChi(year)).toBe(name);
  });

  it('tháng Giêng năm Bính Ngọ là Canh Dần, tháng Chạp là Tân Sửu', () => {
    expect(monthCanChi({ year: 2026, month: 1 })).toBe('Canh Dần');
    expect(monthCanChi({ year: 2026, month: 12 })).toBe('Tân Sửu');
  });

  it('ngày 1/1/2000 là Mậu Ngọ, ngày hôm sau là Kỷ Mùi', () => {
    expect(dayCanChi(d(1, 1, 2000))).toBe('Mậu Ngọ');
    expect(dayCanChi(d(2, 1, 2000))).toBe('Kỷ Mùi');
  });

  it('mỗi ngày có đúng 6 giờ hoàng đạo; ngày Tý có giờ Tý (23–1)', () => {
    for (let offset = 0; offset < 12; offset += 1) {
      expect(zodiacHours(fromJulianDay(julianDay(d(1, 1, 2026)) + offset))).toHaveLength(6);
    }
    const tyDay = Array.from({ length: 12 }, (_, i) => fromJulianDay(julianDay(d(1, 1, 2026)) + i)).find((day) =>
      dayCanChi(day).endsWith('Tý'),
    )!;
    expect(zodiacHours(tyDay)[0]).toEqual({ chi: 'Tý', from: 23, to: 1 });
  });
});

describe('tiết khí và ngày lễ', () => {
  it('mỗi năm có đúng 24 ngày chuyển tiết khí; Đông chí rơi vào 21–22/12', () => {
    for (const year of [2000, 2026, 2050]) {
      let count = 0;
      let winterSolstice: SolarDate | null = null;
      for (let jd = julianDay(d(1, 1, year)); jd <= julianDay(d(31, 12, year)); jd += 1) {
        const term = solarTermStartingOn(fromJulianDay(jd));
        if (term) count += 1;
        if (term === 'Đông chí') winterSolstice = fromJulianDay(jd);
      }
      expect(count).toBe(24);
      expect(winterSolstice?.month).toBe(12);
      expect([21, 22]).toContain(winterSolstice?.day);
    }
  });

  it('nhận ra ngày lễ dương, âm và Giao thừa', () => {
    expect(holidaysOn(d(2, 9, 2026)).map((h) => h.name)).toContain('Quốc khánh');
    expect(holidaysOn(d(17, 2, 2026)).map((h) => h.name)).toContain('Tết Nguyên Đán');
    const giaoThua = fromJulianDay(julianDay(d(17, 2, 2026)) - 1);
    expect(holidaysOn(giaoThua).map((h) => h.name)).toContain('Giao thừa');
    const hungKings = lunarToSolar({ year: 2026, month: 3, day: 10, leap: false })!;
    expect(holidaysOn(hungKings).map((h) => h.name)).toContain('Giỗ Tổ Hùng Vương');
  });
});

describe('ngày giỗ', () => {
  it('giỗ ngày thường rơi đúng ngày âm mỗi năm 2026–2030', () => {
    for (let year = 2026; year <= 2030; year += 1) {
      const solar = anniversaryInLunarYear({ day: 7, month: 8 }, year);
      expect(solarToLunar(solar)).toEqual({ year, month: 8, day: 7, leap: false });
    }
  });

  it('người mất trong tháng nhuận được giỗ vào tháng thường cùng số', () => {
    const death = d(10, 8, 2025);
    expect(solarToLunar(death)).toMatchObject({ month: 6, leap: true });

    const anniversary = anniversaryFromDeath({ calendar: 'duong', precision: 'ngay', ...death, leap: false, approximate: false });
    expect(anniversary).toEqual({ day: 17, month: 6 });
    for (let year = 2026; year <= 2030; year += 1) {
      expect(solarToLunar(anniversaryInLunarYear(anniversary!, year))).toEqual({ year, month: 6, day: 17, leap: false });
    }
  });

  it('giỗ ngày 30 rơi vào ngày cuối tháng khi tháng thiếu (2026–2030)', () => {
    for (let year = 2026; year <= 2030; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        const lunar = solarToLunar(anniversaryInLunarYear({ day: 30, month }, year));
        expect(lunar.month).toBe(month);
        expect(lunar.leap).toBe(false);
        expect(lunar.day).toBe(lunarMonthLength(month, year));
      }
    }
  });

  it('liệt kê các lần giỗ trong một khoảng dương lịch', () => {
    const dates = anniversariesBetween({ day: 15, month: 7 }, d(1, 1, 2026), d(31, 12, 2028));
    expect(dates).toHaveLength(3);
    expect(dates.map((date) => solarToLunar(date).month)).toEqual([7, 7, 7]);
  });

  it('lần giỗ kế tiếp tính cả hôm nay', () => {
    const thisYear = anniversaryInLunarYear({ day: 7, month: 8 }, 2026);
    expect(nextAnniversary({ day: 7, month: 8 }, thisYear)).toEqual(thisYear);
    const dayAfter = fromJulianDay(julianDay(thisYear) + 1);
    expect(solarToLunar(nextAnniversary({ day: 7, month: 8 }, dayAfter)).year).toBe(2027);
  });
});

describe('Ngày không đầy đủ', () => {
  it('hiển thị theo độ chính xác', () => {
    expect(formatPartialDate({ calendar: 'duong', precision: 'nam', year: 1890, approximate: true })).toBe('khoảng 1890');
    expect(formatPartialDate({ calendar: 'am', precision: 'thang', year: 1890, month: 3, leap: false, approximate: false })).toBe(
      '3/1890 ÂL',
    );
    expect(
      formatPartialDate({ calendar: 'am', precision: 'ngay', year: 2025, month: 6, day: 12, leap: true, approximate: false }),
    ).toBe('12/6 nhuận/2025 ÂL');
    expect(formatPartialDate({ calendar: 'duong', precision: 'ngay', year: 1945, month: 9, day: 2, leap: false, approximate: false })).toBe(
      '02/09/1945',
    );
  });

  it('đổi sang lịch kia khi đủ ngày, giữ cờ "khoảng"', () => {
    const solar = { calendar: 'duong', precision: 'ngay', year: 2026, month: 2, day: 17, leap: false, approximate: true } as const;
    expect(toOtherCalendar(solar)).toEqual({ calendar: 'am', precision: 'ngay', year: 2026, month: 1, day: 1, leap: false, approximate: true });
    expect(toOtherCalendar({ calendar: 'am', precision: 'thang', year: 2026, month: 1, leap: false, approximate: false })).toBeNull();
  });

  it('báo lỗi ngày không tồn tại', () => {
    expect(validatePartialDate({ calendar: 'duong', precision: 'ngay', year: 2025, month: 2, day: 29, leap: false, approximate: false })).toMatch(
      /chỉ có 28 ngày/,
    );
    expect(validatePartialDate({ calendar: 'am', precision: 'thang', year: 2026, month: 5, leap: true, approximate: false })).toMatch(
      /không có tháng 5 nhuận/,
    );
    expect(validatePartialDate({ calendar: 'duong', precision: 'nam', year: 0, approximate: false })).toMatch(/Năm/);
    expect(validatePartialDate({ calendar: 'am', precision: 'ngay', year: 2025, month: 6, day: 12, leap: true, approximate: false })).toBeNull();
  });

  it('không suy được ngày giỗ khi chỉ biết năm mất', () => {
    expect(anniversaryFromDeath({ calendar: 'duong', precision: 'nam', year: 1950, approximate: false })).toBeNull();
  });
});
