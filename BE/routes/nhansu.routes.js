const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const AppError = require('../utils/AppError');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { buildOrderBy } = require('../utils/sort');

const router = express.Router();
router.use(authenticateToken);

const SAFE_COLUMNS = 'id, ho_ten, username, vai_tro, created_at, gioi_tinh, duoc_ke_ho, xu_ly_hang';
// Đã từng có báo cáo lựa (tham gia hoặc nhập) -> FE vẫn giữ tên trong ô LỌC dù đã bỏ "xử lý hàng"
const CO_BAO_CAO = `(EXISTS (SELECT 1 FROM BaoCao_NhanSu bn WHERE bn.nhansu_id = NhanSu.id)
  OR EXISTS (SELECT 1 FROM BaoCao bc WHERE bc.nguoi_nhap_id = NhanSu.id)) AS co_bao_cao`;
const GIOI_TINH = { nam: 'Nam', nu: 'Nữ' };

function kiemGioiTinh(value) {
  if (value && !Object.hasOwn(GIOI_TINH, value)) throw new AppError(400, 'gioi_tinh không hợp lệ (nam | nu)');
}
const NHANSU_SORT_COLUMNS = { id: 'id', ho_ten: 'ho_ten', username: 'username', vai_tro: 'vai_tro', created_at: 'created_at' };

// GET /api/nhansu - danh sách nhân sự (mọi người đăng nhập đều xem được), co phan trang (mac dinh 15/trang)
// ?search= tim theo ho_ten hoac username
router.get(
  '/',
  async (req, res) => {
    const { search } = req.query;
    const { page, limit, offset } = getPagination(req.query);

    const params = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE ho_ten ILIKE $${params.length} OR username ILIKE $${params.length}`;
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM NhanSu ${where}`, params);
    const total = Number(countResult.rows[0].count);

    const orderBy = buildOrderBy(req.query, NHANSU_SORT_COLUMNS, 'ORDER BY ho_ten ASC');
    const dataResult = await pool.query(
      `SELECT ${SAFE_COLUMNS}, ${CO_BAO_CAO} FROM NhanSu ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  }
);

// GET /api/nhansu/export - xuất Excel danh sách nhân sự (admin)
router.get(
  '/export',
  requireAdmin,
  async (req, res) => {
    const result = await pool.query(
      `SELECT ${SAFE_COLUMNS} FROM NhanSu ORDER BY ho_ten ASC`
    );
    await sendExcel(res, {
      sheetName: 'NhanSu',
      fileName: 'danh_sach_nhan_su',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Họ tên', key: 'ho_ten', width: 30 },
        { header: 'Username', key: 'username', width: 20 },
        { header: 'Vai trò', key: 'vai_tro', width: 15 },
        { header: 'Giới tính', key: 'gioi_tinh', width: 12 },
        { header: 'Được kê hộ nghỉ', key: 'duoc_ke_ho', width: 18 },
        { header: 'Có xử lý hàng', key: 'xu_ly_hang', width: 16 },
        { header: 'Ngày tạo', key: 'created_at', width: 20 },
      ],
      rows: result.rows.map((r) => ({
        ...r,
        gioi_tinh: GIOI_TINH[r.gioi_tinh],
        duoc_ke_ho: r.duoc_ke_ho ? 'Có' : '',
        xu_ly_hang: r.vai_tro !== 'nhan_vien' ? '' : r.xu_ly_hang ? 'Có' : 'Không',
      })),
    });
  }
);

// GET /api/nhansu/:id
router.get(
  '/:id',
  async (req, res) => {
    const result = await pool.query(`SELECT ${SAFE_COLUMNS} FROM NhanSu WHERE id = $1`, [
      req.params.id,
    ]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
    res.json(result.rows[0]);
  }
);

// POST /api/nhansu - admin tạo tài khoản mới
router.post(
  '/',
  requireAdmin,
  async (req, res) => {
    const { ho_ten, username, password, vai_tro, gioi_tinh, duoc_ke_ho, xu_ly_hang } = req.body;
    if (!ho_ten || !username || !password) {
      throw new AppError(400, 'Thiếu ho_ten, username hoặc password');
    }
    if (vai_tro && !['admin', 'nhan_vien', 'thu_kho'].includes(vai_tro)) {
      throw new AppError(400, 'vai_tro không hợp lệ');
    }
    kiemGioiTinh(gioi_tinh);
    if (password.length < 6) {
      throw new AppError(400, 'Mật khẩu phải có ít nhất 6 ký tự');
    }

    const existed = await pool.query('SELECT id FROM NhanSu WHERE username = $1', [
      username,
    ]);
    if (existed.rows[0]) {
      throw new AppError(409, 'Username đã tồn tại');
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO NhanSu (ho_ten, username, password, vai_tro, gioi_tinh, duoc_ke_ho, xu_ly_hang)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SAFE_COLUMNS}`,
      // quyền kê hộ chỉ có nghĩa với nhân viên
      [ho_ten, username, hashed, vai_tro || 'nhan_vien', gioi_tinh || 'nu',
        duoc_ke_ho === true && (vai_tro || 'nhan_vien') === 'nhan_vien', xu_ly_hang !== false]
    );
    res.status(201).json(result.rows[0]);
  }
);

// PUT /api/nhansu/:id - admin sửa họ tên / vai trò / giới tính / kê hộ / xử lý hàng (không gửi thì giữ nguyên)
router.put(
  '/:id',
  requireAdmin,
  async (req, res) => {
    const { ho_ten, vai_tro, gioi_tinh, duoc_ke_ho, xu_ly_hang } = req.body;
    const hoacGiuNguyen = (v) => (typeof v === 'boolean' ? v : null);
    kiemGioiTinh(gioi_tinh);
    if (!ho_ten) throw new AppError(400, 'Thiếu ho_ten');
    if (vai_tro && !['admin', 'nhan_vien', 'thu_kho'].includes(vai_tro)) {
      throw new AppError(400, 'vai_tro không hợp lệ');
    }

    const result = await pool.query(
      `UPDATE NhanSu SET ho_ten = $1, vai_tro = COALESCE($2, vai_tro), gioi_tinh = COALESCE($3, gioi_tinh),
         duoc_ke_ho = COALESCE($4::boolean, duoc_ke_ho) AND COALESCE($2, vai_tro) = 'nhan_vien',
         xu_ly_hang = COALESCE($5::boolean, xu_ly_hang)
       WHERE id = $6 RETURNING ${SAFE_COLUMNS}`,
      [ho_ten, vai_tro || null, gioi_tinh || null, hoacGiuNguyen(duoc_ke_ho), hoacGiuNguyen(xu_ly_hang), req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
    res.json(result.rows[0]);
  }
);

// PUT /api/nhansu/:id/reset-password - admin đặt lại mật khẩu cho nhân sự
router.put(
  '/:id/reset-password',
  requireAdmin,
  async (req, res) => {
    const { mat_khau_moi } = req.body;
    if (!mat_khau_moi || mat_khau_moi.length < 6) {
      throw new AppError(400, 'Mật khẩu mới phải có ít nhất 6 ký tự');
    }
    const hashed = await bcrypt.hash(mat_khau_moi, 10);
    const result = await pool.query(
      `UPDATE NhanSu SET password = $1 WHERE id = $2 RETURNING ${SAFE_COLUMNS}`,
      [hashed, req.params.id]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  }
);

// DELETE /api/nhansu/:id - admin xóa tài khoản (chặn nếu đã có báo cáo liên quan)
router.delete(
  '/:id',
  requireAdmin,
  async (req, res) => {
    if (Number(req.params.id) === req.user.id) {
      throw new AppError(400, 'Không thể tự xóa tài khoản của chính mình');
    }
    try {
      const result = await pool.query('DELETE FROM NhanSu WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy nhân sự');
      res.json({ message: 'Xóa nhân sự thành công' });
    } catch (err) {
      if (err.code === '23503') {
        throw new AppError(
          409,
          'Không thể xóa: nhân sự này đã có báo cáo, đơn xin nghỉ hoặc dữ liệu liên quan'
        );
      }
      throw err;
    }
  }
);

module.exports = router;
