import { supabase } from '../lib/supabase';
import { DataError } from './trees';

/** Đánh dấu một Người trong một Gia phả là chính tài khoản đang gọi; mồi Danh sách nhắc giỗ lần đầu. */
export const linkAccountToPerson = async (input: { treeId: string; personId: string }): Promise<void> => {
  const { error } = await supabase.rpc('link_account_to_person', { target_tree: input.treeId, person_id: input.personId });
  if (error) throw new DataError(error);
};

/** Người trong bảng `reminder_watch` của tài khoản — từ bản này nghĩa là ĐÃ TẮT nhắc giỗ (mặc định ai cũng được nhắc). */
export type MutedGioPerson = { personId: string; personName: string; treeId: string; treeName: string };

export const listMutedGioPersons = async (): Promise<MutedGioPerson[]> => {
  const { data, error } = await supabase
    .from('reminder_watch')
    .select('person_id, tree_id, persons (full_name), family_trees (name)');
  if (error) throw new DataError(error);
  return data.map((row) => ({
    personId: row.person_id,
    personName: row.persons?.full_name ?? '',
    treeId: row.tree_id,
    treeName: row.family_trees?.name ?? '',
  }));
};

/** Tắt nhắc giỗ cho một Người (mặc định ai cũng được nhắc, đây là ngoại lệ). */
export const muteGioReminder = async (personId: string): Promise<void> => {
  const { error } = await supabase.from('reminder_watch').insert({ person_id: personId });
  if (error) throw new DataError(error);
};

/** Bật lại nhắc giỗ cho một Người đã tắt. */
export const unmuteGioReminder = async (personId: string): Promise<void> => {
  const { error } = await supabase.from('reminder_watch').delete().eq('person_id', personId);
  if (error) throw new DataError(error);
};

export type ReminderPrefs = { offsetDays: number; emailEnabled: boolean };
export type ReminderPrefsByTree = Map<string, ReminderPrefs>;

export const listReminderPrefs = async (): Promise<ReminderPrefsByTree> => {
  const { data, error } = await supabase.from('reminder_prefs').select('tree_id, offset_days, email_enabled');
  if (error) throw new DataError(error);
  return new Map(data.map((row) => [row.tree_id, { offsetDays: row.offset_days, emailEnabled: row.email_enabled }]));
};

export const setReminderOffset = async (input: { treeId: string; offsetDays: 0 | 1 | 3 | 7 }): Promise<void> => {
  const { error } = await supabase
    .from('reminder_prefs')
    .upsert({ tree_id: input.treeId, offset_days: input.offsetDays }, { onConflict: 'account_id,tree_id' });
  if (error) throw new DataError(error);
};

export const setEmailEnabled = async (input: { treeId: string; emailEnabled: boolean }): Promise<void> => {
  const { error } = await supabase
    .from('reminder_prefs')
    .upsert({ tree_id: input.treeId, email_enabled: input.emailEnabled }, { onConflict: 'account_id,tree_id' });
  if (error) throw new DataError(error);
};

export const listNotificationReads = async (): Promise<Set<string>> => {
  const { data, error } = await supabase.from('notification_reads').select('notification_key');
  if (error) throw new DataError(error);
  return new Set(data.map((row) => row.notification_key));
};

export const markNotificationRead = async (notificationKey: string): Promise<void> => {
  const { error } = await supabase.from('notification_reads').upsert({ notification_key: notificationKey });
  if (error) throw new DataError(error);
};

export const markNotificationsRead = async (notificationKeys: readonly string[]): Promise<void> => {
  if (notificationKeys.length === 0) return;
  const { error } = await supabase.from('notification_reads').upsert(notificationKeys.map((notification_key) => ({ notification_key })));
  if (error) throw new DataError(error);
};
