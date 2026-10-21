import { describe, expect, it } from 'vitest';
import { EPHEMERIS_MONTH_STARTS } from './ephemeris-months.ts';
import { fromJulianDay, julianDay, solarToLunar } from './index.ts';

describe('đối chiếu lịch thiên văn độc lập 2026–2046', () => {
  const months = EPHEMERIS_MONTH_STARTS.map((row) => {
    const [date, label] = row.split(' ');
    const [year, month, day] = date!.split('-').map(Number);
    return { solar: { year: year!, month: month!, day: day! }, month: parseInt(label!, 10), leap: label!.endsWith('n') };
  });

  it('mùng 1 mỗi tháng rơi đúng ngày, đúng tháng, đúng nhuận', () => {
    for (const { solar, month, leap } of months) {
      expect(solarToLunar(solar), JSON.stringify(solar)).toMatchObject({ day: 1, month, leap });
    }
  });

  it('ngày liền trước mùng 1 là ngày cuối của tháng trước (29 hoặc 30)', () => {
    for (const { solar } of months.slice(1)) {
      const eve = solarToLunar(fromJulianDay(julianDay(solar) - 1));
      expect([29, 30], JSON.stringify(solar)).toContain(eve.day);
    }
  });
});
