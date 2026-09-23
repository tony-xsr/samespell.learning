# Deploy lên server riêng (tungtran.dev VPS)

Tài liệu cho **bất kỳ project nào** muốn deploy lên cùng server này. Project mẫu: `samespell.learning`
(lingo.tungtran.dev), toàn bộ quy trình nằm trong 1 file [`deploy.sh`](../deploy.sh) ở root repo.

Project mới: copy `deploy.sh` sang, sửa các chỗ ở mục **"Thêm project mới"**, điền `.env.local`, chạy
`./deploy.sh`.

---

## Server

| | |
|---|---|
| IP / SSH | `103.200.20.185`, user `root`, đăng nhập bằng SSH key từ Mac |
| OS | Ubuntu 22.04 LTS, 4 core, 4 GB RAM, 2 GB swap, ổ 40 GB |
| Có sẵn | Docker, Nginx, Redis trên host (`127.0.0.1:6379`, hiện không dùng) |
| HTTPS | **Cloudflare proxy** (đám mây cam). Origin chỉ mở `:80`, **không dùng certbot** |
| Thư mục app | `/opt/apps/<tên>` |

## App đang chạy (cập nhật khi thêm app)

| Domain | Cổng host | Thư mục / container | Ghi chú |
|---|---|---|---|
| tungtran.dev | 3011 | `tung-blog` | |
| pm.tungtran.dev | 3009 | `solana-tracker` (+ `solana-redis` :6380) | deploy kiểu cũ (git pull + compose) |
| lingo.tungtran.dev | 3010 | `samespell` (+ `samespell-redis`) | deploy bằng `deploy.sh` |
| ls.tungtran.dev | 3012 | `tung-livestream` | |

**Cổng trống tiếp theo: 3013.** Kiểm tra lại trước khi dùng: `ssh root@103.200.20.185 'ss -ltn'`.

---

## Mô hình (mỗi app tách biệt hoàn toàn)

```
Trình duyệt ─https→ Cloudflare ─http→ Nginx :80 (server_name = domain)
                                        └→ 127.0.0.1:<APP_PORT> → container <tên> :3000
                                                                    └→ <tên>-redis :6379 (network <tên>-net)
```

Mọi thứ của một app đều mang tên riêng, nên deploy app này không đụng tới app khác:

| Tài nguyên | Tên |
|---|---|
| Container app / Redis | `<tên>`, `<tên>-redis` |
| Docker network / volume | `<tên>-net`, `<tên>-redis-data` |
| Nginx | `/etc/nginx/sites-available/<domain>` (chỉ tạo lần đầu, không ghi đè) |
| Cron | `/etc/cron.d/<tên>` |
| Env | `/opt/apps/<tên>/.env` (quyền 600) |

- App chỉ nghe ở `127.0.0.1:<APP_PORT>`, **không** mở `0.0.0.0` (không ai vào thẳng được, bỏ qua Cloudflare).
- Redis là container riêng, không publish cổng. RAM khoảng 3–10 MB, rẻ hơn nhiều so với rủi ro dùng chung.
- Image build ngay trên server (multi-stage, Next.js `output: "standalone"`), nặng khoảng 200–300 MB **ổ cứng**.

## Lệnh

```bash
./deploy.sh            # rsync code + gửi .env.local → build image → thay container → nginx → cron
./deploy.sh logs       # docker logs -f
./deploy.sh rollback   # quay về image trước (samespell:prev)
./deploy.sh migrate    # riêng samespell: copy Upstash → Redis server (1 lần)
```

`deploy.sh` đọc từ `.env.local` các biến `SERVER_HOST`, `SERVER_USER`, `DOMAIN`, `APP_PORT`, `APP_DIR`,
`SSL` (`cloudflare` mặc định | `certbot`). Toàn bộ `.env.local` được làm sạch (bỏ comment, dấu nháy) rồi
gửi qua ssh thành `/opt/apps/<tên>/.env`. **Env không bao giờ đi qua git.**

---

## Thêm project mới (checklist)

1. **Next.js:** thêm `output: "standalone"` vào `next.config.ts`.
2. **Copy `deploy.sh`**, rồi đổi tên `samespell` thành tên app ở mọi chỗ: container, `-redis`, `-net`,
   `-redis-data`, `samespell:latest/prev`, `/etc/cron.d/...`, giá trị mặc định của `APP_DIR`.
   - Không cần Redis: xoá bước 2 (Redis), bỏ `--network` và `-e REDIS_URL` trong `run-app.sh`.
   - Không có cron: xoá bước 7. Có cron Vercel thì chuyển từng dòng trong `vercel.json` sang `/etc/cron.d/<tên>`.
   - Bỏ lệnh `migrate` và dòng COPY `kuromoji/dict` (hai thứ này chỉ samespell cần).
   - Health check đang gọi `/login`: đổi sang một trang trả về 200 mà không cần đăng nhập.
3. **`.env.local`** thêm:
   ```bash
   SERVER_HOST=103.200.20.185
   SERVER_USER=root
   DOMAIN=<sub>.tungtran.dev
   APP_PORT=3013            # cổng trống tiếp theo, xem bảng trên
   APP_DIR=/opt/apps/<tên>
   SSL=cloudflare
   ```
4. **Cloudflare DNS:** record `A`, name `<sub>`, trỏ về `103.200.20.185`, bật **Proxied**.
5. `./deploy.sh`, rồi cập nhật bảng "App đang chạy" ở trên (trong repo này và trong repo mới).

## Lỗi đã gặp (tránh lặp lại)

- **openrsync trên macOS** không có `--chmod` → gửi file env bằng `ssh "umask 077 && cat > ..." < file`.
- **Không chạy certbot `--redirect`** sau Cloudflare: sẽ bị lặp redirect. Cloudflare đã lo HTTPS.
- **Cookie `secure` khi `NODE_ENV=production`**: phải vào bằng `https://` qua Cloudflare. Gọi thẳng HTTP tới IP
  thì không đăng nhập được, đây không phải lỗi app.
- **File app đọc bằng `fs` lúc chạy** (ví dụ `process.cwd() + "/node_modules/..."`) không được standalone tự
  kèm theo → phải `COPY` vào stage cuối của Dockerfile.
- **Ghi file lúc chạy** (ví dụ ghi vào `data/`) không bền: container bị thay ở mỗi lần deploy. Dữ liệu cần giữ
  lại phải nằm trong Redis/volume.
- **`docker --env-file`** hiểu giá trị nguyên văn, nên dấu nháy và `# comment` cuối dòng trở thành một phần giá
  trị. `deploy.sh` đã làm sạch trước khi gửi.
- **`set -o pipefail` + `cmd | grep -q`** có thể trả về sai (SIGPIPE) → dùng `grep -q ... <<<"$(cmd)"`.
- **Script chạy từ xa qua `ssh ... bash -s`** dễ bị lệnh con đọc mất phần còn lại của stdin → dùng
  `bash -c "$(cat)"`.
- **Build cache của Docker phình rất nhanh** (từng lên 15 GB) → `deploy.sh` chạy
  `docker builder prune -f --keep-storage 3GB` sau mỗi lần deploy.
- **Panel VPS báo RAM gần đầy** là vì tính cả page cache. Xem số thật bằng `free -m` (cột `available`) và
  `docker stats --no-stream`.

## Việc còn tồn (server)

- `solana-redis` đang publish `0.0.0.0:6380` và không có mật khẩu. Cổng 3009/3011/3012 cũng mở ra `0.0.0.0`.
  Nên chuyển sang `127.0.0.1:`.
- `dockerd` đang chiếm khoảng 1 GB RAM sau 150+ ngày chạy. `systemctl restart docker` (các container dừng
  khoảng 10–20 giây) lấy lại được khoảng 900 MB.
