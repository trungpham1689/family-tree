import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { todayInVietnam } from '../calendar/month-grid';
import { bellReminders } from '@gia-pha/reminders';
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
import { queryKeys } from './query-keys';
import { useMyCalendar } from './calendar-queries';

// ---------------------------------------------------------------------------
// Nhắc nhở: liên kết tài khoản–Người, Danh sách nhắc giỗ, độ sớm nhắc, đã đọc
// ---------------------------------------------------------------------------
export const useLinkAccountToPerson = (treeId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) => linkAccountToPerson({ treeId, personId }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.detail(treeId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reminderWatch }),
      ]),
  });
};

/** Những Người tài khoản đang xem đã tắt nhắc giỗ (mặc định ai cũng được nhắc, trừ Người trong danh sách này). */
export const useMutedGioPersons = () => useQuery({ queryKey: queryKeys.reminderWatch, queryFn: listMutedGioPersons });

export const useToggleGioMute = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.reminderWatch });
  const mute = useMutation({ mutationFn: muteGioReminder, onSuccess: invalidate });
  const unmute = useMutation({ mutationFn: unmuteGioReminder, onSuccess: invalidate });
  return { mute, unmute };
};

export const useReminderPrefs = () => useQuery({ queryKey: queryKeys.reminderPrefs, queryFn: listReminderPrefs });

export const useSetReminderOffset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setReminderOffset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs }),
  });
};

export const useSetEmailEnabled = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setEmailEnabled,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs }),
  });
};

export const useSetTienThuong = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setTienThuong,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reminderPrefs }),
  });
};

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notificationReads }),
  });
};

/** Nhắc nhở đến hạn của tài khoản đang đăng nhập: giỗ nhắc mặc định (trừ Người đã tắt), sinh nhật và Sự kiện không lọc. */
export const useDueReminders = () => {
  const calendar = useMyCalendar(true);
  const muted = useMutedGioPersons();
  const prefs = useReminderPrefs();
  const reads = useQuery({ queryKey: queryKeys.notificationReads, queryFn: listNotificationReads });

  const due = useMemo(() => {
    if (!calendar.data) return [];
    const mutedPersonIds = new Set((muted.data ?? []).map((row) => row.personId));
    return bellReminders({ source: calendar.data, today: todayInVietnam(), mutedPersonIds, prefsByTree: prefs.data ?? new Map() });
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
