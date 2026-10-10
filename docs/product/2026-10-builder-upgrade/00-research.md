# Nghiên cứu sản phẩm tương tự — Agent Builder

**ID:** NL-RESEARCH-AGENTBUILDER-001 · **Phiên bản:** 1.0 · **Ngày:** 10/10/2026 · **Người viết:** mũ PM (Claude) · **Trạng thái:** Draft

Nguồn chủ yếu là trang sản phẩm, tài liệu chính thức và bài đánh giá tháng 10/2026. Giá do bên thứ ba ghi lại là giá tham khảo, cần kiểm lại trước khi trích dẫn ra ngoài.

## 1. Ba nhóm đã xem

| Nhóm | Sản phẩm | Điều đáng học |
|---|---|---|
| SMB, cho chủ tiệm tự dùng | Intercom Fin, Chatbase, Tidio Lyro, Gorgias, HubSpot Breeze, Zendesk, ManyChat, Crisp Hugo, Freshworks Freddy | Thiết lập trong vài phút, sửa câu sai ngay tại chỗ, danh sách câu hỏi chưa trả lời được |
| Doanh nghiệp lớn / nhà phát triển | Sierra, Decagon, Salesforce Agentforce, Copilot Studio, Google Conversational Agents, OpenAI AgentKit, Voiceflow, Botpress | Vòng cải tiến khép kín: câu sai → bài kiểm tra → chấm bằng AI → xuất bản |
| Việt Nam / Đông Nam Á | Pancake/Botcake, Fchat, Sapo OmniAI, Haravan, Bizfly, Subiz, FPT.AI, respond.io, SleekFlow, Wati, Meta Business Agent | Xưng hô em – anh/chị, báo giá thật khi khách "ib giá", chốt đơn trong chat, nhiều page – nhiều nhân viên, Zalo OA |

## 2. Mình đang đứng ở đâu

| Năng lực | Thị trường | Mình hiện có |
|---|---|---|
| Hướng dẫn bằng lời thường thay cho prompt trống | Crisp hỏi khoảng 5 câu; Fin/Lyro có "Guidance" | **Có** — hồ sơ trợ lý (business, job, voice, always/never, chuyển nhân viên, thông tin cần xin) |
| Tra dữ liệu có cấu trúc trước khi báo giá | Chỉ Gorgias (Shopify) làm sâu; Sapo **chưa xử lý giá khuyến mãi** | **Có, và khác biệt** — bảng dữ liệu + ưu đãi có ngày hiệu lực, tự ẩn khi hết hạn |
| Thử trước khi chạy, xem câu trả lời dựa vào đâu | Gần như ai cũng có; HubSpot/Gorgias hiện nguồn và hành động | **Có** — Test + Details + bấm vào dòng dữ liệu đã dùng |
| Bài kiểm tra chặn xuất bản | Fin Simulations, Decagon, Agentforce Testing Center | **Có, mức cơ bản** — so chuỗi (phải có / không được có / phải tra / độ dài) |
| Chấm bằng AI theo tiêu chí viết bằng lời | Fin, Sierra, Decagon, Copilot, Botpress `llm_judge` | **Chưa** |
| Câu sai → sửa một lần → thành bài kiểm tra | Chatbase "Revise answer", HubSpot "Coach your agent", Decagon/Google "test case từ lịch sử" | **Chưa** — mới mở được chỗ sửa, chưa tự tạo bài kiểm tra |
| Danh sách câu cần cải thiện | Fin content gaps, Lyro Suggestions, Copilot Themes | **Chưa** |
| Hỏi đồng ý khi xin số điện thoại, xoá/xuất dữ liệu khách | Bắt buộc theo Luật BVDLCN VN (hiệu lực 01/01/2026, NĐ 356/2025); TCPA ở Mỹ | **Chưa đủ** — có thu liên hệ, chưa có thông báo + nhật ký đồng ý + đường xoá |
| Kênh | Messenger, IG, Zalo OA, web widget, WhatsApp | API, webhook, Zernio |
| Chốt đơn trong chat | Sapo, Pancake, Meta Business Agent | Chưa (ngoài phạm vi v1: không ghi ra hệ thống ngoài) |

## 3. Kết luận cho sản phẩm

1. **Đòn bẩy lớn nhất cho đội nhỏ là vòng sửa khép kín.** Mỗi câu trả lời sai được sửa một lần, tự thành bài kiểm tra, và không tái phát ở bản sau. Cả nhóm doanh nghiệp lớn (Sierra, Decagon) lẫn nhóm SMB (Chatbase, HubSpot) đều hội tụ về điểm này.
2. **Lợi thế cần giữ: câu trả lời đúng dữ liệu.** Đối thủ đáng gờm nhất là **Meta Business Agent**: miễn phí, có sẵn trên Messenger/IG/WhatsApp từ 06/2026. Mình thắng bằng giá và ưu đãi luôn đúng hạn, chủ tiệm kiểm soát được, và đa kênh có Zalo. Mình không thắng bằng giá rẻ.
3. **Khiếu nại phổ biến cần tránh:**
   - Định nghĩa "đã giải quyết" bị thổi phồng.
   - Hoá đơn khó đoán, bot im lặng khi hết hạn mức.
   - Cài đặt phải nhờ người làm (Fchat thu 1 triệu ₫ mỗi kịch bản).
   - Bot nói chuyện như robot.
4. **Thứ thừa với một tiệm nhỏ:** A/B test có nhóm đối chứng, phát hành theo phần trăm, quy trình duyệt nhiều vai, bộ mô phỏng 1.000 tình huống, tính tiền theo kết quả.
5. **Giá tham khảo:**
   - Tiệm nhỏ Việt Nam quen trả 100k–1 triệu ₫/tháng.
   - Một "nhân viên AI" thay được người trực page part-time có thể ở mức 30–100 USD/tháng.
   - Tiệm người Việt ở Mỹ: 99–199 USD/tháng.

## 4. Nguồn chính

- Intercom Fin: https://fin.ai/pricing · https://fin.ai/help/en/articles/12628771-run-simulations-for-fin-procedures · https://www.intercom.com/help/en/articles/11394959-use-ai-powered-content-suggestions-to-improve-fin
- Chatbase: https://chatbase.co/docs/user-guides/quick-start/response-quality · https://www.chatbase.co/pricing
- Tidio Lyro: https://help.tidio.com/hc/en-us/articles/24182486548892-Lyro-Suggestions
- HubSpot: https://knowledge.hubspot.com/help-desk/coach-the-customer-agent-in-help-desk
- Gorgias: https://docs.gorgias.com/en-US/navigate-ai-agent-from-setup-to-going-live-1993179
- Crisp: https://help.crisp.chat/en/article/getting-started-with-hugo-ai-agent-w6gbux/
- Sierra: https://sierra.ai/blog/simulations-the-secret-behind-every-great-agent
- Decagon: https://decagon.ai/blog/the-future-of-ai-agents-is-test-driven · https://decagon.ai/blog/decagon-simulations
- Salesforce: https://trailhead.salesforce.com/content/learn/modules/agentforce-agent-testing/use-ai-to-generate-tests
- Microsoft: https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-themes
- Google: https://docs.cloud.google.com/dialogflow/cx/docs/concept/playbook/evaluation
- Botpress: https://botpress.com/docs/adk/testing/evals
- Anthropic: https://platform.claude.com/docs/en/about-claude/use-case-guides/customer-support-chat
- Sapo: https://www.sapo.vn/blog/cam-nang-ung-dung-tro-ly-ai-ban-hang · Fchat: https://fchat.vn/price · Pancake: https://pancake.vn/pricing
- Meta Business Agent: https://aibusiness.com/agentic-ai/meta-rolls-out-ai-agent-enterprises-globally
- Messenger: https://developers.facebook.com/docs/messenger-platform/reference/send-api · Zalo OA: https://zalo.solutions/oa/pricing
- Luật BVDLCN / NĐ 356/2025: https://www.ey.com/vi_vn/technical/tax/tax-and-law-updates/nghi-dinh-so-356-2025-nd-cp-quy-dinh-chi-tiet-mot-so-dieu-va-bien-phap-thi-hanh-luat-bao-ve-du-lieu-ca-nhan
- Niêm yết giá (NĐ 87/2024): https://luatvietnam.vn/tin-phap-luat/ban-hang-online-tai-sao-phai-inbox-gia-230-17198-article.html
