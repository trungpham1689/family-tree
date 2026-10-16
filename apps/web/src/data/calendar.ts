import type { CalendarEvent, CalendarPerson, CalendarSource } from '../calendar/occurrences';
import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import { DataError, listMyTrees } from './trees';

export type TreeEvent = Row<'tree_events'>;
export type EventFields = Pick<
  TreeEvent,
  'title' | 'calendar' | 'repeats_yearly' | 'year' | 'month' | 'day' | 'leap' | 'start_time' | 'location' | 'note'
>;

const fail = (error: { code?: string; message?: string } | null) => {
  if (error) throw new DataError(error);
};

const PERSON_COLUMNS = 'id, tree_id, full_name, is_deceased, anniversary_day, anniversary_month, birth_solar_date';
const EVENT_COLUMNS = 'id, tree_id, title, calendar, repeats_yearly, year, month, day, leap, start_time, location';

/**
 * Dữ liệu cho "Lịch của tôi": mọi Gia phả tài khoản có vai trò. Chỉ tải những Người có giỗ
 * (đã mất) hoặc có ngày sinh dương đầy đủ — RLS bảo đảm chỉ thấy Gia phả của mình.
 */
export const loadMyCalendar = async (accountId: string): Promise<CalendarSource> => {
  const trees = await listMyTrees(accountId);
  const ids = trees.map((tree) => tree.id);
  if (ids.length === 0) return { trees: [], persons: [], events: [] };
  const [persons, events] = await Promise.all([
    supabase
      .from('persons')
      .select(PERSON_COLUMNS)
      .in('tree_id', ids)
      .or('is_deceased.eq.true,birth_solar_date.not.is.null'),
    supabase.from('tree_events').select(EVENT_COLUMNS).in('tree_id', ids),
  ]);
  fail(persons.error);
  fail(events.error);
  return {
    trees: trees.map(({ id, name }) => ({ id, name })),
    persons: (persons.data ?? []) as CalendarPerson[],
    events: (events.data ?? []) as CalendarEvent[],
  };
};

export const listTreeEvents = async (treeId: string): Promise<TreeEvent[]> => {
  const { data, error } = await supabase.from('tree_events').select('*').eq('tree_id', treeId).order('month').order('day');
  fail(error);
  return data ?? [];
};

export const saveTreeEvent = async (input: { treeId: string; eventId: string | null; fields: EventFields }): Promise<void> => {
  const query = input.eventId
    ? supabase.from('tree_events').update(input.fields).eq('id', input.eventId)
    : supabase.from('tree_events').insert({ ...input.fields, tree_id: input.treeId });
  fail((await query).error);
};

export const removeTreeEvent = async (eventId: string): Promise<void> => {
  fail((await supabase.from('tree_events').delete().eq('id', eventId)).error);
};
