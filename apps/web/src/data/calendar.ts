import {
  CALENDAR_EVENT_COLUMNS,
  CALENDAR_MARRIAGE_COLUMNS,
  CALENDAR_PERSON_COLUMNS,
  CALENDAR_PERSON_FILTER,
  toCalendarMarriages,
  type CalendarEvent,
  type CalendarPerson,
  type CalendarSource,
  type MarriageRow,
} from '@gia-pha/reminders';
import { fetchAll } from '../lib/fetch-all';
import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import { discardStoredFiles, listEventPhotoPaths } from './photos';
import { listMyTrees, failOn } from './trees';

export type TreeEvent = Row<'tree_events'>;
export type EventFields = Pick<
  TreeEvent,
  | 'title'
  | 'calendar'
  | 'repeats_yearly'
  | 'repeats_monthly'
  | 'year'
  | 'month'
  | 'day'
  | 'leap'
  | 'start_time'
  | 'location'
  | 'note'
  | 'host_person_id'
  | 'show_in_pha_ky'
  | 'show_in_timeline'
>;

const fail = (error: { code?: string; message?: string } | null) => {
  failOn(error);
};

/**
 * Dữ liệu cho "Lịch của tôi": mọi Gia phả tài khoản có vai trò. Chỉ tải những Người có giỗ
 * (đã mất) hoặc có ngày sinh dương đầy đủ — RLS bảo đảm chỉ thấy Gia phả của mình.
 */
export const loadMyCalendar = async (
  accountId: string,
  loadTrees: () => ReturnType<typeof listMyTrees> = () => listMyTrees(accountId),
): Promise<CalendarSource> => {
  const trees = await loadTrees();
  const ids = trees.map((tree) => tree.id);
  if (ids.length === 0) return { trees: [], persons: [], events: [], marriages: [] };
  const [persons, events, marriages] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('persons')
        .select(CALENDAR_PERSON_COLUMNS)
        .in('tree_id', ids)
        .or(CALENDAR_PERSON_FILTER)
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) => supabase.from('tree_events').select(CALENDAR_EVENT_COLUMNS).in('tree_id', ids).order('id').range(from, to)),
    // Chỉ cuộc hôn phối đã biết đủ ngày cưới và chưa ly hôn.
    fetchAll((from, to) =>
      supabase
        .from('unions')
        .select(CALENDAR_MARRIAGE_COLUMNS)
        .in('tree_id', ids)
        .not('marriage_day', 'is', null)
        .neq('status', 'ly_hon')
        .order('id')
        .range(from, to),
    ),
  ]);
  fail(persons.error);
  fail(events.error);
  fail(marriages.error);
  return {
    trees: trees.map(({ id, name }) => ({ id, name })),
    persons: (persons.data ?? []) as CalendarPerson[],
    events: (events.data ?? []) as CalendarEvent[],
    marriages: toCalendarMarriages((marriages.data ?? []) as unknown as MarriageRow[]),
  };
};

export const listTreeEvents = async (treeId: string): Promise<TreeEvent[]> => {
  const { data, error } = await supabase.from('tree_events').select('*').eq('tree_id', treeId).order('month').order('day');
  fail(error);
  return data ?? [];
};

/** Lưu sự kiện; trả id (của sự kiện mới, hoặc chính sự kiện đang sửa) để gắn ảnh. */
export const saveTreeEvent = async (input: { treeId: string; eventId: string | null; fields: EventFields }): Promise<string> => {
  if (input.eventId) {
    fail((await supabase.from('tree_events').update(input.fields).eq('id', input.eventId)).error);
    return input.eventId;
  }
  const { data, error } = await supabase.from('tree_events').insert({ ...input.fields, tree_id: input.treeId }).select('id').single();
  fail(error);
  return data!.id;
};

/** Xoá sự kiện rồi dọn file ảnh của nó trên Drive (xoá dòng trước: không đủ quyền thì chưa mất gì). */
export const removeTreeEvent = async (eventId: string): Promise<void> => {
  const paths = await listEventPhotoPaths(eventId);
  fail((await supabase.from('tree_events').delete().eq('id', eventId)).error);
  await discardStoredFiles(paths);
};
