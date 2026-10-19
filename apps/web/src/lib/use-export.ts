import { useState } from 'react';

/**
 * Trạng thái chung của các nút "Xuất …" (PDF, PNG…): việc nào đang chạy (`running`), lỗi tiếng Việt nếu hỏng, và `run`
 * bọc một việc xuất. Một nơi cho cách báo "đang xuất / lỗi" thay vì mỗi trang tự viết lại.
 */
export const useExport = <Kind extends string = 'export'>() => {
  const [running, setRunning] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: Kind, work: () => Promise<void> | void, failureMessage: string): Promise<void> => {
    setRunning(kind);
    setError(null);
    try {
      await work();
    } catch {
      setError(failureMessage);
    } finally {
      setRunning(null);
    }
  };

  return { running, error, run };
};
