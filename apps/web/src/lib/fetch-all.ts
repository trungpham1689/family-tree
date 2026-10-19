/** PostgREST cắt mỗi truy vấn ở `max_rows` (1000, xem supabase/config.toml). */
const PAGE_SIZE = 1000;

type PageError = { code?: string; message?: string };
type Page<Row> = PromiseLike<{ data: Row[] | null; error: PageError | null }>;

/**
 * Đọc hết một truy vấn nhiều dòng bằng cách lấy từng trang `range`. Gia phả được phép tới 2.000 Người
 * nên đọc một lần sẽ âm thầm mất dòng thứ 1001 trở đi. Truy vấn phải có `order` ổn định để các trang không chồng/hụt.
 */
export const fetchAll = async <Row>(
  page: (from: number, to: number) => Page<Row>,
): Promise<{ data: Row[] | null; error: PageError | null }> => {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) return { data: rows, error: null };
  }
};
