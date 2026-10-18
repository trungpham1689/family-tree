import { createClient } from '@supabase/supabase-js';
import type { CalendarEvent, CalendarPerson } from '@gia-pha/reminders';
import type { AccountPref } from './digest.ts';

export type ReminderData = {
  source: { trees: { id: string; name: string }[]; persons: CalendarPerson[]; events: CalendarEvent[] };
  emailByAccount: Map<string, string>;
  treesByAccount: Map<string, string[]>;
  watchByAccount: Map<string, Set<string>>;
  prefsByAccount: Map<string, Map<string, AccountPref>>;
  readByAccount: Map<string, Set<string>>;
};

/** Mọi dữ liệu Worker cần, đọc bằng service_role (bỏ qua RLS — đây là tiến trình nền, không phải một tài khoản). */
export const loadReminderData = async (supabaseUrl: string, serviceRoleKey: string): Promise<ReminderData> => {
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const [trees, persons, events, roles, watch, prefs, reads] = await Promise.all([
    supabase.from('family_trees').select('id, name'),
    supabase.from('persons').select('id, tree_id, full_name, is_deceased, anniversary_day, anniversary_month, birth_solar_date'),
    supabase.from('tree_events').select('id, tree_id, title, calendar, repeats_yearly, year, month, day, leap, start_time, location'),
    supabase.from('tree_roles').select('account_id, tree_id'),
    supabase.from('reminder_watch').select('account_id, person_id'),
    supabase.from('reminder_prefs').select('account_id, tree_id, offset_days, email_enabled'),
    supabase.from('notification_reads').select('account_id, notification_key'),
  ]);
  for (const result of [trees, persons, events, roles, watch, prefs, reads]) {
    if (result.error) throw new Error(result.error.message);
  }

  const treesByAccount = new Map<string, string[]>();
  for (const row of roles.data ?? []) treesByAccount.set(row.account_id, [...(treesByAccount.get(row.account_id) ?? []), row.tree_id]);

  const watchByAccount = new Map<string, Set<string>>();
  for (const row of watch.data ?? []) {
    const set = watchByAccount.get(row.account_id) ?? new Set<string>();
    set.add(row.person_id);
    watchByAccount.set(row.account_id, set);
  }

  const readByAccount = new Map<string, Set<string>>();
  for (const row of reads.data ?? []) {
    const set = readByAccount.get(row.account_id) ?? new Set<string>();
    set.add(row.notification_key);
    readByAccount.set(row.account_id, set);
  }

  const prefsByAccount = new Map<string, Map<string, AccountPref>>();
  for (const row of prefs.data ?? []) {
    const map = prefsByAccount.get(row.account_id) ?? new Map<string, AccountPref>();
    map.set(row.tree_id, { offsetDays: row.offset_days, emailEnabled: row.email_enabled });
    prefsByAccount.set(row.account_id, map);
  }

  // Email không nằm trong schema public (auth.users không lộ qua PostgREST) — dùng Admin API.
  const emailByAccount = new Map<string, string>();
  const PER_PAGE = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new Error(error.message);
    for (const user of data.users) if (user.email) emailByAccount.set(user.id, user.email);
    if (data.users.length < PER_PAGE) break;
  }

  return {
    source: {
      trees: trees.data ?? [],
      persons: (persons.data ?? []) as CalendarPerson[],
      events: (events.data ?? []) as CalendarEvent[],
    },
    emailByAccount,
    treesByAccount,
    watchByAccount,
    prefsByAccount,
    readByAccount,
  };
};
