import { fetchAll } from '@gia-pha/db-paging';
import { createClient } from '@supabase/supabase-js';
import type { CalendarEvent, CalendarMarriage, CalendarPerson } from '@gia-pha/reminders';

export type ReminderData = {
  source: { trees: { id: string; name: string }[]; persons: CalendarPerson[]; events: CalendarEvent[]; marriages: CalendarMarriage[] };
  /** Email người nhận theo Gia phả: Chủ sở hữu + Biên tập viên đã duyệt, chưa tắt email ở Gia phả đó. */
  recipientsByTree: Map<string, string[]>;
};

type MarriageRow = Omit<CalendarMarriage, 'names'> & { status: string; a: { full_name: string } | null; b: { full_name: string } | null };

/** Mọi dữ liệu Worker cần, đọc bằng service_role (bỏ qua RLS — đây là tiến trình nền, không phải một tài khoản). */
export const loadReminderData = async (supabaseUrl: string, serviceRoleKey: string): Promise<ReminderData> => {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  // Danh sách cột các bảng lịch cũng nằm ở apps/web/src/data/calendar.ts và hàm SQL public_share.calendar_feed — sửa cả ba khi thêm trường.
  const readAll = async <Row>(table: string, columns: string, orderBy: string[]): Promise<Row[]> => {
    const { data, error } = await fetchAll<Row>((from, to) => {
      let query = supabase.from(table).select(columns);
      for (const column of orderBy) query = query.order(column);
      return query.range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>;
    });
    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  };
  const [trees, persons, events, unions, roles, prefs, approvals] = await Promise.all([
    readAll<{ id: string; name: string }>('family_trees', 'id, name', ['id']),
    readAll<CalendarPerson>('persons', 'id, tree_id, full_name, is_deceased, anniversary_day, anniversary_month, birth_solar_date', ['id']),
    readAll<CalendarEvent>('tree_events', 'id, tree_id, title, calendar, repeats_yearly, year, month, day, leap, start_time, location', ['id']),
    readAll<MarriageRow>(
      'unions',
      'id, tree_id, partner_a, marriage_year, marriage_month, marriage_day, status, a:persons!unions_partner_a_fkey(full_name), b:persons!unions_partner_b_fkey(full_name)',
      ['id'],
    ),
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
  const marriages = unions
    .filter((union) => union.marriage_day !== null && union.status !== 'ly_hon')
    .map(({ a, b, status: _status, ...union }) => ({ ...union, names: [a?.full_name, b?.full_name].filter(Boolean).join(' & ') }));
  return { source: { trees, persons, events, marriages }, recipientsByTree };
};
