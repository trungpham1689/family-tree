// Kiểu cho gói `amlich` (bản JS gốc thuật toán Hồ Ngọc Đức), chỉ dùng làm đối chứng trong test.
declare module 'amlich' {
  /** [ngày, tháng, năm, nhuận (0/1)] */
  export function convertSolar2Lunar(dd: number, mm: number, yy: number, timeZone: number): [number, number, number, number];
  /** [ngày, tháng, năm]; [0, 0, 0] nếu tháng nhuận không tồn tại */
  export function convertLunar2Solar(
    lunarDay: number,
    lunarMonth: number,
    lunarYear: number,
    lunarLeap: number,
    timeZone: number,
  ): [number, number, number];
}
