@AGENTS.md

## Deploy

Production chạy trên server riêng (lingo.tungtran.dev), không dùng Vercel. Deploy bằng `./deploy.sh`.
Chi tiết server, các app đang chạy, bảng cổng và checklist thêm project mới: @docs/DEPLOY.md

## learntools-api (LeanWithAI)

`services/learntools-api/` là API riêng của LeanWithAI (Express + MongoDB), deploy cùng repo nhưng tách
biệt hoàn toàn với samespell (container/mongo/network/domain riêng). Không import gì từ `src/`.
`src/` trong đó là code SINH TỰ ĐỘNG — xem `services/learntools-api/README.md`.

