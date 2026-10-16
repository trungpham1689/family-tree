import { sunLongitudeSector } from './astronomy.ts';
import { julianDay, type SolarDate } from './convert.ts';

/** 24 tiết khí, bắt đầu từ Xuân phân (kinh độ mặt trời 0°), mỗi tiết 15°. */
export const SOLAR_TERMS = [
  'Xuân phân',
  'Thanh minh',
  'Cốc vũ',
  'Lập hạ',
  'Tiểu mãn',
  'Mang chủng',
  'Hạ chí',
  'Tiểu thử',
  'Đại thử',
  'Lập thu',
  'Xử thử',
  'Bạch lộ',
  'Thu phân',
  'Hàn lộ',
  'Sương giáng',
  'Lập đông',
  'Tiểu tuyết',
  'Đại tuyết',
  'Đông chí',
  'Tiểu hàn',
  'Đại hàn',
  'Lập xuân',
  'Vũ thủy',
  'Kinh trập',
] as const;

export type SolarTerm = (typeof SOLAR_TERMS)[number];

const termIndexAt = (jd: number): number => sunLongitudeSector(jd + 1, 24);

/** Tiết khí đang hiệu lực trong ngày. */
export const solarTermOf = (date: SolarDate): SolarTerm => SOLAR_TERMS[termIndexAt(julianDay(date))]!;

/** Tên tiết khí nếu ngày này là ngày bắt đầu một tiết khí mới, ngược lại null. */
export const solarTermStartingOn = (date: SolarDate): SolarTerm | null => {
  const jd = julianDay(date);
  const today = termIndexAt(jd);
  return today !== termIndexAt(jd - 1) ? SOLAR_TERMS[today]! : null;
};
