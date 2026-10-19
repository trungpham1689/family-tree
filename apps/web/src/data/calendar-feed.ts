import { supabase } from '../lib/supabase';
import { failOn } from './trees';

/** Link lịch đăng ký (.ics) của tài khoản đang đăng nhập; null nếu chưa bật. */
export const getCalendarFeedToken = async (): Promise<string | null> => {
  const { data, error } = await supabase.rpc('my_calendar_feed');
  failOn(error);
  return data;
};

/** Bật hoặc tạo lại link; link cũ hết hiệu lực ngay. */
export const rotateCalendarFeed = async (): Promise<string> => {
  const { data, error } = await supabase.rpc('rotate_calendar_feed');
  failOn(error);
  return data;
};

export const disableCalendarFeed = async (): Promise<void> => {
  const { error } = await supabase.rpc('disable_calendar_feed');
  failOn(error);
};

export const calendarFeedUrl = (token: string, origin = window.location.origin) => `${origin}/api/calendar/${token}.ics`;
