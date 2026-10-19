import { describe, expect, it } from 'vitest';
import { todayInVietnam } from './today';

describe('todayInVietnam', () => {
  it('đổi sang ngày giờ Việt Nam (UTC+7), kể cả khi UTC còn là ngày hôm trước', () => {
    expect(todayInVietnam(new Date('2026-10-19T16:59:00Z'))).toEqual({ year: 2026, month: 10, day: 19 });
    expect(todayInVietnam(new Date('2026-10-19T17:00:00Z'))).toEqual({ year: 2026, month: 10, day: 20 });
    expect(todayInVietnam(new Date('2026-12-31T20:00:00Z'))).toEqual({ year: 2027, month: 1, day: 1 });
  });
});
