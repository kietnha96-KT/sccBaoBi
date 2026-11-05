const express = require('express');
const pool = require('../db');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { readRows, importLoaiLoi } = require('../utils/excelImport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { buildOrderBy } = require('../utils/sort');

const router = express.Router();
router.use(authenticateToken);

const LOAILOI_SORT_COLUMNS = {
  ma_vat_tu: 'v.ma_vat_tu',
  ten_vat_tu: 'v.ten_vat_tu',
  ten_loi: 'll.ten_loi',
  muc_dich: 'll.muc_dich',
  la_loi_dac_biet: 'll.la_loi_dac_biet',
};

const rawFile = express.raw({ type: () => true, limit: '15mb' });

const MUC_DICH_HOP_LE = ['gan_nhan', 'tach_hu_bo', 'ca_hai'];
const MUC_DICH_LABEL = { gan_nhan: 'Gán nhãn', tach_hu_bo: 'Tách hư bỏ', ca_hai: 'Cả hai' };
function chuanHoaMucDich(v) {
  if (v === undefined || v === null || v === '') return 'gan_nhan';
  if (!MUC_DICH_HOP_LE.includes(v)) {
    throw new AppError(400, "muc_dich phải là 'gan_nhan', 'tach_hu_bo' hoặc 'ca_hai'");
  }
  return v;
}

const LOAILOI_SELECT = `
  SELECT ll.*, v.ten_vat_tu
  FROM LoaiLoi ll
  JOIN VatTu v ON v.ma_vat_tu = ll.ma_vat_tu
`;

// GET /api/loailoi?ma_vat_tu=xxx - co phan trang (mac dinh 15/trang)
router.get(
  '/',
  async (req, res) => {
    const { ma_vat_tu, thu_kho } = req.query;
    const { page, limit, offset } = getPagination(req.query);
    const params = [];
    const conditions = [];
    if (ma_vat_tu) {
      params.push(ma_vat_tu);
      conditions.push(`ll.ma_vat_tu = $${params.length}`);
    }
    if (thu_kho) {
      params.push(thu_kho);
      conditions.push(`v.thu_kho = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM LoaiLoi ll JOIN VatTu v ON v.ma_vat_tu = ll.ma_vat_tu ${where}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const orderBy = buildOrderBy(req.query, LOAILOI_SORT_COLUMNS, 'ORDER BY v.ma_vat_tu, ll.ten_loi');
    const dataResult = await pool.query(
      `${LOAILOI_SELECT} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  }
);

// GET /api/loailoi/export
router.get(
  '/export',
  requireStaff,
  async (req, res) => {
    const result = await pool.query(`${LOAILOI_SELECT} ORDER BY v.ma_vat_tu, ll.ten_loi`);
    await sendExcel(res, {
      sheetName: 'LoaiLoi',
      fileName: 'danh_muc_loi',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 15 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 30 },
        { header: 'Tên lỗi', key: 'ten_loi', width: 35 },
        { header: 'Lỗi đặc biệt', key: '_dac_biet_txt', width: 12 },
        { header: 'Mục đích', key: '_muc_dich_txt', width: 16 },
      ],
      rows: result.rows.map((r) => ({
        ...r,
        _dac_biet_txt: r.la_loi_dac_biet ? 'Có' : '',
        _muc_dich_txt: MUC_DICH_LABEL[r.muc_dich] || r.muc_dich,
      })),
    });
  }
);

// POST /api/loailoi/import - nạp danh sách loại lỗi từ file Excel (.xlsx)
// Cột chấp nhận (dòng đầu là tiêu đề): Mã vật tư, Tên lỗi.
// Mã vật tư phải tồn tại; cặp (mã vật tư + tên lỗi) đã có -> bỏ qua (không tạo trùng).
router.post(
  '/import',
  requireStaff,
  rawFile,
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(400, 'Không nhận được file. Hãy chọn 1 file Excel (.xlsx).');
    }
    let rows;
    try {
      ({ rows } = await readRows(req.body, {
        ma_vat_tu: ['ma vat tu', 'ma', 'mavt'],
        ten_loi: ['ten loi', 'loi', 'ten'],
      }));
    } catch (e) {
      throw new AppError(400, e.message);
    }

    const result = await importLoaiLoi(pool, rows);
    res.json(result);
  }
);

// Đếm dữ liệu đang dùng 1 loại lỗi: báo cáo gán nhãn nó (loi_chuan_id) + dòng hư bỏ chi tiết.
// Có dữ liệu = loại lỗi bị KHÓA "bản chất" (mục đích, cờ lỗi đặc biệt), chỉ còn đổi tên được.
// Chạy tuần tự (không Promise.all) vì có thể nhận 1 client trong transaction.
async function demSuDung(db, id) {
  const nhan = await db.query('SELECT COUNT(*)::int AS n FROM BaoCao WHERE loi_chuan_id = $1', [id]);
  const ct = await db.query(
    'SELECT COUNT(*)::int AS n, COALESCE(SUM(so_luong), 0) AS tong FROM BaoCao_LoiChiTiet WHERE loai_loi_id = $1',
    [id]
  );
  const soNhan = nhan.rows[0].n;
  const soChiTiet = ct.rows[0].n;
  return {
    so_bao_cao_gan_nhan: soNhan,
    so_bao_cao_chi_tiet: soChiTiet,
    tong_so_luong_chi_tiet: Number(ct.rows[0].tong),
    da_co_du_lieu: soNhan > 0 || soChiTiet > 0,
  };
}

// GET /api/loailoi/:id/su-dung - loại lỗi này đã có dữ liệu dùng chưa (FE dùng để khóa ô
// mục đích / lỗi đặc biệt trong form sửa, kèm lý do).
router.get(
  '/:id/su-dung',
  async (req, res) => {
    res.json(await demSuDung(pool, req.params.id));
  }
);

// GET /api/loailoi/:id
router.get(
  '/:id',
  async (req, res) => {
    const result = await pool.query(`${LOAILOI_SELECT} WHERE ll.id = $1`, [
      req.params.id,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy loại lỗi');
    res.json(result.rows[0]);
  }
);

// POST /api/loailoi - admin tạo loại lỗi mới cho 1 vật tư
router.post(
  '/',
  requireStaff,
  async (req, res) => {
    const { ma_vat_tu, ten_loi, la_loi_dac_biet = false } = req.body;
    if (!ma_vat_tu || !ten_loi) {
      throw new AppError(400, 'Thiếu ma_vat_tu hoặc ten_loi');
    }
    // Lỗi đặc biệt luôn khóa muc_dich = 'gan_nhan': thao tác nội bộ, báo cáo gọi đích
    // danh, và cơ chế loại khỏi tổng lô chạy theo nhãn lỗi chuẩn.
    const muc_dich = la_loi_dac_biet ? 'gan_nhan' : chuanHoaMucDich(req.body.muc_dich);
    const vt = await pool.query('SELECT ma_vat_tu FROM VatTu WHERE ma_vat_tu = $1', [
      ma_vat_tu,
    ]);
    if (!vt.rows[0]) throw new AppError(400, 'Mã vật tư không tồn tại');

    const result = await pool.query(
      'INSERT INTO LoaiLoi (ma_vat_tu, ten_loi, la_loi_dac_biet, muc_dich) VALUES ($1, $2, $3, $4) RETURNING *',
      [ma_vat_tu, ten_loi, !!la_loi_dac_biet, muc_dich]
    );
    res.status(201).json(result.rows[0]);
  }
);

// PUT /api/loailoi/:id - sửa loại lỗi (admin / thủ kho).
// Loại lỗi CHƯA có dữ liệu dùng: đổi tự do (tên, mục đích, cờ lỗi đặc biệt).
// Loại lỗi ĐÃ có dữ liệu dùng (báo cáo gán nhãn hoặc hư bỏ chi tiết): "bản chất" bị KHÓA -
// chỉ đổi được tên. Đổi mục đích / bật-tắt cờ đặc biệt sẽ diễn giải lại toàn bộ lịch sử
// (mất dữ liệu, hoặc đẩy số lượng sang phần khác của lô làm vượt trần) nên bị TỪ CHỐI (409).
// Muốn dùng theo cách khác -> tạo loại lỗi mới.
router.put(
  '/:id',
  requireStaff,
  async (req, res) => {
    const { ten_loi, la_loi_dac_biet } = req.body;
    if (!ten_loi) throw new AppError(400, 'Thiếu ten_loi');
    const mucDichGui =
      req.body.muc_dich === undefined ? null : chuanHoaMucDich(req.body.muc_dich);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Khóa dòng để lúc kiểm tra "đã có dữ liệu chưa" không bị báo cáo mới chen vào (khóa
      // khóa-ngoại của báo cáo mới phải chờ transaction này).
      const cur = await client.query('SELECT * FROM LoaiLoi WHERE id = $1 FOR UPDATE', [
        req.params.id,
      ]);
      const hienTai = cur.rows[0];
      if (!hienTai) throw new AppError(404, 'Không tìm thấy loại lỗi');

      // Giá trị sau khi sửa. Lỗi đặc biệt luôn khóa mục đích = 'gan_nhan'.
      const dacBietMoi = !!(la_loi_dac_biet ?? hienTai.la_loi_dac_biet);
      const mucDichMoi = dacBietMoi ? 'gan_nhan' : mucDichGui ?? hienTai.muc_dich;

      const doi = [];
      if (dacBietMoi !== hienTai.la_loi_dac_biet) doi.push('cờ "lỗi đặc biệt"');
      if (mucDichMoi !== hienTai.muc_dich) doi.push('mục đích dùng');

      if (doi.length) {
        const sd = await demSuDung(client, req.params.id);
        if (sd.da_co_du_lieu) {
          const dangDung = [];
          if (sd.so_bao_cao_gan_nhan > 0) {
            dangDung.push(`${sd.so_bao_cao_gan_nhan} báo cáo đang gán nhãn này`);
          }
          if (sd.so_bao_cao_chi_tiet > 0) {
            dangDung.push(
              `${sd.so_bao_cao_chi_tiet} báo cáo có hư bỏ chi tiết loại lỗi này`
            );
          }
          throw new AppError(
            409,
            `Không thể đổi ${doi.join(' và ')} của loại lỗi "${hienTai.ten_loi}" vì đã có dữ liệu dùng: ${dangDung.join('; ')}. ` +
              'Loại lỗi đã có dữ liệu chỉ được đổi tên. Nếu cần dùng theo cách khác, hãy tạo loại lỗi mới.'
          );
        }
      }

      const result = await client.query(
        'UPDATE LoaiLoi SET ten_loi = $1, la_loi_dac_biet = $2, muc_dich = $3 WHERE id = $4 RETURNING *',
        [ten_loi, dacBietMoi, mucDichMoi, req.params.id]
      );

      await client.query('COMMIT');
      res.json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
);

// DELETE /api/loailoi/:id - admin xóa (chặn nếu đã có báo cáo đang gán nhãn lỗi này)
router.delete(
  '/:id',
  requireStaff,
  async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM LoaiLoi WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy loại lỗi');
      res.json({ message: 'Xóa loại lỗi thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(
          409,
          'Không thể xóa: loại lỗi này đang được dùng ở báo cáo (nhãn lỗi chuẩn hoặc hư bỏ chi tiết). Hãy gỡ ở các báo cáo liên quan trước.'
        );
      }
      throw err;
    }
  }
);

module.exports = router;
