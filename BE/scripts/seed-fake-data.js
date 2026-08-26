// Tạo dữ liệu giả để test trực quan: nhân sự, gán loại/thủ kho cho vật tư, lô, loại lỗi, báo cáo
// trải dài nhiều ngày (tôn trọng ràng buộc tổng tong_lua không vượt so_luong_lo).
// CHỈ chạy trên DB đang trỏ tới (mặc định .env local) - không tự ý chạy lên production.
// Cách dùng: node scripts/seed-fake-data.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

const NHANVIEN = [
  { ho_ten: 'Nguyễn Văn An', username: 'annv' },
  { ho_ten: 'Trần Thị Bình', username: 'binhtt' },
  { ho_ten: 'Lê Văn Cường', username: 'cuonglv' },
  { ho_ten: 'Phạm Thị Dung', username: 'dungpt' },
  { ho_ten: 'Hoàng Văn Em', username: 'emhv' },
  { ho_ten: 'Vũ Thị Phương', username: 'phuongvt' },
  { ho_ten: 'Đặng Văn Giang', username: 'giangdv' },
];
const FAKE_PASSWORD = '123456';

const LOAI_VAT_TU = ['Nhãn/Tem', 'Bao bì giấy', 'Bao bì nhựa', 'Vỏ chai/lọ', 'Phụ liệu đóng gói', 'Băng keo/Decal'];
const THU_KHO = ['Nguyễn Thị Kho', 'Trần Văn Thủ', 'Lê Thị Giữ'];
const LOAI_LOI_MAU = ['Lem mực', 'Rách góc', 'Sai kích thước', 'Lệch tâm', 'Mờ chữ', 'Trầy xước', 'Sai màu', 'Bong keo'];

const SO_VAT_TU_GAN_LOAI = 300; // so vat tu duoc gan loai/thu kho ngau nhien
const SO_VAT_TU_HOAT_DONG = 20; // so vat tu duoc tao lo + bao cao that

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randSample(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function toDateStr(d) {
  return d.toISOString().substring(0, 10);
}
function toTimeStr(hour, minute = 0) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

async function main() {
  const today = new Date();

  console.log('1. Tạo nhân viên...');
  const nhanSuIds = [];
  for (const nv of NHANVIEN) {
    const existed = await pool.query('SELECT id FROM NhanSu WHERE username = $1', [nv.username]);
    if (existed.rows[0]) {
      nhanSuIds.push(existed.rows[0].id);
      continue;
    }
    const hashed = await bcrypt.hash(FAKE_PASSWORD, 10);
    const result = await pool.query(
      `INSERT INTO NhanSu (ho_ten, username, password, vai_tro) VALUES ($1, $2, $3, 'nhan_vien') RETURNING id`,
      [nv.ho_ten, nv.username, hashed]
    );
    nhanSuIds.push(result.rows[0].id);
  }
  console.log(`   -> ${nhanSuIds.length} nhân viên (mật khẩu chung: "${FAKE_PASSWORD}")`);

  console.log('2. Gán "loại" + "thủ kho" cho một số vật tư...');
  const allVatTu = await pool.query('SELECT ma_vat_tu FROM VatTu ORDER BY ma_vat_tu');
  const vatTuCodes = allVatTu.rows.map((r) => r.ma_vat_tu);
  const chosenForLoai = randSample(vatTuCodes, Math.min(SO_VAT_TU_GAN_LOAI, vatTuCodes.length));
  for (const ma of chosenForLoai) {
    await pool.query('UPDATE VatTu SET loai = $1, thu_kho = $2 WHERE ma_vat_tu = $3', [
      rand(LOAI_VAT_TU),
      rand(THU_KHO),
      ma,
    ]);
  }
  console.log(`   -> đã gán loại/thủ kho cho ${chosenForLoai.length} vật tư`);

  console.log('3. Tạo lô + loại lỗi + báo cáo cho vật tư "đang hoạt động"...');
  // Uu tien chon trong so vua duoc gan loai, de test bo loc loai xuyen suot
  const activeVatTu = randSample(chosenForLoai, Math.min(SO_VAT_TU_HOAT_DONG, chosenForLoai.length));

  let tongLo = 0;
  let tongLoaiLoi = 0;
  let tongBaoCao = 0;

  for (const maVatTu of activeVatTu) {
    // moi vat tu co 2-3 lo, ngay san xuat rai trong 90 ngay qua
    const soLo = randInt(2, 3);
    const loaiLoiChoVatTu = randSample(LOAI_LOI_MAU, randInt(2, 4));
    const loaiLoiIds = [];
    for (const tenLoi of loaiLoiChoVatTu) {
      const r = await pool.query(
        'INSERT INTO LoaiLoi (ma_vat_tu, ten_loi) VALUES ($1, $2) RETURNING id',
        [maVatTu, tenLoi]
      );
      loaiLoiIds.push(r.rows[0].id);
      tongLoaiLoi++;
    }

    for (let i = 0; i < soLo; i++) {
      const ngaySanXuat = addDays(today, -randInt(15, 90));
      const soLuongLo = randInt(300, 3000);
      const soLoStr = `L${ngaySanXuat.getFullYear()}${String(ngaySanXuat.getMonth() + 1).padStart(2, '0')}-${randInt(100, 999)}`;

      const loResult = await pool.query(
        'INSERT INTO Lo (so_lo, ma_vat_tu, ngay_san_xuat, so_luong_lo) VALUES ($1, $2, $3, $4) RETURNING id',
        [soLoStr, maVatTu, toDateStr(ngaySanXuat), soLuongLo]
      );
      const loId = loResult.rows[0].id;
      tongLo++;

      // Sinh nhieu bao cao lua dan trong lo nay, khong vuot so_luong_lo.
      // Chi lap day 60-95% de con "con lai" thuc te tren dashboard/tien do.
      const target = Math.floor(soLuongLo * (0.6 + Math.random() * 0.35));
      let filled = 0;
      let ngayLua = addDays(ngaySanXuat, randInt(1, 4));
      let guard = 0;

      while (filled < target && guard < 15) {
        guard++;
        const remaining = target - filled;
        const chunk = Math.min(remaining, randInt(30, 200));
        const huBoPct = 0.02 + Math.random() * 0.08; // 2-10% hư bỏ
        const huBo = Math.round(chunk * huBoPct);
        const dat = chunk - huBo;

        const gioBatDau = rand([7, 8, 13]);
        const soGioLam = randInt(3, 8);
        const gioKetThuc = Math.min(gioBatDau + soGioLam, 20);

        const nguoiNhapId = rand(nhanSuIds);
        const soNguoiThamGia = randInt(1, 3);
        const nhanSuThamGia = new Set([nguoiNhapId, ...randSample(nhanSuIds, soNguoiThamGia - 1)]);

        const coLoi = Math.random() < 0.35;
        const loiNguoiDung = coLoi ? rand(loaiLoiChoVatTu) : null;
        const daGanLoiChuan = coLoi && loaiLoiIds.length && Math.random() < 0.6;
        const loiChuanId = daGanLoiChuan
          ? loaiLoiIds[loaiLoiChoVatTu.indexOf(loiNguoiDung) >= 0 ? loaiLoiChoVatTu.indexOf(loiNguoiDung) : 0]
          : null;

        const baoCaoResult = await pool.query(
          `INSERT INTO BaoCao (ngay, lo_id, dat, hu_bo, tg_bat_dau, tg_ket_thuc, nguoi_nhap_id, loi_nguoi_dung, loi_chuan_id, la_lua_lai, ghi_chu)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10) RETURNING id`,
          [
            toDateStr(ngayLua),
            loId,
            dat,
            huBo,
            toTimeStr(gioBatDau),
            toTimeStr(gioKetThuc),
            nguoiNhapId,
            loiNguoiDung,
            loiChuanId,
            Math.random() < 0.15 ? 'Ca chiều tăng ca' : null,
          ]
        );
        const baoCaoId = baoCaoResult.rows[0].id;
        tongBaoCao++;

        for (const nsId of nhanSuThamGia) {
          await pool.query('INSERT INTO BaoCao_NhanSu (baocao_id, nhansu_id) VALUES ($1, $2)', [
            baoCaoId,
            nsId,
          ]);
        }

        filled += chunk;
        ngayLua = addDays(ngayLua, randInt(0, 2));
        if (ngayLua > today) break;
      }

      // Thinh thoang them 1 bao cao "lua lai" (khong tinh vao so_luong_lo) de test rieng loai nay
      if (Math.random() < 0.4) {
        const ngayLuaLai = addDays(ngaySanXuat, randInt(5, 20));
        if (ngayLuaLai <= today) {
          const chunk = randInt(20, 80);
          const huBo = Math.round(chunk * 0.3); // lua lai thuong ty le hu bo cao hon
          const dat = chunk - huBo;
          const nguoiNhapId = rand(nhanSuIds);

          const baoCaoResult = await pool.query(
            `INSERT INTO BaoCao (ngay, lo_id, dat, hu_bo, tg_bat_dau, tg_ket_thuc, nguoi_nhap_id, la_lua_lai, ghi_chu)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 'Lựa lại hàng hư bỏ đợt trước') RETURNING id`,
            [toDateStr(ngayLuaLai), loId, dat, huBo, toTimeStr(8), toTimeStr(11), nguoiNhapId]
          );
          await pool.query('INSERT INTO BaoCao_NhanSu (baocao_id, nhansu_id) VALUES ($1, $2)', [
            baoCaoResult.rows[0].id,
            nguoiNhapId,
          ]);
          tongBaoCao++;
        }
      }
    }
  }

  console.log(`   -> ${tongLo} lô, ${tongLoaiLoi} loại lỗi, ${tongBaoCao} báo cáo`);
  console.log('\nHoàn tất tạo dữ liệu giả.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
