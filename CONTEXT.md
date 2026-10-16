# CONTEXT — Webapp Gia Phả

Bảng thuật ngữ của dự án. Chỉ định nghĩa khái niệm, không chứa chi tiết kỹ thuật.

## Gia phả & con người

**Gia phả**
Một cây phả hệ của một dòng họ (hoặc một chi), có chủ sở hữu riêng. Một tài khoản có thể tạo hoặc được mời vào nhiều gia phả. Mọi dữ liệu (người, sự kiện, phả đồ) đều thuộc về đúng một gia phả.

**Người**
Một cá nhân được ghi trong gia phả (còn sống hoặc đã mất). Khác với *Tài khoản*.
_Tránh dùng:_ "thành viên" để chỉ người trong cây (dễ nhầm với vai trò truy cập).

**Tài khoản**
Một người dùng đăng nhập vào webapp. Một tài khoản có thể được *liên kết* với đúng một Người trong mỗi gia phả.

**Đinh**
Người sinh ra trong họ (có cha hoặc mẹ là người trong họ), được nối với cha mẹ.

**Dâu / Rể**
Người kết hôn vào họ; chỉ nối với vợ/chồng của mình, không nối với cha mẹ trong cây.

**Thuỷ tổ**
Người ở gốc gia phả (Đời 1).

**Đời**
Thế hệ tính từ Thuỷ tổ: Thuỷ tổ là Đời 1, con của Đời N là Đời N+1. Dâu/Rể cùng đời với vợ/chồng.

**Chi**
Một nhánh của gia phả, tính từ một người con của một tổ tiên chung (chi trưởng, chi thứ…).

**Cháu ngoại**
Con cháu của con gái trong họ. Luôn được lưu đầy đủ; việc hiện hay ẩn là lựa chọn hiển thị.

**Thứ tự con**
Vị trí của một người trong số các con của cùng cha (trưởng, thứ hai…).

**Thứ tự hôn phối**
Thứ tự vợ/chồng của một người (vợ cả, vợ hai…).

## Thời gian & lễ giỗ

**Ngày giỗ (Chính kỵ)**
Ngày mất theo âm lịch, lặp lại mỗi năm. Được hiển thị bằng ngày âm.

**Tiên thường**
Ngày trước ngày Chính kỵ; nhiều gia đình làm cỗ từ hôm này.

**Tháng nhuận**
Tháng âm lịch được thêm vào trong một số năm. Người mất trong tháng nhuận được giỗ vào tháng thường cùng số.

**Sinh nhật**
Ngày sinh dương lịch của một Người còn sống, lặp lại mỗi năm.

**Sự kiện**
Một mốc thời gian gắn với một gia phả: giỗ, sinh nhật, họp họ hoặc ngày do người dùng tự tạo. Mỗi sự kiện theo lịch âm hoặc dương, lặp hằng năm hoặc không.

**Nhắc nhở**
Thông báo gửi tới tài khoản trước một sự kiện. Giỗ: trong app và email. Sinh nhật: chỉ trong app, chỉ cho Người còn sống.

**Danh sách nhắc giỗ**
Tập Người mà một tài khoản muốn được nhắc giỗ trong một gia phả. Mặc định là tổ tiên trực hệ (khoảng 4 đời) của Người được liên kết với tài khoản; tài khoản tự thêm hoặc bớt.

**Bản tin nhắc**
Một email mỗi ngày cho mỗi tài khoản, gom mọi nhắc nhở đến hạn hôm đó.

**Ngày không đầy đủ**
Một ngày chỉ biết năm, hoặc tháng-năm, hoặc có thể kèm dấu "khoảng". Ngày sinh và ngày mất có thể nhập theo âm hoặc dương; khi đủ ngày-tháng-năm thì tự đổi sang lịch kia.

**Mộ phần**
Nơi an táng của một Người: mô tả địa điểm và link vị trí (Google Maps). Chỉ tài khoản có vai trò mới thấy.

**Người chưa nối**
Người thuộc gia phả nhưng chưa xác định được cha/mẹ trong cây. Không hiện trên Phả đồ, vẫn được nhắc giỗ.

## Hiển thị & chia sẻ

**Cây**
Cách xem gia phả tương tác trên màn hình (phóng to, thu gọn nhánh, tìm người).

**Phả đồ**
Bản trình bày gia phả để in (khổ giấy, khung, tiêu đề), xuất ra PDF/ảnh. Cách trình bày phả đồ được lưu riêng, không thay đổi dữ liệu gia phả.

**Vai trò**
Quyền của một tài khoản trên một gia phả: **Chủ sở hữu** (toàn quyền, duy nhất), **Biên tập viên** (sửa dữ liệu, mời người), **Người xem** (chỉ xem bản đầy đủ).

**Link chia sẻ công khai**
Đường dẫn ai có cũng xem được bản rút gọn của gia phả mà không cần đăng nhập. Chủ sở hữu bật/tắt và tạo lại được.

**Thông tin riêng tư**
Những thông tin của Người còn sống bị ẩn khỏi Link chia sẻ công khai; chỉ tài khoản có vai trò mới thấy.
