// Rải các lô CÓ SẴN trong DB local vào các ô kho NGẪU NHIÊN để thử bản đồ kho (dữ liệu giả, chỉ để dev).
// Mỗi vị trí đi qua đúng hàm nghiệp vụ nhap() của utils/viTri.js nên Lo_ViTri và sổ ViTri_GiaoDich khớp nhau.
//
// Cách rải theo từng loại kệ (khớp bản demo ban-do-kho-3d.html):
//  - Kệ selective riêng : mỗi ô độc lập, tầng 1 đầy hơn tầng trên; thỉnh thoảng 1 ô chứa 2 lô, 1 lô nằm nhiều ô gần nhau.
//  - Drive-in (cột nhom): mỗi KỆ trong nhóm là 1 làn; làn xếp từ ô SÂU NHẤT (o = so_o) lùi dần ra phía lối vào (o = 1),
//    nên ô sát lối vào luôn là ô trống trước. Mỗi làn-tầng chứa 1 lô (làn cùng lô cho dễ lấy).
//  - Kệ sàn (loai_ke=san): mỗi cột o xếp từ sâu nhất (chieu_sau = max) lùi ra mặt lối đi (chieu_sau = 1); 1 cột có thể đổi sang lô khác giữa chừng.
//  - Vài ô để số lượng NULL (chưa biết).
//
// Dùng (trong BE/):  node scripts/seed-fake-vitri.js            (chỉ chạy nếu chưa có dữ liệu vị trí)
//                    node scripts/seed-fake-vitri.js --reset    (xóa Lo_ViTri + ViTri_GiaoDich rồi rải lại)
// KHÔNG chạy với DB cloud: script từ chối nếu .env có DATABASE_URL (Render/Neon = dữ liệu thật).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db');
const viTri = require('../utils/viTri');

if (process.env.DATABASE_URL) {
  console.error('TỪ CHỐI: .env đang trỏ DATABASE_URL (DB cloud / dữ liệu thật). Chạy "npm run use:local" rồi thử lại.');
  process.exit(1);
}

// Bộ số ngẫu nhiên cố định (mulberry32) -> chạy lại ra cùng kết quả
let seed = 20261111;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const p2 = (n) => String(n).padStart(2, '0');

async function main() {
  const layout = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'kho-layout.json'), 'utf8'));
  const dem = await pool.query('SELECT (SELECT COUNT(*) FROM Lo_ViTri) AS lv, (SELECT COUNT(*) FROM ViTri_GiaoDich) AS gd, (SELECT COUNT(*) FROM ViTriKho) AS o');
  const { lv, gd, o } = dem.rows[0];
  if (Number(o) === 0) throw new Error('Chưa có bảng ô ViTriKho - chạy migrations/009 + 010 trước');
  if (Number(lv) > 0 || Number(gd) > 0) {
    if (!process.argv.includes('--reset')) {
      throw new Error(`Đã có dữ liệu vị trí (${lv} dòng Lo_ViTri, ${gd} dòng sổ). Thêm --reset nếu muốn xóa và rải lại.`);
    }
    await pool.query('TRUNCATE ViTri_GiaoDich, Lo_ViTri RESTART IDENTITY');
    console.log('Đã xóa dữ liệu vị trí cũ (--reset).');
  }

  // Kho không phụ thuộc bảng Lo; script dev này chỉ MƯỢN danh sách (vật tư, số lô) có sẵn làm "kho tên" cho dữ liệu giả
  // (mỗi cặp 1 lần, bỏ trùng hoa/thường). so_luong_lo chỉ dùng để chọn cỡ số lượng cho giống thật.
  const loRes = await pool.query(
    `SELECT DISTINCT ON (ma_vat_tu, lower(btrim(so_lo))) ma_vat_tu, btrim(so_lo) AS so_lo, so_luong_lo
     FROM Lo ORDER BY ma_vat_tu, lower(btrim(so_lo)), id`
  );
  const lots = loRes.rows;
  if (!lots.length) throw new Error('DB local chưa có lô nào để mượn tên');

  // Người thực hiện: 1 admin / thủ kho có sẵn
  const nsRes = await pool.query("SELECT id FROM NhanSu WHERE vai_tro IN ('admin','thu_kho') ORDER BY id LIMIT 1");
  const nguoiId = nsRes.rows[0]?.id ?? null;

  // Lô "đang dùng": 70% khả năng dùng lại lô vừa chọn (ô lân cận cùng lô), còn lại chọn lô mới
  let current = pick(lots);
  const nextLot = (stick = 0.35) => {
    if (rnd() >= stick) current = pick(lots);
    return current;
  };
  const soLuongNgauNhien = (lot) => {
    if (rnd() < 0.05) return null; // chưa biết số
    const cap = Math.max(40, Math.min(300, Math.round(Number(lot.so_luong_lo) / 6) || 120));
    return ri(10, cap);
  };

  const plan = []; // { lo, ma_vi_tri, so_luong }
  const them = (lot, ma) => plan.push({ lo: lot, ma_vi_tri: ma, so_luong: soLuongNgauNhien(lot) });
  const maSelective = (k, o, t) => `${k.ma_ke}-O${p2(o)}-T${t}`;

  const thongKe = { selective: 0, driveIn: 0, san: 0 };
  for (const k of layout.ke) {
    if (k.loai_ke === 'san') {
      // Kệ sàn: mỗi (cột o, tầng t) xếp từ sâu nhất ra lối đi
      for (let t = 1; t <= k.so_tang; t++) {
        for (let o = 1; o <= k.so_o; o++) {
          const nFill = pick([0, 0, 1, 2, 3, 4, 5, 5]) % (k.chieu_sau + 1);
          let lot = nextLot(0.5);
          const doiLoTai = rnd() < 0.2 ? ri(1, Math.max(1, nFill - 1)) : 0; // đổi lô giữa chừng trong cột
          for (let i = 0; i < nFill; i++) {
            const s = k.chieu_sau - i; // sâu nhất trước
            if (doiLoTai && i === doiLoTai) lot = pick(lots);
            them(lot, `${k.ma_ke}-O${p2(o)}-S${s}-T${t}`);
            thongKe.san++;
          }
        }
      }
    } else if (k.nhom) {
      // Drive-in: kệ = làn. Mỗi làn-tầng chứa 1 lô, xếp từ ô sâu nhất (o = so_o) lùi ra lối vào (o = 1)
      for (let t = 1; t <= k.so_tang; t++) {
        const nFill = pick([0, 1, 2, 3, 3, 4, 4, 5, 5, 5]) * Math.ceil(k.so_o / 5);
        const lot = nextLot(0.4);
        for (let i = 0; i < Math.min(k.so_o, nFill); i++) {
          them(lot, maSelective(k, k.so_o - i, t));
          thongKe.driveIn++;
        }
      }
    } else {
      // Selective riêng: ô độc lập
      for (let t = 1; t <= k.so_tang; t++) {
        for (let o = 1; o <= k.so_o; o++) {
          if (rnd() >= (t === 1 ? 0.92 : 0.7)) continue;
          const lot = nextLot(0.45);
          them(lot, maSelective(k, o, t));
          thongKe.selective++;
          if (rnd() < 0.08) {
            // pallet ghép: thêm 1 lô khác vào CÙNG ô
            const lot2 = pick(lots);
            if (lot2 !== lot) {
              them(lot2, maSelective(k, o, t));
              thongKe.selective++;
            }
          }
        }
      }
    }
  }

  // Ghi qua nghiệp vụ nhap(): 1 transaction duy nhất, lỗi giữa chừng thì không để lại nửa vời
  await viTri.withTransaction(async (db) => {
    for (const p of plan) {
      await viTri.nhap(db, {
        maVatTu: p.lo.ma_vat_tu,
        soLo: p.lo.so_lo,
        maViTri: p.ma_vi_tri,
        soLuong: p.so_luong,
        nguoiId,
        ghiChu: 'Dữ liệu giả (seed-fake-vitri.js)',
      });
    }
  });

  const kq = await pool.query(
    `SELECT (SELECT COUNT(*) FROM Lo_ViTri) AS dong,
            (SELECT COUNT(DISTINCT vi_tri_id) FROM Lo_ViTri) AS o_co_hang,
            (SELECT COUNT(*) FROM (SELECT 1 FROM Lo_ViTri GROUP BY ma_vat_tu, lower(so_lo)) x) AS lo_da_xep,
            (SELECT COUNT(*) FROM ViTri_GiaoDich) AS so_giao_dich,
            (SELECT COUNT(*) FROM Lo_ViTri WHERE so_luong IS NULL) AS chua_biet_so,
            (SELECT COUNT(*) FROM (SELECT vi_tri_id FROM Lo_ViTri GROUP BY 1 HAVING COUNT(*) > 1) x) AS o_nhieu_lo,
            (SELECT COUNT(*) FROM (SELECT 1 FROM Lo_ViTri GROUP BY ma_vat_tu, lower(so_lo) HAVING COUNT(*) > 1) x) AS lo_nhieu_o`
  );
  console.log(`Đã rải: selective ${thongKe.selective}, drive-in ${thongKe.driveIn}, kệ sàn ${thongKe.san} lượt đặt.`);
  console.log('Kết quả:', kq.rows[0]);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Lỗi:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
