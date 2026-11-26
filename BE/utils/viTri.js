// Logic nhập / xuất / chuyển / điều chỉnh lô vào ra các ô kho (bảng Lo_ViTri + sổ ViTri_GiaoDich).
// DB chỉ thuần bảng (chỉ chặn số lượng âm); MỌI quy tắc nằm ở đây. Dùng chung cho routes/vitri.routes.js
// và scripts/seed-fake-vitri.js để dữ liệu seed đi qua đúng đường nghiệp vụ như người dùng thật.
//
// KHO ĐỘC LẬP VỚI PHẦN LỰA: một "lô" ở kho được nhận diện bằng cặp (ma_vat_tu, so_lo) tự lưu trong Lo_ViTri /
// ViTri_GiaoDich - KHÔNG có khóa ngoại và KHÔNG đọc/ghi bảng Lo hay BaoCao. Cặp so khớp bỏ qua hoa/thường và khoảng
// trắng đầu/cuối của so_lo. Số lượng trong kho cũng độc lập với số lượng lô bên lựa. Chỉ khi NHẬP mới tra danh mục
// VatTu (chỉ ĐỌC) để chặn gõ sai mã vật tư.
//
// Quy ước số lượng: NULL = "chưa biết" (cho phép). Các hàm nhận `db` là 1 client ĐANG TRONG transaction
// (route mở BEGIN/COMMIT, xem withTransaction) - hàm ở đây không tự BEGIN/COMMIT.
//
//  nhap       : đặt lô vào ô. Chưa có dòng -> tạo. Đã có -> cộng dồn
//               (có số + có số = tổng; ô đang NULL + số mới = số mới; thêm "không rõ số" vào ô đã có số = giữ nguyên).
//  xuat       : lấy lô ra khỏi ô. so_luong NULL = lấy hết (xóa dòng). Có số: trừ; trừ về 0 thì xóa dòng;
//               lấy quá số đang có -> 400 (không để âm). Ô đang NULL (chưa biết) + lấy 1 số cụ thể -> giữ NULL.
//  chuyen     : xuat ở A + nhap ở B trong cùng transaction, 2 dòng sổ chuyen_di / chuyen_den chung nhom_id.
//  dieu_chinh : đặt lại số lượng của dòng đã có (NULL = chưa biết, 0 = xóa dòng). Sổ ghi SỐ LƯỢNG MỚI.
const crypto = require('crypto');
const pool = require('../db');
const AppError = require('./AppError');

const MAX_SO_LUONG = 9999999999.99; // NUMERIC(12,2)

// Chạy fn(client) trong 1 transaction, tự COMMIT / ROLLBACK.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------- Kiểm tra dữ liệu vào ----------

// Mã vật tư: chuỗi không rỗng, tối đa 20 ký tự (đúng độ dài cột).
function parseMaVatTu(v) {
  if (typeof v !== 'string' || !v.trim()) throw new AppError(400, 'Thiếu ma_vat_tu');
  const s = v.trim();
  if (s.length > 20) throw new AppError(400, 'ma_vat_tu tối đa 20 ký tự');
  return s;
}

// Số lô: không rỗng, cắt khoảng trắng 2 đầu (khớp migration 011 và cách so sánh lower(so_lo)). Cho phép gửi dạng số.
function parseSoLo(v) {
  if (typeof v !== 'string' && typeof v !== 'number') throw new AppError(400, 'Thiếu so_lo');
  const s = String(v).trim();
  if (!s) throw new AppError(400, 'Thiếu so_lo');
  if (s.length > 50) throw new AppError(400, 'so_lo tối đa 50 ký tự');
  return s;
}

function parseMaViTri(v, ten = 'ma_vi_tri') {
  if (typeof v !== 'string' || !v.trim()) throw new AppError(400, `Thiếu ${ten}`);
  return v.trim().toUpperCase();
}

// undefined / null / '' -> null (chưa biết). Có giá trị: phải là số hữu hạn, không âm, không quá cột NUMERIC(12,2).
// batBuocDuong: true -> phải > 0 (nhap/xuat/chuyen); false -> cho phép 0 (dieu_chinh).
function parseSoLuong(v, { batBuocDuong }) {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) throw new AppError(400, 'so_luong không phải số hợp lệ');
  if (n < 0) throw new AppError(400, 'so_luong không được âm');
  if (batBuocDuong && n === 0) throw new AppError(400, 'so_luong phải lớn hơn 0');
  if (n > MAX_SO_LUONG) throw new AppError(400, 'so_luong quá lớn');
  return Math.round(n * 100) / 100;
}

function parseGhiChu(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new AppError(400, 'ghi_chu phải là chuỗi');
  const s = v.trim();
  if (s.length > 500) throw new AppError(400, 'ghi_chu tối đa 500 ký tự');
  return s || null;
}

// ---------- Truy vấn nhỏ ----------

async function layViTri(db, maViTri) {
  const r = await db.query('SELECT id, ma_vi_tri FROM ViTriKho WHERE ma_vi_tri = $1', [maViTri]);
  if (!r.rows[0]) throw new AppError(404, `Không có ô "${maViTri}" trong kho`);
  return r.rows[0];
}

// Chỉ dùng khi NHẬP: mã vật tư phải có trong danh mục VatTu (chỉ đọc, chặn gõ sai). Trả mã đúng chuẩn của danh mục
// (gõ "gn01" ra "GN01"). Xuất / chuyển / điều chỉnh không cần: lô đã nằm sẵn trong ô thì đã qua bước này.
async function layMaVatTuChuan(db, maVatTu) {
  const r = await db.query('SELECT ma_vat_tu FROM VatTu WHERE upper(ma_vat_tu) = upper($1)', [maVatTu]);
  if (!r.rows[0]) throw new AppError(400, `Mã vật tư "${maVatTu}" không có trong danh mục vật tư`);
  return r.rows[0].ma_vat_tu;
}

// Khóa theo lô (vật tư + số lô): 2 thao tác cùng lúc trên cùng 1 lô xếp hàng nhau, không ghi đè nhau.
function khoaLo(db, lo) {
  return db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lo_vitri|${lo.maVatTu}|${lo.soLo.toLowerCase()}`]);
}

async function layDong(db, lo, viTriId) {
  const r = await db.query(
    `SELECT id, so_luong FROM Lo_ViTri
     WHERE ma_vat_tu = $1 AND lower(so_lo) = lower($2) AND vi_tri_id = $3 FOR UPDATE`,
    [lo.maVatTu, lo.soLo, viTriId]
  );
  if (!r.rows[0]) return null;
  return { id: r.rows[0].id, so_luong: r.rows[0].so_luong === null ? null : Number(r.rows[0].so_luong) };
}

function ghiGiaoDich(db, lo, { viTriId, thaoTac, nhomId = null, soLuong, nguoiId, ghiChu }) {
  return db.query(
    `INSERT INTO ViTri_GiaoDich (ma_vat_tu, so_lo, vi_tri_id, thao_tac, nhom_id, so_luong, nguoi_thuc_hien_id, ghi_chu)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [lo.maVatTu, lo.soLo, viTriId, thaoTac, nhomId, soLuong, nguoiId ?? null, ghiChu]
  );
}

// ---------- Thao tác lõi (chưa ghi sổ) ----------

// Cộng `soLuong` vào ô. Trả về { so_luong } sau khi cộng.
async function congVaoO(db, lo, viTriId, soLuong) {
  const dong = await layDong(db, lo, viTriId);
  if (!dong) {
    await db.query('INSERT INTO Lo_ViTri (ma_vat_tu, so_lo, vi_tri_id, so_luong) VALUES ($1, $2, $3, $4)', [
      lo.maVatTu,
      lo.soLo,
      viTriId,
      soLuong,
    ]);
    return { so_luong: soLuong };
  }
  let moi;
  if (soLuong === null) moi = dong.so_luong; // thêm "không rõ số": giữ nguyên
  else if (dong.so_luong === null) moi = soLuong; // ô đang "chưa biết" + số mới = số mới
  else moi = Math.round((dong.so_luong + soLuong) * 100) / 100;
  if (moi > MAX_SO_LUONG) throw new AppError(400, 'Số lượng trong ô sau khi cộng quá lớn');
  await db.query('UPDATE Lo_ViTri SET so_luong = $1, cap_nhat_luc = NOW() WHERE id = $2', [moi, dong.id]);
  return { so_luong: moi };
}

// Lấy `soLuong` ra khỏi ô (null = lấy hết). Trả về { lay, con_lai, da_xoa }:
//  lay = số lượng thực sự lấy ra để ghi sổ (null nếu không biết), con_lai = số còn trong ô (null = chưa biết).
async function truRaKhoiO(db, lo, viTriId, soLuong, maViTri) {
  const dong = await layDong(db, lo, viTriId);
  if (!dong) throw new AppError(404, `Lô ${lo.soLo} (${lo.maVatTu}) không có trong ô ${maViTri}`);

  if (soLuong === null) {
    await db.query('DELETE FROM Lo_ViTri WHERE id = $1', [dong.id]);
    return { lay: dong.so_luong, con_lai: 0, da_xoa: true };
  }
  if (dong.so_luong === null) {
    // ô "chưa biết" số: ghi nhận có lấy ra nhưng không tính ra được số còn lại
    await db.query('UPDATE Lo_ViTri SET cap_nhat_luc = NOW() WHERE id = $1', [dong.id]);
    return { lay: soLuong, con_lai: null, da_xoa: false };
  }
  if (soLuong > dong.so_luong) {
    throw new AppError(400, `Ô ${maViTri} chỉ có ${dong.so_luong}, không thể lấy ra ${soLuong}`, {
      code: 'VUOT_SO_LUONG_TRONG_O',
      details: { ma_vi_tri: maViTri, dang_co: dong.so_luong, muon_lay: soLuong },
    });
  }
  const conLai = Math.round((dong.so_luong - soLuong) * 100) / 100;
  if (conLai === 0) {
    await db.query('DELETE FROM Lo_ViTri WHERE id = $1', [dong.id]);
    return { lay: soLuong, con_lai: 0, da_xoa: true };
  }
  await db.query('UPDATE Lo_ViTri SET so_luong = $1, cap_nhat_luc = NOW() WHERE id = $2', [conLai, dong.id]);
  return { lay: soLuong, con_lai: conLai, da_xoa: false };
}

// ---------- 4 nghiệp vụ (db = client đang trong transaction) ----------
// Lô truyền vào là { maVatTu, soLo } đã qua parseMaVatTu / parseSoLo.

async function nhap(db, { maVatTu, soLo, maViTri, soLuong, nguoiId, ghiChu }) {
  const lo = { maVatTu: await layMaVatTuChuan(db, maVatTu), soLo };
  const vt = await layViTri(db, maViTri);
  await khoaLo(db, lo);
  const kq = await congVaoO(db, lo, vt.id, soLuong);
  await ghiGiaoDich(db, lo, { viTriId: vt.id, thaoTac: 'nhap', soLuong, nguoiId, ghiChu });
  return {
    thao_tac: 'nhap',
    ma_vat_tu: lo.maVatTu,
    so_lo: lo.soLo,
    vi_tri: [{ ma_vi_tri: vt.ma_vi_tri, so_luong: kq.so_luong }],
  };
}

async function xuat(db, { maVatTu, soLo, maViTri, soLuong, nguoiId, ghiChu }) {
  const lo = { maVatTu, soLo };
  const vt = await layViTri(db, maViTri);
  await khoaLo(db, lo);
  const kq = await truRaKhoiO(db, lo, vt.id, soLuong, vt.ma_vi_tri);
  await ghiGiaoDich(db, lo, { viTriId: vt.id, thaoTac: 'xuat', soLuong: kq.lay, nguoiId, ghiChu });
  return {
    thao_tac: 'xuat',
    ma_vat_tu: lo.maVatTu,
    so_lo: lo.soLo,
    vi_tri: [{ ma_vi_tri: vt.ma_vi_tri, so_luong: kq.con_lai, da_xoa: kq.da_xoa }],
  };
}

async function chuyen(db, { maVatTu, soLo, tuViTri, denViTri, soLuong, nguoiId, ghiChu }) {
  if (tuViTri === denViTri) throw new AppError(400, 'Ô đi và ô đến phải khác nhau');
  const lo = { maVatTu, soLo };
  const tu = await layViTri(db, tuViTri);
  const den = await layViTri(db, denViTri);
  await khoaLo(db, lo);
  const nhomId = crypto.randomUUID();
  const ra = await truRaKhoiO(db, lo, tu.id, soLuong, tu.ma_vi_tri);
  const vao = await congVaoO(db, lo, den.id, ra.lay);
  await ghiGiaoDich(db, lo, { viTriId: tu.id, thaoTac: 'chuyen_di', nhomId, soLuong: ra.lay, nguoiId, ghiChu });
  await ghiGiaoDich(db, lo, { viTriId: den.id, thaoTac: 'chuyen_den', nhomId, soLuong: ra.lay, nguoiId, ghiChu });
  return {
    thao_tac: 'chuyen',
    ma_vat_tu: lo.maVatTu,
    so_lo: lo.soLo,
    nhom_id: nhomId,
    vi_tri: [
      { ma_vi_tri: tu.ma_vi_tri, so_luong: ra.con_lai, da_xoa: ra.da_xoa },
      { ma_vi_tri: den.ma_vi_tri, so_luong: vao.so_luong },
    ],
  };
}

async function dieuChinh(db, { maVatTu, soLo, maViTri, soLuong, nguoiId, ghiChu }) {
  const lo = { maVatTu, soLo };
  const vt = await layViTri(db, maViTri);
  await khoaLo(db, lo);
  const dong = await layDong(db, lo, vt.id);
  if (!dong) throw new AppError(404, `Lô ${lo.soLo} (${lo.maVatTu}) không có trong ô ${vt.ma_vi_tri} - hãy dùng "nhập" để đặt vào ô`);
  let daXoa = false;
  if (soLuong === 0) {
    await db.query('DELETE FROM Lo_ViTri WHERE id = $1', [dong.id]);
    daXoa = true;
  } else {
    await db.query('UPDATE Lo_ViTri SET so_luong = $1, cap_nhat_luc = NOW() WHERE id = $2', [soLuong, dong.id]);
  }
  await ghiGiaoDich(db, lo, { viTriId: vt.id, thaoTac: 'dieu_chinh', soLuong, nguoiId, ghiChu });
  return {
    thao_tac: 'dieu_chinh',
    ma_vat_tu: lo.maVatTu,
    so_lo: lo.soLo,
    vi_tri: [{ ma_vi_tri: vt.ma_vi_tri, so_luong: soLuong, da_xoa: daXoa }],
  };
}

module.exports = {
  withTransaction,
  parseMaVatTu,
  parseSoLo,
  parseMaViTri,
  parseSoLuong,
  parseGhiChu,
  nhap,
  xuat,
  chuyen,
  dieuChinh,
};
