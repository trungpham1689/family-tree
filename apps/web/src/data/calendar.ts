import type { CalendarEvent, CalendarMarriage, CalendarPerson, CalendarSource } from '@gia-pha/reminders';
import { fetchAll } from '../lib/fetch-all';
import { supabase } from '../lib/supabase';
import type { Row } from './database.types';
import { listMyTrees, failOn } from './trees';

export type TreeEvent = Row<'tree_events'>;
export type EventFields = Pick<
  TreeEvent,
  'title' | 'calendar' | 'repeats_yearly' | 'year' | 'month' | 'day' | 'leap' | 'start_time' | 'location' | 'note'
>;

const fail = (error: { code?: string; message?: string } | null) => {
  failOn(error);
};

// Cùng bộ cột với apps/worker/src/fetch-data.ts và hàm SQL public_share.calendar_feed: thêm trường lịch thì sửa cả ba.
const PERSON_COLUMNS = 'id, tree_id, full_name, is_deceased, anniversary_day, anniversary_month, birth_solar_date, death_solar_date';
const MARRIAGE_COLUMNS =
  'id, tree_id, partner_a, marriage_year, marriage_month, marriage_day, a:persons!unions_partner_a_fkey(full_name), b:persons!unions_partner_b_fkey(full_name)';

type MarriageRow = Omit<CalendarMarriage, 'names'> & { a: { full_name: string } | null; b: { full_name: string } | null };
const EVENT_COLUMNS = 'id, tree_id, title, calendar, repeats_yearly, year, month, day, leap, start_time, location';

/**
 * Dữ liệu cho "Lịch của tôi": mọi Gia phả tài khoản có vai trò. Chỉ tải những Người có giỗ
 * (đã mất) hoặc có ngày sinh dương đầy đủ — RLS bảo đảm chỉ thấy Gia phả của mình.
 */
export const loadMyCalendar = async (accountId: string): Promise<CalendarSource> => {
  const trees = await listMyTrees(accountId);
  const ids = trees.map((tree) => tree.id);
  if (ids.length === 0) return { trees: [], persons: [], events: [], marriages: [] };
  const [persons, events, marriages] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from('persons')
        .select(PERSON_COLUMNS)
        .in('tree_id', ids)
        .or('is_deceased.eq.true,birth_solar_date.not.is.null')
        .order('id')
        .range(from, to),
    ),
    fetchAll((from, to) => supabase.from('tree_events').select(EVENT_COLUMNS).in('tree_id', ids).order('id').range(from, to)),
    // Chỉ cuộc hôn phối đã biết đủ ngày cưới và chưa ly hôn.
    fetchAll((from, to) =>
      supabase
        .from('unions')
        .select(MARRIAGE_COLUMNS)
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
    marriages: ((marriages.data ?? []) as unknown as MarriageRow[]).map(({ a, b, ...marriage }) => ({
      ...marriage,
      names: [a?.full_name, b?.full_name].filter(Boolean).join(' & '),
    })),
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
