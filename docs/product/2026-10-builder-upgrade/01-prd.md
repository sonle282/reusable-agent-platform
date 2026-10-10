# 01 · PRD — Sửa câu trả lời sai một lần, không tái phát

**ID:** NL-PRD-AGENTBUILDER-001 · **Phiên bản:** 1.0 · **Ngày:** 10/10/2026 · **Chủ sản phẩm:** Sơn · **Người viết:** mũ PM + Designer (Claude) · **Trạng thái:** In Review
**Đọc kèm:** `00-research.md` (thị trường) · `00-brief-and-roadmap.md` (vì sao làm việc này trước)
**Bấm thử trước khi đọc:** `fix-this-answer-prototype.html` (cùng thư mục) — bản bấm được của luồng chính, dùng dữ liệu mẫu.

## 1. Cắm vào hệ thống lớn ở đâu

| | |
|---|---|
| **Sản phẩm** | Agent Builder — mỗi doanh nghiệp một bản cài riêng (single-tenant), một trợ lý. Admin dùng tiếng Anh; trợ lý trả lời khách theo ngôn ngữ của khách. |
| **Vai dùng** | **Chủ doanh nghiệp** (admin duy nhất của bản cài) · **Nhân viên trực kênh** (trả lời khách trong hộp thư của kênh, ví dụ Zernio; **không có tài khoản admin**, không vào app này) · **Khách của doanh nghiệp** (chỉ chat) · **Trợ lý AI** (đọc dữ liệu, không ghi ra ngoài) |
| **Đọc** | Tin nhắn trong Test và Conversations · dấu vết câu trả lời (nguồn kiến thức, dòng dữ liệu đã tra) · hồ sơ trợ lý · bảng dữ liệu · nguồn kiến thức · bài kiểm tra |
| **Ghi** | Bản sửa (đối tượng mới) · dòng dữ liệu · nguồn "Corrected answers" · mục Always/Never/Hand off của hồ sơ · bài kiểm tra · liên hệ khách (đồng ý, xoá, xuất) |
| **Nhận việc từ** | Chủ doanh nghiệp đọc Test, Conversations, hoặc danh sách **Needs attention** |
| **Chuyển việc cho** | Cổng **Publish**: bài kiểm tra mới phải đạt thì bản sửa ở Hướng dẫn mới tới khách. Sửa dữ liệu và kiến thức tới khách ngay, không qua Publish. |

## 2. Nhặt ở hiện trường

- **10/10/2026 — đi lại hành trình trong vai chủ tiệm** (Claude đóng vai, không phải người thật). Chỗ khựng:
  1. Thấy trợ lý trả lời chưa đúng nhưng **không có chỗ ghi "câu đúng là gì"**.
  2. Tạo bài kiểm tra phải điền tay 6 ô bằng thuật ngữ máy ("expected tool", "must include").
  3. Phải tự đoán lỗi nằm ở Data, Knowledge hay Instructions.
- **10/10/2026 — sự cố thật:** "Cyber Carbon S3 giá bao nhiêu?" chỉ tra danh mục 1/4 lần. Cổng kiểm tra bắt được và chặn xuất bản. Sửa một dòng ở Hướng dẫn thì đạt 5/5. Mất khoảng 15 phút công kỹ thuật, chủ tiệm không tự làm được.
- **[CHƯA CÓ] ngồi cạnh chủ tiệm thật.** Người đi tìm: **Sơn**, một buổi 30 phút với chủ Mr Spa, hạn **17/10/2026**, trước khi dựng phần gợi ý nơi sửa. Đo bằng đồng hồ thời gian chủ tự sửa một câu sai theo đường hiện có, và ghi vào cột "Hôm nay" ở mục 10. Nếu buổi này cho thấy chủ không thấy cần sửa, quay lại mục 11 trước khi làm tiếp.

**Rễ và lá.** Ba chỗ khựng trên là **lá**. Chúng mọc từ **một rễ**: hệ thống không có khái niệm "câu trả lời đúng" do chủ viết ra. Vì thiếu nó nên chủ không có chỗ ghi câu đúng, không biết lỗi nằm đâu, và không có gì để biến thành bài kiểm tra. PRD này sửa rễ đó (đối tượng **Fix**), không vá từng màn.

## 3. Nỗi đau trong một câu
> Chủ doanh nghiệp thấy trợ lý trả lời sai nhưng không tự sửa tận gốc được, và không có gì bảo đảm câu đó không sai lại ở bản sau.

## 4. Người dùng
- **Chủ doanh nghiệp nhỏ** (ví dụ thật đầu tiên: chủ một công ty bán ghế và nội thất tiệm nail). Bận, không rành kỹ thuật, đọc câu trả lời bằng mắt rồi biết ngay đúng hay sai.
- **Không phải** người dùng của tính năng này: khách cuối (họ chỉ hưởng câu trả lời đúng hơn), lập trình viên (họ đã có playbook nâng cao).

## 5. Không làm gì (đứng đầu, đọc trước)
1. **Không tự áp dụng sửa đổi** khi chủ chưa bấm đồng ý. AI chỉ gợi ý.
2. **Không A/B test, không phát hành theo %, không duyệt nhiều vai** — một admin, lượng chat nhỏ.
3. **Không mô phỏng khách ảo nhiều lượt** — để H2.
4. **Không chấm tự động mọi hội thoại thật** — chỉ liệt kê các ca cần chú ý (mục 7.4). Chấm hàng loạt để H2.
5. **Không thêm kênh mới**, không gửi email/SMS cho chủ.
6. **Không ghi ra hệ thống ngoài** (đơn hàng, lịch hẹn, thanh toán).
7. **Không đổi cách tính tiền** — bảng giá là quyết định riêng (`00-brief-and-roadmap.md`).
8. **Không xoá hội thoại hàng loạt.** Xoá dữ liệu chỉ theo từng khách, theo yêu cầu.

## 6. Phạm vi theo thời gian — hai tuần, 13/10 → 24/10/2026

| Hạng mục | Vào v1 | Rơi khỏi v1 (vì sao) |
|---|---|---|
| **0. Móng dữ liệu khách** | Thông báo + hỏi đồng ý trước khi xin liên hệ; lưu thời điểm và câu đồng ý; xoá và xuất dữ liệu một khách; che số điện thoại/email khi chép tin nhắn sang bài kiểm tra; nhận số điện thoại quốc tế | Tự động xoá theo hạn lưu trữ (cần chủ quyết hạn; ghi nợ, hạn 30/11/2026) |
| **1. Fix this answer** | Từ bong bóng trả lời trong Test và Conversations; gợi ý 1 nơi sửa; áp dụng; tự tạo bài kiểm tra; chạy lại riêng câu đó | Gợi ý nhiều phương án cùng lúc; sửa hàng loạt |
| **2. Pass when (bằng lời)** | Một ô tiêu chí bằng lời, AI chấm đạt/không kèm lý do; ô so chuỗi chuyển vào Advanced | Chấm nhiều lần để bắt câu chập chờn (chỉ có nút "Run again") |
| **3. Needs attention** | Liệt kê ca nhân viên tiếp quản, ca trả câu dự phòng, ca không dựa vào nguồn nào khi khách hỏi giá hoặc ưu đãi | Gom chủ đề bằng AI; thả tim/ngón cái từ khách |

**Vì sao giữ các màn mới** (bỏ nó thì ai không làm được việc gì):
- **Needs attention (S4):** bỏ đi thì chủ không biết câu nào cần sửa khi không tự đọc từng hội thoại; lead có hạn 24 giờ cũng không có chỗ hiện.
- **Câu thông báo trước khi xin liên hệ (S8):** bỏ đi thì trợ lý xin số điện thoại mà không thông báo, trái luật dữ liệu cá nhân.

**Thứ đã cân nhắc rồi bỏ** (bỏ mà việc vẫn xong):
- **So bản nháp với bản đang chạy** trên toàn bộ bài kiểm tra: cổng Publish đã chạy hết bài; thêm màn so sánh không giúp chủ làm được việc gì mới.
- **Trang "Improve" riêng:** danh sách nằm ngay trang Assistant, không thêm mục điều hướng.
- **Bắt chủ chọn nơi sửa trước:** chủ không phân biệt được Data/Knowledge/Instructions; AI gợi ý, chủ chỉ đổi khi muốn.

## 7. Luồng chính và phương án (bốn mảnh)

### 7.1 Đối tượng
**Bản sửa** (`AnswerFix`, bảng mới `answer_fixes`, migration `0004`):
- `id`
- `origin`: `test` · `conversation`
- `conversation_id`: có thể rỗng
- `version_id`: phiên bản đã trả lời sai
- `customer_message`: đã che số điện thoại/email
- `bad_reply`
- `correct_reply`: chủ gõ
- `target_kind`: `data` · `knowledge` · `rule`
- `target_ref`
- `change_json`: thay đổi đã áp dụng, để hoàn tác
- `eval_case_id`
- `status`
- `created_at` · `applied_at` · `verified_at` · `published_version_id`

**Bài kiểm tra** (đã có): thêm `criteria` (câu bằng lời) vào `assertions_json`. Không đổi bảng.

**Liên hệ khách** (đã có): dùng cột `consent_json` sẵn có, gồm `{ asked_at, given_at, message_id, notice }`; thêm `erased_at`.

### 7.2 Trạng thái của Bản sửa
```
suggested ──Apply──▶ checking ──scenario đạt──▶ verified ──Publish (chỉ với Instructions)──▶ published
    │                   │
    │                   ├──trượt (Data)──▶ tự hoàn tác ──▶ suggested
    │                   ├──trượt (Knowledge, kiểm trên bản nháp)──▶ suggested  (chưa ghi gì nên không cần hoàn tác)
    │                   └──trượt (Instructions, nằm ở bản nháp)──▶ gỡ dòng khỏi bản nháp ──▶ suggested
    │                   (ở cả ba nhánh trượt, chủ có thể chọn "Keep it anyway" ──▶ kept_failing)
    └──Dismiss──▶ dismissed          verified/kept_failing/published ──Undo (kèm lý do, trong 7 ngày)──▶ undone
```
- `undone` là trạng thái cuối. Muốn sửa lại thì tạo bản sửa mới từ câu trả lời.
- Undo một bản sửa Instructions đã `published` sẽ gỡ dòng đó khỏi bản nháp, và cần Publish lần nữa mới tới khách.
- Sửa **data**: ghi vào dòng thật rồi kiểm ngay. Nếu scenario trượt, hệ thống **tự hoàn tác trong cùng thao tác**, chỉ vài giây.
- Sửa **knowledge**: kiểm trên bản nháp có kèm cặp hỏi–đáp mới **trước**. Chỉ khi đạt mới ghi vào nguồn thật, sau đó cần khoảng 1 phút để index.
- Cả hai trường hợp, khách không nhận bản sửa chưa đạt.
- Sửa **rule** nằm ở bản nháp; chỉ tới khách khi `published`.
- `kept_failing`: chủ đã đọc cảnh báo "Customers will see this change even though the scenario fails" và vẫn giữ. Bản sửa này hiện trong Needs attention cho tới khi đạt.

### 7.3 Luật chặn
1. AI **không bao giờ** tự áp dụng; nút "Apply" do chủ bấm.
2. Bài kiểm tra sinh từ bản sửa mặc định **Required**. Publish không đạt thì bản sửa rule không tới khách, kèm đường đi tiếp: "Fix this answer" (nút chính) hoặc "Open the scenario".
3. Tin nhắn khách chép sang bài kiểm tra **luôn được che số điện thoại và email** trước khi lưu.
4. Trợ lý chỉ hỏi số điện thoại/email **sau khi** đã nói một câu thông báo: dùng để làm gì, ai liên hệ, khách có thể yêu cầu xoá.
5. Khách đã xoá dữ liệu thì trợ lý không gợi lại thông tin cũ. Hội thoại cũ hiện "Customer data erased".

### 7.4 Ai được báo, trong bao lâu
Một admin, báo trong app; không gửi email/SMS (xem mục 5). Người nhận mọi mục là **chủ doanh nghiệp**.

| Việc đang chờ | Hạn | Quá hạn thì |
|---|---|---|
| Mục Needs attention chưa xử lý | 48 giờ | Nhãn cam "Waiting 2 days", xếp lên đầu |
| Bản sửa rule đã áp dụng nhưng chưa Publish | 24 giờ | Mục "Fix not live yet" vào Needs attention |
| Bản sửa `kept_failing` | Ngay | Mục "Fix kept but failing" vào Needs attention |
| Hội thoại đang "Your team replies" | 24 giờ | Ô "Waiting for your team" ghi "Oldest 1 day" màu cam |
| Khách mới để lại liên hệ (lead) | Liên hệ trong 24 giờ (chủ tự gọi hoặc giao nhân viên ngoài app); chỉ chủ bấm "Mark as contacted" | Mục "New lead to contact" vào Needs attention ngay; quá 24 giờ thì nhãn cam "Waiting 1 day" |
| Yêu cầu dữ liệu của khách | 72 giờ (chờ luật sư xác nhận) | Nhãn đỏ "Overdue" |

Bài kiểm tra sinh từ bản sửa mà trượt ở lần Publish sau thì hiện **ngay ở banner Publish**: "A fixed answer broke again".

## 8. Dữ liệu và quyền

| Dữ liệu | Chủ doanh nghiệp | Nhân viên trực kênh | Khách | Trợ lý AI |
|---|---|---|---|---|
| Bản sửa, scenario | Tạo, sửa, xoá, xem | Không thấy (không vào app này) | Không thấy | Không thấy (chỉ hưởng kết quả) |
| Dòng dữ liệu, kiến thức, hồ sơ | Sửa, xem | Không thấy | Không thấy trực tiếp | Chỉ đọc qua tra cứu |
| Tin nhắn hội thoại | Xem, che khi xoá dữ liệu khách | Xem và trả lời trong hộp thư của kênh, theo quyền của kênh | Chỉ hội thoại của mình | Đọc hội thoại đang trả lời |
| Liên hệ khách | Xem, xuất, xoá | Chỉ thấy những gì khách gõ trong hộp thư kênh | Chỉ phần mình, qua yêu cầu với chủ | Ghi khi khách tự đưa, sau thông báo |
| Nhật ký (ai xem/sửa gì) | Xem | Không | Không | Không |

**Dữ liệu cá nhân** (Luật BVDLCN Việt Nam hiệu lực 01/01/2026, NĐ 356/2025; tham chiếu PDPA Singapore; TCPA nếu sau này nhắn SMS ở Mỹ):
- **Hỏi đồng ý trước khi thu:** câu thông báo bắt buộc trong luật chạy (runtime rules), chủ chỉnh được lời.
- **Chỉ thu thứ dùng tới:** danh sách "Contact details to collect" trong hồ sơ là trần.
- **Trẻ em:** builder không nhắm khách dưới 16 tuổi. Khách tự nhận dưới 16 tuổi thì trợ lý không xin liên hệ, chuyển nhân viên.
- **Đường xoá và xuất:** nút trong Conversations. Xoá nghĩa là xoá liên hệ và che số/email trong bản ghi tin nhắn.
- **Nhật ký:** ghi `contact.viewed`, `contact.exported`, `contact.erased` vào `audit_logs`.
- **[CHƯA CÓ] luật sư xem lại câu đồng ý.** Người đi tìm: **Sơn**, hạn 31/10/2026.

## 9. Sự kiện ghi lại
- Bản sửa: `fix.started` · `fix.suggested` (`target_kind` gợi ý, thời gian AI) · `fix.target_changed` (chủ đổi nơi sửa) · `fix.applied` · `fix.auto_reverted` · `fix.kept_failing` · `fix.verified` · `fix.undone` (lý do) · `fix.regressed` (trượt ở lần Publish sau) · `fix.published`
- Scenario: `scenario.judged` (đạt/không, lý do) · `draft.reverted_to_live`
- Needs attention: `attention.listed` (nguồn) · `attention.dismissed` (lý do) · `attention.overdue`
- Lead: `lead.created` · `lead.contacted` · `lead.overdue`
- Dữ liệu khách: `contact.consent_asked` · `contact.consent_given` · `contact.consent_declined` · `contact.viewed` · `data_request.created` · `contact.exported` · `contact.erased`

Mỗi sự kiện có: thời điểm, `agent_id`, `version_id`, id đối tượng. Không chứa số điện thoại/email.

## 10. Đo thành công

| Chỉ số | Hôm nay | Mục tiêu sau 2 tuần dùng | Cách đo |
|---|---|---|---|
| **Dẫn trước:** thời gian từ bấm "Fix this answer" tới lúc có bài kiểm tra bảo vệ | Không đo được (đường tay khoảng 5–10 phút, ước tính theo số bước; 0 bản sửa có bài kiểm tra) | Trung vị < 2 phút | `fix.started` → `fix.verified` |
| Bản sửa bị sai lại | Không theo dõi được | 0 | `fix.regressed` |
| Bài kiểm tra Required | 2 | ≥ 10 | đếm `eval_cases` |
| Liên hệ được thu kèm đồng ý | 0% (chưa có thông báo) | 100% | `consent_given` / liên hệ mới |

## 11. Khi nào thì dừng — bốn kết cục (xét ngày 21/11/2026, sau 4 tuần dùng)
- **Nuôi tiếp:** ≥ 5 bản sửa thật, 0 tái phát, trung vị < 2 phút → làm tiếp H2 (chấm hội thoại thật).
- **Gộp:** chủ dùng "Fix this answer" nhưng gần như luôn sửa Data → bỏ gợi ý AI, gộp vào nút sửa dòng sẵn có.
- **Chế độ ít bảo trì:** < 3 bản sửa trong 4 tuần → giữ nút và bài kiểm tra tự sinh, tắt gợi ý AI và Needs attention.
- **Khai tử có biên bản:** AI gợi ý sai nơi sửa > 50% → gỡ gợi ý, viết biên bản bài học vào `docs/product/`.

Kết cục nào cũng ghi bài học vào `CURRENT-STATE.md`.

## 12. Bán cho doanh nghiệp khác thì đổi gì, giữ gì
- **Giữ (lõi, không đổi theo khách):** đối tượng Bản sửa, trạng thái, luật chặn, luật dữ liệu cá nhân, sự kiện. Mọi luật quyền và luật dữ liệu nằm ở máy chủ.
- **Đổi được (giao diện, theo khách):** lời thông báo đồng ý, danh sách thông tin cần xin, tên bảng/cột, màu thương hiệu.
- **Ranh giới đơn vị:** mỗi bản cài là một doanh nghiệp; không viết cứng tên doanh nghiệp nào vào lõi (đã có bài kiểm tra chặn chữ đặc thù ngành trong template).
- **Mang dữ liệu đi:** bản sao lưu xuất cả bài kiểm tra và bản sửa, không kèm dữ liệu cá nhân.

## 13. Rủi ro
| Rủi ro | Giảm thế nào |
|---|---|
| AI gợi ý sai nơi sửa | Chủ luôn thấy trước thay đổi; đổi được nơi sửa; đo tỉ lệ đổi |
| AI chấm bài kiểm tra sai | Hiện lý do chấm; nút "Run again"; tiêu chí dừng ở mục 11 |
| Chi phí model tăng | Chỉ gọi khi chủ bấm Suggest hoặc chạy bài kiểm tra; dùng model nhỏ |
| Số điện thoại lọt vào bài kiểm tra/bản sao lưu | Che bằng máy trước khi lưu; bài kiểm tra tự động cho mẫu số VN, Mỹ, quốc tế |
| Bản sửa Data trượt kiểm tra mà vẫn tới khách | Tự hoàn tác trong cùng thao tác; chỉ giữ khi chủ chọn rõ (7.2) |
| Nhận diện số điện thoại hiện chỉ bắt số Việt Nam | Sửa trong hạng mục 0: nhận số quốc tế (E.164) và kiểu Mỹ `(215) 555-0100` |

## 14. Cửa vận hành (trước khi mở cho doanh nghiệp thứ hai)
1. **Tự vào được không?** Có — setup bằng mã khởi tạo, tạo trợ lý bằng 3 câu.
2. **Ai được vào?** Một admin, email + mật khẩu.
3. **Hỏng thì ai biết trước?** **[CHƯA CÓ]** cảnh báo khi model hoặc kênh lỗi liên tục. Người đi tìm: **Sơn**, hạn 31/10/2026 (đề xuất: kiểm tra `/health` mỗi 5 phút + Cloudflare alert).
4. **Kẹt lúc 10 giờ tối đi đâu?** **[CHƯA CÓ]** trang tự tra. Người đi tìm: **Sơn**, hạn trước khi bán bản thứ hai.
5. **Sửa trong bao lâu, ai chịu?** **Sơn**; mục tiêu phản hồi trong 1 ngày làm việc.
6. **Dữ liệu:** xem/xuất/xoá theo mục 8; nhật ký `audit_logs`.
7. **Người xây đi rồi ai nuôi?** Bộ `docs/` (CURRENT-STATE, runbook, PRD này) đủ để người sau tiếp tục. Người nuôi: **Sơn**.
8. **Không ai dùng thì sao?** Theo mục 11.
9. **Tiền nuôi mỗi tháng:** Cloudflare Workers paid + lượt gọi model của từng doanh nghiệp (API key của họ). **[CHƯA CÓ]** con số. Người đo: **Sơn**, từ hoá đơn tháng 10.
10. **Phần cho không / phần bán:** **[CHƯA CÓ]** bảng giá. Người chốt: **Sơn**.
