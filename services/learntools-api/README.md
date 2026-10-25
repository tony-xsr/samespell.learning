# learntools-api (LeanWithAI)

API **gọn** cho app iOS và Chrome extension của LeanWithAI, chạy trên cùng server với samespell
nhưng **tách biệt hoàn toàn**: container, MongoDB, network, cổng, domain, env, backup đều riêng.
Không đụng vào code, Redis hay cấu hình của samespell.

Chỉ **đọc và cập nhật từ vựng**. Không admin, không AI, không cron, không TTS, không import Anki.

## Tài nguyên (đo thật với 232k bản ghi)

| | RAM | Ổ đĩa |
|---|---|---|
| `learntools-api` (Express + mongoose) | ~30–80 MB (giới hạn 192 MB) | image 149 MB |
| `learntools-mongo` (mongo:7, cache 256 MB) | ~300–380 MB (giới hạn 512 MB) | image ~800 MB, data ~265 MB |

## 33 endpoint (`/api/learntools/...`)

| Nhóm | Endpoint |
|---|---|
| Thẻ | `GET card` · `GET dict-card` · `POST review` · `POST dict-review` · `POST master` · `POST add-vocab` · `GET weak-cards` · `GET weak-drill` · `GET upcoming` · `GET related-words` |
| Bộ thẻ | `GET decks` · `GET dict-decks` |
| Thống kê | `GET stats` · `GET streak` · `GET review-days` · `GET forecast` · `GET milestones` · `GET shown-today` · `GET/POST review-log` · `GET leeches` · `POST suspend` |
| Người dùng | `GET user-stats` · `POST user-stats/xp` · `POST user-stats/immersion` |
| Lưu thẻ / tra từ | `GET bookmarks` · `POST bookmark` · `DELETE bookmarks/:id` · `GET dict-search` |
| Quiz | `POST quiz/start` · `POST quiz/:id/answer` · `POST quiz/:id/end` · `GET quiz/session/:id` |

Mọi request `/api/*` cần `Authorization: Bearer <LT_TOKEN>` (hoặc `?token=`). `GET /health` công khai.
Chức năng extension gọi endpoint ngoài danh sách (AI enhance, admin, chat, mining, TTS server…) sẽ nhận
404. Các chức năng đó vẫn dùng được với backend local.

## Cấu trúc

```
server.js                       token, CORS, health, kết nối Mongo — code của thư mục này
src/                            SINH TỰ ĐỘNG — không sửa tay
  routes/learntools.js          33 route chép nguyên văn từ leanwithAI
  services/srs.js               chỉ hàm recordReview (SM-2)
  services/ankiQuizService.js
  models/*.js
scripts/
  sync-from-leanwithai.js       sinh lại src/ từ ../../../leanwithAI/backend
  backup-learntools.js          (chép từ leanwithAI)
  restore-learntools.js         (chép từ leanwithAI)
Dockerfile
```

## Lệnh (chạy ở root repo samespell)

```bash
./deploy.sh learntools                 # chỉ deploy learntools-api (+ mongo lần đầu)
./deploy.sh                            # samespell như cũ, rồi learntools nếu có LT_DOMAIN
./deploy.sh lt-restore <file.lwbak.gz> # nạp backup từ Mac (gộp theo _id, chạy lại an toàn)
./deploy.sh lt-backup                  # backup trên server rồi tải về ./backups-learntools/
./deploy.sh lt-logs
./deploy.sh learntools-music [dir]     # nhạc nền Player (mặc định /Volumes/MacMini/audio/_app_m4a) → /opt/apps/learntools/music
```

Nhạc nền: `GET /api/music/music.json` + `/api/music/<id>.m4a` (cùng token, hỗ trợ Range), thư mục host mount
read-only vào container. Tạo file bằng `learntools/app/scripts/import-music.js` trong repo leanwithAI (~14 MB/bài 1 giờ).

Server tự backup lúc 02:00 giờ VN mỗi ngày vào `/opt/apps/learntools/backups`, giữ 7 bản mới nhất.

### Lần đầu

1. `.env.local` của samespell thêm:
   ```bash
   LT_DOMAIN=api-lwai.tungtran.dev
   LT_PORT=3013
   LT_TOKEN=<openssl rand -hex 24>
   ```
2. Cloudflare DNS: record `A` `api-lwai` → `103.200.20.185`, bật **Proxied**.
3. `./deploy.sh learntools`
4. `./deploy.sh lt-restore ../leanwithAI/backend/backup/learntools-….lwbak.gz`
5. App iOS / extension: Server URL = `https://api-lwai.tungtran.dev`, API token = `LT_TOKEN`.

## Kịch bản đọc ngắn (tts_back)

```bash
ssh root@103.200.20.185 'docker exec learntools-api node scripts/build-tts-back.js'            # mục chưa xử lý
ssh root@103.200.20.185 'docker exec learntools-api node scripts/build-tts-back.js --report'   # % theo bộ
```
Chi tiết quy tắc: đầu file `scripts/build-tts-back.js` (nguồn ở leanwithAI/backend).

## Cập nhật code từ leanwithAI

Sửa route ở `leanwithAI/backend/src/routes/learntools.js`, rồi:
```bash
cd services/learntools-api && npm run sync && cd ../.. && ./deploy.sh learntools
```
Muốn thêm endpoint: thêm vào `KEEP` trong `scripts/sync-from-leanwithai.js`. Script dừng và báo lỗi nếu
route đó cần phần đã lược bỏ (AI, TTS, upload…).

## Chạy local

```bash
npm install
MONGODB_URI=mongodb://localhost:27017/leanwithai PORT=3021 node server.js   # không token = không kiểm tra
```
