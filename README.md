# Gia Phả

Webapp lưu giữ gia phả cho nhiều dòng họ: lưu thông tin các đời, xem cây, chia sẻ online, nhắc giỗ theo lịch âm và in phả đồ khổ lớn.

- Thuật ngữ: [`CONTEXT.md`](CONTEXT.md)
- Quyết định kiến trúc: [`docs/adr/`](docs/adr)
- Plan và spec: [`docs/PLAN.md`](docs/PLAN.md), [`docs/SPEC.md`](docs/SPEC.md)
- Công việc: board Trello "Family Tree"

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `apps/web` | Giao diện React + TypeScript (Vite, Tailwind) |
| `apps/worker` | Cloudflare Worker Cron: tính nhắc nhở đến hạn, gửi Bản tin nhắc qua Resend |
| `packages/*` | Các mô-đun thuần TypeScript dùng chung (lịch âm, bố cục cây, nhắc nhở…) |
| `supabase/migrations` | Schema database, áp lên cả Supabase thật và database test |
| `tests/db` | Test seam B: database chạy trên PGlite với RLS thật ([ADR 0005](docs/adr/0005-test-database-pglite.md)) |

## Chạy cục bộ

Cần Node 22 trở lên và pnpm 10.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # giá trị mẫu trỏ vào project Supabase của dự án
pnpm dev                                 # mở http://localhost:5173
```

| Lệnh | Việc |
|---|---|
| `pnpm test` | Test đơn vị (mô-đun thuần, logic giao diện) |
| `pnpm test:db` | Test seam B trên PGlite |
| `pnpm test:all` | Toàn bộ test |
| `pnpm typecheck` / `pnpm lint` | Kiểm tra kiểu và lint |
| `pnpm build` | Build bản production vào `apps/web/dist` |

### Biến môi trường (`apps/web/.env`)

| Biến | Ý nghĩa |
|---|---|
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Khoá publishable (công khai theo thiết kế; quyền thật nằm ở RLS) |

## Hạ tầng (toàn bộ gói miễn phí, xem [ADR 0004](docs/adr/0004-ha-tang-mien-phi.md))

- **Supabase** project `family-tree` (`gihidxqjfcezsrcibrla`, vùng Singapore): database, đăng nhập. Ảnh cũ còn trong Storage cho tới khi chạy script chuyển (mục 4).
- **Cloudflare Pages**: hosting web, tự deploy khi có commit lên `main`; Pages Function `/api/photos` đứng giữa trình duyệt và Google Drive.
- **Google Drive** (15 GB miễn phí): ảnh Người và ảnh gia phả, thư mục `Family-tree/<tên gia phả>/Ảnh Gia Phả` và `Ảnh Người`.
- **Cloudflare Worker Cron** (`apps/worker`): chạy mỗi 5 ngày, có giỗ/sự kiện 5 ngày tới mới gửi một Bản tin nhắc chung cho Chủ sở hữu và Biên tập viên của mỗi gia phả qua **Resend** — chưa deploy, xem mục 3 dưới.

## Việc chủ dự án cần tự làm

### 1. Cấu hình đăng nhập trên Supabase

Vào [Supabase Dashboard](https://supabase.com/dashboard/project/gihidxqjfcezsrcibrla) → **Authentication**:

1. **URL Configuration**
   - *Site URL*: địa chỉ bản deploy (ví dụ `https://gia-pha.pages.dev`).
   - *Redirect URLs*: thêm `http://localhost:5173/**` và `https://<tên-project>.pages.dev/**`.
2. **Sign In / Providers → Email**: đang bật sẵn. Email xác nhận dùng máy gửi mặc định của Supabase, giới hạn vài thư mỗi giờ; tạm tắt *Confirm email* nếu thử nghiệm nhiều tài khoản.

### 2. Deploy lên Cloudflare Pages

1. Tạo tài khoản Cloudflare miễn phí.
2. **Workers & Pages → Create → Pages → Connect to Git**, chọn repo `family-tree`.
3. Thông số build:

   | Mục | Giá trị |
   |---|---|
   | Production branch | `main` |
   | Root directory | `apps/web` (để Cloudflare thấy thư mục `functions/`) |
   | Build command | `pnpm install --frozen-lockfile && pnpm build` |
   | Build output directory | `dist` |
   | Biến môi trường | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (giá trị như `.env.example`), `NODE_VERSION=22`, `SKIP_DEPENDENCY_INSTALL=1`, `PNPM_VERSION=10.28.0` |

   Hai biến `VITE_SUPABASE_*` dùng cho cả lúc build lẫn Pages Function `functions/p/[[path]].ts`
   (chèn tiêu đề và ảnh xem trước khi dán link công khai vào Zalo/Facebook).

   `SKIP_DEPENDENCY_INSTALL=1` và `PNPM_VERSION` bắt buộc phải có: Root directory là `apps/web`,
   không có `pnpm-lock.yaml` ở đó, nên Cloudflare tự chạy `npm install` trước khi tới Build command
   và báo lỗi `Unsupported URL Type "workspace:"`. Hai biến này tắt bước npm tự động đó, để Build
   command tự `pnpm install` (pnpm tự tìm workspace root từ thư mục con).

4. Lấy địa chỉ `*.pages.dev` vừa có, quay lại bước 1.1 để thêm vào Site URL và Redirect URLs.

### 3. Deploy Worker Cron (Bản tin nhắc qua email)

Chưa làm bước này thì nhắc nhở vẫn chạy trong app (chuông "Nhắc nhở", trang `/nhac-gio`) như thường, chỉ chưa có email nhắc.

1. **Tạo tài khoản [Resend](https://resend.com)** (miễn phí 100 email/ngày) → **API Keys** → tạo key mới.
   - Chưa có domain riêng: gửi được ngay bằng `onboarding@resend.dev`, nhưng Resend chỉ cho gửi về đúng email bạn dùng để đăng ký tài khoản Resend — đủ để tự thử, không gửi được cho người khác.
   - Có domain riêng: **Domains** → thêm domain, trỏ các bản ghi DNS Resend đưa ra, rồi đổi `RESEND_FROM` trong `apps/worker/wrangler.toml` sang địa chỉ `@domain-của-bạn`.
2. **Lấy Service role key**: [Supabase Dashboard](https://supabase.com/dashboard/project/gihidxqjfcezsrcibrla) → Project Settings → API → `service_role` (secret, bỏ qua RLS — không phải khoá `anon`/`publishable` đang dùng ở `apps/web/.env`).
3. **Đăng nhập Cloudflare từ dòng lệnh** (một lần):
   ```bash
   cd apps/worker
   npx wrangler login
   ```
4. **Đặt bí mật** (không ghi vào `wrangler.toml`, không commit):
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put RESEND_API_KEY
   ```
5. **Kiểm tra cục bộ rồi deploy**:
   ```bash
   pnpm --filter worker typecheck
   npx wrangler deploy
   ```
   Worker chạy theo lịch đã đặt sẵn trong `wrangler.toml` (`0 0 * * *`, 7:00 sáng giờ Việt Nam hằng ngày; code chỉ gửi mỗi 5 ngày một lần và chỉ khi 5 ngày tới có giỗ/sự kiện), không cần làm gì thêm. Xem log: `npx wrangler tail`. Đổi `APP_URL`/`RESEND_FROM` thì sửa `[vars]` trong `wrangler.toml` rồi deploy lại.

### 4. Ảnh trên Google Drive

Ảnh (đại diện, tư liệu, ảnh gia phả) nằm trong **Drive của bạn**, người dùng không cần tài khoản Google. Pages Function
`/api/photos` kiểm tra đăng nhập và vai trò bằng database, rồi mới dùng khoá Drive bên dưới. Chưa làm mục này thì nút tải ảnh báo lỗi, phần còn lại của app chạy bình thường.

1. [Google Cloud Console](https://console.cloud.google.com) → tạo project → **APIs & Services → Library** → bật **Google Drive API**.
2. **OAuth consent screen**: loại *External*, thêm email của bạn vào *Test users*, rồi bấm **Publish app** (để refresh token không hết hạn sau 7 ngày; app chỉ dùng quyền `drive.file`, không cần Google duyệt).
3. **Credentials → Create credentials → OAuth client ID**, loại *Web application*, thêm Authorized redirect URI `https://developers.google.com/oauthplayground`. Ghi lại *Client ID* và *Client secret*.
4. Vào [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) → ⚙ → tích *Use your own OAuth credentials*, dán Client ID/secret → ở bước 1 nhập scope `https://www.googleapis.com/auth/drive.file` → **Authorize APIs** (đăng nhập đúng tài khoản Google sẽ chứa ảnh) → **Exchange authorization code for tokens** → chép **Refresh token**.
5. Cloudflare Pages → Settings → Environment variables (Production), thêm dạng *Secret*: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Deploy lại.
6. Áp migration `supabase/migrations/20261019080000_anh_google_drive.sql` lên Supabase.
7. Có ảnh cũ trên Supabase Storage thì chuyển một lần (chạy thử trước với `--dry-run`):
   ```bash
   cd apps/web
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… GOOGLE_REFRESH_TOKEN=… \
     node --experimental-strip-types scripts/migrate-photos-to-drive.mjs
   ```

Quy cách ảnh cho người dùng: Người — ảnh vuông/dọc, mặt ở giữa, tối thiểu 300×300px (nên ≥800px); ảnh gia phả — ảnh ngang, tối thiểu 1200×800px; cả hai tối đa 5MB, JPEG/PNG/WEBP, tối đa 3 ảnh/Người. Trình duyệt tự thu nhỏ (Người 1000px, gia phả 1600px) và nén JPEG nên mỗi ảnh còn khoảng 100–300KB trên Drive; Function chặn cứng ở 4MB.

Lịch đăng ký (`/api/calendar/<token>.ics`) cũng là một Pages Function, dùng hai biến `VITE_SUPABASE_*` như `/p/<token>`; không cần thêm biến nào.

Ứng dụng cài được lên màn hình điện thoại (PWA: `manifest.webmanifest`, `sw.js`); khi mất mạng vẫn mở được và xem dữ liệu đã tải trong 7 ngày gần nhất (lưu trong IndexedDB, tự xoá khi đăng xuất). Service worker chỉ chạy ở bản build.

Chạy cục bộ: `pnpm dev` không có `/api/photos`. Muốn thử tải ảnh, build rồi chạy `npx wrangler pages dev dist` trong `apps/web` với file `.dev.vars` chứa ba biến Google và hai biến `VITE_SUPABASE_*`.

### 5. Duyệt tài khoản mới

Ai đăng ký cũng vào được trang đăng nhập, nhưng tài khoản mới chỉ thấy màn "Tài khoản đang chờ duyệt" — không xem, không sửa, không tạo được gia phả nào (kể cả khi đã được mời) — cho tới khi bạn duyệt:

- **Supabase Dashboard → Table Editor → `account_approvals`** → tìm dòng theo `email` → tích `approved` → Save. Người dùng tự vào được trong vòng 30 giây (hoặc bấm "Kiểm tra lại").
- Hoặc SQL Editor: `update account_approvals set approved = true where email = 'nguoi@example.com';`
- Thu hồi: bỏ tích `approved`, người đó mất quyền ngay và không nhận email nhắc nữa.

Tài khoản có từ trước khi có tính năng này được duyệt sẵn (migration `20261019090000_duyet_tai_khoan.sql`).
