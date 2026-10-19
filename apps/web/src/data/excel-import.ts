import type { ImportPayload } from '../excel/import-preview';
import { supabase } from '../lib/supabase';
import { failOn } from './trees';

/** Tạo Gia phả mới và lưu toàn bộ dữ liệu đã xem trước, trong một transaction. */
export const importNewTree = async (name: string, payload: ImportPayload): Promise<string> => {
  const { data, error } = await supabase.rpc('import_new_tree', { tree_name: name, payload });
  failOn(error);
  return data;
};

/** Đổ dữ liệu đã xem trước vào một Gia phả đang trống. */
export const importIntoTree = async (treeId: string, payload: ImportPayload): Promise<void> => {
  const { error } = await supabase.rpc('import_into_tree', { target_tree: treeId, payload });
  failOn(error);
};
