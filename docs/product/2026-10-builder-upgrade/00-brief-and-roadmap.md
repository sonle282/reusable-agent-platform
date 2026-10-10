# Problem Brief + Roadmap — Agent Builder, chặng tiếp theo

**ID:** NL-PB-AGENTBUILDER-001 · NL-ROADMAP-AGENTBUILDER-001 · **Phiên bản:** 1.0 · **Ngày:** 10/10/2026 · **Chủ sản phẩm:** Sơn · **Trạng thái:** In Review

## Phần A — Problem Brief

### 1. Người dùng
**Chủ doanh nghiệp nhỏ**, không rành kỹ thuật, bán qua page/inbox. Họ dùng trợ lý AI thay nhân viên trực page, tư vấn và sales. Khách hàng đầu tiên là Mr Spa, bán ghế và nội thất tiệm nail cho chủ tiệm gốc Việt ở Mỹ. Builder dùng chung cho mọi ngành.

Giai đoạn hiện tại: trợ lý đã chạy (v3), chủ tiệm bắt đầu **sống chung** với nó mỗi ngày.

### 2. Việc cần làm (giọng người dùng)
> "Khi thấy trợ lý trả lời sai một câu, tôi muốn sửa ngay tại đó và chắc chắn nó không sai lại câu đó nữa — để tôi dám để nó trực page một mình."

### 3. Bằng chứng
- **Đi lại hành trình ngày 10/10/2026** (vai chủ tiệm, do Claude đóng): sửa được một dòng dữ liệu từ câu trả lời, nhưng:
  - Không có chỗ ghi "câu đúng phải là gì".
  - Bài kiểm tra phải tạo tay, 6 ô.
  - Sửa ở Hướng dẫn thì phải tự đoán sửa mục nào.
- **Sự cố có thật cùng ngày:** câu "Cyber Carbon S3 giá bao nhiêu?" chỉ tra danh mục **1/4 lần**. Lỗi bị phát hiện vì cổng kiểm tra chặn xuất bản. Sửa xong thì đạt **5/5**. Bằng chứng này cho thấy bài kiểm tra cứu được chất lượng, nhưng hôm nay tạo bài kiểm tra quá tốn công.
- **Thị trường:** nhóm doanh nghiệp lớn (Sierra, Decagon) và nhóm SMB (Chatbase, HubSpot) đều hội tụ về vòng "câu sai → sửa một lần → thành bài kiểm tra" (xem `00-research.md`).
- **Phản chứng:** lượng chat thật hiện rất ít (2 hội thoại trong 7 ngày). Có thể chủ tiệm chưa đủ câu sai để cần vòng sửa. Vòng sửa dùng được cả trong Test, nên vẫn có giá trị trước khi traffic lên.
- **[CHƯA CÓ] ngồi cạnh chủ tiệm thật.** Người đi tìm: **Sơn**. Mục tiêu: một buổi 30 phút cạnh chủ Mr Spa, ghi lại ba chỗ chủ tiệm khựng lại, hạn **24/10/2026**.

### 4. Giả thuyết
> Nếu có nút **"Fix this answer"**: chủ tiệm gõ câu đúng, hệ thống gợi ý nơi sửa và tự lưu thành bài kiểm tra. Khi đó **thời gian từ lúc thấy câu sai đến lúc bản sửa có bài kiểm tra bảo vệ** giảm từ khoảng 5–10 phút (đường làm tay hiện nay, ước tính theo số bước) xuống **dưới 2 phút**, và **0 câu đã sửa bị sai lại** ở các bản xuất bản sau, trong 4 tuần.

### 5. Kiểm 7 nguyên tắc
Bốn nguyên tắc 1, 5, 6, 7 gốc dành cho Nedu, nên được **thay bằng câu tương ứng** của sản phẩm này.

| # | Nguyên tắc | Kết quả |
|---|---|---|
| 1 | *(thay)* Rút ngắn đường tới lợi thế: câu trả lời đúng dữ liệu + chủ tiệm kiểm soát, trước khi Meta Business Agent phủ thị trường | Đạt — đây chính là lợi thế đó |
| 2 | Chống phình (đội ~20 người) | Đạt — giảm việc trông chừng; chi phí thêm là vài lượt gọi model khi chủ tiệm bấm sửa |
| 3 | AI-first | Đạt — AI gợi ý nơi sửa và chấm bài kiểm tra |
| 4 | 300 năm | Đạt — bộ bài kiểm tra lớn dần theo năm, là tài sản tích luỹ |
| 5 | *(thay)* Hợp chủ tiệm Việt, không rành kỹ thuật | Đạt, kèm điều kiện: chữ trên màn phải là lời thường, không bắt chủ tiệm phân biệt "kiến thức" với "dữ liệu" |
| 6 | *(thay)* Giữ lời hứa sản phẩm "câu trả lời tin được" | Đạt |
| 7 | *(thay)* Có đường ra tiền | **Tạm** — chưa có bảng giá. Giá tham khảo 30–100 USD/tháng (VN), 99–199 USD/tháng (Mỹ). **[CHƯA CÓ]** quyết định giá, người chốt: **Sơn** |

### 6. Khuyến nghị
**Làm (sang PRD).** Kèm một điều kiện trước: phần móng dữ liệu khách (Hạng mục 0 bên dưới) phải làm trong cùng chặng. Vòng sửa sẽ chép tin nhắn khách vào bài kiểm tra, và Luật BVDLCN đã có hiệu lực.

---

## Phần B — Roadmap

### H1 · Hai tuần (13/10 – 24/10/2026)

| # | Việc | Chủ | Demo | Tiêu chí dừng |
|---|---|---|---|---|
| 0 | **Móng dữ liệu khách:** thông báo + hỏi đồng ý trước khi xin số điện thoại, ghi thời điểm đồng ý, xoá/xuất một khách, che số điện thoại/email khi chép tin nhắn sang bài kiểm tra | Claude (dựng) · Sơn (duyệt) | Thứ Sáu 17/10 | Không dừng — luật bắt buộc |
| 1 | **Fix this answer** từ Test và Conversations: gõ câu đúng → AI gợi ý nơi sửa → áp dụng → tự tạo bài kiểm tra → chạy lại | Claude · Sơn | Thứ Sáu 24/10 | Sau 4 tuần dùng, chủ tiệm sửa < 3 câu thì thu về chế độ ít bảo trì (giữ nút, bỏ gợi ý AI) |
| 2 | **Bài kiểm tra chấm bằng lời:** ô "Pass when…" viết bằng lời thường, AI chấm; các ô so chuỗi chuyển vào Advanced | Claude · Sơn | 24/10 | AI chấm sai > 10% trên 20 lượt chấm tay thì quay về so chuỗi làm mặc định |
| 3 | **Needs attention:** danh sách câu cần cải thiện (nhân viên phải tiếp quản, câu dự phòng, câu không dựa vào nguồn nào) trên trang Assistant | Claude · Sơn | 24/10 | Sau 2 tuần liền không có mục nào thì gộp vào ô tóm tắt |

### H2 · 18 tháng — tối đa 5 hướng
1. **Kênh trực tiếp:**
   - Thứ tự: Messenger + Instagram (cùng hệ Meta) → web widget → Zalo OA.
   - Mỗi kênh tôn trọng cửa sổ tin nhắn: 24 giờ với Meta, 48 giờ với Zalo.
   - Đây là nơi tiền vào.
2. **Ghi nhận đơn / báo giá trong chat (nội bộ):**
   - Hỏi lần lượt món → biến thể → số lượng → tên → số điện thoại → địa chỉ, đọc lại để khách xác nhận.
   - Tạo "yêu cầu đặt hàng" và báo chủ tiệm.
   - Vẫn không ghi ra hệ thống ngoài.
3. **Chấm chất lượng hội thoại thật** theo cùng tiêu chí của bài kiểm tra, gom lỗi theo chủ đề.
4. **Nhiều page, nhiều nhân viên, giờ làm việc:**
   - Ca trực.
   - Bật/tắt chế độ "AI gợi ý, người gửi" theo từng hội thoại.
5. **Đóng gói để bán cho doanh nghiệp thứ hai:**
   - Tự dựng instance cho khách mới.
   - Bảng giá theo page + lượng hội thoại.
   - Trang tự tra khi kẹt.

### H3 · 5 năm+
- **Thư viện bài kiểm tra và mẫu hồ sơ theo ngành.** Mỗi khách mới khởi đầu với hàng trăm tình huống đã kiểm chứng, đã cắt danh tính.
- **Chuẩn "nhân viên AI tin được":** bộ thước đo công khai, gồm tỉ lệ trả lời đúng dữ liệu, tỉ lệ chuyển người đúng lúc, và không bao giờ bịa giá.

### Không làm trong chặng này (và vì sao)
1. **A/B test, phát hành theo %:** lượng chat quá ít để có ý nghĩa thống kê; khôi phục tức thì + cổng kiểm tra là đủ.
2. **Mô phỏng khách ảo nhiều lượt:** tốn model, phải chấm phức tạp; làm sau khi bài kiểm tra chấm bằng lời đã ổn (H2).
3. **Thao tác ghi ra ngoài** (tạo đơn ở POS, đặt lịch, thanh toán): ngoài phạm vi v1, rủi ro cao.
4. **Kênh mới:** bạn đã chốt "xong builder rồi mới cắm kênh".
5. **Thông báo email/SMS cho chủ tiệm:** chỉ một admin, xem trong app trước; SMS dính TCPA.
6. **Tính tiền theo "đã giải quyết":** dễ tranh cãi (khiếu nại số một của thị trường).
7. **WhatsApp, Shopee, TikTok Shop:** thị phần thấp với khách hiện tại, cần duyệt ISV.
