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

**Siêu quản trị**
Tài khoản quản lý hệ thống: vào được trang quản trị để chặn, xoá hoặc gỡ chặn tài khoản khác. Tài khoản mới đăng ký xong dùng được ngay, không chờ duyệt. Khác với vai trò trong một gia phả. Siêu quản trị *gốc* không bị thu hồi và là người duy nhất cấp quyền này.

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
Trong Phả ký và danh sách các Đời, mỗi Đời xếp theo thứ tự của Đời trước (con của người đứng đầu Đời trước trước, rồi con của người thứ hai…; con của vợ cả trước con của vợ hai); Thứ tự con chỉ xếp các con cùng cha mẹ.

**Thứ tự hôn phối**
Thứ tự vợ/chồng của một người (vợ cả, vợ hai…).

## Thời gian & lễ giỗ

**Ngày giỗ (Chính kỵ)**
Ngày âm lịch cúng giỗ, lặp lại mỗi năm; hiển thị bằng ngày âm. Khi biết đủ ngày mất, app tự suy ra ngày giỗ là **ngày trước ngày mất** (theo tục cúng trước, lệch múi giờ mất trước nửa đêm) và cho sửa tay; người mất ngày mùng 1 thì giỗ rơi vào ngày cuối tháng trước.

**Tiên thường**
Ngày trước ngày Chính kỵ; nhiều gia đình làm cỗ từ hôm này.

**Tháng nhuận**
Tháng âm lịch được thêm vào trong một số năm. Người mất trong tháng nhuận được giỗ vào tháng thường cùng số.

**Sinh nhật**
Ngày sinh dương lịch của một Người còn sống, lặp lại mỗi năm.

**Sự kiện**
Một mốc thời gian gắn với một gia phả: giỗ, sinh nhật, họp họ hoặc ngày do người dùng tự tạo. Mỗi sự kiện theo lịch âm hoặc dương, lặp hằng năm hoặc không.

**Nhắc nhở**
Thông báo gửi tới tài khoản trước một sự kiện. Giỗ, sinh nhật (chỉ Người còn sống) và Sự kiện: trong app và email.

**Danh sách nhắc giỗ**
Mặc định mọi Người đã mất đều được nhắc giỗ; danh sách của một tài khoản trong một gia phả là những Người tài khoản đó đã **tắt** nhắc giỗ (kể cả Tiên thường của họ). Chỉ áp dụng cho chuông nhắc nhở trong app; email chung của gia phả không lọc theo danh sách này.

**Bản tin nhắc**
Một email gửi chung cho Chủ sở hữu và Biên tập viên của một gia phả, cứ 5 ngày một lần, gom giỗ, sinh nhật (người còn sống) và sự kiện của 5 ngày tới, mỗi loại một khối riêng. Không có gì sắp tới thì không gửi.

**Ngày không đầy đủ**
Một ngày chỉ biết năm, hoặc tháng-năm, hoặc có thể kèm dấu "khoảng". Ngày sinh và ngày mất có thể nhập theo âm hoặc dương; khi đủ ngày-tháng-năm thì tự đổi sang lịch kia.

**Hưởng thọ**
Tuổi của một Người lúc mất, tính theo tuổi mụ như gia phả Việt thường ghi: năm mất − năm sinh + 1.

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
Quyền của một tài khoản trên một gia phả: **Chủ sở hữu** (toàn quyền, duy nhất, người mời), **Biên tập viên** (chỉ sửa/xoá Người, ảnh và Sự kiện do chính mình tạo; xoá Người phải gửi yêu cầu, chờ Chủ sở hữu duyệt; không mời được người khác), **Người xem** (chỉ xem bản đầy đủ).

**Quy tắc ghi**
Biên tập viên: Người, ảnh tư liệu, Sự kiện — chỉ thêm/sửa/xoá cái do mình tạo. Quan hệ cha mẹ và hôn phối — thêm và sửa mọi cái, không xoá (chỉ Chủ sở hữu xoá; xoá Người thì quan hệ mất theo). Cấu hình Phả đồ — lưu chung, Biên tập viên nào cũng lưu được. Chủ sở hữu: mọi thứ. Người xem: không ghi gì. Kiểm bằng tests/db/write-rules.test.ts.

**Link chia sẻ công khai**
Đường dẫn ai có cũng xem được bản rút gọn của gia phả mà không cần đăng nhập. Chủ sở hữu bật/tắt và tạo lại được.

**Thông tin riêng tư**
Những thông tin của Người còn sống bị ẩn khỏi Link chia sẻ công khai; chỉ tài khoản có vai trò mới thấy.

## Đăng ký trả phí

**Gói**
Mức dịch vụ của một Tài khoản Chủ sở hữu: Gói miễn phí hoặc một gói trả phí. Gói áp dụng cho mọi Gia phả tài khoản đó sở hữu; giới hạn và tính năng của gói được tính trên từng Gia phả.

Có ba gói: **Gói miễn phí**, **Gói Gia đình**, **Gói Dòng họ**. Tên "Gói Dòng họ" chỉ là tên một gói, không phải một Gia phả.

**Dùng thử**
30 ngày dùng Gói Dòng họ khi tạo Gia phả đầu tiên, không cần thẻ; hết hạn thì về Gói miễn phí.

**Đăng ký**
Việc Chủ sở hữu trả tiền định kỳ để nâng Gói của tài khoản mình. Chỉ Chủ sở hữu mới đăng ký; Biên tập viên và Người xem không phải trả gì và không bị giới hạn bởi gói.

**Hết hạn**
Đăng ký không được gia hạn: Tài khoản về Gói miễn phí. Dữ liệu không bị xoá; phần vượt giới hạn của Gói miễn phí chỉ xem được, không thêm được.
