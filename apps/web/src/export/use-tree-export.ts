import { toIsoDate, todayInVietnam } from '../calendar/month-grid';
import { useExport } from '../lib/use-export';
import { EXPORT_JOBS, type ExportJobs, type ExportKind } from './tree-exports';

/**
 * Giao diện duy nhất để xuất file của một gia phả: `run(kind, input)` tự đặt trạng thái đang xuất, báo lỗi đúng câu của loại đó,
 * và trả kết quả của việc xuất (nếu có). Ngày trong tên file là ngày hôm nay theo giờ Việt Nam.
 */
export const useTreeExport = (treeName: string) => {
  const { running, error, run: runWithState } = useExport<ExportKind>();

  const run = async <K extends ExportKind>(kind: K, input: ExportJobs[K]['input']): Promise<ExportJobs[K]['result'] | undefined> => {
    const job = EXPORT_JOBS[kind];
    let result: ExportJobs[K]['result'] | undefined;
    await runWithState(
      kind,
      async () => {
        result = await job.run(treeName, toIsoDate(todayInVietnam()), input);
      },
      job.failure,
    );
    return result;
  };

  return { running, error, run };
};
