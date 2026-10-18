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

- **Supabase** project `family-tree` (`gihidxqjfcezsrcibrla`, vùng Singapore): database, đăng nhập, Storage (ảnh).
- **Cloudflare Pages**: hosting web, tự deploy khi có commit lên `main`.
- **Cloudflare Worker Cron** (`apps/worker`): chạy mỗi ngày, tính nhắc nhở đến hạn, gửi Bản tin nhắc qua **Resend** — chưa deploy, xem mục 3 dưới.

## Việc chủ dự án cần tự làm

### 1. Cấu hình đăng nhập trên Supabase

Vào [Supabase Dashboard](https://supabase.com/dashboard/project/gihidxqjfcezsrcibrla) → **Authentication**:

1. **URL Configuration**
   - *Site URL*: địa chỉ bản deploy (ví dụ `https://gia-pha.pages.dev`).
   - *Redirect URLs*: thêm `http://localhost:5173/**` và `https://<tên-project>.pages.dev/**`.
2. **Sign In / Providers → Email**: đang bật sẵn. Email xác nhận dùng máy gửi mặc định của Supabase, giới hạn vài thư mỗi giờ; tạm tắt *Confirm email* nếu thử nghiệm nhiều tài khoản.
3. **Sign In / Providers → Google**:
   1. Vào [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials* → *OAuth client ID* → loại *Web application*.
   2. *Authorized redirect URIs*: `https://gihidxqjfcezsrcibrla.supabase.co/auth/v1/callback`.
   3. Dán *Client ID* và *Client secret* vào trang Google provider trên Supabase, bật lên.

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
   | Biến môi trường | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (giá trị như `.env.example`), `NODE_VERSION=22` |

   Hai biến `VITE_SUPABASE_*` dùng cho cả lúc build lẫn Pages Function `functions/p/[[path]].ts`
   (chèn tiêu đề và ảnh xem trước khi dán link công khai vào Zalo/Facebook).

4. Lấy địa chỉ `*.pages.dev` vừa có, quay lại bước 1.1 để thêm vào Site URL và Redirect URLs.

### 3. Deploy Worker Cron (Bản tin nhắc qua email)

Chưa làm bước này thì nhắc nhở vẫn chạy trong app (chuông "Nhắc nhở", trang `/nhac-gio`) như thường, chỉ chưa có email mỗi sáng.

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
   Worker chạy theo lịch đã đặt sẵn trong `wrangler.toml` (`0 0 * * *`, tức 7:00 sáng giờ Việt Nam), không cần làm gì thêm. Xem log: `npx wrangler tail`. Đổi `APP_URL`/`RESEND_FROM` thì sửa `[vars]` trong `wrangler.toml` rồi deploy lại.
