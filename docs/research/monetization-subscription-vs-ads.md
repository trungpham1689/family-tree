# Nghiên cứu kiếm tiền: đăng ký (subscription) hay quảng cáo cho webapp/app Gia phả

Ngày nghiên cứu: 2026-10-20. Mọi "truy cập" bên dưới đều là 2026-10-20 trừ khi ghi khác.
Quy ước: **FACT** = số liệu/điều khoản đọc trực tiếp từ nguồn (có URL ở mục Nguồn); **ASSUMPTION** = giả định của người viết; **REC** = khuyến nghị. Chỗ nào ghi "không tìm thấy" nghĩa là đã tìm nhưng không có nguồn kiểm chứng được. Nguồn thứ cấp (báo, blog, tổng hợp) được gắn nhãn "thứ cấp".

---

## 1. Tóm tắt điều hành (≤10 dòng)

1. **Chọn: Miễn phí + đăng ký theo năm cho Chủ sở hữu, KHÔNG quảng cáo** trong app/web đăng nhập. Người xem luôn miễn phí. Quảng cáo chỉ xem lại khi MAU > ~20.000 (lúc đó doanh thu quảng cáo ước tính vẫn chỉ vài chục USD/tháng, xem mục 5).
2. **Giá khuyến nghị (tỷ giá 25.680 ₫/USD, Vietcombank chuyển khoản 2026-10-20):** Miễn phí (100 Người) / **Gia đình 199.000₫/năm (~$7,75)** / **Dòng họ 499.000₫/năm (~$19,43)**; chỉ bán theo năm, không bán tháng. Giá Gia đình hạ từ 249.000₫ xuống 199.000₫ (199.000₫ là mức giá đã thấy trên App Store VN; 249.000₫ thì không thấy ở listing nào).
3. **Dùng thử:** 30 ngày mở khoá gói Dòng họ khi tạo gia phả (không cần thẻ), hết hạn thì về Miễn phí đúng như quyết định hiện có. **Ưu đãi sáng lập:** 100 gia phả đầu tiên giảm 50% năm đầu (99.000₫ / 249.000₫), khoá giá 2 năm.
4. **Giá draft không cần thay đổi nhiều:** 499.000₫ đã rẻ hơn mọi dịch vụ web VN có ≥500 thành viên (599.000₫–1.300.000₫/năm) và rất rẻ so với dịch vụ vẽ Phả đồ thuê (từ 790.000₫ đến ~9,8 triệu₫, bảng giá 2018). Giá cho app di động phổ thông mới là chỗ cao (99.000–199.000₫/năm).
5. **Số tiền thực tế nhỏ:** với giả định 1 Chủ sở hữu/20 MAU và 1–5% chủ sở hữu trả tiền, năm 1 chỉ đạt khoảng 0,1 triệu / 1,2 triệu / 8,2 triệu₫ doanh thu ròng (kịch bản xấu/cơ sở/tốt). Hoà vốn hạ tầng Pro ($55/tháng) cần ~57 gia phả trả phí. **Giữ hạ tầng miễn phí (ADR 0004) cho đến khi có ~50 gia phả trả phí**, đừng nâng Supabase/Resend Pro sớm.
6. **Kiểm chứng rẻ trước khi viết billing:** (a) truy vấn DB thật để đếm tỷ lệ gia phả vượt 100 Người và số tài khoản/gia phả; (b) fake-door paywall trên web có A/B giá 499.000₫ vs 699.000₫; (c) pre-sale thủ công qua chuyển khoản/VietQR cho ~20 người sáng lập. Ngưỡng quyết định ở mục 9.
7. **Chưa kiểm chứng được (cần kế toán/luật sư):** cách khấu trừ thuế của Apple/Google cho cá nhân tại VN, ngưỡng miễn thuế hộ kinh doanh 1 tỷ₫ (Nghị định 141/2026, chỉ đọc qua nguồn thứ cấp), VAT cho bán web qua VietQR, và giá một lần của nhà in khổ lớn.

---

## 2. Thị trường và đối thủ

### 2.1 App di động Việt Nam (App Store storefront Việt Nam, giá VND đã gồm thuế)

FACT, nguồn [A1]–[A7], truy cập 2026-10-20. "Ratings" là số lượt đánh giá trên storefront VN (tín hiệu cầu yếu/mạnh).

| App (nhà phát triển) | Mô hình | Giá in-app thấy trên listing | Ratings VN / tải |
|---|---|---|---|
| **Phả Tuệ - Gia Phả 4.0** (FooLab, ra mắt 2019-10) | Miễn phí + IAP; Android có quảng cáo + IAP | Phả Sư 7 ngày **599.000₫**; Phả Sư 1 năm **1.999.000₫**; "Gói 800 Xu" 349.000₫; "Gói 5000 Xu" 1.790.000₫ | iOS 4,31★ / **205**; Play **10K+** tải, 4,23★ / 233 |
| **GensTree** (trước là MyFamilyTree) | Miễn phí + IAP | Plus: năm 99.000₫; 6 tháng 79.000₫; tháng/tuần/3 tháng cùng liệt kê 39.000₫ (tên và giá trên listing có vẻ lệch nhau); trọn đời 299.000₫; dung lượng 1GB 29.000₫ / 10GB 149.000₫ / 100GB 749.000₫ | iOS 4,84★ / 49 |
| **Gia Phả Việt: Phả Hệ Dòng Họ** (ra mắt 2026-08) | Miễn phí + IAP | Pro năm **99.000₫**; Pro trọn đời **299.000₫**; "ủng hộ" 29.000/59.000/129.000₫; dung lượng 2GB 29.000₫ / 10GB 99.000₫ / 30GB 199.000₫ | iOS 4,8★ / 5 |
| **Kintree - Family Tree** | Miễn phí + IAP | Premium 1 năm **199.000₫**; trọn đời 1.999.000₫ | iOS 4,75★ / 4 |
| **Gia Phả Số** (Le Anh) | Miễn phí + "ủng hộ" | "Gói gạo" 5kg/15kg/50kg/150kg = 49.000 / 129.000 / 399.000 / 1.099.000₫ | iOS 5★ / 4 |
| Gia Phả Hưng Gia, Gia Tộc Số, Gia phả Việt (Hien Cao), Gia Phả Online… | Miễn phí, không thấy IAP | không có | 0–21 ratings; Play thường 10–500 tải |

Nhận xét (FACT + diễn giải):
- Phả Tuệ là app VN nổi nhất nhóm này mà chỉ có **205 ratings iOS và 10K+ tải Android sau 7 năm**; các app còn lại dưới 50 ratings. Thị trường "app gia phả" ở VN rất nhỏ so với calendar (mục 2.3). Đây là tín hiệu cầu thấp-vừa, không phải thị trường đại chúng.
- Giá app phổ thông cho gói năm nằm ở **99.000–199.000₫**; kiểu "trọn đời" 299.000₫ khá phổ biến. Phả Tuệ là ngoại lệ định giá cao (1.999.000₫/năm, 599.000₫/7 ngày) nhưng không có dữ liệu bao nhiêu người mua.
- Google Play VN cho thấy nhiều app gia phả mới có 10–500 tải (kiểm tra 21 package, [G1]).

### 2.2 Dịch vụ web/phần mềm gia phả cho dòng họ tại VN (đối thủ trực tiếp nhất)

FACT, nguồn [W1]–[W7]. Giá VND/năm trừ khi ghi khác.

| Dịch vụ | Gói và giá | Giới hạn chính | Ghi chú |
|---|---|---|---|
| **Gia Phả Đại Việt online** (giaphadaiviet.vn) | Khởi đầu **0₫**; Cơ bản **500.000₫**; Đoàn viên **1.000.000₫**; Đồng tâm **2.000.000₫**; Thịnh vượng **5.000.000₫**; Bản sắc **10.000.000₫** | 50 / 200 / 500 / 2.000 / 10.000 / không giới hạn thành viên; 1–15 quản trị viên; 1–50GB | Có nhập Excel, xuất Excel/PDF/SVG/PNG, website dòng họ, tên miền riêng, nhắc giỗ/email. Trang tôi tải không ghi rõ VAT |
| **Gia Phả Số Đại Việt** (giaphaso.com) | Dùng thử 30 ngày (30 TV); 300 TV **1.100.000₫** (giá gốc 2.000.000₫); 500 TV **1.300.000₫** (gốc 2.500.000₫); 1.000 TV **1.800.000₫** (gốc 3.000.000₫); không giới hạn **2.990.000₫** (gốc 6.000.000₫) | 3–5 quản trị viên, 2.000MB; thêm 100 TV = 100.000₫; thêm 1.000MB = 400.000₫ | Giá đã gồm VAT, 12 tháng. Giá "gốc" gạch ngang là chiêu khuyến mãi |
| **phanmemgiapha.vn** (Webux) | Cơ bản **0₫** (100 TV, 50 ảnh, 3 phả đồ); Phổ thông **599.000₫** (2.500 TV, 250 ảnh, 10 phả đồ); Nâng cao **999.000₫** (5.000 TV, 500 ảnh, 20 phả đồ) | | Công ty TNHH WebUX, MST 0108181640 |
| **AKB - Quản lý gia phả (bản cài trên máy, offline)** | Bản quyền một lần: 500 TV **1.000.000₫**; 1.000 TV **1.500.000₫**; không giới hạn **2.000.000₫**. Dịch vụ nhập liệu **2.750₫/thành viên** (đã gồm VAT) | | Bảng giá hiệu lực từ 2026-01-01; ghi "không chịu thuế" cho bản quyền phần mềm |
| **Cafe Tú Nhiên** (làm phả đồ ngang online, dịch vụ một lần) | ≤50 nút **790.000₫**; ≤100 **990.000₫**; ≤150 **1.490.000₫**; ≤200 **1.990.000₫** | tính theo "nút" | Trang bán hàng, không ghi ngày |
| **Bảng giá "vẽ phả đồ / làm cuốn gia phả" (2018)** | Vẽ phả đồ 700–800 người **9.800.000₫**; 300–400 người 5.800.000₫; cuốn gia phả 50–60 trang 5.000.000₫ … 140–150 trang 14.000.000₫; cuốn mẫu 3.700.000₫ | | Tài liệu 1 trang từ itrithuc.vn, không rõ đơn vị, cũ (2018) |
| **vietnamgiapha.com** | Không tìm thấy bảng giá (trang là SPA Angular/Ionic, HTML không chứa giá). Tìm kiếm thứ cấp cho biết có trình soạn offline miễn phí giấy phép EPL trên SourceForge | | |
| Heritage Tree | Không tìm thấy listing/trang tương ứng | | |

So sánh theo đầu người (FACT tính từ bảng trên): Đại Việt 1.000.000₫/500 TV = 2.000₫/TV/năm; phanmemgiapha 599.000₫/2.500 TV = 240₫/TV; draft của ta 499.000₫ cho "không giới hạn" (xem REC giới hạn 3.000 Người).

### 2.3 Đối thủ toàn cầu

FACT, nguồn [X1]–[X7]. Giá ở App Store Mỹ là USD, VN là VND (mỗi listing chỉ liệt kê mức giá, không ghi kỳ hạn rõ cho mọi dòng).

| Dịch vụ | Mô hình / giá | Tín hiệu cầu |
|---|---|---|
| **MyHeritage** | Subscription + DNA. App Store Mỹ: PremiumPlus $119,99 / $139,99; Complete $199,99 / $249,99; Data $16,99 / $119,99. App Store VN: Premium 2.299.000₫, PremiumPlus 3.199.000₫, Complete 6.999.000₫; "Monthly Complete FT" 599.000₫ | iOS Mỹ 4,86★ / 66.358; Play **10Tr+** tải |
| **Ancestry** | Subscription. Mỹ: U.S. Discovery $19,99–$24,99; World Explorer $34,99–$39,99. VN: U.S. Discovery 449.000–579.000₫; World Explorer 789.000–919.000₫ | iOS Mỹ 4,77★ / 654.483; Play 10Tr+ |
| **Findmypast** | Subscription. Mỹ: 1 tháng Essential $19,99, Ultimate $29,99, Everything $34,99; 12 tháng Ultimate $199,99, Everything/Premium $299,99 | iOS Mỹ 4,56★ / 817 |
| **FamilySearch** | Miễn phí (listing không có mua trong ứng dụng) | Play 10Tr+; iOS Mỹ 504.534 ratings |
| **Tribal Pages** (tribalpages.com) | Free (có banner quảng cáo, gói trả phí "Banner-Free") / Premium **$3/tháng tính theo năm** / Deluxe **$4/tháng tính theo năm** (= $36 / $48 mỗi năm) | iOS 3,71★ / 14 |
| **Family Echo** | Dịch vụ miễn phí ("provided as a free service") | không tìm thấy |
| **Famberry** | 2GB miễn phí, Premium tới 100GB (giá không có trên trang) | không tìm thấy |
| **Geni** | Không đọc được trang chính thức (chặn). Thứ cấp: Pro $119,40/năm (ưu đãi từ $149) | không tìm thấy |

Nhận xét: bên toàn cầu, giá năm cao ($100–300) vì có kho hồ sơ lịch sử/DNA, không so sánh trực tiếp được. Phần so sánh được là **Tribal Pages** (công cụ cây + chia sẻ gia đình): $36–48/năm ≈ 925.000–1.230.000₫; giá Famberry không tìm thấy.

### 2.4 Sản phẩm liền kề người Việt đã trả tiền (neo willingness-to-pay)

FACT, nguồn [A6], [P1], [G1].

| Sản phẩm | Giá |
|---|---|
| Lịch Vạn Niên 2026 & Lịch Việt (674.205 ratings iOS VN) | VIP 1 tháng 19.000₫; Year Premium 99.000₫; Lifetime 299.000₫ |
| Lịch Vạn Niên 2026 Lịch Việt (LICH VIET, 655.845 ratings) | Cơ bản 7 ngày 9.000₫; Gói Bạc/Nâng cao 1 tháng 39.000₫; **Bỏ quảng cáo 6 tháng 29.000₫; Bỏ quảng cáo 1 năm 50.000₫**; Chọn ngày tốt 1 năm 280.000₫; Nâng cao trọn đời 390.000₫ |
| Lịch Vạn Niên 2026 - Lịch Âm (247.036 ratings) | Pro 1 tháng 19.000₫; Hàng năm 149.000₫; Trọn đời 299.000₫ |
| Lịch Vạn Niên 2026 & Lịch Âm (207.982 ratings) | VIP 1 tháng 29.000₫; 1 năm 149.000₫ (hoặc 99.000₫); trọn đời 299.000₫ (hoặc 149.000₫) |
| Viet Lunar (3.212 ratings) | Tháng 19.000₫; 3 tháng 49.000₫; năm 79.000₫; vĩnh viễn 299.000₫ |
| Lịch Âm - Lịch Vạn Niên (tử vi) | Mở khoá lá số: 79.000₫ – 699.000₫ |
| Spotify Premium Individual VN | 65.000₫/tháng (≈ 780.000₫/năm) |
| iCloud+ VN | 50GB 25.000₫/tháng; 200GB 89.000₫/tháng; 2TB 299.000₫/tháng (giá đã gồm thuế) |

Nhận xét: lịch âm/vạn niên **lớn hơn app gia phả hàng nghìn lần về số lượt đánh giá** (674.205 so với 205 ratings của Phả Tuệ), dựa vào quảng cáo + IAP với giá "bỏ quảng cáo" rất thấp (50.000₫/năm) và gói năm 99.000–149.000₫. Trên Google Play VN, hầu hết app lịch có nhãn "Chứa quảng cáo" + "Mua trong ứng dụng" (1Tr+ đến 100N+ tải). Điều đó cho thấy người Việt trả tiền cho nội dung âm lịch, nhưng ở mức 99.000–149.000₫/năm cho dùng hằng ngày; sản phẩm của ta dùng ít hơn nhiều (nhắc theo mùa).

---

## 3. Mức sẵn sàng chi trả ở Việt Nam

### 3.1 Chuyển đổi và giá (RevenueCat State of Subscription Apps 2026, [R1])

FACT (báo cáo của RevenueCat, 115.000 app; "IN/SEA" gộp Ấn Độ + Đông Nam Á, **không tách riêng Việt Nam**):
- Download-to-paid ngày 35, trung vị toàn cầu **2,0%**; freemium **2,1%** (nhóm tốt nhất >4,5%); hard paywall 10,7%. Theo vùng người dùng: Bắc Mỹ 2,8%, Châu Á-Thái Bình Dương (Nhật, Hàn, Úc, NZ) 2,4%, **IN/SEA 0,7%**.
- Trial-to-paid: Bắc Mỹ 34,2%; APAC 31,9%; **IN/SEA 15,2%**. Trial 17–32 ngày chuyển đổi cao nhất (42,5%) so với ≤4 ngày (25,5%).
- Giá trung vị gói năm: Bắc Mỹ **$39,99**; **IN/SEA $18,32** (≈ 470.000₫ ở 25.680). Gói tháng IN/SEA $3,75.
- Doanh thu 1 năm trên mỗi người trả tiền (RLTV năm 1): toàn cầu $23; IN/SEA **$19,32**.

Diễn giải (REC/ASSUMPTION): giá draft **Dòng họ $19,43/năm ≈ trung vị gói năm IN/SEA ($18,32)**; **Gia đình $9,70 (249.000₫) thấp hơn trung vị**. Tỷ lệ chuyển đổi 1–5% **trên Chủ sở hữu** (không phải trên tổng tải) là hợp lý so với 0,7% download-to-paid của IN/SEA vì Chủ sở hữu là nhóm đã bỏ công nhập dữ liệu; nhưng **không có số liệu Việt Nam** cho ngách này.

### 3.2 Thị trường chi tiêu app tại VN (thứ cấp)

Adjust "Mobile App Trends Spotlight: Vietnam 2026", qua VnEconomy 2026-07-13 [R3] (thứ cấp): doanh thu IAP game **$259 triệu**; streaming video IAP **$23,2 triệu** (+73%); short-drama $11,5 triệu; tổng tải 2,88 tỷ. Không có số cho tiện ích/lifestyle/gia phả. Ý nghĩa: IAP ở VN tập trung vào game; app tiện ích phải tự chứng minh.

### 3.3 Thanh toán

- FACT: NAPAS xử lý ~**15 triệu giao dịch VietQR/ngày** (đầu 11/2025); 9 tháng đầu 2025 giao dịch QR tăng 61% về số lượng và >150% về giá trị [R4] (thứ cấp, VnEconomy). Số liệu NAPAS từ báo chí ghi "gần 90 triệu tài khoản" dùng mobile banking quét VietQR (10/2025) (thứ cấp, tìm kiếm, chưa mở bài gốc).
- Tỷ lệ sở hữu/sử dụng **thẻ tín dụng VN: không tìm thấy** số liệu mới (Findex 2024 có biến "has a credit card" nhưng trang mô tả không cho tỷ lệ); số cũ 2015: 4,9 thẻ tín dụng/100 dân (thứ cấp).
- ASSUMPTION: người dùng lớn tuổi/Chủ sở hữu ngoài thành phố thích chuyển khoản/VietQR hơn thẻ; IAP của Apple/Google dùng thẻ, số dư Apple, hoặc thanh toán qua nhà mạng (chưa kiểm). Vì VietQR là chuyển tiền chủ động, **không tự gia hạn** (không tìm thấy nguồn xác nhận PayOS/SePay hỗ trợ thu định kỳ tự động) nên gói mua qua web phải có nhắc gia hạn (đã có Hết hạn + Bản tin nhắc), tỷ lệ gia hạn web có thể thấp hơn IAP tự gia hạn.

Kết luận mục 3: **không có số liệu chuyển đổi/giá riêng cho Việt Nam hoặc cho gia phả**. Mọi dự báo ở mục 6–7 là giả định; vì vậy mục 9 đặt kiểm chứng trước khi xây billing.

---

## 4. Nền tảng và thuế (chỉ nguồn chính thức; chỗ thứ cấp ghi rõ)

### 4.1 Apple
- FACT [F1]: Small Business Program: hoa hồng **15%** cho app trả phí và IAP nếu proceeds ≤ **$1 triệu**/năm trước và năm hiện tại (phải đăng ký chương trình, khai các Associated Developer Accounts). Vượt $1 triệu năm hiện tại thì áp mức chuẩn cho giao dịch sau đó.
- FACT [F2]: Guideline 3.1.1 bắt buộc dùng IAP để mở tính năng trong app. 3.1.3(b) cho phép mở tính năng đã mua ở web/nền tảng khác **với điều kiện cũng bán qua IAP trong app**. Nghĩa là mở bán web (VietQR) trước là được, nhưng khi ra app iOS phải có IAP song song.
- FACT [T1] (Apple Developer News, 2025-08-21, Việt Nam): với **cá nhân phát triển ở VN**: thuế TNCN **2%** thay cho thuế TNDN; **FCT 5% trên phần hoa hồng của Apple**; mức VAT 0% cho báo/tạp chí/sách bị bỏ (mọi nội dung dùng thuế suất chuẩn). Với **tổ chức ở VN**: Apple không còn nộp hộ FCT trên doanh số cho người dùng cuối, FCT 5% chỉ áp trên hoa hồng. Giá đăng ký tự gia hạn không bị đổi theo đợt cập nhật giá 2025-09-08.
- FACT [P1]: giá App Store VN đã bao gồm thuế (footnote 3 trong bảng giá iCloud+ của Apple).
- FACT: giá thấp nhất IAP quan sát được trên storefront VN là **9.000₫** (Lịch Việt, gói 7 ngày). Bảng "price tier/min price" chính thức của Apple cho VN: **không tìm thấy** trên docs đã fetch; cần xem trong App Store Connect. Các mức đã thấy là hợp lệ trên storefront: 29.000, 49.000, 79.000, 99.000, 149.000, **199.000**, 299.000, 349.000, **499.000**, 599.000₫…; **249.000₫ không thấy trên listing nào** (có thể tồn tại nhưng chưa xác nhận).
- FACT [F6]: Apple yêu cầu mọi app trên storefront VN có xếp hạng độ tuổi theo Điều 38 Nghị định 147 (00+/12+/16+/18+) từ 2026-06-18 [F6] (Nghị định 147 ở đây là quy định về mạng xã hội; chưa kiểm tra app gia phả có thuộc phạm vi hay không).
- Phí Apple Developer Program $99/năm [I3].

### 4.2 Google Play
- FACT [F3] (support.google.com, bản đang hiển thị 2026-10-20): cơ cấu phí mới (10% + 5% phí billing cho subscription) chỉ áp cho giao dịch với người dùng ở **EEA, Anh, Mỹ (từ 2026-06-30)** và **Úc, Nhật (từ 2026-09-30)**. **Việt Nam thuộc "remaining markets"**: **15% cho $1 triệu doanh thu đầu/năm** (30% phần vượt) nếu đã đăng ký mức 15%, và **15% cho đăng ký tự gia hạn bất kể doanh thu**. Tức là thay đổi tháng 6/2026 **không áp dụng cho VN** ở thời điểm này.
- FACT [T2]: nhà phát triển đặt tại VN và được coi là hộ kinh doanh/cá nhân: **Google tính và nộp 5% VAT** cho mua hàng của người dùng VN; nếu không phải hộ/cá nhân thì nhà phát triển tự chịu VAT; Google tính thêm 5% VAT trên phí dịch vụ; phải khai mã số thuế VN (số định danh cá nhân 12 số) trong Play Console. Nhà phát triển ngoài VN: Google nộp VAT 10%.
- Giá tối thiểu Google Play cho VN: **không tìm thấy**.

### 4.3 RevenueCat
- FACT [R2]: Pro miễn phí tới **$2.500 doanh thu theo dõi/tháng (MTR)**, sau đó **1%** của phần theo dõi. $2.500 ≈ 64 triệu₫/tháng nên phí này ≈ 0 trong mọi kịch bản ở đây.

### 4.4 Cổng thanh toán web
- FACT [B2]: Stripe: **Việt Nam không có trong danh sách quốc gia hỗ trợ** tại stripe.com/global (có Thái Lan, Singapore, Malaysia; Indonesia "Preview"). Không dùng được Stripe cho đăng ký tài khoản merchant ở VN.
- FACT [B2]: **payOS** quảng cáo "cổng thanh toán miễn phí", tiền về thẳng tài khoản ngân hàng, đăng ký bằng CCCD, "tài trợ chi phí bởi các ngân hàng". Biểu phí chi tiết (ví dụ gói BIDV-1K): **không tìm thấy**.
- FACT [B2]: **SePay**: gói miễn phí 0₫/tháng với 50 giao dịch/tháng; gói trả phí từ 120.000₫/tháng (180 giao dịch/tháng). VNPay, MoMo, ZaloPay: **không kiểm tra** trong lần nghiên cứu này.

### 4.5 Thuế Việt Nam cho nhà phát triển cá nhân (ĐỂ KẾ TOÁN XÁC NHẬN)
- Thứ cấp [T3]: Tuổi Trẻ 2025-12-19: hộ kinh doanh doanh thu ≤ **500 triệu₫/năm** không chịu GTGT và TNCN từ 2026-01-01. Thứ cấp [T4] (MISA, tóm tắt Nghị định 141/2026/NĐ-CP ký 2026-04-29, hiệu lực hồi tố 2026-01-01): **nâng lên 1 tỷ₫/năm** (sửa Nghị định 68/2026/NĐ-CP) và doanh nghiệp có tổng doanh thu ≤1 tỷ₫ được miễn thuế TNDN. **Chưa đọc văn bản gốc** (thuvienphapluat.vn trả 403 khi tải tự động).
- Thứ cấp [T5]: Nghị định 117/2025/NĐ-CP (hiệu lực 2025-07-01) yêu cầu sàn/nền tảng (cả nước ngoài) khấu trừ và nộp thuế thay cho hộ/cá nhân. Chưa có nguồn nói rõ cách áp cho Apple/Google; Apple tự mô tả 2% TNCN (mục 4.1).
- **Chưa xác minh được:** (1) khoản 2% TNCN do Apple khấu trừ có được hoàn khi tổng doanh thu dưới ngưỡng miễn không; (2) thuế suất VAT cho đăng ký phần mềm bán trực tiếp qua web (5%, 8%, 10% hay miễn); (3) có phải xuất hoá đơn cho người mua cá nhân; (4) nên đăng ký hộ kinh doanh hay công ty (payOS/SePay có thể cần tài khoản doanh nghiệp/hộ). AKB ghi bản quyền phần mềm một lần là "không chịu thuế" nhưng đây là bản cài một lần, không phải SaaS thuê bao.

Phí/thuế dùng cho tính toán ở mục 6 (ASSUMPTION, tính từ các FACT trên):
- iOS (SBP): giá niêm yết đã gồm VAT 10% → ròng = P/1,10 × (1 − 15% − 0,75% [FCT 5% trên hoa hồng] − 2% [TNCN]) ≈ **0,75 P**.
- Google Play: P/1,05 × (1 − 15%) ≈ **0,81 P**.
- Web VietQR: 0,93–1,00 P (tuỳ có phải nộp 5% VAT + 2% TNCN hay được miễn).
- Trọng số: 70% di động / 30% web → **hệ số ròng ≈ 0,80** (dùng xuyên suốt).

---

## 5. Quảng cáo so với đăng ký cho sản phẩm này

### 5.1 Số liệu eCPM Việt Nam tìm được (đều thứ cấp)
- MonetizeMore (blog nhà cung cấp, dữ liệu app publisher 2024) [M1]: eCPM **interstitial** Việt Nam khoảng **$0,72 (tháng 1/2024) → $1,51 (tháng 12/2024)**; **App Open** Việt Nam $1,22–$2,34 theo tháng. Adnimation [M2] nêu cùng xu hướng ($0,7 → $1,5).
- Tenjin glossary [M3] (thứ cấp, từ kết quả tìm kiếm): banner thị trường Tier 1 chỉ **$0,50–$2,00**; Việt Nam thấp hơn nhưng **không tìm thấy** số banner/rewarded cho Việt Nam từ AdMob/AppLovin/Unity/Tenjin; báo cáo AnyMind và Appodeal có bảng theo nước nhưng bị khoá, trang công khai không hiện số [M4].
- Hệ quả: **eCPM banner VN trong mô hình dưới đây là ASSUMPTION** ($0,08 / $0,15 / $0,30), interstitial dùng khoảng thấy ($0,7 / $1,0 / $1,5).

### 5.2 Mô hình doanh thu (công thức, giả định rõ ràng)

Công thức quảng cáo (ASSUMPTION cho mọi tham số):
`Doanh thu QC/tháng = MAU × phiên/MAU/tháng × (số lượt banner/phiên × eCPM banner + số lượt interstitial/phiên × eCPM interstitial) / 1000`

| Tham số (ASSUMPTION) | Xấu | Cơ sở | Tốt |
|---|---|---|---|
| Phiên/MAU/tháng (app dùng ít, theo lời nhắc; Người xem 1–2, Chủ sở hữu nhiều hơn) | 2 | 3 | 6 |
| Lượt banner/phiên | 2 | 3 | 4 |
| eCPM banner | $0,08 | $0,15 | $0,30 |
| Lượt interstitial/phiên (chỉ khi dùng interstitial) | 0 | 0,5 | 1 |
| eCPM interstitial (khoảng thấy ở VN 2024) | $0,70 | $1,00 | $1,50 |
| **ARPMAU chỉ banner ($/MAU/tháng)** | 0,00032 | 0,00135 | 0,00720 |
| **ARPMAU banner + interstitial** | 0,00032 | 0,00285 | 0,01620 |

Doanh thu quảng cáo mỗi tháng (tỷ giá 25.680):

| MAU | Xấu (banner) | Cơ sở (banner) | Cơ sở (banner+interstitial) | Tốt (banner) | Tốt (banner+interstitial) |
|---|---|---|---|---|---|
| 1.000 | $0,3 (8.200₫) | $1,35 (35.000₫) | $2,85 (73.000₫) | $7,2 (185.000₫) | $16,2 (416.000₫) |
| 10.000 | $3,2 (82.000₫) | $13,5 (347.000₫) | $28,5 (732.000₫) | $72 (1,85 triệu₫) | $162 (4,16 triệu₫) |
| 100.000 | $32 (0,82 triệu₫) | $135 (3,47 triệu₫) | $285 (7,32 triệu₫) | $720 (18,5 triệu₫) | $1.620 (41,6 triệu₫) |

Công thức đăng ký:
`Doanh thu ròng ĐK/tháng = (MAU / MAU_mỗi_gia_phả) × tỷ lệ trả tiền × ARPPU_gộp × hệ số ròng / 12`
Giả định: **1 Chủ sở hữu mỗi 20 MAU** (ASSUMPTION; cần đo từ DB thật), cơ cấu mua **40% Gia đình / 60% Dòng họ**, giá khuyến nghị 199.000₫ / 499.000₫ → trung bình 379.000₫/năm, ròng (×0,80) 303.200₫/năm = **25.267₫/tháng/người trả tiền**. (Với giá draft 249.000₫/499.000₫: 399.000₫ gộp, ròng 26.600₫/tháng.)

| MAU | Chủ sở hữu | Trả tiền 1% | Trả tiền 3% | Trả tiền 5% | Doanh thu ròng/tháng ở 1% / 3% / 5% |
|---|---|---|---|---|---|
| 1.000 | 50 | 0,5 | 1,5 | 2,5 | 12.600₫ / 37.900₫ / 63.200₫ |
| 10.000 | 500 | 5 | 15 | 25 | 126.000₫ / 379.000₫ / 632.000₫ ($4,9 / $14,8 / $24,6) |
| 100.000 | 5.000 | 50 | 150 | 250 | 1,26 triệu₫ / 3,79 triệu₫ / 6,32 triệu₫ ($49 / $148 / $246) |

Doanh thu trên mỗi MAU (đơn vị ₫/MAU/tháng): đăng ký **12,6 / 37,9 / 63,2** (1/3/5%); quảng cáo banner **8 / 35 / 185** (xấu/cơ sở/tốt), banner+interstitial **8 / 73 / 416**.

**Đọc kết quả (diễn giải):**
- Ở giả định cơ sở, quảng cáo banner (35₫/MAU) và đăng ký 3% (38₫/MAU) **cùng bậc độ lớn**; quảng cáo chỉ vượt hẳn khi tham số đều ở mức "tốt" (6 phiên/tháng, eCPM banner $0,30), vốn là giả định chưa có nguồn cho VN và không hợp lý với app dùng thưa. Quảng cáo tỷ lệ theo MAU (có Người xem), đăng ký tỷ lệ theo số Chủ sở hữu.
- **Ở quy mô thực tế (1.000–10.000 MAU), quảng cáo chỉ đáng $1–$30/tháng** ở cơ sở. Hoà vốn quảng cáo cho chi phí Pro ($55/tháng ≈ 1,45 triệu₫) cần ~42.000 MAU (banner) hoặc ~20.000 MAU (banner+interstitial) ở cơ sở.
- Độ nhạy theo tỷ lệ Chủ sở hữu/MAU (ASSUMPTION): nếu 1:10 thì đăng ký/MAU gấp đôi; nếu 1:40 thì còn một nửa. Cần đo thật.

### 5.3 Chi phí phi tiền tệ của quảng cáo cho sản phẩm trang nghiêm
- UX/tin cậy (REC, ASSUMPTION): giỗ, ngày mất, mộ phần là nội dung tang lễ/gia tộc; chèn banner/interstitial cạnh đó dễ bị cảm nhận thiếu tôn trọng; người lớn tuổi dễ chạm nhầm quảng cáo. Chính sách AdMob/AdSense đã đọc (support.google.com/admob/answer/6223431, adsense/answer/9728) **không tìm thấy** điều khoản cấm riêng nội dung giỗ/tưởng niệm; rủi ro là quảng cáo không phù hợp ngữ cảnh, không phải vi phạm chính sách (chưa xác minh được).
- Apple ATT/nhãn riêng tư [F4]: bán/chia sẻ dữ liệu với mạng quảng cáo để nhắm mục tiêu hoặc đo lường được tính là "tracking" và cần hộp thoại ATT; phải khai nhãn App Privacy. Google Play yêu cầu khai Data safety [F5]. Dùng quảng cáo không cá nhân hoá làm giảm eCPM (ASSUMPTION).
- Google Play Families (qua kết quả tìm kiếm đến support.google.com/admob/answer/6223431, chưa đọc đầy đủ): chỉ áp khi app hướng tới trẻ em. App gia phả không nhắm trẻ em nên không bắt buộc, nhưng Người xem có thể là trẻ nhỏ (ASSUMPTION); cần màn hình xác thực tuổi nếu phát hiện đối tượng hỗn hợp.
- Pháp lý VN [L1]–[L3]: Nghị định 13/2023/NĐ-CP đã được **thay bằng Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 2026-01-01) và Nghị định 356/2025/NĐ-CP** (ký 2025-12-31, hiệu lực 2026-01-01; Điều 42 Nghị định 356 ghi Nghị định 13 hết hiệu lực; một nguồn cho rằng 13/2023 vẫn là văn bản hướng dẫn chuyển tiếp, nên cần luật sư xác nhận). Theo bản dịch tiếng Anh trên luatvietnam (thứ cấp): Điều 28 yêu cầu **đồng ý của khách hàng** cho quảng cáo, nhắm mục tiêu/hành vi cần đồng ý và cho phép từ chối chia sẻ dữ liệu; Điều 29 yêu cầu cho từ chối cookie và "do not track" với dịch vụ mạng xã hội/truyền thông. Phạt tối đa theo Điều 8: 3 tỷ₫ (vi phạm chung), 5% doanh thu năm trước (chuyển dữ liệu xuyên biên giới trái phép), 10 lần khoản thu (mua bán dữ liệu). Văn bản không nêu rõ miễn trừ cho mục đích cá nhân/gia đình (chưa xác nhận); **dữ liệu người đã mất** không được đề cập.
- Hệ quả (REC): dữ liệu ở đây gồm thông tin người còn sống (ngày sinh, quan hệ) do một người nhập thay họ; thêm SDK quảng cáo/phân tích gửi ID thiết bị của người thân sang bên thứ ba làm tăng rủi ro đồng ý, khác với lựa chọn hiện tại (lọc dữ liệu phía server cho Link chia sẻ, ADR 0002). Đây là lý do thêm để không gắn quảng cáo vào app.

### 5.4 Các phương án lai (đánh giá)

| Phương án | Bằng chứng/neo | Đánh giá | Quyết định |
|---|---|---|---|
| Miễn phí + đăng ký (Chủ sở hữu) | Đối thủ web VN bán theo năm 500.000–2.000.000₫; app 99.000–199.000₫ | Khớp mô hình đã chọn; doanh thu nhỏ nhưng sạch, không rủi ro dữ liệu | **Chọn** |
| Miễn phí + quảng cáo + IAP "bỏ quảng cáo" | App lịch VN: bỏ QC 50.000₫/năm; Phả Tuệ Android có QC + IAP | Cần SDK QC, ATT, consent; doanh thu QC ở quy mô <10k MAU < $30/tháng; giá bỏ QC thấp kéo ARPPU xuống | Không làm; xem lại khi MAU > 20.000 |
| QC chỉ ở trang Link chia sẻ công khai | Không tìm thấy RPM web VN (AdSense) | Trang chứa tên người đã mất, hiện cho họ hàng lớn tuổi mở từ Zalo; cookie/consent theo Điều 29 | Không làm giai đoạn đầu |
| Tài trợ/affiliate (in phả đồ, đồ thờ cúng, khắc bia, quay phim lễ) | Không tìm thấy mức hoa hồng nào được công bố | Không ước tính được; rủi ro "thương mại hoá" nội dung tâm linh | Thử 1–2 đối tác in ấn sau khi có báo giá; không đưa vào doanh thu dự báo |
| Mua một lần (bản quyền / "trọn đời") | AKB bản quyền 1–2 triệu₫; app VN trọn đời 299.000₫ | "Trọn đời" không hợp vì chi phí vận hành tiếp diễn (email, DB) | Không bán trọn đời |
| Gói in 30 ngày / mua theo lần xuất Phả đồ | Phả Tuệ bán gói 7 ngày 599.000₫; dịch vụ vẽ phả đồ 790.000₫–9,8 triệu₫ | Có thể là cửa vào cho người chỉ cần in một lần; cần kiểm chứng bằng fake door | Thử bằng fake door (mục 9) |
| Dịch vụ in Phả đồ giao tận nơi (biên lợi nhuận/lần in) | Không tìm thấy giá in khổ lớn công khai; chỉ có dịch vụ thiết kế (Cafe Tú Nhiên) | Công thức: lãi = giá bán − giá in − vận chuyển − thuế − thời gian xử lý; thiếu dữ liệu chi phí in | Lấy 2–3 báo giá nhà in rồi mới quyết |
| Dịch vụ nhập liệu hộ | AKB: 2.750₫/thành viên (đã gồm VAT) | 600 người ≈ 1,65 triệu₫; tốn công thủ công | Tuỳ chọn sau, cho gói Dòng họ |

---

## 6. Hoà vốn và kịch bản 12 tháng

### 6.1 Chi phí cố định (FACT + ASSUMPTION)
- Supabase Pro **$25/tháng** (Free: 500MB DB, 50k MAU, tạm dừng sau 1 tuần không hoạt động) [I1]; Resend Pro **$20/tháng** cho 50.000 email (Free: 3.000 email/tháng, 100/ngày) [I2]; Apple Developer Program **$99/năm** [I3]; Google Play đăng ký $25 một lần (ASSUMPTION từ kiến thức chung, chưa fetch lại); tên miền ~300.000₫/năm (ADR 0004). RevenueCat $0 tới $2.500 MTR; Cloudflare Pages $0.
- **Hạ tầng đầy đủ Pro:** $45 + $8,25 (Apple/12) + $2,08 (Google, khấu hao năm 1) = ~$55,3/tháng + 25.000₫ tên miền = **1.446.000₫/tháng**.
- **Hạ tầng tinh gọn (vẫn ở gói miễn phí, chỉ phí cửa hàng):** $10,3/tháng + tên miền = **290.000₫/tháng**.

### 6.2 Hoà vốn (hệ số ròng 0,80; ARPPU ròng 25.267₫/tháng)
| Mốc | Gia phả trả phí cần có | Chủ sở hữu cần (ở 1% / 3% / 5%) | MAU cần (1:20) ở 1% / 3% / 5% |
|---|---|---|---|
| Hạ tầng tinh gọn (290.000₫/tháng) | **≈ 12** | 1.150 / 383 / 230 | 23.000 / 7.700 / 4.600 |
| Hạ tầng Pro (1.446.000₫/tháng) | **≈ 57** | 5.700 / 1.900 / 1.140 | 114.000 / 38.000 / 23.000 |

Hoà vốn bằng quảng cáo (chỉ banner, cơ sở): ~42.000 MAU cho Pro, ~8.400 MAU cho tinh gọn. Bằng đăng ký: ~38.000 MAU cho Pro ở 3%. Tức là **hai nguồn cùng bậc**; cái tạo khác biệt là chi phí tin cậy/pháp lý, không phải doanh thu.

### 6.3 Doanh thu năm 1 (12 tháng), tăng MAU tuyến tính từ 0
Tham số kịch bản (ASSUMPTION): xấu = MAU tháng 12 1.000, 1% chủ sở hữu trả tiền; cơ sở = 5.000, 3%; tốt = 20.000, 5%. Bán web + app, giá khuyến nghị, hệ số ròng 0,80. Lưu ý: 100.000 MAU năm đầu vượt xa mọi đối thủ quan sát được (Phả Tuệ 10K+ tải Android sau 7 năm) nên chỉ xét như ngoại lệ ở bảng mục 5.2.

| | Xấu | Cơ sở | Tốt |
|---|---|---|---|
| MAU cuối tháng 12 | 1.000 | 5.000 | 20.000 |
| Gia phả trả phí cuối tháng 12 | 0,5 | 7,5 | 50 |
| **Đăng ký: doanh thu ròng cộng dồn 12 tháng** | **0,08 triệu₫** (~$3) | **1,23 triệu₫** (~$48) | **8,21 triệu₫** (~$320) |
| Đăng ký: doanh thu ròng/tháng ở tháng 12 | 13.000₫ | 190.000₫ | 1,26 triệu₫ |
| Quảng cáo chỉ banner (cộng dồn) | 0,05 triệu₫ | 1,13 triệu₫ | 24,0 triệu₫ |
| Quảng cáo banner + interstitial | 0,05 triệu₫ | 2,38 triệu₫ | 54,1 triệu₫ |
| Chi phí tinh gọn 12 tháng | 3,48 triệu₫ | 3,48 triệu₫ | 3,48 triệu₫ |
| Chi phí Pro 12 tháng | 17,35 triệu₫ | 17,35 triệu₫ | 17,35 triệu₫ |
| **Ròng: chỉ đăng ký, chi phí tinh gọn** | −3,40 | −2,25 | **+4,73** triệu₫ |
| Ròng: chỉ đăng ký, chi phí Pro | −17,27 | −16,12 | −9,14 triệu₫ |
| Ròng: chỉ quảng cáo (banner), chi phí tinh gọn | −3,43 | −2,35 | +20,56 triệu₫ |
| Ròng: lai (đăng ký + banner), chi phí tinh gọn | −3,35 | −1,13 | +28,76 triệu₫ |

Đọc (diễn giải): trừ kịch bản "tốt" (mọi tham số quảng cáo đều lạc quan và chưa có nguồn), **không phương án nào có lãi trong năm 1**; sản phẩm là dự án phụ, mục tiêu năm 1 là chứng minh có người trả tiền và giữ chi phí gần 0. Kịch bản "tốt" cho thấy quảng cáo có thể vượt đăng ký, nhưng nó đòi hỏi 20.000 MAU và 6 phiên/MAU/tháng, trái với đặc điểm "nhắc theo mùa". Nếu muốn đưa quảng cáo vào mô hình, hãy lấy số thật từ một thử nghiệm nhỏ thay vì dựa vào bảng này.

---

## 7. Khuyến nghị gói và giá

### 7.1 Gói đề xuất (tỷ giá 25.680₫/USD)

| | **Miễn phí** | **Gia đình** | **Dòng họ** |
|---|---|---|---|
| Giá năm | 0₫ | **199.000₫** (~$7,75) | **499.000₫** (~$19,43) |
| Giá ưu đãi sáng lập (100 gia phả đầu, năm 1, khoá giá 2 năm) | – | 99.000₫ (~$3,86) | 249.000₫ (~$9,70) |
| Người | 100 | 300 | 3.000 (thay cho "không giới hạn"; có thể nới theo yêu cầu) |
| Biên tập viên | 0 | 2 | 10 |
| Ảnh | 100 | 500 | 5.000 |
| Phả đồ PDF | có watermark | không watermark | không watermark |
| Phả ký | không | có | có |
| Bản tin nhắc email | không | có | có |
| Excel | **xuất miễn phí**; nhập không | nhập + xuất | nhập + xuất |
| Người xem | miễn phí, không giới hạn | miễn phí | miễn phí |

Không có gói tháng; không có "trọn đời". Thanh toán: IAP (RevenueCat, SBP 15%) trên iOS/Android; web qua payOS/VietQR (Stripe không dùng được ở VN). Gia hạn web cần nhắc (không tự trừ tiền).

### 7.2 Draft hiện tại: thay đổi hay giữ
| Mục | Draft | Khuyến nghị | Lý do (bằng chứng) |
|---|---|---|---|
| Miễn phí 100 Người | 100 | Giữ; thử 100 vs 200 | Đối thủ web miễn phí 50–100 TV (Đại Việt 50, phanmemgiapha 100). Giới hạn 100 là điểm chạm chuyển đổi |
| Gia đình | 249.000₫, 300 Người | **199.000₫** | Mức 199.000₫ đã thấy trên App Store VN (Kintree); app phổ thông 99.000–199.000₫/năm; 249.000₫ chưa xác nhận là price point; trung vị năm IN/SEA $18 còn Gia đình $9,7 vẫn thấp hơn |
| Dòng họ | 499.000₫ | **Giữ 499.000₫, thử 699.000₫** | Rẻ hơn mọi dịch vụ web VN ≥500 TV (599.000₫–1,3 triệu₫); tiền họ có thể góp quỹ họ (ASSUMPTION) |
| "Không giới hạn" | không giới hạn | 3.000 Người | Đối thủ chia bậc 2.000/2.500/5.000/10.000; tránh cam kết vô hạn |
| Excel xuất | trả phí | **miễn phí** (nhập vẫn trả phí) | Giữ dữ liệu của họ không bị "khoá cổng" gây mất tin cậy; chi phí 0; luật bảo vệ dữ liệu có thể yêu cầu quyền truy cập/sao chép (chưa xác nhận, hỏi luật sư) |
| Email digest | trả phí | Giữ | Resend Free 100 email/ngày (ADR 0004); trả phí hợp lý |
| Quảng cáo | không đề cập | Không có | mục 5 |
| Gói in 30 ngày (SKU thử) | không có | Chỉ fake door, giá thử 99.000–149.000₫ | Phả Tuệ bán gói 7 ngày 599.000₫; dịch vụ vẽ phả đồ 790.000₫+; không có dữ liệu mua thật |

Về giới hạn: **không quá chặt cho ngách mục tiêu**; gia phả 500–800 người sẽ gần như chắc chắn cần Dòng họ (3.000 Người), tức Gia đình chủ yếu là bậc neo để Dòng họ trông hợp lý (ASSUMPTION). Nếu dữ liệu thật cho thấy phần lớn gia phả <300 người thì bỏ bậc Gia đình cho đơn giản.

### 7.3 Dùng thử và ưu đãi
- **30 ngày reverse trial** (mở Dòng họ lúc tạo gia phả, hết hạn về Miễn phí không xoá dữ liệu): báo cáo RevenueCat cho thấy trial 17–32 ngày chuyển đổi cao hơn trial ngắn (42,5% vs 25,5%), nhưng IN/SEA chỉ 15,2% trial-to-paid [R1]. Vì mô hình của ta là freemium (không phải hard paywall) nên trial này chỉ làm lộ giá trị trước khi chạm giới hạn 100. Cần chống lạm dụng (tạo gia phả mới liên tục).
- **Ưu đãi sáng lập:** 50% năm đầu, 100 gia phả đầu tiên; kích hoạt qua mã giảm giá web trước, offer code của Apple/Google khi ra app (ASSUMPTION: cả hai cửa hàng đều có promotional/offer code; chưa kiểm).
- Chỉ bán theo năm vì dùng theo mùa (giỗ, Tết); trung vị gói tháng IN/SEA $3,75 [R1] không phù hợp với sản phẩm dùng ít.

---

## 8. Rủi ro và việc cần xác minh

1. **Thuế** (mục 4.5): kế toán xác nhận mô hình hộ kinh doanh vs công ty; khoản khấu trừ 2% của Apple; VAT với bán web; ngưỡng 1 tỷ₫ (Nghị định 141/2026 chỉ đọc qua nguồn thứ cấp).
2. **Giá thực của Apple tại VN:** vào App Store Connect xem danh sách price point cho VN, nhất là 199.000₫, 249.000₫, 499.000₫, 699.000₫.
3. **Tỷ lệ Chủ sở hữu/MAU, Người xem/gia phả:** đo từ DB thật; kết quả đổi toàn bộ mục 5–6.
4. **Quyền riêng tư:** thông tin người còn sống; Luật 91/2025 và Nghị định 356/2025 vừa có hiệu lực 2026-01-01; hỏi luật sư về vai trò "bên kiểm soát/xử lý dữ liệu", dữ liệu người đã mất, chuyển dữ liệu ra nước ngoài (Supabase/Resend/Google Drive đặt ngoài VN; Điều 8 nêu phạt 5% doanh thu cho chuyển xuyên biên giới trái phép, cần xác nhận phạm vi áp dụng).
5. **Gia hạn web:** VietQR không tự trừ tiền; cần đo tỷ lệ gia hạn.
6. **Dung lượng Drive 15GB:** một gia phả Dòng họ đầy 5.000 ảnh × ~200KB ≈ 1GB; 15 gia phả đầy là hết (ASSUMPTION từ ADR 0004). Cần nâng gói lưu trữ hoặc dùng R2 khi có gia phả trả phí; chưa tính vào chi phí ở trên.
7. **Google Play:** phí 15% cho tới $1 triệu cần đăng ký mức 15% [F3]; phí mới 2026 chưa áp dụng cho VN nhưng "remaining markets" ghi "until the announced updated service fees are rolled out globally", có thể đổi.

---

## 9. Thí nghiệm kiểm chứng trước khi xây billing

Thứ tự, từ rẻ đến đắt:

1. **Truy vấn DB thật (0₫, 1 giờ):** số gia phả, phân bố Người/gia phả (bao nhiêu >100, >300), số tài khoản/gia phả, tỷ lệ tài khoản quay lại sau 30 ngày. Quyết định: nếu <20% gia phả vượt 100 Người thì giới hạn miễn phí quá rộng hoặc cầu thấp, nâng nhu cầu lên 50 Người hoặc thêm hạn chế theo tính năng; nếu >50% vượt, giữ 100.
2. **Fake-door paywall trên web (vài giờ code):** khi Chủ sở hữu chạm 100 Người, bấm "Xuất Phả đồ không watermark", hoặc bấm "Nhập Excel", hiện thẻ giá (Gia đình 199.000₫ / Dòng họ 499.000₫; một nửa người dùng thấy Dòng họ 699.000₫) và nút "Đăng ký giữ giá sáng lập". Đo: tỷ lệ bấm nút / số người thấy thẻ giá, tỷ lệ để lại số điện thoại/email. Ngưỡng gợi ý (ASSUMPTION): ≥5% bấm nút và ≥2% để lại liên hệ là tín hiệu tiếp tục; <1% bấm thì xem lại giá/giá trị trước khi làm billing. Ghi rõ trong màn hình rằng thanh toán chưa mở (tránh gây hiểu lầm).
3. **Pre-sale thủ công cho ~20 người sáng lập (cần hỏi kế toán trước khi nhận tiền):** chuyển khoản/VietQR vào tài khoản đã đăng ký, cấp mã kích hoạt thủ công. Ngưỡng: ≥10 người trả tiền thật (không phải bạn bè) trước khi tích hợp RevenueCat/payOS.
4. **Fake-door cho in Phả đồ và gói 30 ngày:** nút "Đặt in Phả đồ A0 giao tận nơi" và "Gói in 30 ngày 129.000₫", đo số bấm; song song xin 2–3 báo giá nhà in khổ lớn (thiếu dữ liệu giá in).
5. **Waitlist app di động:** trang đăng ký email "báo khi có app iOS/Android" để ước lượng cầu trước khi dựng Expo.
6. **Sau khi có app:** thử A/B giá Dòng họ 499.000₫ vs 699.000₫ và giới hạn miễn phí 100 vs 200; mỗi nhánh cần vài chục Chủ sở hữu chạm paywall mới có ý nghĩa, nên chạy vài tháng.

---

## 10. Nguồn

Tất cả truy cập 2026-10-20.

**App Store VN / iTunes API (primary: trang cửa hàng)**
- [A1] Phả Tuệ - Gia Phả 4.0: https://apps.apple.com/vn/app/id1481584566
- [A2] GensTree: https://apps.apple.com/vn/app/id6502604080
- [A3] Gia Phả Việt: Phả Hệ Dòng Họ: https://apps.apple.com/vn/app/id6793965394
- [A4] Kintree: https://apps.apple.com/vn/app/id6758687235
- [A5] Gia Phả Số: https://apps.apple.com/vn/app/id6762728013
- [A6] Lịch: https://apps.apple.com/vn/app/id1071624317, /id585253443, /id980481486, /id1252603252, /id6444249673, /id6499255314
- [A7] Tìm kiếm/lookup VN (ratings): https://itunes.apple.com/search?term=gia%20ph%E1%BA%A3&country=vn&entity=software , https://itunes.apple.com/lookup?id=1481584566&country=vn
- Mô tả Phả Tuệ (AI "Phả Tuệ", Xu, Phả Sư) lấy từ lookup API ở trên.

**Google Play VN (primary: listing)**
- [G1] https://play.google.com/store/apps/details?id=tech.foolab.tefa&hl=vi&gl=VN (Phả Tuệ); các package khác: com.caonguyen.GiaPhaViet, com.sangkienhunggia, dev.creaton.kintree, giaphaviet.connguoiviet.nld, vn.familyconnect.app, org.familysearch.mobile, air.com.myheritage.mobile, com.ancestry.android.apps.ancestry, và lịch (com.ctv.vn.lichviet, com.hdviet.lichvannien.tuvi209, com.lichnhuy…); trang tìm kiếm https://play.google.com/store/search?q=gia%20ph%E1%BA%A3&c=apps&hl=vi&gl=VN

**Dịch vụ gia phả VN (primary: trang nhà cung cấp)**
- [W1] https://giaphadaiviet.vn/
- [W2] https://giaphaso.com/
- [W3] https://phanmemgiapha.vn/
- [W4] https://www.akb.com.vn/bang-gia-dich-vu-san-pham-2026/ ; https://giapha.akb.com.vn/
- [W5] https://cafetunhien.com/giaphangangphai-dich-vu-lam-gia-pha-dong-ho-lam-cay-gia-pha-ngang
- [W6] https://dulieu.itrithuc.vn/media/dataset/2020_08/bang-gia-2018-gia-pha.pdf (2018, đơn vị không rõ)
- [W7] https://vietnamgiapha.com (không có giá trong HTML)

**Toàn cầu**
- [X1] MyHeritage: https://apps.apple.com/us/app/id477971748 ; https://apps.apple.com/vn/app/id477971748
- [X2] Ancestry: https://apps.apple.com/us/app/id349554263 ; https://apps.apple.com/vn/app/id349554263
- [X3] Findmypast: https://apps.apple.com/us/app/id1444898210
- [X4] Tribal Pages: https://www.tribalpages.com/ ; https://apps.apple.com/us/app/id541934630
- [X5] Family Echo: https://www.familyecho.com/ ; Famberry: https://www.famberry.com/
- [X6] Geni (thứ cấp): https://www.genealogyexplained.com/geni-com-review
- [X7] FamilySearch: https://play.google.com/store/apps/details?id=org.familysearch.mobile ; https://apps.apple.com/us/app/id885982973

**Neo giá khác**
- [P1] Spotify VN: https://www.spotify.com/vn-vi/premium/ ; iCloud+ VN (Apple): https://support.apple.com/vi-vn/108047

**Doanh thu/chuyển đổi/thanh toán**
- [R1] RevenueCat State of Subscription Apps 2026: https://www.revenuecat.com/state-of-subscription-apps
- [R2] RevenueCat pricing: https://www.revenuecat.com/pricing/
- [R3] (thứ cấp) Adjust qua VnEconomy 2026-07-13: https://en.vneconomy.vn/next-challenge-for-vietnams-mobile-app-market.htm
- [R4] (thứ cấp) VnEconomy về QR/VietQR: https://vneconomy.vn/tu-chuyen-khoan-ca-nhan-den-thanh-toan-thuong-mai-chuan-quoc-gia.htm
- (thứ cấp) World Bank Findex 2024 VN: https://microdata.worldbank.org/catalog/7998/variable/F1/V37?name=fin10

**Quảng cáo**
- [M1] (thứ cấp) MonetizeMore: https://www.monetizemore.com/blog/ecpm-insights/
- [M2] (thứ cấp) Adnimation: https://www.adnimation.com/mobile-optimization-in-2025-turning-every-tap-into-revenue/
- [M3] (thứ cấp, từ kết quả tìm kiếm) Tenjin glossary: https://tenjin.com/zh/glossary/ad-monetization/
- [M4] AnyMind (số bị khoá): https://anymindgroup.com/report/download-ecpm-banner-native-ads-2025 ; Appodeal: https://appodeal.com/the-mobile-ecpm-report-updated-q4-2024-view

**Nền tảng, chính sách, thuế**
- [F1] Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
- [F2] App Store Review Guidelines 3.1.1/3.1.3(b): https://developer.apple.com/app-store/review/guidelines/
- [F3] Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622 ; 15% tier: https://support.google.com/googleplay/android-developer/answer/10632485
- [F4] Apple ATT/tracking: https://developer.apple.com/app-store/user-privacy-and-data-use/
- [F5] Google Data safety: https://support.google.com/googleplay/android-developer/answer/10787469 ; Families ads: https://support.google.com/admob/answer/6223431 (qua kết quả tìm kiếm)
- [F6] Apple News 2026-05-21 (xếp hạng độ tuổi VN, Nghị định 147): https://developer.apple.com/news/?id=qs5bol0
- [T1] Apple News 2025-08-21 (thuế VN): https://developer.apple.com/news/?id=yo2104n5
- [T2] Google Play VAT: https://support.google.com/googleplay/android-developer/answer/138000
- [T3] (thứ cấp) Tuổi Trẻ 2025-12-19: https://tuoitre.vn/ho-kinh-doanh-co-doanh-thu-tren-500-trieu-dong-nam-moi-phai-nop-thue-20251219110854944.htm
- [T4] (thứ cấp) MISA Nghị định 141/2026: https://www.misaeshop.vn/40801/nghi-dinh-141-2026-nd-cp-mien-thue-hkd-duoi-1-ty/ ; liên quan (chưa mở được, 403): https://thuvienphapluat.vn/phap-luat-doanh-nghiep/bai-viet/chinh-thuc-ho-kinh-doanh-duoi-1-ty-duoc-mien-thue-theo-nghi-dinh-141-2026-nd-cp-20747.html
- [T5] (thứ cấp, qua tìm kiếm, chưa mở bài gốc) Nghị định 117/2025/NĐ-CP: https://thuvienphapluat.vn/van-ban/Thuong-mai/Nghi-dinh-117-2025-ND-CP-quan-ly-thue-hoat-dong-kinh-doanh-tren-nen-tang-thuong-mai-dien-tu-641913.aspx
- [L1] (bản dịch, thứ cấp) Luật 91/2025/QH15: https://english.luatvietnam.vn/dan-su/law-on-personal-data-protection-law-no-91-2025-qh15-405135-d1.html
- [L2] Bộ Công an về hiệu lực 2026-01-01: https://bocongan.gov.vn/chinh-sach-phap-luat/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-01-01-2026-1767186124
- [L3] (thứ cấp) Nghị định 356/2025/NĐ-CP: https://luatvietnam.vn/thong-tin/nghi-dinh-356-2025-nd-cp-quy-dinh-chi-tiet-luat-bao-ve-du-lieu-ca-nhan-422896-d1.html
- [I1] Supabase: https://supabase.com/pricing ; [I2] Resend: https://resend.com/pricing ; [I3] Apple Developer Program: https://developer.apple.com/programs/enroll/
- [B1] Tỷ giá Vietcombank (USD chuyển khoản 25.680 ₫, mua 25.650, bán 26.060, 2026-10-20 11:30): https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx
- [B2] Stripe: https://stripe.com/global ; payOS: https://payos.vn/ ; SePay: https://sepay.vn/bang-gia.html
