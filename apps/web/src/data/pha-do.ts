import type { PhaDoConfig } from '../pha-do/config';
import { supabase } from '../lib/supabase';
import type { Json } from './database.types';
import { failOn } from './trees';

/** Cấu hình Phả đồ đã lưu của Gia phả (JSON thô, đọc lại bằng readPhaDoConfig); null nếu chưa lưu. */
export const loadPhaDoConfig = async (treeId: string): Promise<unknown> => {
  const { data, error } = await supabase.from('pha_do_configs').select('config').eq('tree_id', treeId).maybeSingle();
  failOn(error);
  return data?.config ?? null;
};

export const savePhaDoConfig = async (input: { treeId: string; config: PhaDoConfig }): Promise<void> => {
  const { error } = await supabase
    .from('pha_do_configs')
    .upsert({ tree_id: input.treeId, config: input.config as unknown as Json }, { onConflict: 'tree_id' });
  failOn(error);
};

const fontCache = new Map<string, Promise<string>>();

/** Tải font TTF (có dấu tiếng Việt) dưới dạng chuỗi nhị phân để nhúng vào PDF; chỉ tải một lần. */
export const loadFontBinary = (path: string): Promise<string> => {
  const cached = fontCache.get(path);
  if (cached) return cached;
  const loading = fetch(path)
    .then((response) => {
      if (!response.ok) throw new Error(`Không tải được font ${path}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      return binary;
    });
  fontCache.set(path, loading);
  loading.catch(() => fontCache.delete(path));
  return loading;
};
