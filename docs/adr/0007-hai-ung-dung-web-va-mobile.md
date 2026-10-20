# 0007 — Hai ứng dụng: web (PWA) giữ nguyên, mobile native riêng

**Trạng thái:** Đã chấp nhận · 2026-10-20

## Bối cảnh
Cần có app trên iOS và Android (push nhắc giỗ, có mặt trên store) mà vẫn giữ PWA. `apps/web` đã chạy, có test và e2e; phần nặng (Phả đồ khổ lớn, Excel, quản trị) vốn hợp trình duyệt trên máy tính.

## Quyết định
- Giữ `apps/web` làm PWA như hiện tại.
- Thêm `apps/mobile` (Expo / React Native, Expo Router) cho iOS và Android, trong cùng monorepo pnpm.
- Dùng chung `packages/*` (lịch âm, bố cục cây, nhắc nhở, phân trang). Logic và kiểu dữ liệu còn nằm trong `apps/web/src` (`data/`, `family/`, `people/`…) được tách ra package chung **khi mobile cần đến**, không tách trước.
- Cây trên mobile vẽ bằng `@shopify/react-native-skia` trên toạ độ từ `packages/tree-layout`.
- Mobile chỉ tiếng Việt; không có quản trị trên mobile (chỉ web).
- Database dùng chung. Migration phải tương thích ngược với bản app cũ; app có cơ chế buộc nâng cấp khi phiên bản quá cũ.

## Phương án đã loại
- **Expo universal (viết lại web bằng react-native-web):** một codebase nhưng phải bỏ `apps/web`, viết lại cây d3, jspdf, Excel và e2e, chỉ để có thêm một đầu ra web mà PWA đã đáp ứng.
- **Repo mobile riêng:** hai bên sẽ lệch nhau mỗi lần đổi schema.

## Hệ quả
- Hai bộ giao diện phải giữ hành vi nhất quán; logic nghiệp vụ dùng chung ở `packages/*` để giảm lệch.
- Cần quy tắc migration chỉ-thêm (không đổi hay xoá thứ app cũ còn dùng), xoá chỉ sau khi phiên bản app tối thiểu đã nâng.
- Cần tài khoản Apple Developer ($99/năm) và Google Play ($25 một lần); đây là khoản chi mới ngoài ADR 0004.
- Xuất PDF/Phả đồ trên mobile dùng `expo-print`; giới hạn khổ giấy phải đo bằng spike ở đầu M3.
