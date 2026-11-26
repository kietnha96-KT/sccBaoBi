const express = require('express');
const pool = require('../db');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { buildOrderBy } = require('../utils/sort');
const viTri = require('../utils/viTri');

const router = express.Router();
router.use(authenticateToken);

// ĐỌC: mọi người dùng đã đăng nhập (nhân viên lựa cũng cần biết lô nằm ở đâu).
// GHI (nhap/xuat/chuyen/dieu-chinh): admin hoặc thu_kho (requireStaff) - FE ẩn nút theo cùng quy tắc.

// GET /api/vi-tri - danh mục ô, kèm tóm tắt hàng đang chứa. Lọc: ke, nhom, khu, tang, q (mã ô), co_hang=1
// (chỉ ô có hàng), ma_vat_tu (ô chứa vật tư này). Không phân trang: toàn kho chỉ ~2.570 ô và bản đồ cần đủ.
// gon=1: CHẾ ĐỘ GỌN cho bản đồ 3D - chỉ trả 3 thứ bản đồ dùng (mã ô, số lô trong ô, số lô đầu) dạng mảng, tên cột nằm 1 lần ở `cot`:
//   { cot: ['ma_vi_tri','so_lo_trong_o','so_lo_dau'], data: [['K05-O03-T2', 1, '26001'], ...], total }
// Vị trí / tầng / độ sâu... bản đồ tự có từ file layout nên không gửi lại (nhỏ hơn ~90% so với dạng đầy đủ). Bỏ gon = như cũ.
router.get('/', async (req, res) => {
  const { ke, nhom, khu, tang, q, co_hang, ma_vat_tu } = req.query;
  const gon = req.query.gon === '1' || req.query.gon === 'true';
  const conditions = [];
  const params = [];
  if (ke) {
    params.push(String(ke).toUpperCase());
    conditions.push(`v.ke = $${params.length}`);
  }
  if (nhom) {
    params.push(nhom);
    conditions.push(`v.nhom = $${params.length}`);
  }
  if (khu) {
    params.push(khu);
    conditions.push(`v.khu = $${params.length}`);
  }
  if (tang !== undefined && tang !== '') {
    const t = Number(tang);
    if (!Number.isInteger(t)) throw new AppError(400, 'tang không hợp lệ');
    params.push(t);
    conditions.push(`v.tang = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`v.ma_vi_tri ILIKE $${params.length}`);
  }
  if (co_hang === '1' || co_hang === 'true') conditions.push('s.so_lo > 0');
  if (ma_vat_tu) {
    params.push(ma_vat_tu);
    conditions.push(
      `EXISTS (SELECT 1 FROM Lo_ViTri x WHERE x.vi_tri_id = v.id AND x.ma_vat_tu = $${params.length})`
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  if (gon) {
    const g = await pool.query(
      `SELECT v.ma_vi_tri, COALESCE(s.so_lo, 0) AS so_lo_trong_o, s.so_lo_dau
       FROM ViTriKho v
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS so_lo,
                (ARRAY_AGG(lv.so_lo ORDER BY lv.cap_nhat_luc DESC, lv.id DESC))[1] AS so_lo_dau
         FROM Lo_ViTri lv
         WHERE lv.vi_tri_id = v.id
       ) s ON TRUE
       ${where}`,
      params
    );
    return res.json({
      cot: ['ma_vi_tri', 'so_lo_trong_o', 'so_lo_dau'],
      data: g.rows.map((r) => [r.ma_vi_tri, r.so_lo_trong_o, r.so_lo_dau]),
      total: g.rows.length,
    });
  }

  const result = await pool.query(
    `SELECT v.id, v.ma_vi_tri, v.khu, v.ke, v.loai_ke, v.nhom, v.o, v.chieu_sau, v.tang,
            COALESCE(s.so_lo, 0) AS so_lo_trong_o,
            s.tong_so_luong, s.co_so_luong_chua_biet, s.ma_vat_tu, s.so_lo_dau
     FROM ViTriKho v
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS so_lo,
              SUM(lv.so_luong) AS tong_so_luong,
              BOOL_OR(lv.so_luong IS NULL) AS co_so_luong_chua_biet,
              (ARRAY_AGG(lv.ma_vat_tu ORDER BY lv.cap_nhat_luc DESC, lv.id DESC))[1] AS ma_vat_tu,
              (ARRAY_AGG(lv.so_lo ORDER BY lv.cap_nhat_luc DESC, lv.id DESC))[1] AS so_lo_dau
       FROM Lo_ViTri lv
       WHERE lv.vi_tri_id = v.id
     ) s ON TRUE
     ${where}
     ORDER BY v.ke, v.o, v.tang, v.chieu_sau`,
    params
  );
  res.json({ data: result.rows, total: result.rows.length });
});

// GET /api/vi-tri/goi-y?q=&limit= - gợi ý mã ô cho ô tìm kiếm (K53, K53-O02, S1-O10-T2...): các ô ĐÃ CÓ trong danh mục
// mà mã chứa q (không phân biệt hoa/thường), mã bắt đầu bằng q xếp trước, rồi theo kệ / ô / tầng / độ sâu.
// Trả { data: [mã ô...], total } - total = tổng số ô khớp (để FE báo "còn N ô khác"). limit mặc định 10, tối đa 30.
// Đặt TRƯỚC '/:ma_vi_tri' để "goi-y" không bị hiểu là mã ô.
router.get('/goi-y', async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 30);
  if (!q) return res.json({ data: [], total: 0 });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 30);
  const esc = q.replace(/[\\%_]/g, '\\$&'); // escape ký tự đặc biệt của LIKE để q được hiểu là chữ thường
  const [rows, dem] = await Promise.all([
    pool.query(
      `SELECT ma_vi_tri FROM ViTriKho
       WHERE ma_vi_tri ILIKE $1
       ORDER BY (ma_vi_tri ILIKE $2) DESC, ke, o, tang, chieu_sau
       LIMIT $3`,
      [`%${esc}%`, `${esc}%`, limit]
    ),
    pool.query('SELECT COUNT(*)::int AS n FROM ViTriKho WHERE ma_vi_tri ILIKE $1', [`%${esc}%`]),
  ]);
  res.json({ data: rows.rows.map((r) => r.ma_vi_tri), total: dem.rows[0].n });
});

// GET /api/vi-tri/tong-theo-lo - danh sách lô ĐANG nằm trong kho (mỗi (vật tư, số lô) một dòng): tổng SL (cộng
// Lo_ViTri.so_luong qua các ô), số ô, co_chua_biet = có ô nào so_luong NULL (chưa biết SL). Đây là SL TRONG KHO, hoàn
// toàn độc lập với số lượng lô bên lựa. Lô không có dòng nào trong Lo_ViTri thì không có mặt ở đây.
// Đặt TRƯỚC '/:ma_vi_tri' để "tong-theo-lo" không bị hiểu là mã ô.
router.get('/tong-theo-lo', async (req, res) => {
  const result = await pool.query(
    `SELECT ma_vat_tu, (ARRAY_AGG(so_lo ORDER BY id))[1] AS so_lo, COUNT(*)::int AS so_o,
            SUM(so_luong) AS tong_so_luong, BOOL_OR(so_luong IS NULL) AS co_chua_biet
     FROM Lo_ViTri
     GROUP BY ma_vat_tu, lower(so_lo)
     ORDER BY ma_vat_tu, lower(so_lo)`
  );
  res.json({ data: result.rows });
});

// GET /api/vi-tri/theo-lo?ma_vat_tu=&so_lo= - các ô mà 1 lô (vật tư + số lô) đang nằm (1 lô có thể ở nhiều ô).
// Lô không có ô nào -> data rỗng (không phải lỗi: kho không có danh mục lô riêng để mà "không tìm thấy").
// Đặt TRƯỚC '/:ma_vi_tri' để "theo-lo" không bị hiểu là mã ô.
router.get('/theo-lo', async (req, res) => {
  const maVatTu = viTri.parseMaVatTu(req.query.ma_vat_tu);
  const soLo = viTri.parseSoLo(req.query.so_lo);
  const result = await pool.query(
    `SELECT v.id AS vi_tri_id, v.ma_vi_tri, v.khu, v.ke, v.loai_ke, v.nhom, v.o, v.chieu_sau, v.tang,
            lv.so_luong, lv.cap_nhat_luc
     FROM Lo_ViTri lv
     JOIN ViTriKho v ON v.id = lv.vi_tri_id
     WHERE lv.ma_vat_tu = $1 AND lower(lv.so_lo) = lower($2)
     ORDER BY v.ke, v.o, v.tang, v.chieu_sau`,
    [maVatTu, soLo]
  );
  res.json({ ma_vat_tu: maVatTu, so_lo: soLo, data: result.rows });
});

// whitelist cột sort của sổ giao dịch (chặn SQL injection qua ?sort_by=)
const GD_SORT_COLUMNS = {
  thoi_gian: 'gd.id',
  thao_tac: 'gd.thao_tac',
  ma_vi_tri: 'v.ma_vi_tri',
  so_lo: 'gd.so_lo',
  so_luong: 'gd.so_luong',
};
const THAO_TAC = ['nhap', 'xuat', 'chuyen_di', 'chuyen_den', 'dieu_chinh'];

// GET /api/vi-tri/giao-dich - sổ giao dịch (mới nhất trước), lọc so_lo / ma_vi_tri / thao_tac / ma_vat_tu, có phân trang.
// so_lo khớp đúng cả chuỗi (bỏ qua hoa/thường). Đặt TRƯỚC '/:ma_vi_tri' để "giao-dich" không bị hiểu là mã ô.
router.get('/giao-dich', async (req, res) => {
  const { so_lo, ma_vi_tri, thao_tac, ma_vat_tu, nhom_id } = req.query;
  const { page, limit, offset } = getPagination(req.query);
  const conditions = [];
  const params = [];
  if (so_lo) {
    params.push(viTri.parseSoLo(so_lo));
    conditions.push(`lower(gd.so_lo) = lower($${params.length})`);
  }
  if (ma_vi_tri) {
    params.push(`%${String(ma_vi_tri).trim()}%`);
    conditions.push(`v.ma_vi_tri ILIKE $${params.length}`);
  }
  if (thao_tac) {
    if (!THAO_TAC.includes(thao_tac)) throw new AppError(400, 'thao_tac không hợp lệ');
    params.push(thao_tac);
    conditions.push(`gd.thao_tac = $${params.length}`);
  }
  if (ma_vat_tu) {
    params.push(ma_vat_tu);
    conditions.push(`gd.ma_vat_tu = $${params.length}`);
  }
  if (nhom_id) {
    if (!/^[0-9a-f-]{36}$/i.test(nhom_id)) throw new AppError(400, 'nhom_id không hợp lệ');
    params.push(nhom_id);
    conditions.push(`gd.nhom_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const from = `FROM ViTri_GiaoDich gd
     JOIN ViTriKho v ON v.id = gd.vi_tri_id
     LEFT JOIN NhanSu ns ON ns.id = gd.nguoi_thuc_hien_id`;

  const total = Number((await pool.query(`SELECT COUNT(*) ${from} ${where}`, params)).rows[0].count);
  const orderBy = buildOrderBy(req.query, GD_SORT_COLUMNS, 'ORDER BY gd.id DESC');
  const rows = await pool.query(
    `SELECT gd.id, gd.so_lo, gd.ma_vat_tu, gd.vi_tri_id, v.ma_vi_tri, gd.thao_tac, gd.nhom_id,
            gd.so_luong, gd.ghi_chu, gd.thoi_gian, gd.nguoi_thuc_hien_id, ns.ho_ten AS nguoi_thuc_hien
     ${from} ${where} ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  res.json({ data: rows.rows, pagination: buildPaginationMeta({ page, limit, total }) });
});

// GET /api/vi-tri/:ma_vi_tri - 1 ô + các lô đang chứa
router.get('/:ma_vi_tri', async (req, res) => {
  const ma = viTri.parseMaViTri(req.params.ma_vi_tri);
  const o = await pool.query(
    'SELECT id, ma_vi_tri, khu, ke, loai_ke, nhom, o, chieu_sau, tang FROM ViTriKho WHERE ma_vi_tri = $1',
    [ma]
  );
  if (!o.rows[0]) throw new AppError(404, `Không có ô "${ma}" trong kho`);
  // LEFT JOIN VatTu chỉ để hiện tên vật tư; mã vật tư không còn trong danh mục thì ten_vat_tu = null, vẫn hiện lô.
  const lo = await pool.query(
    `SELECT lv.ma_vat_tu, lv.so_lo, v.ten_vat_tu, lv.so_luong, lv.cap_nhat_luc
     FROM Lo_ViTri lv
     LEFT JOIN VatTu v ON v.ma_vat_tu = lv.ma_vat_tu
     WHERE lv.vi_tri_id = $1
     ORDER BY lv.cap_nhat_luc DESC, lv.id DESC`,
    [o.rows[0].id]
  );
  res.json({ ...o.rows[0], lo: lo.rows });
});

// Đọc body chung cho các thao tác ghi
function docNguoi(req) {
  return req.user.id;
}

// Lô ở kho = (ma_vat_tu, so_lo) gõ thẳng trong body, không cần lô đã khai bên lựa. Nhập thì ma_vat_tu phải có trong
// danh mục VatTu (chặn gõ sai); xuất / chuyển / điều chỉnh chỉ cần lô đang nằm trong ô.

// POST /api/vi-tri/nhap  { ma_vat_tu, so_lo, ma_vi_tri, so_luong?, ghi_chu? }
router.post('/nhap', requireStaff, async (req, res) => {
  const b = req.body || {};
  const args = {
    maVatTu: viTri.parseMaVatTu(b.ma_vat_tu),
    soLo: viTri.parseSoLo(b.so_lo),
    maViTri: viTri.parseMaViTri(b.ma_vi_tri),
    soLuong: viTri.parseSoLuong(b.so_luong, { batBuocDuong: true }),
    ghiChu: viTri.parseGhiChu(b.ghi_chu),
    nguoiId: docNguoi(req),
  };
  res.status(201).json(await viTri.withTransaction((db) => viTri.nhap(db, args)));
});

// POST /api/vi-tri/xuat  { ma_vat_tu, so_lo, ma_vi_tri, so_luong? (bỏ trống = lấy hết), ghi_chu? }
router.post('/xuat', requireStaff, async (req, res) => {
  const b = req.body || {};
  const args = {
    maVatTu: viTri.parseMaVatTu(b.ma_vat_tu),
    soLo: viTri.parseSoLo(b.so_lo),
    maViTri: viTri.parseMaViTri(b.ma_vi_tri),
    soLuong: viTri.parseSoLuong(b.so_luong, { batBuocDuong: true }),
    ghiChu: viTri.parseGhiChu(b.ghi_chu),
    nguoiId: docNguoi(req),
  };
  res.json(await viTri.withTransaction((db) => viTri.xuat(db, args)));
});

// POST /api/vi-tri/chuyen  { ma_vat_tu, so_lo, tu_vi_tri, den_vi_tri, so_luong? (bỏ trống = chuyển hết), ghi_chu? }
router.post('/chuyen', requireStaff, async (req, res) => {
  const b = req.body || {};
  const args = {
    maVatTu: viTri.parseMaVatTu(b.ma_vat_tu),
    soLo: viTri.parseSoLo(b.so_lo),
    tuViTri: viTri.parseMaViTri(b.tu_vi_tri, 'tu_vi_tri'),
    denViTri: viTri.parseMaViTri(b.den_vi_tri, 'den_vi_tri'),
    soLuong: viTri.parseSoLuong(b.so_luong, { batBuocDuong: true }),
    ghiChu: viTri.parseGhiChu(b.ghi_chu),
    nguoiId: docNguoi(req),
  };
  res.json(await viTri.withTransaction((db) => viTri.chuyen(db, args)));
});

// POST /api/vi-tri/dieu-chinh  { ma_vat_tu, so_lo, ma_vi_tri, so_luong (bắt buộc có khóa; null = chưa biết, 0 = bỏ khỏi ô), ghi_chu? }
router.post('/dieu-chinh', requireStaff, async (req, res) => {
  const b = req.body || {};
  if (!('so_luong' in b)) throw new AppError(400, 'Thiếu so_luong (gửi null nếu chưa biết)');
  const args = {
    maVatTu: viTri.parseMaVatTu(b.ma_vat_tu),
    soLo: viTri.parseSoLo(b.so_lo),
    maViTri: viTri.parseMaViTri(b.ma_vi_tri),
    soLuong: viTri.parseSoLuong(b.so_luong, { batBuocDuong: false }),
    ghiChu: viTri.parseGhiChu(b.ghi_chu),
    nguoiId: docNguoi(req),
  };
  res.json(await viTri.withTransaction((db) => viTri.dieuChinh(db, args)));
});

module.exports = router;
