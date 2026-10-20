/** Tuỳ chọn "Hiển thị Cháu ngoại" dùng chung cho Cây, Phả đồ và cài đặt gia phả. */
export const OUTSIDE_OPTIONS = [0, 1, 2, 3, 4, 5] as const;

export const outsideLabel = (generations: number): string => (generations === 0 ? 'Không hiện Cháu ngoại' : `Hiện Cháu ngoại ${generations} đời`);
