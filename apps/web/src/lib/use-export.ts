import { useRef, useState } from 'react';
import { singleFlight } from './single-flight';

/**
 * Trạng thái chung của các nút "Xuất …" (PDF, PNG…): việc nào đang chạy (`running`), lỗi tiếng Việt nếu hỏng, và `run`
 * bọc một việc xuất. Một nơi cho cách báo "đang xuất / lỗi" thay vì mỗi trang tự viết lại.
 */
export const useExport = <Kind extends string = 'export'>() => {
  const [running, setRunning] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Đang xuất thì bỏ qua lần bấm thêm (khoá đặt ngay lúc gọi, trước cả khi nút kịp bị vô hiệu).
  const guarded = useRef(
    singleFlight(async (kind: Kind, work: () => Promise<void> | void, failureMessage: string): Promise<void> => {
      setRunning(kind);
      setError(null);
      try {
        await work();
      } catch (error) {
        // Người dùng chỉ thấy câu báo tiếng Việt; lỗi gốc ghi ra console để còn tra được nguyên nhân.
        console.error(`Xuất "${kind}" lỗi:`, error);
        setError(failureMessage);
      } finally {
        setRunning(null);
      }
    }),
  );
  const run = (kind: Kind, work: () => Promise<void> | void, failureMessage: string): Promise<void> => guarded.current(kind, work, failureMessage);

  return { running, error, run };
};
