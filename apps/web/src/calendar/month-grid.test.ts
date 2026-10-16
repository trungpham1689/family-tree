import { describe, expect, it } from 'vitest';
import { buildMonthGrid, parseIsoDate, shiftMonth, todayInVietnam, toIsoDate, weekdayName } from './month-grid';

describe('buildMonthGrid', () => {
  it('tuần bắt đầu từ thứ Hai và chứa đủ ngày trong tháng', () => {
    const weeks = buildMonthGrid(2026, 10);
    const inMonth = weeks.flat().filter((cell) => cell.inMonth);

    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(inMonth).toHaveLength(31);
    // 1/10/2026 là thứ Năm → ô đầu tiên là thứ Hai 28/9.
    expect(weeks[0]![0]!.date).toEqual({ year: 2026, month: 9, day: 28 });
    expect(weeks[0]![3]!.date).toEqual({ year: 2026, month: 10, day: 1 });
  });

  it('kèm ngày âm và ngày lễ', () => {
    const tet = buildMonthGrid(2026, 2)
      .flat()
      .find((cell) => cell.date.day === 17 && cell.inMonth)!;
    expect(tet.lunar).toEqual({ year: 2026, month: 1, day: 1, leap: false });
    expect(tet.holidays.map((holiday) => holiday.name)).toContain('Tết Nguyên Đán');
  });
});

describe('tiện ích ngày', () => {
  it('ngày hôm nay theo giờ Việt Nam', () => {
    // 20:00 UTC ngày 16/10 là 03:00 ngày 17/10 ở Việt Nam.
    expect(todayInVietnam(new Date('2026-10-16T20:00:00Z'))).toEqual({ year: 2026, month: 10, day: 17 });
  });

  it('chuyển tháng qua năm', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('đọc và ghi ngày trên URL, loại ngày không tồn tại', () => {
    expect(toIsoDate({ year: 2026, month: 2, day: 7 })).toBe('2026-02-07');
    expect(parseIsoDate('2026-02-07')).toEqual({ year: 2026, month: 2, day: 7 });
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('hôm nay')).toBeNull();
  });

  it('tên thứ', () => {
    expect(weekdayName({ year: 2026, month: 10, day: 16 })).toBe('Thứ Sáu');
    expect(weekdayName({ year: 2026, month: 10, day: 18 })).toBe('Chủ nhật');
  });
});
