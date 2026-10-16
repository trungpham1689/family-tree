# 0005 — Test seam B trên PGlite thay vì Supabase CLI + Docker

**Trạng thái:** Đã chấp nhận · 2026-10-16

## Bối cảnh
Spec định chạy test seam B qua client Supabase, trên một Supabase cục bộ dựng bằng Supabase CLI (cần Docker). Môi trường làm việc của agent không có Docker, và chỉ tải được gói từ npm, không tải được bản build từ GitHub (PostgREST, GoTrue). Ngoài ra, chạy cả bộ Supabase trong CI mất vài phút mỗi lần.

## Quyết định
- Test seam B chạy trên **PGlite**: Postgres thật biên dịch sang WebAssembly, cài qua npm, chạy trong tiến trình test.
- Một file giả lập (`tests/db/supabase-shim.sql`) tạo phần tối thiểu của Supabase mà dự án dựa vào: các role `anon`, `authenticated`, `service_role`; bảng `auth.users`; hàm `auth.uid()`, `auth.role()`, `auth.jwt()` đọc từ `request.jwt.claims`, đúng cách Supabase làm.
- Mỗi lệnh trong test chạy trong một transaction với `set local role` và JWT claims của người gọi, đúng như PostgREST làm cho mỗi request. Vì vậy RLS được kiểm thật.
- Seam B là **API của database** (bảng + hàm RPC dưới RLS), không phải thư viện `supabase-js`. Web gọi chính các bảng và RPC đó qua `supabase-js`; lớp client trong web phải giữ thật mỏng.
- Cùng một bộ file trong `supabase/migrations/` được áp lên project Supabase thật và lên PGlite trong test.

## Hệ quả
- Test chạy trong vài giây, cả trên máy agent lẫn CI, không cần Docker.
- PGlite là Postgres 18, còn Supabase đang chạy 17. Migration chỉ được dùng tính năng có ở cả hai bản.
- Phần Supabase không giả lập (GoTrue, Storage, Realtime) không được test ở seam B. Đăng nhập thật được kiểm bằng tay trên bản deploy, và bằng test khói ở ticket 19.
- Nếu migration dựa vào một tính năng Supabase chưa có trong shim (ví dụ extension), phải bổ sung shim trước.
