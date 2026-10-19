import { fetchAll } from '@gia-pha/db-paging';
import { createClient } from '@supabase/supabase-js';
import {
  CALENDAR_EVENT_COLUMNS,
  CALENDAR_MARRIAGE_COLUMNS,
  CALENDAR_PERSON_COLUMNS,
  isCalendarPerson,
  toCalendarMarriages,
  type CalendarEvent,
  type CalendarMarriage,
  type CalendarPerson,
  type MarriageRow,
} from '@gia-pha/reminders';

export type ReminderData = {
  source: { trees: { id: string; name: string }[]; persons: CalendarPerson[]; events: CalendarEvent[]; marriages: CalendarMarriage[] };
  /** Email người nhận theo Gia phả, do hàm SQL `digest_recipients` quyết định. */
  recipientsByTree: Map<string, string[]>;
};

/** Mọi dữ liệu Worker cần, đọc bằng service_role (bỏ qua RLS — đây là tiến trình nền, không phải một tài khoản). */
export const loadReminderData = async (supabaseUrl: string, serviceRoleKey: string): Promise<ReminderData> => {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  // Cột và bộ lọc của nguồn lịch lấy từ @gia-pha/reminders (calendar-source.ts), dùng chung với web và đối chiếu với hàm SQL calendar_feed.
  const readAll = async <Row>(table: string, columns: string, orderBy: string[]): Promise<Row[]> => {
    const { data, error } = await fetchAll<Row>((from, to) => {
      let query = supabase.from(table).select(columns);
      for (const column of orderBy) query = query.order(column);
      return query.range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>;
    });
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };
  const [trees, persons, events, unions, recipientRows] = await Promise.all([
    readAll<{ id: string; name: string }>('family_trees', 'id, name', ['id']),
    readAll<CalendarPerson>('persons', CALENDAR_PERSON_COLUMNS, ['id']),
    readAll<CalendarEvent>('tree_events', CALENDAR_EVENT_COLUMNS, ['id']),
    readAll<MarriageRow>('unions', CALENDAR_MARRIAGE_COLUMNS, ['id']),
    // Người nhận do database tính (Chủ sở hữu + Biên tập viên đã duyệt, chưa tắt email): một nơi giữ quy tắc.
    fetchAll<{ tree_id: string; email: string }>((from, to) =>
      supabase.rpc('digest_recipients').order('tree_id').order('email').range(from, to) as unknown as PromiseLike<{
        data: { tree_id: string; email: string }[] | null;
        error: { message?: string } | null;
      }>,
    ).then(({ data, error }) => {
      if (error) throw new Error(`digest_recipients: ${error.message}`);
      return data ?? [];
    }),
  ]);

  const recipientsByTree = new Map<string, string[]>();
  for (const { tree_id, email } of recipientRows) recipientsByTree.set(tree_id, [...(recipientsByTree.get(tree_id) ?? []), email]);
  return { source: { trees, persons: persons.filter(isCalendarPerson), events, marriages: toCalendarMarriages(unions) }, recipientsByTree };
};
