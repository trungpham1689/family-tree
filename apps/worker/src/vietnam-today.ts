import type { SolarDate } from '@gia-pha/lunar';

/**
 * Ngày hôm nay theo giờ Việt Nam, bất kể Worker chạy ở vùng nào.
 * Bản sao nhỏ của apps/web/src/calendar/month-grid.ts#todayInVietnam — phần còn lại của file đó
 * (lưới lịch tháng, tên thứ…) là chuyện hiển thị, không liên quan tới Worker này.
 */
export const todayInVietnam = (now: Date = new Date()): SolarDate => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
};
