import { createClient } from '@supabase/supabase-js';
import type { CalendarEvent, CalendarPerson } from '@gia-pha/reminders';

export type ReminderData = {
  source: { trees: { id: string; name: string }[]; persons: CalendarPerson[]; events: CalendarEvent[] };
  /** Email người nhận theo Gia phả: Chủ sở hữu + Biên tập viên đã duyệt, chưa tắt email ở Gia phả đó. */
  recipientsByTree: Map<string, string[]>;
};

/** Mọi dữ liệu Worker cần, đọc bằng service_role (bỏ qua RLS — đây là tiến trình nền, không phải một tài khoản). */
export const loadReminderData = async (supabaseUrl: string, serviceRoleKey: string): Promise<ReminderData> => {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  // PostgREST cắt mỗi truy vấn ở 1000 dòng (max_rows) — đọc từng trang, sắp theo khoá chính để không chồng/hụt.
  const PAGE_SIZE = 1000;
  const readAll = async <Row>(table: string, columns: string, orderBy: string[]): Promise<Row[]> => {
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase.from(table).select(columns);
      for (const column of orderBy) query = query.order(column);
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      rows.push(...((data ?? []) as Row[]));
      if ((data?.length ?? 0) < PAGE_SIZE) return rows;
    }
  };
  const [trees, persons, events, roles, prefs, approvals] = await Promise.all([
    readAll<{ id: string; name: string }>('family_trees', 'id, name', ['id']),
    readAll<CalendarPerson>('persons', 'id, tree_id, full_name, is_deceased, anniversary_day, anniversary_month, birth_solar_date', ['id']),
    readAll<CalendarEvent>('tree_events', 'id, tree_id, title, calendar, repeats_yearly, year, month, day, leap, start_time, location', ['id']),
    readAll<{ account_id: string; tree_id: string; role: string }>('tree_roles', 'account_id, tree_id, role', ['tree_id', 'account_id']),
    readAll<{ account_id: string; tree_id: string; email_enabled: boolean }>('reminder_prefs', 'account_id, tree_id, email_enabled', ['account_id', 'tree_id']),
    readAll<{ account_id: string; approved: boolean }>('account_approvals', 'account_id, approved', ['account_id']),
  ]);

  // Email không nằm trong schema public (auth.users không lộ qua PostgREST) — dùng Admin API.
  const emailByAccount = new Map<string, string>();
  const PER_PAGE = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(error.message);
    for (const user of data.users) if (user.email) emailByAccount.set(user.id, user.email);
    if (data.users.length < PER_PAGE) break;
  }

  // Tài khoản chưa được duyệt không dùng được app nên không nhận email; Người xem không nhận.
  const approved = new Set(approvals.filter((row) => row.approved).map((row) => row.account_id));
  const emailOff = new Set(prefs.filter((row) => !row.email_enabled).map((row) => `${row.account_id}:${row.tree_id}`));
  const recipientsByTree = new Map<string, string[]>();
  for (const role of roles) {
    const email = emailByAccount.get(role.account_id);
    if (!email || !approved.has(role.account_id) || emailOff.has(`${role.account_id}:${role.tree_id}`)) continue;
    if (role.role !== 'owner' && role.role !== 'editor') continue;
    recipientsByTree.set(role.tree_id, [...(recipientsByTree.get(role.tree_id) ?? []), email]);
  }
  return { source: { trees, persons, events }, recipientsByTree };
};
