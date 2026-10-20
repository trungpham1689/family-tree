import { describe, expect, it } from 'vitest';
import { describeEvent, EMPTY_EVENT_FORM, parseEventForm } from './event-form';

describe('form Sự kiện', () => {
  it('âm lịch lặp hằng năm', () => {
    const result = parseEventForm({ ...EMPTY_EVENT_FORM, title: ' Họp họ ', day: '10', month: '1', year: '2020', time: '08:30', location: 'Nhà thờ họ', showInTimeline: false });
    expect(result).toEqual({
      ok: true,
      fields: {
        title: 'Họp họ',
        calendar: 'am',
        repeats_yearly: true,
        repeats_monthly: false,
        year: 2020,
        month: 1,
        day: 10,
        leap: false,
        start_time: '08:30',
        location: 'Nhà thờ họ',
        note: null,
        host_person_id: null,
        show_in_pha_ky: true,
        show_in_timeline: false,
      },
    });
  });

  it('dương một lần cần năm và ngày có thật', () => {
    const base = { ...EMPTY_EVENT_FORM, title: 'Khánh thành', calendar: 'duong' as const, repeat: 'once' as const };
    expect(parseEventForm({ ...base, day: '20', month: '12' })).toMatchObject({ ok: false, errors: { year: expect.any(String) } });
    expect(parseEventForm({ ...base, day: '31', month: '4', year: '2027' })).toMatchObject({ ok: false, errors: { day: expect.any(String) } });
    expect(parseEventForm({ ...base, day: '20', month: '12', year: '2026' })).toMatchObject({ ok: true });
  });

  it('tháng nhuận phải có thật trong năm đó', () => {
    const base = { ...EMPTY_EVENT_FORM, title: 'Lễ', repeat: 'once' as const, leap: true, day: '15', month: '6' };
    expect(parseEventForm({ ...base, year: '2025' })).toMatchObject({ ok: true });
    expect(parseEventForm({ ...base, year: '2026' })).toMatchObject({ ok: false, errors: { day: expect.stringContaining('nhuận') } });
  });

  it('báo lỗi tên trống, giờ sai', () => {
    const result = parseEventForm({ ...EMPTY_EVENT_FORM, day: '1', month: '1', year: '2020', time: '25:00', showInTimeline: false });
    expect(result).toMatchObject({ ok: false, errors: { title: expect.any(String), time: expect.any(String) } });
  });

  it('hằng tháng: chỉ cần ngày và năm bắt đầu, không tháng nhuận', () => {
    const base = { ...EMPTY_EVENT_FORM, title: 'Sinh hoạt mùng một', repeat: 'monthly' as const, day: '1', month: '7', leap: true, showInTimeline: false };
    expect(parseEventForm({ ...base, year: '2020' })).toMatchObject({ ok: true, fields: { repeats_monthly: true, repeats_yearly: false, month: null, leap: false, year: 2020 } });
    expect(parseEventForm(base)).toMatchObject({ ok: false, errors: { year: expect.any(String) } });
    expect(parseEventForm({ ...base, year: 'abc' })).toMatchObject({ ok: false, errors: { year: expect.any(String) } });
    expect(parseEventForm({ ...base, year: '2020', calendar: 'duong', day: '31' })).toMatchObject({ ok: true });
    expect(parseEventForm({ ...base, year: '2020', day: '31' })).toMatchObject({ ok: false, errors: { day: expect.any(String) } });
  });

  it('mọi sự kiện cần năm; chủ trì và hai cờ hiển thị được lưu', () => {
    const base = { ...EMPTY_EVENT_FORM, title: 'Họp họ', day: '10', month: '1', hostPersonId: 'p1', showInPhaKy: false };
    expect(parseEventForm({ ...base, showInTimeline: true })).toMatchObject({ ok: false, errors: { year: expect.any(String) } });
    expect(parseEventForm({ ...base, showInTimeline: true, year: '2020' })).toMatchObject({
      ok: true,
      fields: { year: 2020, host_person_id: 'p1', show_in_pha_ky: false, show_in_timeline: true },
    });
  });

  it('mô tả dễ đọc', () => {
    expect(
      describeEvent({ calendar: 'am', repeats_yearly: true, repeats_monthly: false, year: null, month: 1, day: 10, leap: false, start_time: '08:30:00', location: 'Nhà thờ họ' }),
    ).toBe('Ngày 10 tháng 1 âm lịch, hằng năm · 08:30 · Nhà thờ họ');
    expect(describeEvent({ calendar: 'am', repeats_yearly: false, repeats_monthly: true, year: null, month: null, day: 1, leap: false, start_time: null, location: null })).toBe(
      'Ngày 1 âm lịch, hằng tháng',
    );
    expect(
      describeEvent({ calendar: 'duong', repeats_yearly: false, year: 2026, month: 12, day: 20, leap: false, start_time: null, location: null }),
    ).toBe('Ngày 20/12/2026');
  });
});
