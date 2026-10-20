# Plan — App di động Gia Phả và đăng ký trả phí

Chốt ngày 2026-10-20 sau 6 vòng hỏi đáp và một nghiên cứu giá ([`docs/research/monetization-subscription-vs-ads.md`](research/monetization-subscription-vs-ads.md)). Thuật ngữ: [`CONTEXT.md`](../CONTEXT.md). Quyết định khó đảo ngược: [ADR 0006](adr/0006-dang-ky-theo-tai-khoan-chu-so-huu.md), [ADR 0007](adr/0007-hai-ung-dung-web-va-mobile.md), cập nhật ở [ADR 0004](adr/0004-ha-tang-mien-phi.md). Plan web v1 vẫn ở [`PLAN.md`](PLAN.md).

## 1. Mục tiêu và phạm vi

Bán subscription cho Chủ sở hữu gia phả và đưa sản phẩm lên iOS, Android (app native) song song với PWA hiện có. Giá trị chính của app: push nhắc giỗ và có mặt trên store.

**Có trong kế hoạch này**: toàn bộ tính năng của web, trừ quản trị. Chia mốc để mỗi mốc phát hành được (mục 6).

**Không có**: quản trị `/quan-tri` trên mobile; ghi khi mất mạng (hàng đợi đồng bộ); đăng nhập Google/Apple; đa ngôn ngữ; quảng cáo; gói tháng; gói trọn đời.

## 2. Các quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| 1 | Mục tiêu | Bán subscription; app có push và có mặt trên store |
| 2 | Nền tảng | iOS + Android (Expo native) + PWA giữ nguyên `apps/web` (ADR 0007) |
| 3 | Repo | Monorepo, thêm `apps/mobile`; tách code dùng chung ra `packages/*` khi mobile cần |
| 4 | Ai trả | Chỉ Chủ sở hữu; Biên tập viên và Người xem miễn phí (ADR 0006) |
| 5 | Đơn vị gói | Tài khoản Chủ sở hữu, áp cho mọi Gia phả họ sở hữu; giới hạn tính trên từng Gia phả |
| 6 | Mô hình thu | Miễn phí + đăng ký theo năm, không quảng cáo, không gói tháng, không trọn đời |
| 7 | Dùng thử | 30 ngày gói Dòng họ khi tạo gia phả, không cần thẻ |
| 8 | Thanh toán | IAP qua RevenueCat trên iOS/Android; PayOS/VietQR trên web (Stripe không hỗ trợ Việt Nam); trạng thái gói lưu ở Supabase |
| 9 | Hết hạn | Về Gói miễn phí, không xoá dữ liệu, phần vượt giới hạn chỉ xem |
| 10 | Tài khoản | Bỏ duyệt tay; đăng ký xong dùng ngay (xác nhận email); chỉ email/mật khẩu; có nút "Xoá tài khoản của tôi" trong app; Chặn của quản trị giữ nguyên |
| 11 | Push | Expo Push từ Worker cron, 7:00 giờ VN, tối đa 2 push/ngày ("Hôm nay có giỗ…", "Mai là Tiên thường…"); sinh nhật và Sự kiện đi chung; tôn trọng Danh sách nhắc giỗ; công tắc tắt push toàn app; không thay Bản tin email |
| 12 | Tên miền | Mua trước M1 để làm deep link (Universal Links / App Links), email, URL chính sách quyền riêng tư |
| 13 | Cây | `@shopify/react-native-skia` trên toạ độ `packages/tree-layout`; đo với 800 node ở đầu M1 |
| 14 | Offline | Xem 7 ngày như web; ghi cần mạng |
| 15 | Điều hướng | Expo Router; 4 tab (Gia phả, Lịch, Nhắc nhở, Tài khoản); trong Gia phả: Cây là trang chính, các mục khác trong menu "Thêm"; chi tiết Người là trang đẩy; route tiếng Việt khớp web (`/gia-pha/[treeId]/cay`…) |
| 16 | Phát hành | Build local khi cần, EAS cho bản lớn, EAS Update cho sửa nhỏ; migration chỉ-thêm; màn buộc nâng cấp trước khi lên store |
| 17 | Kiểm thử | vitest cho logic chung; vài luồng Maestro cho mobile (đăng nhập, mở cây, xem Người, mua gói sandbox); thanh toán sandbox kiểm tay; CI mobile để sau M1 |
| 18 | Theo dõi | Sentry (gói free, không gửi dữ liệu cá nhân) + analytics ẩn danh (PostHog hoặc Firebase) cho phễu thanh toán |
| 19 | Xuất PDF trên mobile | `expo-print`; spike đầu M3 để đo khổ giấy lớn và font Việt |
| 20 | Ngôn ngữ | Chỉ tiếng Việt |
| 21 | Kiểm giới hạn | Ở database (hàm + trigger/RLS), không chỉ giao diện |

## 3. Gói và giá

Tỷ giá tham chiếu 25.680 ₫/USD (Vietcombank, 2026-10-20). Chỉ bán theo năm. Giá và ranh giới là **giả thuyết** cho tới khi M0 đạt ngưỡng.

| | **Miễn phí** | **Gia đình** | **Dòng họ** |
|---|---|---|---|
| Giá/năm | 0 | 199.000₫ (~$7,75) | 499.000₫ (~$19,43) |
| Ưu đãi sáng lập (100 gia phả đầu, khoá giá 2 năm) | – | 99.000₫ | 249.000₫ |
| Thực nhận sau 15% phí store | – | ~169.000₫ | ~424.000₫ |
| Số Người / Gia phả | 100 | 300 | 3.000 |
| Biên tập viên / Gia phả | 0 | 2 | 10 |
| Người xem | không giới hạn | không giới hạn | không giới hạn |
| Ảnh / Gia phả | 100 | 500 | 5.000 |
| Cây, Lịch giỗ, push, link công khai | có | có | có |
| Phả đồ PDF/PNG | có watermark | không watermark | không watermark |
| Phả ký, Dòng thời gian PDF | không | có | có |
| Xuất Excel / sao lưu | **có** | có | có |
| Nhập Excel | không | không | có |
| Bản tin nhắc qua email | không | có | có |

Giới hạn 3 gia phả / tài khoản và 5 ảnh / Người trong `PLAN.md` (Q18) giữ nguyên, không đổi theo gói. Mọi con số trong bảng là cấu hình trong database, không nằm cứng trong code.

**Khung kinh tế** (từ research, đều là ước tính): hạ tầng Pro khoảng $55/tháng; hoà vốn cần khoảng 57 gia phả trả phí; doanh thu ròng năm 1 khoảng 0,1 / 1,2 / 8,2 triệu₫ (xấu / cơ sở / tốt). Vì vậy giữ hạ tầng miễn phí đến khoảng 50 gia phả trả phí.

## 4. Kiến trúc

```
apps/web (PWA, giữ nguyên)  ┐
apps/mobile (Expo)          ├──► Supabase (Postgres + RLS + Auth)  ◄── Cloudflare Worker Cron (7:00 VN)
packages/* (dùng chung)     ┘          ▲                                ├─ nhắc nhở in-app, Bản tin email (Resend)
                                       │                                └─ push (Expo Push)
RevenueCat ── webhook ──► Pages Function ──► bảng gói của Tài khoản
PayOS/VietQR ─ webhook ──┘
```

- **Gói** là dữ liệu: bảng gói theo tài khoản (gói, nguồn: apple / google / payos / thủ công / dùng thử, ngày hết hạn) và bảng giới hạn theo gói. Hàm database trả giới hạn hiệu lực của một Gia phả; trigger/RLS dùng hàm đó để chặn ghi vượt giới hạn.
- **Dữ liệu mới** (đều chỉ-thêm): bảng gói tài khoản, bảng giới hạn theo gói, token thiết bị push, sự kiện phễu thanh toán (ẩn danh), cài đặt push của tài khoản.
- **Mobile**: TanStack Query như web, phiên đăng nhập lưu bằng secure storage, cache 7 ngày; Skia cho Cây (font Be Vietnam Pro, Noto Serif đã có trong repo); `expo-print` cho PDF; Sentry.
- **Dùng chung**: `lunar`, `tree-layout`, `reminders`, `db-paging` có sẵn. Tách thêm từ `apps/web/src` khi cần: kiểu `database.types`, truy vấn dữ liệu, quyền (`permissions`), quan hệ họ hàng (`family/`), nhãn và hiển thị Người.
- **Cổng giới hạn trên web** cũng phải có (hiện chưa có khái niệm gói): thẻ giá, trạng thái gói, nút nâng cấp.

## 5. Người dùng hiện có

Web đã có người dùng thật, một số gia phả có thể đã vượt 100 Người. Trước khi bật giới hạn:
- Chạy truy vấn đếm gia phả theo số Người, số tài khoản/gia phả, tỷ lệ quay lại 30 ngày (bước 1 của M0).
- Mọi tài khoản hiện có nhận 30 ngày dùng thử gói Dòng họ **tính từ ngày bật giới hạn**, kèm thông báo trước ít nhất 14 ngày. Không ai bị bất ngờ mất quyền thêm Người.
- Hết hạn dùng thử mà vượt giới hạn: dữ liệu giữ nguyên, chỉ xem (ADR 0006).

## 6. Các mốc phát triển

| Mốc | Nội dung | Xong khi |
|---|---|---|
| **M0 Kiểm chứng cầu** | (1) Truy vấn DB thật. (2) Fake-door paywall trên web: thẻ giá khi Chủ sở hữu chạm 100 Người, bấm "Phả đồ không watermark" hoặc "Nhập Excel"; một nửa người dùng thấy Dòng họ 699.000₫; đo bấm và để lại liên hệ. (3) Bán trước thủ công qua VietQR cho khoảng 20 người sáng lập (sau khi hỏi kế toán). (4) Fake-door "Đặt in Phả đồ" và xin 2–3 báo giá nhà in. (5) Waitlist app di động. | Đạt ngưỡng ở mục 7, nếu không thì dừng và xem lại mô hình trước khi làm IAP |
| **M1.0 Nền tảng kỹ thuật** | Mua tên miền; tài khoản Apple Developer / Google Play / RevenueCat / Sentry; thêm `apps/mobile` vào workspace (Metro + pnpm); tách `packages/data` tối thiểu; spike Skia vẽ 800 node trên Android tầm trung | Cây 800 node kéo/phóng mượt trên máy Android tầm trung; build chạy trên cả hai nền tảng |
| **M1.1 Đăng nhập và danh sách** | Đăng ký/đăng nhập/quên mật khẩu bằng deep link, bỏ duyệt tay, Xoá tài khoản, danh sách Gia phả, màn buộc nâng cấp | Tài khoản mới đăng ký xong vào được ngay, xoá được; đăng nhập qua deep link |
| **M1.2 Xem** | Cây, danh sách theo đời, tìm kiếm, chi tiết Người, link công khai, offline 7 ngày | Xem hết gia phả mẫu 800 người, mất mạng vẫn xem được dữ liệu đã tải |
| **M1.3 Lịch và nhắc** | Lịch âm dương, Sự kiện, chuông nhắc, push 7:00 sáng, công tắc push | Đúng giỗ/Tiên thường trong tuần thử; push đến cả iOS và Android; tắt công tắc thì không nhận |
| **M1.4 Gói và thanh toán** | Bảng gói + giới hạn + trigger; webhook RevenueCat và PayOS; paywall trên mobile và web; dùng thử 30 ngày; ưu đãi sáng lập; điểm theo dõi phễu | Mua sandbox thành công trên iOS và Android; hết hạn thì về Gói miễn phí đúng luật; test DB chứng minh giới hạn bị chặn ở database |
| **M1.5 Lên store** | Mô tả, ảnh chụp, chính sách quyền riêng tư, khai App Privacy / Data Safety, tài khoản demo cho người duyệt, TestFlight / kiểm thử nội bộ Play | Qua duyệt của cả hai store |
| **M2 Ghi** | Thêm/sửa Người, quan hệ, ảnh (camera/thư viện), Sự kiện, mời thành viên, Người chưa nối, Hồ sơ thiếu, Thành viên trùng, phát hiện xung đột; đúng Quy tắc ghi theo Vai trò | Làm lại được luồng nhập tay gia phả 3 đời trên điện thoại; test ghi theo vai trò không đổi |
| **M3 Xuất/nhập** | Spike `expo-print` đầu mốc; Phả ký, Dòng thời gian, Phả đồ PDF/PNG, nhập/xuất Excel, sao lưu | Phả đồ khổ lớn xuất được hoặc có phương án thay thế đã chốt sau spike |

M4 Quản trị trên mobile: **bỏ**.

## 7. Ngưỡng của M0

Là giả định để quyết định, chưa kiểm chứng:
- Dưới 20% gia phả vượt 100 Người: giới hạn miễn phí quá rộng hoặc cầu thấp, hạ xuống 50 Người hoặc hạn chế theo tính năng. Trên 50% vượt: giữ 100.
- Fake-door: từ 5% bấm nút và từ 2% để lại liên hệ là tín hiệu tiếp tục; dưới 1% bấm thì xem lại giá và giá trị trước khi làm billing.
- Bán trước: từ 10 người trả tiền thật (không phải người quen) trước khi tích hợp RevenueCat/PayOS.

## 8. Việc chủ dự án cần tự làm

- Tài khoản Apple Developer ($99/năm), Google Play ($25), RevenueCat, Sentry, PostHog hoặc Firebase.
- Đăng ký Apple Small Business Program (không tự động).
- Mua tên miền; trỏ file xác thực Universal Links / App Links.
- Hỏi kế toán về thuế bán subscription và nhận tiền bán trước trước khi nhận khoản đầu tiên.
- Soạn chính sách quyền riêng tư và điều khoản (Luật Bảo vệ dữ liệu cá nhân 2025, Nghị định 13/2023 về dữ liệu người còn sống).

## 9. Rủi ro và điều chưa kiểm chứng

| Rủi ro | Xử lý |
|---|---|
| Cầu trả tiền ở Việt Nam chưa có bằng chứng (app gia phả nổi nhất chỉ có hàng trăm lượt đánh giá) | M0 trước khi tốn công IAP |
| Tỷ lệ chuyển đổi 1–5% và 1 Chủ sở hữu trên 20 người dùng là giả định, không có số liệu gia phả VN | Đo bằng M0 và phễu thanh toán |
| Cây 800 node bằng Skia chưa đo | Spike M1.0 |
| `expo-print` với khổ lớn và font Việt chưa đo | Spike đầu M3; nếu hỏng, mở web (PWA) để xuất |
| Thuế: Apple khấu trừ 2% PIT + 5% FCT, Google 5% VAT, ngưỡng hộ kinh doanh 1 tỷ₫ (NĐ 141/2026) mới chỉ có nguồn thứ cấp | Hỏi kế toán |
| Không tìm thấy: phí PayOS, VietQR tự gia hạn, giá sàn Apple/Google ở Việt Nam, giá in khổ lớn hiện hành | Kiểm trong App Store Connect / Play Console / hỏi PayOS trước M1.4 |
| Apple duyệt: cần xoá tài khoản trong app, tài khoản demo vào được ngay, không nhắc thanh toán ngoài app | Có trong M1.1 và M1.5 |
| Migration làm hỏng app cũ | Quy tắc chỉ-thêm; màn buộc nâng cấp |
| Analytics làm lộ dữ liệu người còn sống | Chỉ đếm sự kiện phễu ẩn danh; Sentry lọc dữ liệu cá nhân; khai đúng App Privacy |
