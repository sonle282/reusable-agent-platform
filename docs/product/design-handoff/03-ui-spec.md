# 03 · UI spec — Sửa câu trả lời sai một lần, không tái phát

**ID:** NL-UI-AGENTBUILDER-001 · **Phiên bản:** 1.1 · **Ngày:** 10/10/2026 · **Đọc kèm:** `01-prd.md`, `02-ux-flow.md` (bảng tên ở mục đầu) · **Bấm thử:** `fix-this-answer-prototype.html`

## 0. Chuẩn chung

- **Chữ trên màn: tiếng Anh**, theo quyết định của chủ sản phẩm ngày 10/10/2026. Tài liệu viết tiếng Việt, còn chữ trên giao diện để nguyên văn trong ngoặc kép.
  - Luật chữ: rõ, thẳng, gọi người dùng là "you", câu dưới 20 chữ, không thuật ngữ máy.
  - Không dùng các chữ: "tool", "eval", "assertion", "trace", "LLM", "embedding".
- **Thành phần dùng lại**, không vẽ mới: `Sheet` · `Section` · `Row` · `FieldRow` · `Button` (filled/tinted/gray/plain/destructive) · `Badge` · `Banner` · `Toggle` · `Segmented` · `EmptyState` · `Spinner` · `useToast` (`src/client/ui.tsx`).
- **Token hai lớp:**
  - Lớp gốc: màu hệ thống Apple (`--blue`, `--green`, `--orange`, `--red`…). Đổi được theo thương hiệu.
  - Lớp vai giữ nguyên: `--tint` (nút chính), `--label`, `--label-secondary`, `--separator`, `--bg`, `--bg-secondary`.
  - Không viết mã màu trực tiếp trong thành phần.
- **Ngày giờ:** `Oct 10, 2026, 2:35 PM` ở mọi nơi; trong danh sách chỉ ngày: `Oct 10, 2026`. Không bỏ năm. Khoảng chờ hiện bằng ngày/giờ: "Waiting 2 days".
- **Tiền:** hiện đúng như chủ nhập trong Data, kèm ký hiệu tiền tệ của dòng đó, ví dụ `$1,700` hoặc `1.700.000 ₫`. App không tự đổi tiền tệ, không làm tròn. Số trong giao diện admin dùng dấu phẩy ngăn hàng nghìn: `1,700`.
- **Tên gọi:** theo bảng tên ở đầu `02-ux-flow.md`. Ví dụ trong ô nhập dùng ví dụ trung tính, không theo ngành của khách đầu tiên.
- **Mỗi màn một nút chính** (filled). Việc phụ dùng gray/plain.
  - Trang Assistant: nút chính là **Publish** khi có thay đổi chưa đưa tới khách. Khi đó nút "Fix this answer" trong Details là **tinted**.
  - Khi banner S6 hiện (Publish bị chặn): Publish hạ xuống **gray**, nút chính chuyển sang "Fix this answer" trong banner.
  - Khi bản nháp trùng bản đang chạy: Publish ghi "Published", bị khoá, và "Fix this answer" là nút chính duy nhất (filled).

## 1. Bạn cần… → Dùng…

| Bạn cần… | Dùng… |
|---|---|
| Hành động chính duy nhất của màn hoặc sheet | `Button` filled |
| Hành động phụ cạnh nút chính | `Button` gray |
| Link nhẹ trong dòng ("Choose another place") | `Button` plain |
| Thao tác không lùi được (Erase) | `Button` destructive + xác nhận bằng chữ |
| Bật/tắt một trạng thái | `Toggle` (role switch) |
| Chọn một trong 2–3 kiểu | `Segmented` |
| Báo trạng thái ngắn (Passed, Waiting 2 days) | `Badge` |
| Báo lỗi hoặc cảnh báo kèm việc làm tiếp | `Banner` + nút trong dòng |
| Xác nhận đã xong, không cần làm gì thêm | `useToast` |

`Banner` và `Toast` khác nhau thế nào: Banner đứng yên và có việc để làm; Toast tự tắt và chỉ báo đã xong.

## 2. Màn S1 — Assistant: ô tóm tắt (sửa màn có sẵn)

- Từ 3 ô lên **4 ô**: "Chats in the last 24 hours" · **"Needs attention"** · "Waiting for your team" · "Replies not delivered".
- Ô Needs attention:
  - Số lớn, màu cam khi > 0.
  - Dòng phụ: "Oldest waiting 2 days", hoặc "All clear" khi 0.
  - Bấm vào thì danh sách S4 mở **ngay bên dưới**, ô được đánh dấu đang chọn. Bấm lần nữa thì đóng.
- **Điện thoại:** 4 ô xếp lưới 2×2.

| Trạng thái | Hiện gì |
|---|---|
| Đang tải | 4 ô xám không có số (không hiện số 0 giả) |
| Lỗi | Một dòng chữ phụ thay cho hàng ô: "Couldn't load today's numbers." + plain "Try again"; phần còn lại của trang vẫn chạy |
| Trống (mọi số = 0) | Vẫn hiện, các ô ghi "All clear" |
| Quá hạn | Ô Needs attention ghi "Oldest waiting 2 days" màu cam; ô Waiting for your team ghi "Oldest 1 day" màu cam |

## 3. Màn S2 — Details trong Test (sửa màn có sẵn)

- Đầu panel: nút **"Fix this answer"**, chiếm cả chiều ngang; filled hay tinted theo luật một nút chính ở mục 0.
- Bên dưới giữ nguyên các nhóm: "Status" · "Time" · "Model" · "Knowledge read" · "Data looked up" (bấm từng dòng để sửa thẳng).
- Chưa chọn câu trả lời: "Tap a reply to see what it was based on, or to fix it."

| Trạng thái | Hiện gì |
|---|---|
| Trống | Câu ở trên |
| Đang tải | Bong bóng "…" (typing) trong chat; Details giữ câu trả lời trước |
| Lỗi | Banner trong chat: "The assistant couldn't reply — <lý do>." + "Try again" |
| Quá hạn | Không áp dụng |

## 4. Màn S3 — Sheet "Fix this answer" (mới)

Một sheet, ba bước nối tiếp, **không đổi sheet giữa chừng**. Tiêu đề: **"Fix this answer"**.

**Bước 1 — Câu đúng**
- Nhóm "Conversation" (chỉ đọc):
  - "Customer asked": tin khách, đã che số; số bị che hiện `•••• 1111`.
  - "Assistant replied": render bong bóng như Test.
- Nhóm "What it used": tối đa 3 dòng (nguồn kiến thức, dòng dữ liệu), mỗi dòng kèm `Badge` "Knowledge" hoặc "Data".
- Ô nhập **"What should it have said?"**:
  - textarea, 4 dòng, tự giãn.
  - placeholder: "Write the answer you'd give, in your own words."
- Chân sheet: gray "Cancel" · filled **"Suggest a fix"** (khoá khi ô trống).

**Bước 2 — Gợi ý**
- Thẻ gợi ý: icon theo loại, cùng màu với chỗ khác:
  - Data màu xanh lá.
  - Knowledge màu chàm.
  - Instructions màu cam.
- Tiêu đề thẻ, một trong ba:
  - "Update a data row" (Data)
  - "Add to Corrected answers" (Knowledge)
  - "Add to your instructions" (Instructions)
- Dòng lý do một câu, ví dụ: "The offer table has no free-shipping row for 8 chairs; the reply guessed."
- Phần **"What will change"** trình bày dạng trước/sau:
  - Dữ liệu: tên bảng › tên dòng › cột, giá trị cũ gạch ngang và giá trị mới.
  - Kiến thức: cặp "Q: … / A: …".
  - Instructions: tên mục (Always/Never/Hand off) + dòng mới, sửa được trực tiếp.
- Link plain **"Choose another place"** mở `Segmented`: Data · Knowledge · Instructions.
- Chân sheet: gray "Back" · filled **"Apply fix"**.

**Bước 2b — Đang áp dụng và kiểm:** nút "Checking…", spinner, nút đóng tạm khoá (tối đa khoảng 15 giây).

**Bước 3 — Kết quả**
- Đạt:
  - Icon dấu tích xanh, tiêu đề **"Fixed and protected"**.
  - Dòng 2 theo loại:
    - Data: "Live for customers now."
    - Knowledge: "Live in about a minute."
    - Instructions: "Publish to send it to customers."
  - Dòng "Saved as a scenario: *‘<tên>’*" + link "View".
  - Dòng "Next": "1 more answer needs attention" (link mở S4), hoặc "You're all caught up".
  - Chân sheet:
    - Instructions: gray "Done" · filled **"Publish now"**.
    - Data/Knowledge: filled **"Done"**.
- **Undo** (plain, ở chân sheet bước 3, và trong sheet của scenario "From a fix" trong 7 ngày): sheet nhỏ "Undo this fix?". Câu giải thích theo nơi sửa:
  - Data: "The data row goes back to its old value."
  - Knowledge: "The question and answer are removed from Corrected answers."
  - Instructions: "The line is removed from your draft. Publish to send the change to customers."
  - Hai nút lý do: "Wrong fix" · "No longer needed"; ô chọn "Also remove the scenario" (bật sẵn).
- Chưa đạt:
  - `Banner` cam **"Not applied — the scenario still fails."**
    - Dòng 2: "Customers don't see this change. Reason: <lý do của AI>".
  - Chân sheet: plain **"Keep it anyway"** · gray "Done" · filled **"Try another fix"**.
- **Xác nhận "Keep it anyway"** (sheet nhỏ):
  - "Customers will see this change even though the scenario fails. It stays in Needs attention until it passes."
  - Nút: gray "Cancel" · destructive "Keep change".

| Trạng thái | Hiện gì |
|---|---|
| Đang gợi ý | Nút chuyển "Thinking…" + spinner nhỏ; ô câu đúng vẫn sửa được |
| Đang áp dụng | Nút "Applying…" |
| Lỗi gợi ý | Banner đỏ: "Couldn't get a suggestion — the AI didn't respond. Your answer is kept." + "Try again" · plain "Choose another place" |
| Chưa có API key | Banner cam: "Suggestions need your AI key. Add it in Settings, or choose another place." + plain "Open Settings" · plain "Choose another place" |
| Hội thoại thật, khách còn chờ | Dòng trên cùng: "This customer may still be waiting. Turn on Your team replies to answer them yourself." + `Toggle` "Your team replies" |
| Không áp dụng được | Banner đỏ: "Couldn't apply the fix — <lý do, ví dụ: the data row was deleted>. Nothing changed for customers." + filled "Try again" · plain "Choose another place"; câu đúng vẫn giữ |
| Trống | Ô câu đúng trống: nút "Suggest a fix" khoá, chữ phụ "Write the answer first." |
| Quá hạn | Câu trả lời cũ hơn 7 ngày: dòng "This reply is from Oct 1, 2026. The assistant may answer differently now." + plain "Try it again in Test" |

**Điện thoại:** sheet thành bottom sheet cao 92%; nút chân sheet dính đáy.

## 5. Màn S4 — Danh sách Needs attention (mới, nằm trong trang Assistant)

- `Section`, tiêu đề "Needs attention", mỗi mục một `Row`:
  - **Icon theo nguồn:**
    - person: Your team is replying.
    - warning: Sent the backup reply.
    - clock: Fix not live yet. Fix kept but failing có `Badge` đỏ "Failing".
    - tag (%): Price question without a lookup.
    - person: New lead to contact. Dòng có nút gray "Mark as contacted".
    - shield: Data request.
  - **Tiêu đề:** tin khách, che số, tối đa 1 dòng.
  - **Phụ đề:** nhãn nguồn · ngày (`Oct 8, 2026`).
  - **Phụ kiện:** `Badge` "Waiting 2 days" (cam) hoặc "Overdue" (đỏ, chỉ với Data request).
  - Bấm vào dòng mở `Sheet` gồm 3 nút: filled "Fix this answer" · gray "Open conversation" · plain "Dismiss".
- **Dismiss:** `Segmented` 3 lý do ("Answer was fine" · "Not worth fixing" · "Handled elsewhere") + nút "Dismiss".
- Bộ lọc nhỏ ở đầu: "Open" · "Dismissed".
- **Lỗi khi Dismiss:** toast không dùng; giữ sheet, banner "Couldn't dismiss. Try again."

| Trạng thái | Hiện gì |
|---|---|
| Trống | `EmptyState`: "Nothing needs your attention." / "New issues show up here automatically." |
| Đang tải | 3 dòng xám |
| Lỗi | Banner: "Couldn't load Needs attention. Other parts of the page still work." + "Try again" |
| Quá hạn | Mục cũ hơn 48 giờ có `Badge` cam "Waiting 2 days", xếp đầu |

## 6. Màn S5 — Sheet Scenario (sửa sheet có sẵn)

- **Thứ tự ô:**
  - "Name" (điền sẵn).
  - "Customer message".
  - **"Pass when…"**: textarea; placeholder "e.g. Mentions free delivery on orders over $100".
  - "Required to publish" (`Toggle`, mặc định bật).
- **"Advanced"** đóng sẵn: "Checks this table" · "Says these words" · "Never says these words" · "Longest reply (characters)".
- Nút chính sheet: filled "Save"; khi sửa scenario có thêm plain "Delete" (xác nhận lần hai).
- **Kết quả trong danh sách:**
  - `Badge` Passed/Failed + một dòng lý do (chữ phụ).
  - Nút plain "Run again".
  - Scenario sinh từ bản sửa có `Badge` xám "From a fix".
- **AI chưa chấm được:** `Badge` xám "Not checked" + "Run again". Trạng thái này **chặn Publish** như Failed.

| Trạng thái | Hiện gì |
|---|---|
| Trống | "No scenarios yet. Fix an answer or add one to protect it." + gray "Add scenario" |
| Đang chạy | Mỗi dòng "Checking…" + spinner nhỏ; danh sách vẫn đọc được |
| Lỗi lưu | Banner trong sheet: "Couldn't save the scenario. Your text is kept." + "Try again" |
| Quá hạn | Không áp dụng (scenario không có hạn) |

## 7. Màn S6 — Banner Publish bị chặn (sửa)

- Banner đỏ trên đầu trang Assistant: **"A fixed answer broke again."** + tin khách (in nghiêng) + lý do một câu.
- Nút trong banner: filled **"Fix this answer"** (nút chính) · gray "See what changed" · plain "Discard unpublished changes".
- "See what changed" mở sheet: hai bong bóng cạnh nhau, nhãn "When fixed · Oct 10, 2026" và "Now".
  - **Điện thoại:** xếp chồng thay vì cạnh nhau.

| Trạng thái | Hiện gì |
|---|---|
| Đang chạy scenario | Nút Publish "Running scenarios…" |
| Lỗi khi chạy | Banner đỏ "Couldn't run scenarios — nothing was published." + "Try again" |
| Thành công | Toast "Published version 4 · 3 scenarios passed" |
| Trống | Không có banner khi mọi scenario đạt |
| Quá hạn | Banner còn đó sau 24 giờ (chưa sửa, chưa Publish): thêm dòng "Customers are still on version 3 since Oct 10, 2026." |

## 8. Màn S7 — Conversations (sửa)

- Dưới mỗi bong bóng trợ lý: link plain nhỏ **"Fix this answer"**.
  - Bàn phím: Tab tới được.
  - Điện thoại: chạm vào bong bóng để hiện link.
- Thêm nhóm **"Customer data"** dưới thông tin liên hệ:
  - Dòng "Consent": "Given Oct 10, 2026, 2:35 PM", hoặc "Not asked".
  - Hàng nút: gray "Export" · destructive "Erase customer data".
- **Sheet Erase:**
  - Tiêu đề "Erase this customer's data?".
  - Dòng giải thích: "Their phone and email are removed from this conversation and your contacts. This can't be undone."
  - Ô "Type ERASE to confirm"; nút destructive "Erase" chỉ bật khi gõ đúng.
- **Sau khi xoá:** đầu hội thoại hiện `Banner` xám "Customer data erased on Oct 12, 2026".
- Nút chính của màn chi tiết hội thoại: `Toggle` "Your team replies" (việc hay làm nhất); Export/Erase là việc phụ.

| Trạng thái | Hiện gì |
|---|---|
| Đang tải | Bong bóng xám 3 dòng |
| Lỗi xoá | Banner đỏ "Couldn't erase. Nothing was removed." + "Try again" |
| Lỗi xuất | Banner "Couldn't export. Try again." |
| Quá hạn | Yêu cầu dữ liệu quá 72 giờ: `Badge` đỏ "Overdue" ở đầu hội thoại |
| Trống | "No messages yet." |

## 9. Màn S8 — Instructions › Contact details to collect (sửa)

- Thêm ô dưới danh sách: **"What to tell customers first"**.
  - Điền sẵn câu thông báo mặc định (UX F6).
  - Chữ chân: "Said before asking for any contact details. Required by privacy law in many countries."
- **Ô trống khi đang có danh sách thông tin cần xin:** viền đỏ + chữ "Add a short notice so customers know why you ask. Until then, the assistant uses the default notice." Không chặn lưu, nhưng banner cam ở trang Assistant (cùng chỗ với cảnh báo thiếu API key) báo cho tới khi điền.

| Trạng thái | Hiện gì |
|---|---|
| Đang lưu | Chữ "Saving…" ở đầu trang (tự lưu như hiện nay) |
| Lỗi lưu | Banner "Couldn't save the draft. Your text is kept." |
| Trống | Câu mặc định điền sẵn |
| Quá hạn | Không áp dụng |

## 10. Nói thật chỗ chưa có, không hiện số giả
- Ô tóm tắt khi đang tải **không hiện 0**.
- Chỉ số "thời gian sửa" chưa có màn hiển thị trong v1. Nó chỉ nằm trong sự kiện, **không** vẽ biểu đồ mẫu.
- Mục "Price question without a lookup" là **suy đoán bằng từ khoá**; phụ đề ghi rõ "Possible issue".

## 11. Khả năng tiếp cận (bắt buộc)
- **Sheet:**
  - `role="dialog"`, `aria-modal`, `aria-label` bằng tiêu đề; Esc đóng; đóng xong trả focus về nút đã mở.
  - **Nợ kỹ thuật:** chưa giữ focus vòng trong sheet (Tab có thể thoát ra ngoài). Chuyển sang lớp nền có sẵn (ví dụ Radix Dialog) hoặc thêm focus trap. **Hạn 24/10/2026**, cùng chặng này.
- **Ba bước của sheet Fix:**
  - Mỗi lần đổi bước, focus chuyển về tiêu đề bước.
  - Kết quả đặt trong vùng `aria-live="polite"` để trình đọc màn hình đọc "Fixed and protected".
- **Bong bóng trả lời bấm được:**
  - `button` có `aria-label="Assistant reply. Open details."`.
  - Link "Fix this answer" có `aria-label="Fix this answer: <6 chữ đầu câu trả lời>"`.
- **Toggle:** `role="switch"`, `aria-checked`, nhãn đọc được.
- **Badge màu luôn có chữ**, không dùng màu làm tín hiệu duy nhất (cam/đỏ kèm "Waiting", "Overdue").
- **Tương phản:** chữ trên nền tint ≥ 4.5:1 ở cả chế độ sáng và tối; kiểm lại cam và đỏ trên nền phụ.
- **Chuyển động:** tôn trọng `prefers-reduced-motion` (đã có trong `styles.css`).
- **Vùng chạm:** ≥ 44×44 pt cho mọi nút trên điện thoại, kể cả link "Fix this answer".
- **Bảng dữ liệu trên điện thoại:** làm **trong chặng này**. Dưới 860px, mỗi dòng thành một `Row` (tiêu đề + 2 cột phụ), không còn cuộn ngang.
