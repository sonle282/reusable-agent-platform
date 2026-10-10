# 02 · UX flow — Sửa câu trả lời sai một lần, không tái phát

**ID:** NL-UX-AGENTBUILDER-001 · **Phiên bản:** 1.0 · **Ngày:** 10/10/2026 · **Đọc kèm:** `01-prd.md`

**Bấm thử:** `fix-this-answer-prototype.html`. **Trạng thái từng màn** (trống · đang tải · lỗi · quá hạn) nằm trong bảng ở mỗi màn của `03-ui-spec.md`; tài liệu này chỉ ghi các nhánh rẽ của luồng.

Tên gọi dùng thống nhất ở mọi màn và mọi file (chữ trên giao diện là tiếng Anh, admin đã chốt):

| Khái niệm | Tên duy nhất trên màn | Không dùng |
|---|---|---|
| Bản sửa | **Fix** (nút mở: "Fix this answer") | correction, patch |
| Bài kiểm tra | **Scenario** | test, eval |
| Tiêu chí đạt | **Pass when** | criteria, assertion |
| Câu trả lời khi AI lỗi | **Backup reply** | fallback |
| Ba nơi sửa | **Data** · **Knowledge** · **Instructions** | Rule, prompt |
| Danh sách ca cần chú ý | **Needs attention** | issues, gaps |
| Đưa bản nháp tới khách | **Publish** | deploy, release |
| Bỏ bản nháp, quay về bản đang chạy | **Discard unpublished changes** | undo last change, revert draft |
| Nhân viên đang trả lời thay trợ lý | **Your team replies** (công tắc) · **Your team is replying** (nhãn mục) | takeover |
| Phiên bản đang chạy | **Live · version 3** | v3, prod |
| Chọn nơi sửa khác | **Choose another place** | choose a place yourself |
| Scenario chưa chấm được | **Not checked** | couldn't check |
| Dữ liệu khách | **Customer data** | PII |

## 0. Hành trình lớn của chủ doanh nghiệp
**Biết tới → cài đặt → thử → xuất bản → sống chung hằng ngày → sửa → quay lại.**

| Chặng | Đã có / thuộc PRD này |
|---|---|
| Biết tới, cân nhắc, mua | Tối thiểu hôm nay: chủ doanh nghiệp nghe giới thiệu → xem demo trực tiếp → Sơn dựng bản cài và gửi mã khởi tạo. Bản tự phục vụ (trang giới thiệu, bảng giá, tự dựng) thuộc hướng H2 số 5 trong `00-brief-and-roadmap.md` |
| Cài đặt | Đã có: setup 2 bước + tạo trợ lý bằng 3 câu |
| Thử | Đã có: Test; PRD này thêm "Fix this answer" ngay trong Test |
| Xuất bản | Đã có: Publish chạy scenario; PRD này thêm banner "A fixed answer broke again" |
| Sống chung, sửa, quay lại | **Phần chính của tài liệu này** |

| Chặng | Chủ làm gì | Màn | Nhớ gì, mang gì đi |
|---|---|---|---|
| Mở app buổi sáng | Nhìn 4 ô tóm tắt | Assistant | Biết ngay hôm nay có việc gì không |
| Thấy câu sai | Bấm vào câu trả lời → **Fix this answer** | Test / Conversations | "Sửa ở ngay đây, không phải đi tìm" |
| Sửa | Gõ câu đúng → xem gợi ý → **Apply** | Sheet Fix | Thấy trước sẽ đổi gì |
| Yên tâm | Thấy "Protected by a scenario" | Sheet Fix → kết quả | "Câu này sẽ không sai lại" |
| Đưa tới khách | Publish (chỉ khi bản sửa nằm ở Instructions) | Assistant | Biết khách đã có bản mới |
| Quay lại | Ô Needs attention về 0 | Assistant | Cảm giác "đã xong việc hôm nay" |

## 1. Luồng F1 — Sửa từ Test

1. Chủ chat thử trong **Test**, bấm vào một bong bóng trả lời.
   - Panel **Details** mở ra, đã có sẵn: nguồn kiến thức, dòng dữ liệu đã tra.
   - Hành động chính của panel: **Fix this answer**.
2. Bấm **Fix this answer** → sheet mở, **điền sẵn**:
   - Customer message (tin khách, đã che số/email).
   - Assistant replied (câu đã trả lời).
   - What it used (nguồn, dòng dữ liệu).
3. Chủ gõ vào ô duy nhất: **"What should it have said?"** (câu đúng, viết tự nhiên).
   - Chưa gõ gì thì nút chính bị khoá.
   - Chữ gợi ý trong ô: "Write the answer you'd give, in your own words."
4. Bấm **Suggest a fix** → hệ thống trả về **một** gợi ý, ghi rõ nơi sửa và lý do. Ba loại gợi ý:
   - **Update a data row:** đổi ô nào, từ gì sang gì.
   - **Add to Corrected answers:** thêm cặp hỏi–đáp vào kiến thức.
   - **Add to your instructions:** thêm một dòng vào Always / Never / Hand off.
   - Kèm link **Choose another place** để đổi nơi sửa.
5. Bấm **Apply fix**:
   - Hệ thống áp dụng thay đổi.
   - Tạo **Scenario** từ tin khách, với tiêu chí "Says: …" lấy từ câu đúng; nếu là sửa dữ liệu thì thêm "Looks up <bảng>".
   - Chạy ngay scenario đó trên bản nháp.
   - Trong lúc kiểm: nút "Checking…", sheet không đóng được.
6. **Kết quả**, một trong ba:
   - ✅ **Fixed and protected:** scenario đạt.
     - Sửa Data: "Live for customers now."
     - Sửa Knowledge: "Live in about a minute."
     - Sửa Instructions: "Publish to send it to customers" kèm nút chính **Publish now**. Nếu chưa Publish trong 24 giờ thì mục "Fix not live yet" vào Needs attention.
   - ⚠️ **Not applied — the scenario still fails:** hệ thống **đã tự hoàn tác**, khách không thấy thay đổi. Hiện lý do chấm, kèm:
     - Nút chính **Try another fix**: quay lại bước 4, giữ câu đúng.
     - Link **Keep it anyway**: mở xác nhận "Customers will see this change even though the scenario fails."
   - ❌ **Couldn't apply:** lỗi mạng, dòng dữ liệu đã bị xoá… Hiện câu nói rõ lỗi, kèm **Try again**. Câu đúng chủ đã gõ không bị mất.

**Chỗ chặn và đường đi tiếp:**
- **Chưa có API key:** nút Suggest bị khoá, chữ "Suggestions need your AI key. Add it in Settings, or choose another place.", kèm link Settings. Vẫn cho chọn nơi sửa tay (Choose another place).
- **Bảng dữ liệu đã ẩn:** gợi ý chuyển sang Instructions, kèm ghi chú "The table is hidden".
- **Việc tiếp theo** (ô cuối sheet sau khi xong): "Next: 1 more answer needs attention" kèm link, hoặc "You're all caught up".

## 2. Luồng F2 — Sửa từ một hội thoại thật

Giống F1, khác ba điểm:
- **Điểm vào:** bong bóng của trợ lý trong **Conversations**, có link **Fix this answer** dưới bong bóng.
- `origin = conversation`; giữ `conversation_id` và `version_id` của câu trả lời đó.
- Không gửi lại tin cho khách. Nếu khách vẫn đang chờ, sheet nhắc: "This customer may still be waiting — Turn on Your team replies to answer them yourself", kèm **công tắc ngay trong sheet**.

## 3. Luồng F3 — Needs attention

1. Ô **Needs attention (N)** trên trang Assistant → bấm → danh sách mở ngay dưới ô tóm tắt. Không đổi trang.
2. Ba nguồn mục:
   - **Your team is replying:** hội thoại bật "Your team replies".
   - **Sent the backup reply:** AI lỗi hoặc quá thời gian nên khách nhận Backup reply.
   - **Answered a price or offer question without looking it up:** câu khách có từ chỉ giá/ưu đãi nhưng trace không có tra cứu nào.
3. Mỗi mục có 3 việc:
   - **Fix this answer** (sang F2).
   - **Open conversation**.
   - **Dismiss**: bắt buộc chọn lý do: *Answer was fine* · *Not worth fixing* · *Handled elsewhere*.
4. **Hạn:** mục chưa xử lý quá **48 giờ** đổi nhãn thành "Waiting 2 days", màu cam, và xếp lên đầu.
   - Một admin nên người nhận luôn là chủ.
   - Chỗ báo là ô tóm tắt; không gửi email (PRD mục 5).
5. **Trống:** "Nothing needs your attention. New issues show up here automatically."

## 4. Luồng F4 — Scenario bằng lời

1. Test → **Test scenarios** → **Add scenario**, hoặc bấm vào một scenario để sửa.
2. Ô đầu: **Customer message**. Ô thứ hai: **Pass when…**, ví dụ "Mentions free shipping from 6 chairs and asks how many chairs they need".
3. **Advanced** (đóng sẵn): Checks this table · Says these words · Never says these words · Longest reply (characters) (các ô so chuỗi cũ).
4. **Run all**:
   - Mỗi scenario hiện Passed / Failed **kèm một câu lý do của AI**.
   - Có nút **Run again** cho từng scenario, để kiểm khi kết quả chập chờn.
5. **Lỗi khi AI chấm** (model không trả lời): scenario hiện "Not checked" kèm nút "Run again". Lỗi này **không tính là đạt**; Publish vẫn bị chặn, kèm đường đi tiếp **Run again**.

## 5. Luồng F5 — Publish khi một câu đã sửa sai lại

1. Bấm **Publish** → chạy scenarios (như hiện nay).
2. Scenario sinh từ một bản sửa mà trượt → Publish dừng.
   - Banner: "A fixed answer broke again: *‘Có ưu đãi gì nếu mua 8 ghế?’* — the reply no longer mentions free shipping."
   - Nút **See what changed** mở scenario: câu cũ (lúc sửa) và câu mới đặt cạnh nhau.
3. Hai đường đi tiếp:
   - Nút chính **Fix this answer** (sang F1 với câu mới).
   - Link **Discard unpublished changes**: bỏ **toàn bộ** thay đổi chưa Publish trong bản nháp. Xác nhận bằng một câu liệt kê số thay đổi sẽ mất, ví dụ "3 unpublished changes will be removed", và ghi lý do một chạm (Wrong change · Start over).

## 6. Luồng F6 — Khách để lại liên hệ (phía khách)

1. Trợ lý thấy đến lúc cần liên hệ: khách muốn báo giá, đặt hàng, hoặc cần nhân viên.
2. Trợ lý nói **một câu thông báo trước khi xin**, theo lời chủ đặt, mặc định: "To have our team contact you, may I have your phone number? We only use it to follow up on this request, and you can ask us to delete it anytime."
3. Khách đưa số → hệ thống lưu liên hệ, ghi `consent_given` (thời điểm, id tin nhắn, câu thông báo đã nói).
   - **Chuyển tay:** mục **"New lead to contact"** vào Needs attention ngay, người nhận là chủ.
   - Hạn liên hệ lại: **24 giờ**. Liên hệ xong, chủ bấm **Mark as contacted**.
   - Quá 24 giờ: nhãn cam "Waiting 1 day", xếp lên đầu.
   - Trợ lý nói với khách thời gian thật: "Our team will contact you within 24 hours."
4. Khách từ chối → trợ lý không hỏi lại trong hội thoại đó, vẫn tư vấn tiếp.
5. Khách nói mình dưới 16 tuổi → không xin liên hệ, đề nghị chuyển nhân viên.

## 7. Luồng F7 — Chủ xử lý yêu cầu xoá hoặc xuất dữ liệu

1. Khách yêu cầu (trong chat hoặc qua kênh khác). Trong chat, trợ lý trả lời: "I've passed your request to our team", và mục hiện trong **Needs attention** với nhãn "Data request".
2. Chủ mở hội thoại → **Customer data** → **Export** (tải JSON) hoặc **Erase**.
3. **Erase** cần gõ chữ `ERASE` để xác nhận, vì không hoàn tác được.
   - Che số/email trong mọi tin nhắn của khách đó.
   - Xoá liên hệ.
   - Ghi `contact.erased`.
4. **Hạn:** mục "Data request" quá 72 giờ đổi nhãn đỏ "Overdue".
   - **[CHƯA CÓ]** hạn theo luật cần luật sư xác nhận; người đi tìm: Sơn (PRD mục 8).

## 8. Không hỏi lại thứ hệ thống đã biết

| Ô | Điền sẵn từ |
|---|---|
| Customer message | Tin khách của lượt đó (đã che) |
| Assistant replied, What it used | Trace của lượt đó |
| Scenario: tiêu chí | Câu đúng chủ vừa gõ |
| Scenario: Looks up | Bảng dữ liệu bị sửa |
| Scenario name | 6 chữ đầu của tin khách |
| Lý do Dismiss | Ba lựa chọn sẵn, không bắt gõ |

## 9. Đường lùi
- **Mọi bản sửa đều có Undo** trong 7 ngày, theo `change_json`. Undo hỏi lý do một chạm: *Wrong fix* · *No longer needed*.
  - Mở Undo ở hai chỗ: ngay ở bước kết quả của sheet Fix, và trên scenario có nhãn "From a fix".
  - Undo một bản sửa Instructions đã Publish sẽ gỡ dòng khỏi bản nháp; cần **Publish** lần nữa để khách nhận.
  - Sửa dữ liệu: trả lại giá trị cũ.
  - Sửa kiến thức: gỡ mục hỏi–đáp vừa thêm.
  - Sửa rule: gỡ dòng vừa thêm.
- Scenario sinh ra **không** tự xoá khi Undo; hỏi "Also remove the scenario?".
- **Dismiss** ghi lý do; mở lại được từ bộ lọc "Dismissed".
- **Erase** là việc duy nhất không lùi được, nên phải xác nhận bằng chữ.

## 9b. Việc tiếp theo ở mỗi màn chính

| Màn | Ô "việc tiếp theo" |
|---|---|
| Assistant | Ô Needs attention: số ca + mục cũ nhất |
| Test | Chưa chọn câu trả lời: "Tap a reply to see what it was based on, or to fix it." |
| Conversations (chi tiết) | Mặc định: link "Fix this answer" dưới câu trả lời mới nhất của trợ lý. Nếu đang "Your team replies" quá 24 giờ: "Turn the assistant back on when your team is done." |
| Scenario | Có scenario Failed/Not checked: "Fix this answer" trên scenario đó |
| Instructions | Mặc định: "Try your changes in Test" (link sang Test). Thiếu câu thông báo liên hệ: "Add a short notice before asking for contact details." |

## 10. Dấu vết dữ liệu cho vòng sau
Mỗi bước ở F1–F7 ghi sự kiện theo PRD mục 9. Từ các sự kiện này, vòng sau đo được:
- Thời gian sửa.
- Tỉ lệ đổi nơi sửa so với gợi ý của AI (để chấm AI).
- Tỉ lệ tái phát.
- Lý do Dismiss nào nhiều nhất (để bỏ bớt nguồn mục ồn ào trong Needs attention).
