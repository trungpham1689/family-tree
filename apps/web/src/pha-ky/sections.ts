import type { TreeEvent } from '../data/calendar';
import { describeEvent } from '../events/event-form';
import { anniversaryText } from '../people/person-display';
import { fieldLabel } from '../people/profile-fields';
import { cleanFreeText, type BranchSummary, type NotablePerson, type OriginSummary } from './narrative';

/**
 * Các khối trước phần theo Đời của Phả ký, dựng một lần dưới dạng dữ liệu: trang web vẽ chúng bằng JSX, file PDF
 * và file PDF vẽ bằng bảng/đoạn văn (`narrativeToPdf`) từ cùng dữ liệu này. Nội dung (chữ, thứ tự, khi nào có khối nào) nằm ở đây nên hai bản không lệch nhau.
 */
export type PhaKySection =
  | { kind: 'intro'; heading: string; text: string }
  | {
      kind: 'origin';
      heading: string;
      progenitorId: string;
      progenitorName: string;
      /** Câu mở: `before` + tên Thuỷ tổ + `after` (tên là liên kết trên web). */
      before: string;
      after: string;
      /** Giỗ, nơi thờ, mộ tổ — mỗi dòng một sự thật. */
      facts: { label: string; value: string }[];
    }
  | { kind: 'branches'; heading: string; items: { id: string; name: string; memberCount: number }[] }
  | { kind: 'notable'; heading: string; items: { id: string; name: string; title: string }[] }
  | { kind: 'events'; heading: string; items: PhaKyEvent[] };

/** Một Sự kiện trong Phả ký. Ảnh (nếu có) nằm ngoài dữ liệu này, theo `id`, vì là data URL nặng. */
export type PhaKyEvent = { id: string; title: string; when: string; host: string | null; description: string | null };

/** Sự kiện chọn "Đưa vào Phả ký": có năm thì xếp theo ngày, lặp không năm xếp sau theo tháng, ngày. */
export const phaKyEvents = (events: readonly TreeEvent[], hostName: (personId: string) => string | null): PhaKyEvent[] =>
  events
    .filter((event) => event.show_in_pha_ky)
    .toSorted(
      (a, b) =>
        (a.year ?? 99_999) - (b.year ?? 99_999) ||
        (a.month ?? 99) - (b.month ?? 99) ||
        a.day - b.day ||
        a.title.localeCompare(b.title, 'vi'),
    )
    .map((event) => ({
      id: event.id,
      title: event.title,
      when: describeEvent(event),
      host: event.host_person_id ? hostName(event.host_person_id) : null,
      description: event.note,
    }));

export const buildFrontSections = (input: {
  description: string | null;
  origin: OriginSummary | null;
  branches: readonly BranchSummary[];
  notable: readonly NotablePerson[];
  today: { year: number; month: number; day: number };
  /** Sự kiện đã chọn đưa vào Phả ký (xem `phaKyEvents`). */
  events?: readonly PhaKyEvent[];
}): PhaKySection[] => {
  const { description, origin, branches, notable, today, events = [] } = input;
  const sections: PhaKySection[] = [];
  if (description) sections.push({ kind: 'intro', heading: 'Lời mở đầu', text: description });
  if (origin?.progenitorName && origin.progenitorId) {
    const hometown = cleanFreeText(origin.hometown);
    const anniversary = anniversaryText({ day: origin.anniversaryDay, month: origin.anniversaryMonth }, today);
    const facts = [
      ...(anniversary ? [{ label: 'Giỗ Thuỷ tổ', value: anniversary }] : []),
      ...(origin.worshipPlace
        ? [{ label: 'Nơi thờ', value: `${origin.worshipPlace}${origin.worshipKeeper ? ` (người phụ trách: ${origin.worshipKeeper})` : ''}` }]
        : []),
      ...(origin.burialPlace ? [{ label: 'Mộ tổ', value: origin.burialPlace }] : []),
    ];
    sections.push({
      kind: 'origin',
      heading: 'Nguồn gốc và Thuỷ tổ',
      progenitorId: origin.progenitorId,
      progenitorName: origin.progenitorName,
      before: 'Dòng họ tôn ',
      after: ` làm Thuỷ tổ — người đời đầu tiên còn ghi lại được.${hometown ? ` ${fieldLabel('hometown', 'narrative')}: ${hometown}.` : ''}`,
      facts,
    });
  }
  if (branches.length > 0) {
    sections.push({ kind: 'branches', heading: 'Các chi trong họ', items: branches.map((b) => ({ id: b.branchId, name: b.founderName, memberCount: b.memberCount })) });
  }
  if (notable.length > 0) {
    sections.push({ kind: 'notable', heading: 'Người có chức tước, công trạng', items: notable.map((p) => ({ id: p.personId, name: p.fullName, title: p.title })) });
  }
  if (events.length > 0) sections.push({ kind: 'events', heading: 'Sự kiện của dòng họ', items: [...events] });
  return sections;
};
