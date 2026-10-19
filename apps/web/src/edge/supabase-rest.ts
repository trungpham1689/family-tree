/**
 * Truy cập PostgREST của Supabase từ Pages Function: một nơi lo biến môi trường, header, xử lý lỗi và phân trang,
 * thay vì mỗi function tự `fetch`. Hai adapter: Supabase thật, và `fetch` giả trong test (truyền vào `doFetch`).
 */
export type EdgeEnv = { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string };

/** Lỗi khi nói chuyện với Supabase: `status` là mã HTTP nên trả cho người gọi (502 khi Supabase lỗi). */
export class EdgeError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SupabaseRest = {
  /** Gọi hàm RPC. `jwt` bỏ trống thì gọi với quyền khách (khoá công khai). 401 trả về `{ unauthorized: true }`. */
  rpc: <T>(fn: string, args: Record<string, unknown>, jwt?: string) => Promise<{ unauthorized: boolean; data: T | null }>;
  /** Đọc dòng bằng quyền người gọi (RLS áp dụng). Lỗi thì ném `EdgeError` — không coi "không đọc được" là "không có dòng". */
  rows: <Row>(query: string, jwt: string) => Promise<Row[]>;
  /** Như `rows` nhưng đọc hết từng trang 1000 dòng. */
  all: <Row>(query: string, jwt: string) => Promise<Row[]>;
  /** Xoá dòng bằng quyền người gọi; trả các dòng đã xoá (rỗng = RLS không cho xoá hoặc không có). */
  remove: <Row>(query: string, jwt: string) => Promise<Row[]>;
};

const PAGE = 1000;

/** `null` khi môi trường chưa đủ biến Supabase. */
export const supabaseRest = (env: EdgeEnv, doFetch: typeof fetch = fetch): SupabaseRest | null => {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const headers = (jwt?: string, extra: Record<string, string> = {}) => ({ apikey: key, ...(jwt ? { authorization: `Bearer ${jwt}` } : {}), ...extra });

  const rows = async <Row>(query: string, jwt: string, extra: Record<string, string> = {}): Promise<Row[]> => {
    const response = await doFetch(`${url}/rest/v1/${query}`, { headers: headers(jwt, extra) });
    if (!response.ok) throw new EdgeError(502, `Supabase trả ${response.status} khi đọc ${query.split('?')[0]}.`);
    return (await response.json()) as Row[];
  };

  return {
    rpc: async <T>(fn: string, args: Record<string, unknown>, jwt?: string) => {
      const response = await doFetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: headers(jwt, { 'content-type': 'application/json' }),
        body: JSON.stringify(args),
      });
      if (response.status === 401) return { unauthorized: true, data: null };
      if (!response.ok) throw new EdgeError(502, `Supabase trả ${response.status} khi gọi ${fn}.`);
      return { unauthorized: false, data: (await response.json()) as T | null };
    },
    rows,
    all: async <Row>(query: string, jwt: string) => {
      const all: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        const page = await rows<Row>(query, jwt, { 'range-unit': 'items', range: `${from}-${from + PAGE - 1}` });
        all.push(...page);
        if (page.length < PAGE) return all;
      }
    },
    remove: async <Row>(query: string, jwt: string) => {
      const response = await doFetch(`${url}/rest/v1/${query}`, { method: 'DELETE', headers: headers(jwt, { prefer: 'return=representation' }) });
      if (!response.ok) throw new EdgeError(502, `Supabase trả ${response.status} khi xoá ${query.split('?')[0]}.`);
      return (await response.json()) as Row[];
    },
  };
};
