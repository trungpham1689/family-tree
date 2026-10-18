import { supabase } from '../lib/supabase';
import { DataError } from './trees';

/** Đánh dấu một Người trong một Gia phả là chính tài khoản đang gọi; mồi Danh sách nhắc giỗ lần đầu. */
export const linkAccountToPerson = async (input: { treeId: string; personId: string }): Promise<void> => {
  const { error } = await supabase.rpc('link_account_to_person', { target_tree: input.treeId, person_id: input.personId });
  if (error) throw new DataError(error);
};

export type WatchedPerson = { personId: string; personName: string; treeId: string; treeName: string };

export const listReminderWatch = async (): Promise<WatchedPerson[]> => {
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

export const addToWatch = async (personId: string): Promise<void> => {
  const { error } = await supabase.from('reminder_watch').insert({ person_id: personId });
  if (error) throw new DataError(error);
};

export const removeFromWatch = async (personId: string): Promise<void> => {
  const { error } = await supabase.from('reminder_watch').delete().eq('person_id', personId);
  if (error) throw new DataError(error);
};

export type ReminderPrefsByTree = Map<string, number>;

export const listReminderPrefs = async (): Promise<ReminderPrefsByTree> => {
  const { data, error } = await supabase.from('reminder_prefs').select('tree_id, offset_days');
  if (error) throw new DataError(error);
  return new Map(data.map((row) => [row.tree_id, row.offset_days]));
};

export const setReminderOffset = async (input: { treeId: string; offsetDays: 0 | 1 | 3 | 7 }): Promise<void> => {
  const { error } = await supabase
    .from('reminder_prefs')
    .upsert({ tree_id: input.treeId, offset_days: input.offsetDays }, { onConflict: 'account_id,tree_id' });
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
