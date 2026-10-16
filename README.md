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
| `packages/*` | Các mô-đun thuần TypeScript dùng chung (lịch âm, bố cục cây…) |
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

- **Supabase** project `family-tree` (`gihidxqjfcezsrcibrla`, vùng Singapore): database, đăng nhập.
- **Cloudflare Pages**: hosting web, tự deploy khi có commit lên `main`.
- Về sau: Cloudflare R2 (ảnh), Worker Cron (nhắc giỗ), Resend (email).

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
   | Build command | `pnpm install --frozen-lockfile && pnpm build` |
   | Build output directory | `apps/web/dist` |
   | Biến môi trường | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (giá trị như `.env.example`), `NODE_VERSION=22` |

4. Lấy địa chỉ `*.pages.dev` vừa có, quay lại bước 1.1 để thêm vào Site URL và Redirect URLs.
