import type { Occurrence } from '@gia-pha/reminders';
import { loadFontBinary } from '../data/pha-do';
import type { Person, TreeWithRole } from '../data/trees';
import type { FamilyGraph } from '../family/family-graph';
import type { TimelineEntry } from '../family/timeline';
import { downloadBlob, exportFileName } from '../lib/download';
import type { Drawing } from '../pha-do/drawing';
import { FONT_FAMILY_EXPORT_FILES, type PhaDoFontFamily } from '../pha-do/config';
import type { PngPlan } from '../pha-do/png';
import type { NarrativeGeneration } from '../pha-ky/narrative';
import type { PdfPhotos } from '../pha-ky/pdf';
import type { PhaKySection } from '../pha-ky/sections';
import type { BackupProgress } from '../backup/download-backup';

/**
 * Các việc "xuất file" của một gia phả, mỗi loại một mục: nạp lười thư viện nặng, nạp phông, đặt tên file, tải xuống, và câu báo
 * lỗi tiếng Việt. Giao diện chỉ gọi `runExport(kind, ...)` (xem use-tree-export.ts); không trang nào tự viết lại các bước này.
 */
type Fonts = { regular: string; bold: string };

const loadFonts = async (files: { regular: string; bold: string }): Promise<Fonts> => {
  const [regular, bold] = await Promise.all([loadFontBinary(files.regular), loadFontBinary(files.bold)]);
  return { regular, bold };
};

const NOTO = FONT_FAMILY_EXPORT_FILES['noto-serif'];

export type ExportJobs = {
  'pha-do-pdf': { input: { drawing: Drawing; fontFamily: PhaDoFontFamily }; result: void };
  'pha-do-png': { input: { drawing: Drawing; fontFamily: PhaDoFontFamily; plan: PngPlan }; result: void };
  'pha-ky-pdf': {
    input: { generations: NarrativeGeneration[]; front: PhaKySection[]; closing: string | null; photos: PdfPhotos };
    result: void;
  };
  'timeline-pdf': { input: { entries: readonly TimelineEntry[] }; result: void };
  xlsx: { input: { graph: FamilyGraph<Person> }; result: void };
  'backup-zip': { input: { tree: TreeWithRole; onProgress: (progress: BackupProgress) => void }; result: { failedImages: number } };
  ics: { input: { occurrences: readonly Occurrence[] }; result: void };
};
export type ExportKind = keyof ExportJobs;

type Job<K extends ExportKind> = {
  /** Câu báo khi xuất lỗi. */
  failure: string;
  run: (treeName: string, date: string, input: ExportJobs[K]['input']) => Promise<ExportJobs[K]['result']>;
};

export const EXPORT_JOBS: { [K in ExportKind]: Job<K> } = {
  'pha-do-pdf': {
    failure: 'Không tạo được file PDF. Hãy thử lại.',
    run: async (treeName, date, { drawing, fontFamily }) => {
      const [{ drawingToPdf }, fonts] = await Promise.all([import('../pha-do/pdf'), loadFonts(FONT_FAMILY_EXPORT_FILES[fontFamily])]);
      drawingToPdf(drawing, fonts, `Gia phả ${treeName}`).save(exportFileName('Pha-do', treeName, date, 'pdf'));
    },
  },
  'pha-do-png': {
    failure: 'Không tạo được ảnh PNG (trình duyệt có thể thiếu bộ nhớ). Hãy thử khổ nhỏ hơn hoặc dùng PDF.',
    run: async (treeName, date, { drawing, fontFamily, plan }) => {
      const [{ renderPng }, fonts] = await Promise.all([import('../pha-do/png-export'), loadFonts(FONT_FAMILY_EXPORT_FILES[fontFamily])]);
      downloadBlob(await renderPng(drawing, fonts, plan), exportFileName('Pha-do', treeName, `${date}-${plan.dpi}dpi`, 'png'));
    },
  },
  'pha-ky-pdf': {
    failure: 'Không tạo được file PDF. Hãy thử lại.',
    run: async (treeName, date, { generations, front, closing, photos }) => {
      const [{ narrativeToPdf }, fonts] = await Promise.all([import('../pha-ky/pdf'), loadFonts(NOTO)]);
      narrativeToPdf(generations, fonts, { treeName, date }, front, closing, photos).save(exportFileName('Pha-ky', treeName, date, 'pdf'));
    },
  },
  'timeline-pdf': {
    failure: 'Không tạo được file PDF. Hãy thử lại.',
    run: async (treeName, date, { entries }) => {
      const [{ timelineToPdf }, fonts] = await Promise.all([import('../family/timeline-pdf'), loadFonts(NOTO)]);
      timelineToPdf(entries, fonts, { treeName, date }).save(exportFileName('Dong-thoi-gian', treeName, date, 'pdf'));
    },
  },
  xlsx: {
    failure: 'Không tạo được file Excel. Hãy thử lại.',
    run: async (treeName, date, { graph }) => {
      const { downloadFamily } = await import('../excel/xlsx-io');
      await downloadFamily(treeName, graph, date);
    },
  },
  'backup-zip': {
    failure: 'Không tạo được file sao lưu. Hãy thử lại.',
    run: async (_treeName, date, { tree, onProgress }) => {
      const { downloadFullBackup } = await import('../backup/download-backup');
      return { failedImages: await downloadFullBackup(tree, date, onProgress) };
    },
  },
  ics: {
    failure: 'Không tạo được file lịch. Hãy thử lại.',
    run: async (_treeName, _date, { occurrences }) => {
      const { occurrencesToIcs } = await import('../calendar/ics');
      downloadBlob(new Blob([occurrencesToIcs(occurrences)], { type: 'text/calendar;charset=utf-8' }), 'lich-gia-pha.ics');
    },
  },
};
