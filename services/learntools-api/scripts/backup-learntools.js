#!/usr/bin/env node
/**
 * SAO LƯU toàn bộ dữ liệu học: từ vựng + mọi tiến trình của người dùng.
 *
 *   node src/scripts/backup-learntools.js                      → sao lưu TẤT CẢ
 *   node src/scripts/backup-learntools.js --out D:/backup      → chọn chỗ lưu
 *   node src/scripts/backup-learntools.js --only vocabs,reviewlogs
 *   node src/scripts/backup-learntools.js --user cb5981d5      → chỉ 1 người dùng
 *   node src/scripts/backup-learntools.js --no-gzip            → để xem bằng mắt
 *   node src/scripts/backup-learntools.js --file                → gộp TẤT CẢ vào MỘT file
 *   node src/scripts/backup-learntools.js --file D:/bk/hoc.lwbak.gz
 *
 * CHẾ ĐỘ MỘT FILE (--file): tiện khi cần đem đi — chép sang server, đẩy lên Drive, gửi qua
 * chat. Một file duy nhất thay vì thư mục 21 file.
 * Định dạng vẫn là NDJSON + EJSON như trên, chỉ khác: dòng ĐẦU là manifest, mỗi dòng sau là
 * `{"c":"<tên collection>","d":<bản ghi>}`. Vẫn đọc/ghi theo dòng nên file lớn bao nhiêu
 * cũng chạy được, không phải nạp hết vào RAM.
 *
 * ĐỊNH DẠNG: mỗi collection một file NDJSON (mỗi dòng một bản ghi) + `manifest.json`.
 *
 * Vì sao NDJSON chứ không phải một mảng JSON khổng lồ: dictionaryentries có 109.713 bản ghi /
 * 136 MB. Một mảng JSON thì phải nạp hết vào RAM mới parse được; NDJSON đọc/ghi theo dòng nên
 * dung lượng bao nhiêu cũng chạy được.
 *
 * Vì sao EJSON (Extended JSON) chứ không phải JSON thường: JSON thường làm MẤT KIỂU —
 * `_id` thành chuỗi và `next_review_at` thành chuỗi. Phục hồi bằng dữ liệu đó thì SRS hỏng
 * hoàn toàn: mọi so sánh ngày (`next_review_at <= now`) đều sai, và `_id` mới sẽ không khớp
 * các bảng tham chiếu. EJSON giữ nguyên `{"$oid":…}` / `{"$date":…}`.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leanwithai';

// Trường chứa người dùng, theo từng collection. Dùng cho --user. Collection nào không có tên ở
// đây thì KHÔNG lọc theo người dùng được (vd dictionaryentries là kho dùng chung) — khi có
// --user thì chúng vẫn được sao lưu NGUYÊN VẸN, vì thiếu chúng là thẻ mất nghĩa.
const TRUONG_USER = {
  vocabs: 'user_id',
  reviewlogs: 'user_id',
  ankireviews: 'user_id',
  bookmarkedcards: 'user_id',
  userstats: 'user_id',
  learnerprofiles: 'user_id',
  sprints: 'user_id',
  sprinttopics: 'user_id',
  vocalnotes: 'user_id',
  immersionlogs: 'user_id',
  mininghistories: 'user_id',
  homeworkassignments: 'user_id',
  aihomeworksessions: 'user_id',
  speechprofiles: 'user_id',
  adaptiverecommendations: 'user_id',
};

function docThamSo(argv) {
  const o = { out: '', only: null, user: '', gzip: true, file: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i];
    else if (a === '--only') o.only = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--user') o.user = argv[++i];
    else if (a === '--no-gzip') o.gzip = false;
    else if (a === '--file') { o.file = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; }
    else if (a === '--help' || a === '-h') o.help = true;
  }
  return o;
}

async function main() {
  const o = docThamSo(process.argv);
  if (o.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, ''));
    process.exit(0);
  }

  const moc = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const motFile = o.file
    ? (typeof o.file === 'string' ? o.file
      : path.join(o.out || path.join(__dirname, '..', '..', 'backups'),
        'learntools-' + moc + '.lwbak' + (o.gzip ? '.gz' : '')))
    : null;
  const thuMuc = motFile ? path.dirname(motFile)
    : (o.out || path.join(__dirname, '..', '..', 'backups', 'learntools-' + moc));
  fs.mkdirSync(thuMuc, { recursive: true });

  await mongoose.connect(URI, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  let ten = (await db.listCollections().toArray()).map((c) => c.name).sort();
  if (o.only) ten = ten.filter((n) => o.only.includes(n));

  console.log('Sao lưu từ : ' + URI);
  console.log(motFile ? 'Ra MỘT file: ' + motFile : 'Ra thư mục : ' + thuMuc);
  if (o.user) console.log('Chỉ người dùng: ' + o.user + '  (kho dùng chung vẫn sao lưu đầy đủ)');
  console.log('');

  const manifest = {
    kind: 'leanwithai-learntools-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    sourceUri: URI.replace(/\/\/[^@]*@/, '//***@'),   // không ghi mật khẩu vào file
    userFilter: o.user || null,
    gzip: o.gzip,
    collections: [],
  };

  let tongBanGhi = 0, tongByte = 0;

  // Đếm trước để manifest (nằm ở DÒNG ĐẦU của file) có đủ số liệu — người đọc file biết ngay
  // trong đó có gì mà không phải quét hết.
  const danhSach = [];
  for (const n of ten) {
    const loc = (o.user && TRUONG_USER[n]) ? { [TRUONG_USER[n]]: o.user } : {};
    const c = await db.collection(n).countDocuments(loc);
    if (c) danhSach.push({ name: n, count: c, loc });
  }

  if (motFile) {
    manifest.singleFile = true;
    manifest.collections = danhSach.map((x) => ({ name: x.name, count: x.count }));
    async function* dong() {
      // Dòng 1 = manifest. Mỗi dòng sau = { c: tên collection, d: bản ghi }.
      yield JSON.stringify({ __manifest: manifest }) + '\n';
      for (const x of danhSach) {
        const cursor = db.collection(x.name).find(x.loc, { noCursorTimeout: false });
        let i = 0;
        for await (const d of cursor) { yield EJSON.stringify({ c: x.name, d }) + '\n'; i++; }
        tongBanGhi += i;
        console.log('  ' + x.name.padEnd(26) + String(i).padStart(7) + ' bản ghi');
      }
    }
    const nguon = Readable.from(dong());
    if (o.gzip) await pipeline(nguon, zlib.createGzip({ level: 1 }), fs.createWriteStream(motFile));
    else await pipeline(nguon, fs.createWriteStream(motFile));
    tongByte = fs.statSync(motFile).size;
    console.log('\nTổng: ' + tongBanGhi + ' bản ghi · ' + (tongByte / 1048576).toFixed(1) + ' MB'
      + ' · ' + danhSach.length + ' collection · MỘT file');
    console.log('Phục hồi: node src/scripts/restore-learntools.js --in "' + motFile + '"');
    await mongoose.disconnect();
    return;
  }

  for (const x of danhSach) {
    const n = x.name;
    const col = db.collection(n);
    const tep = path.join(thuMuc, n + '.ndjson' + (o.gzip ? '.gz' : ''));
    const cursor = col.find(x.loc, { noCursorTimeout: false });

    // Đọc theo con trỏ và đẩy thẳng ra stream — KHÔNG gom hết vào RAM.
    async function* dong() {
      for await (const d of cursor) yield EJSON.stringify(d) + '\n';
    }
    const nguon = Readable.from(dong());
    if (o.gzip) await pipeline(nguon, zlib.createGzip({ level: 1 }), fs.createWriteStream(tep));
    else await pipeline(nguon, fs.createWriteStream(tep));

    const byte = fs.statSync(tep).size;
    tongBanGhi += x.count; tongByte += byte;
    manifest.collections.push({ name: n, count: x.count, file: path.basename(tep), bytes: byte });
    console.log('  ' + n.padEnd(26) + String(x.count).padStart(7) + ' bản ghi → ' + (byte / 1048576).toFixed(2) + ' MB');
  }

  fs.writeFileSync(path.join(thuMuc, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\nTổng: ' + tongBanGhi + ' bản ghi · ' + (tongByte / 1048576).toFixed(1) + ' MB'
    + ' · ' + manifest.collections.length + ' collection');
  console.log('Phục hồi: node src/scripts/restore-learntools.js --in "' + thuMuc + '"');
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('LỖI: ' + e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
