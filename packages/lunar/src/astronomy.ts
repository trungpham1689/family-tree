/**
 * Phần tính thiên văn của thuật toán âm lịch Hồ Ngọc Đức
 * (https://www.informatik.uni-leipzig.de/~duc/amlich/), bản dựa trên
 * "Astronomical Algorithms" (Jean Meeus, 1998). Các hằng số giữ nguyên bản gốc.
 *
 * Mô-đun nội bộ: bên ngoài dùng các hàm trong convert.ts.
 */

/** Múi giờ Việt Nam (UTC+7), kinh tuyến 105° Đông. */
export const VIETNAM_TIME_ZONE = 7;

const floor = Math.floor;
const DEG = Math.PI / 180;

/** Số ngày Julius của một ngày dương lịch (lịch Gregory từ 15/10/1582, Julius trước đó). */
export const jdFromDate = (day: number, month: number, year: number): number => {
  const a = floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const gregorian = day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045;
  if (gregorian >= 2299161) return gregorian;
  return day + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - 32083;
};

export const jdToDate = (jd: number): { day: number; month: number; year: number } => {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = floor((4 * a + 3) / 146097);
    c = a - floor((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = floor((4 * c + 3) / 1461);
  const e = c - floor((1461 * d) / 4);
  const m = floor((5 * e + 2) / 153);
  return {
    day: e - floor((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * floor(m / 10),
    year: b * 100 + d - 4800 + floor(m / 10),
  };
};

/** Thời điểm (ngày Julius, giờ UTC) của lần sóc thứ k tính từ sóc 1/1/1900. */
const newMoon = (k: number): number => {
  const t = k / 1236.85;
  const t2 = t * t;
  const t3 = t2 * t;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * t - 0.009173 * t2) * DEG);
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3;
  const mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3;
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3;
  let c1 = (0.1734 - 0.000393 * t) * Math.sin(m * DEG) + 0.0021 * Math.sin(2 * DEG * m);
  c1 = c1 - 0.4068 * Math.sin(mpr * DEG) + 0.0161 * Math.sin(DEG * 2 * mpr);
  c1 = c1 - 0.0004 * Math.sin(DEG * 3 * mpr);
  c1 = c1 + 0.0104 * Math.sin(DEG * 2 * f) - 0.0051 * Math.sin(DEG * (m + mpr));
  c1 = c1 - 0.0074 * Math.sin(DEG * (m - mpr)) + 0.0004 * Math.sin(DEG * (2 * f + m));
  c1 = c1 - 0.0004 * Math.sin(DEG * (2 * f - m)) - 0.0006 * Math.sin(DEG * (2 * f + mpr));
  c1 = c1 + 0.001 * Math.sin(DEG * (2 * f - mpr)) + 0.0005 * Math.sin(DEG * (2 * mpr + m));
  const deltaT =
    t < -11
      ? 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
      : -0.000278 + 0.000265 * t + 0.000262 * t2;
  return jd1 + c1 - deltaT;
};

/** Kinh độ mặt trời (radian, 0..2π) tại thời điểm ngày Julius `jdn` (UTC). */
const sunLongitude = (jdn: number): number => {
  const t = (jdn - 2451545.0) / 36525;
  const t2 = t * t;
  const m = 357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2;
  const l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2;
  let dl = (1.9146 - 0.004817 * t - 0.000014 * t2) * Math.sin(DEG * m);
  dl = dl + (0.019993 - 0.000101 * t) * Math.sin(DEG * 2 * m) + 0.00029 * Math.sin(DEG * 3 * m);
  const longitude = (l0 + dl) * DEG;
  return longitude - Math.PI * 2 * floor(longitude / (Math.PI * 2));
};

/** Kinh độ mặt trời lúc 0h ngày `dayNumber` (giờ địa phương), chia thành `sectors` phần bằng nhau. */
export const sunLongitudeSector = (dayNumber: number, sectors: number, timeZone = VIETNAM_TIME_ZONE): number =>
  floor((sunLongitude(dayNumber - 0.5 - timeZone / 24) / (Math.PI * 2)) * sectors);

/** Ngày (số Julius, giờ địa phương) bắt đầu tháng âm có sóc thứ k. */
export const newMoonDay = (k: number, timeZone = VIETNAM_TIME_ZONE): number => floor(newMoon(k) + 0.5 + timeZone / 24);

/** Ngày bắt đầu tháng 11 âm lịch (tháng chứa Đông chí) của năm dương `year`. */
export const lunarMonth11Start = (year: number, timeZone = VIETNAM_TIME_ZONE): number => {
  const offset = jdFromDate(31, 12, year) - 2415021;
  const k = floor(offset / 29.530588853);
  const start = newMoonDay(k, timeZone);
  // Kinh độ mặt trời ≥ 270° nghĩa là tháng này đã qua Đông chí: lùi một tháng.
  return sunLongitudeSector(start, 12, timeZone) >= 9 ? newMoonDay(k - 1, timeZone) : start;
};

/**
 * Trong năm có tháng nhuận, vị trí (tính từ tháng 11 âm năm trước) của tháng đầu tiên
 * không chứa trung khí — đó là tháng nhuận.
 */
export const leapMonthOffset = (month11Start: number, timeZone = VIETNAM_TIME_ZONE): number => {
  const k = floor((month11Start - 2415021.076998695) / 29.530588853 + 0.5);
  let index = 1;
  let arc = sunLongitudeSector(newMoonDay(k + index, timeZone), 12, timeZone);
  let last: number;
  do {
    last = arc;
    index += 1;
    arc = sunLongitudeSector(newMoonDay(k + index, timeZone), 12, timeZone);
  } while (arc !== last && index < 14);
  return index - 1;
};
