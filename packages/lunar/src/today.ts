import type { SolarDate } from './convert.ts';

/** Ngày hôm nay theo giờ Việt Nam, bất kể máy hoặc vùng chạy mã đặt múi giờ nào (trình duyệt, Worker, Pages Function). */
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
