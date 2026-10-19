import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fromJulianDay, julianDay } from '@gia-pha/lunar';
import { todayInVietnam } from '../calendar/month-grid';
import { dueReminders, occurrencesBetween, tienThuongOf } from '@gia-pha/reminders';
import {
  linkAccountToPerson,
  listMutedGioPersons,
  listNotificationReads,
  listReminderPrefs,
  markNotificationsRead,
  muteGioReminder,
  setEmailEnabled,
  setTienThuong,
  setReminderOffset,
  unmuteGioReminder,
} from './reminders';
import { treeKeys } from './query-keys';
import { useMyCalendar } from './calendar-queries';

// ---------------------------------------------------------------------------
// Nhắc nhở: liên kết tài khoản–Người, Danh sách nhắc giỗ, độ sớm nhắc, đã đọc
// ---------------------------------------------------------------------------
const MAX_OFFSET_DAYS = 7;

export const useLinkAccountToPerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) => linkAccountToPerson({ treeId, personId }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: treeKeys.detail(treeId) }),
        queryClient.invalidateQueries({ queryKey: ['reminder-watch'] }),
      ]),
  });
};

/** Những Người tài khoản đang xem đã tắt nhắc giỗ (mặc định ai cũng được nhắc, trừ Người trong danh sách này). */
export const useMutedGioPersons = () => useQuery({ queryKey: ['reminder-watch'], queryFn: listMutedGioPersons });

export const useToggleGioMute = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['reminder-watch'] });
  const mute = useMutation({ mutationFn: muteGioReminder, onSuccess: invalidate });
  const unmute = useMutation({ mutationFn: unmuteGioReminder, onSuccess: invalidate });
  return { mute, unmute };
};

export const useReminderPrefs = () => useQuery({ queryKey: ['reminder-prefs'], queryFn: listReminderPrefs });

export const useSetReminderOffset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setReminderOffset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminder-prefs'] }),
  });
};

export const useSetEmailEnabled = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setEmailEnabled,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminder-prefs'] }),
  });
};

export const useSetTienThuong = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setTienThuong,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminder-prefs'] }),
  });
};

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-reads'] }),
  });
};

/** Nhắc nhở đến hạn của tài khoản đang đăng nhập: giỗ nhắc mặc định (trừ Người đã tắt), sinh nhật và Sự kiện không lọc. */
export const useDueReminders = () => {
  const calendar = useMyCalendar(true);
  const muted = useMutedGioPersons();
  const prefs = useReminderPrefs();
  const reads = useQuery({ queryKey: ['notification-reads'], queryFn: listNotificationReads });

  const due = useMemo(() => {
    if (!calendar.data) return [];
    const today = todayInVietnam();
    // +1 ngày: giỗ của ngày mai cho ra Tiên thường vào hôm nay.
    const base = occurrencesBetween(calendar.data, today, fromJulianDay(julianDay(today) + MAX_OFFSET_DAYS + 1));
    const withTienThuong = tienThuongOf(base.filter((occurrence) => prefs.data?.get(occurrence.treeId)?.tienThuong));
    const occurrences = [...base, ...withTienThuong];
    const mutedIds = new Set((muted.data ?? []).map((row) => row.personId));
    const offsetsByTree = new Map([...(prefs.data ?? new Map())].map(([treeId, pref]) => [treeId, pref.offsetDays]));
    return dueReminders(occurrences, today, mutedIds, offsetsByTree);
  }, [calendar.data, muted.data, prefs.data]);

  const readKeys = reads.data ?? new Set<string>();
  const unread = due.filter((reminder) => !readKeys.has(reminder.key));

  return {
    isPending: calendar.isPending || muted.isPending || prefs.isPending || reads.isPending,
    due,
    unread,
    readKeys,
  };
};
