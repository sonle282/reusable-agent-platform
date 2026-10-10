# Master prompt for continuing on another machine

Copy everything inside the block into a new Codex session opened in the cloned repository.

```text
Bạn đang tiếp tục xây dựng và vận hành Reusable Agent Platform cho Mr Spa. Đây là một public source repository và một production Cloudflare Worker đang hoạt động. Hãy hành động như senior product engineer + Cloudflare platform engineer: kiểm tra bằng chứng trước, tiếp tục từ trạng thái hiện tại, không làm lại phần đã hoàn tất, không yêu cầu tôi thao tác tay nếu bạn có thể thực hiện an toàn bằng CLI/API/UI automation.

Repository và production:
- GitHub public repo: sonle282/reusable-agent-platform
- Default branch: main
- Cloudflare account: Mrspainc Nail Furniture and Equipment
- Cloudflare account ID: 759105f65ba94c85759b0b2a03f1c39a
- Worker: reusable-agent-platform
- Production URL: https://reusable-agent-platform.mrspaoffice.workers.dev
- D1 UUID: 35e4f854-2a4c-4b60-ae6b-8807bf35d08d
- Cloudflare Workers Builds is connected to GitHub account sonle282.
- Build command: npm run ci
- Deploy command: npm run deploy:ci

Trước khi thay đổi bất cứ thứ gì:
1. Đọc toàn bộ README.md, docs/README.md, docs/CURRENT-STATE.md, docs/PLATFORM-PLAN.md, docs/OPERATIONS-RUNBOOK.md và mọi AGENTS.md áp dụng.
2. Chạy git status --short --branch, git log --oneline -10, npm ci nếu cần, npm run ci, npx wrangler whoami, và kiểm tra production /health.
3. Xác nhận repo vẫn PUBLIC và Cloudflare account/Worker đúng trước mọi mutation từ xa.
4. Bảo toàn mọi thay đổi chưa commit của người dùng; không reset hoặc ghi đè chúng.

Trạng thái đã hoàn tất:
- Một Worker chứa React/Vite admin UI, Hono API, runtime, Queue consumer, Durable Object/Agents SDK, D1, R2, AI Search và AI Gateway provider.
- Setup/admin auth, agent CRUD, draft/version/publish/rollback, Preview/evals, generic collections/CSV, knowledge ingestion/retrieval, conversation/contact/human takeover, Generic API/webhook và Zernio adapter đã được implement.
- Security gồm AES-GCM credentials, PBKDF2 password, signed sessions, CSRF/origin, lockout/rate limits, SSRF/MIME validation, idempotency và log redaction.
- Production setup đã xong; bootstrap không còn hiệu lực.
- Mr Spa đã import 1 agent, 5 collections, 75 records (72 products + 3 offers), 9 knowledge sources ready và 2 eval cases.
- Admin email: sonle@nhi.sg. Không có password hay secret nào trong Git.
- PBKDF2 đã được sửa xuống 100,000 iterations để tương thích Workers; commit f9d1e87. Không tăng lại vượt giới hạn runtime.

Việc cần tiếp tục ngay:
1. Anthropic API key chưa được cấu hình. Khi cần key, yêu cầu tôi copy key vào clipboard hoặc nhập qua UI bảo mật; tuyệt đối không in, echo, log, lưu file, commit hoặc đưa key vào prompt.
2. Cấu hình provider với Cloudflare account ID ở trên, AI Gateway ID `default`, Anthropic key và model Claude nằm trong allowlist.
3. Test model connection.
4. Test Mr Spa agent trong Preview với câu hỏi về sản phẩm, ưu đãi còn hiệu lực và policy; kiểm tra trace để đảm bảo dynamic facts dùng collection tools, explanatory content dùng Knowledge.
5. Chạy 2 eval cases; sửa lỗi critical nếu có; publish production version đầu tiên.
6. Tạo/test Generic API connection cho sync + async, API key scope, rate limit và idempotency.
7. Khi tôi cung cấp Zernio credentials/endpoint, cấu hình và test HMAC sai=401, duplicate bị bỏ qua, webhook=202 nhanh, queue/outbound/idempotent retry.
8. Test contact capture, conversation search, human takeover, failed job inspect/retry.

Nguyên tắc làm việc:
- Bám đúng v1 scope trong docs/PLATFORM-PLAN.md. Không tự mở rộng sang multi-tenant SaaS, billing, audio, PDF/DOCX, crawler, external write actions, visual workflow hoặc multi-agent.
- Runtime phải channel-independent; connector chỉ verify/normalize/send.
- Dữ liệu động như giá, khuyến mãi, tồn kho, ngày hiệu lực phải ở Data Collections; Knowledge chỉ dành cho nội dung semantic ổn định.
- Không cho model chạy raw SQL hoặc external write methods.
- Conversation giữ nguyên agentVersionId; rollback chỉ đổi active pointer cho conversation mới.
- Không sửa migration Durable Object/D1 đã chạy; tạo migration mới.
- Không commit secrets. Không đọc/hiển thị secret remote. Không rotate CREDENTIAL_ENCRYPTION_KEY khi chưa có decrypt/re-encrypt migration.
- Với thay đổi code: dùng apply_patch, chạy test/typecheck/build phù hợp, secret scan, git diff --check, rồi commit/push nếu nằm trong yêu cầu.
- Sau push main, theo dõi Cloudflare Workers Build đến khi thành công và kiểm tra /health. Nếu thất bại, chẩn đoán và sửa trong scope; không bỏ cuộc ở bước giữa.
- Cập nhật docs/CURRENT-STATE.md khi production state, resource, migration, model hoặc data thay đổi đáng kể.
- Tra cứu Cloudflare docs/skills hiện hành khi API/limit/config có thể đã thay đổi; dùng package versions và wrangler config trong repo làm baseline.

Acceptance cho chặng tiếp theo:
- Model connection test pass qua AI Gateway.
- Preview trả lời đúng dựa trên imported Mr Spa data và trace rõ nguồn/tool.
- Critical evals pass và agent được publish.
- Generic API có một smoke test thành công, không lộ key, duplicate request không tạo duplicate output.
- Cloudflare build/deploy và production health đều xanh.

Hãy bắt đầu bằng cách báo ngắn gọn những gì bạn đã xác minh và hành động tiếp theo, rồi tự thực hiện. Chỉ dừng để hỏi tôi khi thật sự cần secret/credential hoặc một quyết định có thể thay đổi đáng kể phạm vi/sản phẩm.
```
