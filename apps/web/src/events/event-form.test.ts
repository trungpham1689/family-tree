import { describe, expect, it } from 'vitest';
import { describeEvent, EMPTY_EVENT_FORM, parseEventForm } from './event-form';

describe('form Sự kiện', () => {
  it('âm lịch lặp hằng năm', () => {
    const result = parseEventForm({ ...EMPTY_EVENT_FORM, title: ' Họp họ ', day: '10', month: '1', time: '08:30', location: 'Nhà thờ họ' });
    expect(result).toEqual({
      ok: true,
      fields: {
        title: 'Họp họ',
        calendar: 'am',
        repeats_yearly: true,
        year: null,
        month: 1,
        day: 10,
        leap: false,
        start_time: '08:30',
        location: 'Nhà thờ họ',
        note: null,
      },
    });
  });

  it('dương một lần cần năm và ngày có thật', () => {
    const base = { ...EMPTY_EVENT_FORM, title: 'Khánh thành', calendar: 'duong' as const, repeatsYearly: false };
    expect(parseEventForm({ ...base, day: '20', month: '12' })).toMatchObject({ ok: false, errors: { year: expect.any(String) } });
    expect(parseEventForm({ ...base, day: '31', month: '4', year: '2027' })).toMatchObject({ ok: false, errors: { day: expect.any(String) } });
    expect(parseEventForm({ ...base, day: '20', month: '12', year: '2026' })).toMatchObject({ ok: true });
  });

  it('tháng nhuận phải có thật trong năm đó', () => {
    const base = { ...EMPTY_EVENT_FORM, title: 'Lễ', repeatsYearly: false, leap: true, day: '15', month: '6' };
    expect(parseEventForm({ ...base, year: '2025' })).toMatchObject({ ok: true });
    expect(parseEventForm({ ...base, year: '2026' })).toMatchObject({ ok: false, errors: { day: expect.stringContaining('nhuận') } });
  });

  it('báo lỗi tên trống, giờ sai', () => {
    const result = parseEventForm({ ...EMPTY_EVENT_FORM, day: '1', month: '1', time: '25:00' });
    expect(result).toMatchObject({ ok: false, errors: { title: expect.any(String), time: expect.any(String) } });
  });

  it('mô tả dễ đọc', () => {
    expect(
      describeEvent({ calendar: 'am', repeats_yearly: true, year: null, month: 1, day: 10, leap: false, start_time: '08:30:00', location: 'Nhà thờ họ' }),
    ).toBe('Ngày 10 tháng 1 âm lịch, hằng năm · 08:30 · Nhà thờ họ');
    expect(
      describeEvent({ calendar: 'duong', repeats_yearly: false, year: 2026, month: 12, day: 20, leap: false, start_time: null, location: null }),
    ).toBe('Ngày 20/12/2026');
  });
});
