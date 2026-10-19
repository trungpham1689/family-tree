import { julianDay, type SolarDate } from '@gia-pha/lunar';
import { digestOccurrences, type CalendarSource, type Occurrence } from '@gia-pha/reminders';

/** Chu kỳ gửi: cứ 5 ngày một lần, mỗi lần gom 5 ngày tới — không ngày nào bị bỏ sót hay gửi hai lần. */
export const DIGEST_PERIOD_DAYS = 5;

/** Một email cho cả Gia phả, gửi chung tới Chủ sở hữu và Biên tập viên. */
export type TreeDigest = { treeId: string; treeName: string; emails: string[]; occurrences: Occurrence[] };

/** Hôm nay có phải ngày gửi không (theo số ngày Julian, chia hết cho chu kỳ). */
export const isDigestDay = (today: SolarDate): boolean => julianDay(today) % DIGEST_PERIOD_DAYS === 0;

/**
 * Với mỗi Gia phả có người nhận và có giỗ/Sự kiện trong `DIGEST_PERIOD_DAYS` ngày tới, dựng một bản tin.
 * Gồm giỗ, sinh nhật (người còn sống) và Sự kiện. Không có gì thì không có bản tin.
 */
export const buildDigests = (input: {
  today: SolarDate;
  source: CalendarSource;
  /** Email người nhận theo Gia phả: Chủ sở hữu + Biên tập viên đã duyệt, chưa tắt email. */
  recipientsByTree: ReadonlyMap<string, readonly string[]>;
}): TreeDigest[] => {
  const occurrences = digestOccurrences(input.source, input.today, DIGEST_PERIOD_DAYS);
  return input.source.trees.flatMap((tree) => {
    const emails = input.recipientsByTree.get(tree.id) ?? [];
    const own = occurrences.filter((occurrence) => occurrence.treeId === tree.id);
    return emails.length > 0 && own.length > 0 ? [{ treeId: tree.id, treeName: tree.name, emails: [...emails], occurrences: own }] : [];
  });
};
