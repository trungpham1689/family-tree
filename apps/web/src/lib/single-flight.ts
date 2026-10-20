/**
 * Bọc một việc bất đồng bộ (gọi API, xuất file…) để chỉ chạy một lần tại một thời điểm: gọi lại khi lần trước chưa xong thì bị bỏ qua
 * (trả về ngay). Khoá đặt ngay lúc gọi, không chờ giao diện vẽ lại, nên bấm liên tiếp thật nhanh cũng không chạy hai lần.
 */
export const singleFlight = <Args extends unknown[]>(work: (...args: Args) => Promise<void>): ((...args: Args) => Promise<void>) => {
  let running = false;
  return async (...args) => {
    if (running) return;
    running = true;
    try {
      await work(...args);
    } finally {
      running = false;
    }
  };
};
