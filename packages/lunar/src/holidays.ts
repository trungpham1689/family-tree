import { lunarMonthLength, solarToLunar, type SolarDate } from './convert.ts';
import { solarTermStartingOn } from './solar-terms.ts';

export type Holiday = { name: string; calendar: 'duong' | 'am' | 'tiet-khi'; dayOff: boolean };

const SOLAR_HOLIDAYS: Record<string, Omit<Holiday, 'calendar'>> = {
  '1/1': { name: 'Tết Dương lịch', dayOff: true },
  '14/2': { name: 'Lễ Tình nhân', dayOff: false },
  '8/3': { name: 'Quốc tế Phụ nữ', dayOff: false },
  '30/4': { name: 'Ngày Giải phóng miền Nam', dayOff: true },
  '1/5': { name: 'Quốc tế Lao động', dayOff: true },
  '1/6': { name: 'Quốc tế Thiếu nhi', dayOff: false },
  '27/7': { name: 'Ngày Thương binh Liệt sĩ', dayOff: false },
  '2/9': { name: 'Quốc khánh', dayOff: true },
  '20/10': { name: 'Ngày Phụ nữ Việt Nam', dayOff: false },
  '20/11': { name: 'Ngày Nhà giáo Việt Nam', dayOff: false },
  '22/12': { name: 'Ngày thành lập Quân đội Nhân dân', dayOff: false },
  '24/12': { name: 'Lễ Giáng sinh', dayOff: false },
};

const LUNAR_HOLIDAYS: Record<string, Omit<Holiday, 'calendar'>> = {
  '1/1': { name: 'Tết Nguyên Đán', dayOff: true },
  '2/1': { name: 'Mùng 2 Tết', dayOff: true },
  '3/1': { name: 'Mùng 3 Tết', dayOff: true },
  '15/1': { name: 'Tết Nguyên Tiêu (Rằm tháng Giêng)', dayOff: false },
  '3/3': { name: 'Tết Hàn thực', dayOff: false },
  '10/3': { name: 'Giỗ Tổ Hùng Vương', dayOff: true },
  '15/4': { name: 'Lễ Phật đản', dayOff: false },
  '5/5': { name: 'Tết Đoan ngọ', dayOff: false },
  '15/7': { name: 'Lễ Vu lan', dayOff: false },
  '15/8': { name: 'Tết Trung thu', dayOff: false },
  '23/12': { name: 'Ông Công ông Táo', dayOff: false },
};

const TERM_HOLIDAYS = new Set(['Thanh minh']);

/** Ngày lễ rơi vào một ngày dương (có thể nhiều hơn một). */
export const holidaysOn = (date: SolarDate): Holiday[] => {
  const holidays: Holiday[] = [];
  const solar = SOLAR_HOLIDAYS[`${date.day}/${date.month}`];
  if (solar) holidays.push({ ...solar, calendar: 'duong' });

  const lunar = solarToLunar(date);
  if (!lunar.leap) {
    const fixed = LUNAR_HOLIDAYS[`${lunar.day}/${lunar.month}`];
    if (fixed) holidays.push({ ...fixed, calendar: 'am' });
    // Giao thừa: ngày cuối tháng Chạp (29 hoặc 30).
    if (lunar.month === 12 && lunar.day === lunarMonthLength(12, lunar.year)) {
      holidays.push({ name: 'Giao thừa', calendar: 'am', dayOff: true });
    }
  }

  const term = solarTermStartingOn(date);
  if (term && TERM_HOLIDAYS.has(term)) holidays.push({ name: `Tiết ${term}`, calendar: 'tiet-khi', dayOff: false });
  return holidays;
};
