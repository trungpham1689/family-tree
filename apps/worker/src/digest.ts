import { fromJulianDay, julianDay, type SolarDate } from '@gia-pha/lunar';
import { dueReminders, occurrencesBetween, type CalendarSource, type Occurrence } from '@gia-pha/reminders';

/** Nhắc nhở của một tài khoản để gộp vào một email/ngày (Bản tin nhắc — SPEC story 65). */
export type AccountDigest = { accountId: string; email: string; occurrences: Occurrence[] };

export type AccountPref = { offsetDays: number; emailEnabled: boolean };

const MAX_OFFSET_DAYS = 7;

/**
 * Gộp dữ liệu toàn hệ thống thành một bản tin cho mỗi tài khoản còn nhắc nhở chưa đọc, chưa tắt
 * email ở gia phả đó. Dùng đúng occurrencesBetween + dueReminders mà web đang dùng (@gia-pha/reminders),
 * nên "đến hạn" tính y hệt giữa app và email.
 */
export const buildDigests = (input: {
  today: SolarDate;
  source: CalendarSource;
  emailByAccount: ReadonlyMap<string, string>;
  treesByAccount: ReadonlyMap<string, readonly string[]>;
  watchByAccount: ReadonlyMap<string, ReadonlySet<string>>;
  prefsByAccount: ReadonlyMap<string, ReadonlyMap<string, AccountPref>>;
  readByAccount: ReadonlyMap<string, ReadonlySet<string>>;
}): AccountDigest[] => {
  const windowEnd = fromJulianDay(julianDay(input.today) + MAX_OFFSET_DAYS);
  const allOccurrences = occurrencesBetween(input.source, input.today, windowEnd);
  const digests: AccountDigest[] = [];

  for (const [accountId, email] of input.emailByAccount) {
    const treeIds = input.treesByAccount.get(accountId) ?? [];
    const prefs = input.prefsByAccount.get(accountId) ?? new Map<string, AccountPref>();
    const emailTrees = new Set(treeIds.filter((treeId) => prefs.get(treeId)?.emailEnabled ?? true));
    if (emailTrees.size === 0) continue;

    const offsetsByTree = new Map(treeIds.map((treeId) => [treeId, prefs.get(treeId)?.offsetDays ?? 0]));
    const relevant = allOccurrences.filter((occurrence) => emailTrees.has(occurrence.treeId));
    const watched = input.watchByAccount.get(accountId) ?? new Set<string>();
    const read = input.readByAccount.get(accountId) ?? new Set<string>();

    const due = dueReminders(relevant, input.today, watched, offsetsByTree).filter((item) => !read.has(item.key));
    if (due.length > 0) digests.push({ accountId, email, occurrences: due.map((item) => item.occurrence) });
  }

  return digests;
};
