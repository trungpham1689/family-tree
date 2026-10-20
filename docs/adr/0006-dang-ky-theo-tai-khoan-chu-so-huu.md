# 0006 — Đăng ký trả phí theo Tài khoản Chủ sở hữu, Người xem luôn miễn phí

**Trạng thái:** Đã chấp nhận · 2026-10-20 (giá và ranh giới gói còn chờ kiểm chứng ở M0 của `docs/PLAN-MOBILE.md`)

## Bối cảnh
Cần nguồn thu để trả hạ tầng khi vượt gói miễn phí (ADR 0004) và để bán trên App Store/Google Play. Hầu hết người dùng là họ hàng chỉ xem (người lớn tuổi); một Chủ sở hữu quản lý cả cây. Nghiên cứu: [`docs/research/monetization-subscription-vs-ads.md`](../research/monetization-subscription-vs-ads.md).

## Quyết định
- **Chỉ Chủ sở hữu trả tiền.** Biên tập viên và Người xem không bao giờ phải trả, và không bị chặn bởi gói.
- **Gói thuộc Tài khoản Chủ sở hữu**, áp cho mọi Gia phả họ sở hữu; giới hạn (số Người, Biên tập viên, ảnh…) tính trên từng Gia phả. Không gắn gói với Gia phả vì Apple/Google gắn subscription với Apple ID/Google account và không cho mua cùng một sản phẩm hai lần.
- **Ba gói, chỉ bán theo năm:** Miễn phí, Gia đình, Dòng họ. Dùng thử 30 ngày gói Dòng họ khi tạo gia phả, không cần thẻ. Không bán gói tháng, không bán "trọn đời" ở v1.
- **Không quảng cáo** trong web/app đăng nhập. Xem lại chỉ khi trên khoảng 20.000 người dùng hoạt động hàng tháng.
- **Hết hạn** không xoá dữ liệu: tài khoản về Gói miễn phí, phần vượt giới hạn chỉ xem được.
- **Giới hạn được kiểm ở database** (hàm và trigger/RLS đọc bảng gói của Chủ sở hữu), không chỉ ở giao diện, để web, mobile và API trực tiếp cùng một luật.
- **Thanh toán:** IAP qua RevenueCat trên iOS/Android (Apple Small Business Program, 15%); PayOS/VietQR trên web. Trạng thái gói lưu một chỗ ở Supabase; mọi nền tảng chỉ đọc chỗ đó. Bản iOS không nhắc tới thanh toán ngoài app.

## Phương án đã loại
- **Gói theo Gia phả:** không khớp IAP (xem trên).
- **Miễn phí + quảng cáo:** doanh thu ước tính khoảng $1–30/tháng ở 1.000–10.000 người dùng hoạt động; thêm chi phí ATT, đồng ý dữ liệu theo luật Việt Nam, và mất niềm tin khi quảng cáo cạnh ngày mất.
- **Gói tháng / trọn đời:** tăng bỏ ngang và phí giao dịch / chi phí hạ tầng lặp lại mãi nhưng chỉ thu một lần.

## Hệ quả
- Cần bảng gói theo tài khoản và webhook từ RevenueCat/PayOS cập nhật bảng đó; cần bảng giới hạn theo gói để đổi số mà không đổi code.
- Người dùng hiện có phải được xử lý riêng (xem mục "Người dùng hiện có" trong `docs/PLAN-MOBILE.md`) để không bất ngờ mất quyền thêm Người.
- Doanh thu nhỏ: không nâng Supabase/Resend Pro cho đến khi có khoảng 50 tài khoản trả phí.
- Thuế bán subscription ở Việt Nam chưa kiểm chứng; phải hỏi kế toán trước khi nhận tiền.
