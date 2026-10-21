import { describe, expect, it } from 'vitest';
import { eventStatus, partitionByToday, weekdayShort } from './event-status';

const today = { year: 2026, month: 10, day: 21 };

describe('eventStatus', () => {
  it('đã qua: ghi số ngày trước', () => {
    expect(eventStatus({ year: 2026, month: 10, day: 17 }, today)).toEqual({ state: 'past', days: -4, label: 'Đã qua · 4 ngày trước' });
  });

  it('hôm nay', () => {
    expect(eventStatus(today, today)).toEqual({ state: 'today', days: 0, label: 'Hôm nay' });
  });

  it('trong 7 ngày tới là near, từ ngày thứ 8 là later', () => {
    expect(eventStatus({ year: 2026, month: 10, day: 28 }, today)).toMatchObject({ state: 'near', label: 'Còn 7 ngày' });
    expect(eventStatus({ year: 2026, month: 10, day: 29 }, today)).toMatchObject({ state: 'later', label: 'Còn 8 ngày' });
  });

  it('qua ranh giới tháng và năm', () => {
    expect(eventStatus({ year: 2027, month: 1, day: 1 }, { year: 2026, month: 12, day: 31 })).toMatchObject({ state: 'near', days: 1 });
    expect(eventStatus({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 })).toMatchObject({ state: 'past', days: -1 });
  });
});

describe('weekdayShort', () => {
  it('T4 cho Thứ Tư, CN cho Chủ nhật', () => {
    expect(weekdayShort(today)).toBe('T4');
    expect(weekdayShort({ year: 2026, month: 10, day: 25 })).toBe('CN');
  });
});

describe('partitionByToday', () => {
  const at = (day: number) => ({ date: { year: 2026, month: 10, day } });

  it('hôm nay và sắp tới giữ thứ tự, đã qua mới nhất trước', () => {
    const { upcoming, past } = partitionByToday([at(3), at(14), at(21), at(25)], today);
    expect(upcoming.map((item) => item.date.day)).toEqual([21, 25]);
    expect(past.map((item) => item.date.day)).toEqual([14, 3]);
  });

  it('chỉ có đã qua, hoặc chỉ có sắp tới, hoặc rỗng', () => {
    expect(partitionByToday([at(1), at(2)], today)).toEqual({ upcoming: [], past: [at(2), at(1)] });
    expect(partitionByToday([at(22)], today)).toEqual({ upcoming: [at(22)], past: [] });
    expect(partitionByToday([], today)).toEqual({ upcoming: [], past: [] });
  });
});
