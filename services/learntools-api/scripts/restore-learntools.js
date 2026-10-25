#!/usr/bin/env node
/**
 * PHỤC HỒI dữ liệu học từ một thư mục sao lưu (do backup-learntools.js tạo ra).
 *
 *   node src/scripts/restore-learntools.js --in D:/backup/learntools-2026-10-21T...
 *   node src/scripts/restore-learntools.js --in <dir> --uri mongodb://host:27017/leanwithai
 *   node src/scripts/restore-learntools.js --in <dir> --only vocabs,reviewlogs
 *   node src/scripts/restore-learntools.js --in <dir> --wipe      ← XOÁ collection trước khi nạp
 *   node src/scripts/restore-learntools.js --in <dir> --dry       ← chỉ xem, không ghi
 *   node src/scripts/restore-learntools.js --in D:/bk/hoc.lwbak.gz  ← bản sao lưu MỘT FILE
 *
 * `--in` nhận cả THƯ MỤC (có manifest.json) lẫn MỘT FILE `.lwbak`/`.lwbak.gz`. Tự nhận dạng.
 *
 * MẶC ĐỊNH LÀ GỘP (upsert theo `_id`), KHÔNG xoá gì. Chạy lại nhiều lần ra cùng kết quả.
 * `--wipe` chỉ dùng khi dựng server MỚI hoàn toàn — nó xoá sạch collection trước khi nạp.
 *
 * `--dry` là mặc định an toàn khi bạn chưa chắc: nó đọc và đếm nhưng không ghi gì.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function docThamSo(argv) {
  const o = { in: '', uri: '', only: null, wipe: false, dry: false, batch: 1000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') o.in = argv[++i];
    else if (a === '--uri') o.uri = argv[++i];
    else if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--wipe') o.wipe = true;
    else if (a === '--dry') o.dry = true;
    else if (a === '--batch') o.batch = Math.max(100, Number(argv[++i]) || 1000);
    else if (a === '--help' || a === '-h') o.help = true;
  }
  return o;
}

async function main() {
  const o = docThamSo(process.argv);
  if (o.help || !o.in) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(o.in ? 0 : 1);
  }
  const URI = o.uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/leanwithai';

  // Chế độ MỘT FILE: --in trỏ thẳng vào file thay vì thư mục.
  const laMotFile = fs.existsSync(o.in) && fs.statSync(o.in).isFile();
  if (laMotFile) return await phucHoiMotFile(o);

  const mPath = path.join(o.in, 'manifest.json');
  if (!fs.existsSync(mPath)) {
    console.error('LỖI: không thấy manifest.json trong ' + o.in + ' — đây có phải thư mục sao lưu không?');
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  if (manifest.kind !== 'leanwithai-learntools-backup') {
    console.error('LỖI: manifest.json không phải bản sao lưu learntools (kind=' + manifest.kind + ')');
    process.exit(1);
  }

  console.log('Nguồn sao lưu : ' + o.in);
  console.log('Tạo lúc       : ' + manifest.createdAt + (manifest.userFilter ? '  (chỉ user ' + manifest.userFilter + ')' : ''));
  console.log('Nạp vào       : ' + URI.replace(/\/\/[^@]*@/, '//***@'));
  console.log('Chế độ        : ' + (o.dry ? 'CHẠY THỬ (không ghi gì)' : o.wipe ? 'XOÁ RỒI NẠP (--wipe)' : 'GỘP theo _id (mặc định)'));
  console.log('');

  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  let tongDoc = 0, tongGhi = 0;
  for (const c of manifest.collections) {
    if (o.only && !o.only.includes(c.name)) continue;
    const tep = path.join(o.in, c.file);
    if (!fs.existsSync(tep)) { console.log('  ' + c.name.padEnd(26) + '✗ thiếu file ' + c.file); continue; }

    const col = db.collection(c.name);
    const truoc = await col.countDocuments();
    if (o.wipe && !o.dry) await col.deleteMany({});

    // Đọc theo DÒNG: file dictionaryentries có 109.713 dòng / 136 MB, đọc cả file vào RAM rồi
    // split('\n') là vừa tốn vừa dễ nổ. readline xử lý từng dòng, dung lượng bao nhiêu cũng được.
    const stream = c.file.endsWith('.gz')
      ? fs.createReadStream(tep).pipe(zlib.createGunzip())
      : fs.createReadStream(tep);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let lo = [], doc = 0, ghi = 0, loi = 0;
    const xa = async () => {
      if (!lo.length || o.dry) { lo = []; return; }
      // upsert theo _id: chạy lại nhiều lần không sinh bản trùng, và không đụng bản ghi mới hơn
      // nào không có trong bản sao lưu.
      const r = await col.bulkWrite(lo.map((d) => ({
        replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
      })), { ordered: false });
      ghi += (r.upsertedCount || 0) + (r.modifiedCount || 0);
      lo = [];
    };

    for await (const line of rl) {
      const s = line.trim();
      if (!s) continue;
      doc++;
      try { lo.push(EJSON.parse(s)); } catch { loi++; continue; }
      if (lo.length >= o.batch) await xa();
    }
    await xa();

    const sau = o.dry ? truoc : await col.countDocuments();
    tongDoc += doc; tongGhi += ghi;
    console.log('  ' + c.name.padEnd(26) + String(doc).padStart(7) + ' dòng'
      + ' · ghi ' + String(ghi).padStart(7)
      + ' · ' + truoc + ' → ' + sau + ' bản ghi'
      + (loi ? '  ⚠ ' + loi + ' dòng hỏng' : ''));
  }

  console.log('\nĐọc ' + tongDoc + ' dòng · ghi ' + tongGhi + ' bản ghi'
    + (o.dry ? '\n(CHẠY THỬ — chưa ghi gì. Bỏ --dry để nạp thật.)' : ''));
  await mongoose.disconnect();
}

/**
 * Phục hồi từ bản sao lưu MỘT FILE.
 * Dòng 1 là manifest, mỗi dòng sau là { c: tên collection, d: bản ghi }.
 * Gom theo từng collection rồi ghi theo lô — đổi collection thì xả lô trước, nếu không các bản
 * ghi của collection này sẽ bị ghi nhầm vào collection kia.
 */
async function phucHoiMotFile(o) {
  const URI = o.uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/leanwithai';
  // KẾT NỐI TRƯỚC, MỞ FILE SAU — thứ tự này bắt buộc.
  //
  // Lỗi đã sửa (mất dữ liệu âm thầm): bản đầu tạo readline TRƯỚC `await mongoose.connect()`.
  // `createInterface` cho stream chảy ngay, trong lúc chờ kết nối Mongo (vài chục ms) thì các
  // dòng đầu đã phát ra dưới dạng sự kiện 'line' mà CHƯA có async iterator nào nhận → rơi mất
  // im lặng. Đo được: phục hồi 240.994/241.004 bản ghi — thiếu đúng 10, gồm TOÀN BỘ 6 bản ghi
  // của collection đầu tiên theo thứ tự chữ cái (aihomeworksessions) và 4 của collection kế
  // tiếp. Không có lỗi nào được báo. Chế độ thư mục không dính vì nó đã kết nối từ trước.
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;

  const stream = o.in.endsWith('.gz')
    ? fs.createReadStream(o.in).pipe(zlib.createGunzip())
    : fs.createReadStream(o.in);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let manifest = null, hienTai = null, lo = [], doc = 0, ghi = 0, loi = 0;
  const daXoa = new Set();
  const theoCol = {};

  const xa = async () => {
    if (!hienTai || !lo.length) { lo = []; return; }
    if (o.dry) { lo = []; return; }
    const col = db.collection(hienTai);
    if (o.wipe && !daXoa.has(hienTai)) { await col.deleteMany({}); daXoa.add(hienTai); }
    const r = await col.bulkWrite(lo.map((d) => ({
      replaceOne: { filter: { _id: d._id }, replacement: d, upsert: true },
    })), { ordered: false });
    const n = (r.upsertedCount || 0) + (r.modifiedCount || 0);
    ghi += n; theoCol[hienTai] = (theoCol[hienTai] || 0) + n;
    lo = [];
  };

  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    if (!manifest) {
      try {
        const j = JSON.parse(s);
        if (j && j.__manifest) {
          manifest = j.__manifest;
          if (manifest.kind !== 'leanwithai-learntools-backup') {
            console.error('LỖI: file này không phải bản sao lưu learntools'); process.exit(1);
          }
          console.log('Nguồn sao lưu : ' + o.in);
          console.log('Tạo lúc       : ' + manifest.createdAt);
          console.log('Nạp vào       : ' + URI.replace(/\/\/[^@]*@/, '//***@'));
          console.log('Chế độ        : ' + (o.dry ? 'CHẠY THỬ (không ghi gì)' : o.wipe ? 'XOÁ RỒI NẠP (--wipe)' : 'GỘP theo _id (mặc định)'));
          console.log('');
          continue;
        }
      } catch { /* không phải manifest → coi như file cũ không có dòng manifest */ }
      manifest = {};
    }
    let obj;
    try { obj = EJSON.parse(s); } catch { loi++; continue; }
    if (!obj || !obj.c || !obj.d) { loi++; continue; }
    if (o.only && !o.only.includes(obj.c)) continue;
    if (obj.c !== hienTai) { await xa(); hienTai = obj.c; }
    doc++;
    lo.push(obj.d);
    if (lo.length >= o.batch) await xa();
  }
  await xa();

  for (const [n, v] of Object.entries(theoCol)) {
    console.log('  ' + n.padEnd(26) + 'ghi ' + String(v).padStart(7) + ' bản ghi');
  }
  console.log('\nĐọc ' + doc + ' dòng · ghi ' + ghi + ' bản ghi'
    + (loi ? ' · ' + loi + ' dòng hỏng' : '')
    + (o.dry ? '\n(CHẠY THỬ — chưa ghi gì. Bỏ --dry để nạp thật.)' : ''));
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('LỖI: ' + e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
