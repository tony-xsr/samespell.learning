import path from "path";
import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

let kuroshiroPromise: Promise<Kuroshiro> | null = null;

function getKuroshiro(): Promise<Kuroshiro> {
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const kuroshiro = new Kuroshiro();
      // kuromoji-analyzer-kuromoji chỉ chạy được ổn định ở phía SERVER (Node dùng fs + zlib thật) —
      // bản browser của kuromoji dựa vào zlibjs kiểu global <script>, không tương thích với bundler
      // hiện đại (webpack lỗi "Cannot read properties of undefined (reading 'Gunzip')"). Vì vậy hàm
      // này CHỈ được gọi từ route API (xem src/app/api/grammar/furigana/route.ts), không gọi trực
      // tiếp từ component "use client".
      await kuroshiro.init(new KuromojiAnalyzer({ dictPath: path.join(process.cwd(), "node_modules/kuromoji/dict") }));
      return kuroshiro;
    })();
  }
  return kuroshiroPromise;
}

/** Sinh furigana (HTML <ruby>/<rt>) cho 1 câu tiếng Nhật bất kỳ — dữ liệu tĩnh chỉ lưu chữ Hán gốc,
 * không lưu cách đọc, nên phải tính lúc hiển thị. Tương tự toPinyin (tiếng Trung) nhưng khởi tạo BẤT
 * ĐỒNG BỘ (tải từ điển kuromoji ~17MB, cache lại sau lần tải đầu tiên trong vòng đời server). Chỉ
 * dùng cho tiếng Nhật; tiếng Hàn (Hangul đã là chữ ghi âm) không cần hàm này. */
export async function toFuriganaHtml(text: string): Promise<string> {
  try {
    const kuroshiro = await getKuroshiro();
    return await kuroshiro.convert(text, { to: "hiragana", mode: "furigana" });
  } catch {
    return "";
  }
}
