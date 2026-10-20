import { supabase } from '../lib/supabase';
import { failOn } from './trees';

/** Đánh dấu một Người trong một Gia phả là chính tài khoản đang gọi; `personId` null là bỏ đánh dấu. */
export const linkAccountToPerson = async (input: { treeId: string; personId: string | null }): Promise<void> => {
  const { error } = await supabase.rpc('link_account_to_person', { target_tree: input.treeId, person_id: input.personId });
  failOn(error);
};

/** Người trong bảng `reminder_watch` của tài khoản — từ bản này nghĩa là ĐÃ TẮT nhắc giỗ (mặc định ai cũng được nhắc). */
export type MutedGioPerson = { personId: string; personName: string; treeId: string; treeName: string };

export const listMutedGioPersons = async (): Promise<MutedGioPerson[]> => {
  const { data, error } = await supabase
    .from('reminder_watch')
    .select('person_id, tree_id, persons (full_name), family_trees (name)');
  failOn(error);
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
  failOn(error);
};

/** Bật lại nhắc giỗ cho một Người đã tắt. */
export const unmuteGioReminder = async (personId: string): Promise<void> => {
  const { error } = await supabase.from('reminder_watch').delete().eq('person_id', personId);
  failOn(error);
};

/** Độ sớm nhắc cho phép: đúng ngày hoặc trước 1, 3, 7 ngày (khớp check của cột reminder_prefs.offset_days). */
export const REMINDER_OFFSETS = [0, 1, 3, 7] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export type ReminderPrefs = { offsetDays: number; emailEnabled: boolean; tienThuong: boolean };
export type ReminderPrefsByTree = Map<string, ReminderPrefs>;
/** Dạng lưu/giữ offline (JSON): mảng, vì Map/Set không qua JSON được. Hook đổi sang Map/Set bằng `select`. */
export type ReminderPrefsRow = ReminderPrefs & { treeId: string };

export const listReminderPrefs = async (): Promise<ReminderPrefsRow[]> => {
  const { data, error } = await supabase.from('reminder_prefs').select('tree_id, offset_days, email_enabled, tien_thuong');
  failOn(error);
  return data.map((row) => ({ treeId: row.tree_id, offsetDays: row.offset_days, emailEnabled: row.email_enabled, tienThuong: row.tien_thuong }));
};

export const prefsByTree = (rows: readonly ReminderPrefsRow[]): ReminderPrefsByTree =>
  new Map(rows.map(({ treeId, ...prefs }) => [treeId, prefs]));

export const setReminderOffset = async (input: { treeId: string; offsetDays: ReminderOffset }): Promise<void> => {
  const { error } = await supabase
    .from('reminder_prefs')
    .upsert({ tree_id: input.treeId, offset_days: input.offsetDays }, { onConflict: 'account_id,tree_id' });
  failOn(error);
};

export const setEmailEnabled = async (input: { treeId: string; emailEnabled: boolean }): Promise<void> => {
  const { error } = await supabase
    .from('reminder_prefs')
    .upsert({ tree_id: input.treeId, email_enabled: input.emailEnabled }, { onConflict: 'account_id,tree_id' });
  failOn(error);
};

/** Nhắc thêm "Tiên thường" (hôm trước ngày giỗ) trên chuông nhắc nhở của một gia phả. */
export const setTienThuong = async (input: { treeId: string; tienThuong: boolean }): Promise<void> => {
  const { error } = await supabase
    .from('reminder_prefs')
    .upsert({ tree_id: input.treeId, tien_thuong: input.tienThuong }, { onConflict: 'account_id,tree_id' });
  failOn(error);
};

export const listNotificationReads = async (): Promise<string[]> => {
  const { data, error } = await supabase.from('notification_reads').select('notification_key');
  failOn(error);
  return data.map((row) => row.notification_key);
};

export const markNotificationsRead = async (notificationKeys: readonly string[]): Promise<void> => {
  if (notificationKeys.length === 0) return;
  const { error } = await supabase.from('notification_reads').upsert(notificationKeys.map((notification_key) => ({ notification_key })));
  failOn(error);
};
