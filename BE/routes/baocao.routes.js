const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { authenticateToken, requireStaff } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { BC_CALC_CTE } = require('../utils/productivity');

const router = express.Router();
router.use(authenticateToken);

// dùng bc_nang_suat (từ BC_CALC_CTE) thay cho BaoCao -> có sẵn nang_suat_8h cho từng dòng
const BASE_FROM = `
  FROM bc_nang_suat bc
  JOIN Lo l ON l.id = bc.lo_id
  JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
  JOIN NhanSu ns ON ns.id = bc.nguoi_nhap_id
  LEFT JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
`;

const LIST_SELECT = `
  ${BC_CALC_CTE}
  SELECT
    bc.id, bc.ngay, bc.lo_id, bc.dat, bc.hu_bo, bc.tong_lua,
    bc.tg_bat_dau, bc.tg_ket_thuc, bc.nguoi_nhap_id, bc.loi_nguoi_dung,
    bc.loi_chuan_id, bc.la_lua_lai, bc.ghi_chu, bc.created_at,
    bc.nang_suat_8h,
    l.so_lo, l.ma_vat_tu, l.so_luong_lo, v.ten_vat_tu,
    ns.ho_ten AS nguoi_nhap_ho_ten,
    ll.ten_loi AS loi_chuan_ten,
    -- "trong ngày nhập" tính theo múi giờ VN, không theo UTC của server
    ((bc.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS co_the_sua_xoa_hom_nay,
    (
      SELECT COALESCE(json_agg(json_build_object('id', n2.id, 'ho_ten', n2.ho_ten) ORDER BY n2.ho_ten), '[]')
      FROM BaoCao_NhanSu bcns2 JOIN NhanSu n2 ON n2.id = bcns2.nhansu_id
      WHERE bcns2.baocao_id = bc.id
    ) AS nhansu_tham_gia
  ${BASE_FROM}
`;

// Xây where-clause dùng chung cho list và export
function buildFilters(query) {
  const { tu_ngay, den_ngay, ma_vat_tu, lo_id, nguoi_nhap_id, nhansu_id, la_lua_lai, loi_chuan_id } =
    query;
  const conditions = [];
  const params = [];

  if (tu_ngay) {
    params.push(tu_ngay);
    conditions.push(`bc.ngay >= $${params.length}`);
  }
  if (den_ngay) {
    params.push(den_ngay);
    conditions.push(`bc.ngay <= $${params.length}`);
  }
  if (ma_vat_tu) {
    params.push(ma_vat_tu);
    conditions.push(`l.ma_vat_tu = $${params.length}`);
  }
  if (lo_id) {
    params.push(lo_id);
    conditions.push(`bc.lo_id = $${params.length}`);
  }
  if (nguoi_nhap_id) {
    params.push(nguoi_nhap_id);
    conditions.push(`bc.nguoi_nhap_id = $${params.length}`);
  }
  if (la_lua_lai !== undefined) {
    params.push(la_lua_lai === 'true');
    conditions.push(`bc.la_lua_lai = $${params.length}`);
  }
  if (loi_chuan_id) {
    params.push(loi_chuan_id);
    conditions.push(`bc.loi_chuan_id = $${params.length}`);
  }
  if (nhansu_id) {
    params.push(nhansu_id);
    conditions.push(
      `EXISTS (SELECT 1 FROM BaoCao_NhanSu bcns WHERE bcns.baocao_id = bc.id AND bcns.nhansu_id = $${params.length})`
    );
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// GET /api/baocao - danh sách báo cáo, có lọc + phân trang
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { where, params } = buildFilters(req.query);
    const { page, limit, offset } = getPagination(req.query, { maxLimit: 200 });

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM BaoCao bc JOIN Lo l ON l.id = bc.lo_id ${where}`,
      params
    );
    const total = Number(countResult.rows[0].count);

    const dataResult = await pool.query(
      `${LIST_SELECT} ${where} ORDER BY bc.ngay DESC, bc.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ data: dataResult.rows, pagination: buildPaginationMeta({ page, limit, total }) });
  })
);

// GET /api/baocao/export - xuất Excel theo cùng bộ lọc với danh sách (không phân trang, tối đa 20000 dòng)
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const { where, params } = buildFilters(req.query);
    const result = await pool.query(
      `${LIST_SELECT} ${where} ORDER BY bc.ngay DESC, bc.id DESC LIMIT 20000`,
      params
    );

    const rows = result.rows.map((r) => ({
      ...r,
      nhansu_tham_gia: (r.nhansu_tham_gia || []).map((n) => n.ho_ten).join(', '),
      la_lua_lai: r.la_lua_lai ? 'Có' : 'Không',
      // năng suất trong CTE chưa làm tròn -> làm tròn 2 số ở đây, giữ kiểu số cho Excel
      nang_suat_8h: r.nang_suat_8h == null ? null : Math.round(Number(r.nang_suat_8h) * 100) / 100,
    }));

    await sendExcel(res, {
      sheetName: 'BaoCao',
      fileName: 'danh_sach_bao_cao',
      columns: [
        { header: 'ID', key: 'id', width: 8 },
        { header: 'Ngày', key: 'ngay', width: 14 },
        { header: 'Số lô', key: 'so_lo', width: 18 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 28 },
        { header: 'Đạt', key: 'dat', width: 12 },
        { header: 'Hư bỏ', key: 'hu_bo', width: 12 },
        { header: 'Tổng lựa', key: 'tong_lua', width: 12 },
        { header: 'Giờ bắt đầu', key: 'tg_bat_dau', width: 12 },
        { header: 'Giờ kết thúc', key: 'tg_ket_thuc', width: 12 },
        { header: 'Năng suất (quy 8h)', key: 'nang_suat_8h', width: 16 },
        { header: 'Người nhập', key: 'nguoi_nhap_ho_ten', width: 22 },
        { header: 'Nhân sự tham gia', key: 'nhansu_tham_gia', width: 35 },
        { header: 'Lỗi (người dùng nhập)', key: 'loi_nguoi_dung', width: 30 },
        { header: 'Lỗi chuẩn (admin gán)', key: 'loi_chuan_ten', width: 25 },
        { header: 'Lựa lại', key: 'la_lua_lai', width: 10 },
        { header: 'Ghi chú', key: 'ghi_chu', width: 30 },
      ],
      rows,
    });
  })
);

// GET /api/baocao/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query(`${LIST_SELECT} WHERE bc.id = $1`, [req.params.id]);
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy báo cáo');
    res.json(result.rows[0]);
  })
);

// Giờ làm việc: định dạng 24h "HH:MM" (00:00 - 23:59), KHÔNG dùng AM/PM.
const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Chuẩn hóa cặp giờ bắt đầu / kết thúc:
// - cho phép để trống CẢ HAI (báo cáo chưa có giờ -> không tính năng suất)
// - nếu nhập thì phải nhập đủ cả hai, đúng định dạng 24h, và kết thúc > bắt đầu
// - cùng ngày (không hỗ trợ ca qua đêm) -> so sánh chuỗi "HH:MM" là đủ
function normalizeGioLamViec(tg_bat_dau, tg_ket_thuc) {
  const bd = tg_bat_dau ? String(tg_bat_dau).trim().slice(0, 5) : '';
  const kt = tg_ket_thuc ? String(tg_ket_thuc).trim().slice(0, 5) : '';

  if (!bd && !kt) return { tg_bat_dau: null, tg_ket_thuc: null };

  if (!bd || !kt) {
    throw new AppError(400, 'Phải nhập cả giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai');
  }
  if (!TIME_24H_RE.test(bd)) {
    throw new AppError(400, 'Giờ bắt đầu không hợp lệ, cần định dạng 24 giờ HH:MM (ví dụ 08:30)');
  }
  if (!TIME_24H_RE.test(kt)) {
    throw new AppError(400, 'Giờ kết thúc không hợp lệ, cần định dạng 24 giờ HH:MM (ví dụ 17:00)');
  }
  if (kt <= bd) {
    throw new AppError(400, 'Giờ kết thúc phải sau giờ bắt đầu (trong cùng một ngày)');
  }
  return { tg_bat_dau: bd, tg_ket_thuc: kt };
}

// Chuẩn hóa + validate payload nhập/sửa báo cáo
function parseReportBody(body) {
  const { ngay, lo_id, dat, hu_bo, tg_bat_dau, tg_ket_thuc, loi_nguoi_dung, la_lua_lai, ghi_chu, nhansu_ids } =
    body;

  if (!ngay) throw new AppError(400, 'Thiếu ngày');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngay)) || Number.isNaN(Date.parse(ngay))) {
    throw new AppError(400, 'Ngày không hợp lệ (định dạng YYYY-MM-DD)');
  }
  if (!lo_id) throw new AppError(400, 'Thiếu lo_id');
  if (dat !== undefined && Number(dat) < 0) throw new AppError(400, 'dat không được âm');
  if (hu_bo !== undefined && Number(hu_bo) < 0) throw new AppError(400, 'hu_bo không được âm');
  if (!Array.isArray(nhansu_ids) || nhansu_ids.length === 0) {
    throw new AppError(400, 'Phải chọn ít nhất 1 nhân viên tham gia');
  }

  const gio = normalizeGioLamViec(tg_bat_dau, tg_ket_thuc);

  return {
    ngay,
    lo_id,
    dat: dat ?? 0,
    hu_bo: hu_bo ?? 0,
    tg_bat_dau: gio.tg_bat_dau,
    tg_ket_thuc: gio.tg_ket_thuc,
    loi_nguoi_dung: loi_nguoi_dung || null,
    la_lua_lai: !!la_lua_lai,
    ghi_chu: ghi_chu || null,
    nhansu_ids: [...new Set(nhansu_ids.map(Number))],
  };
}

// Chuẩn hóa danh sách "nhân sự tham gia": chỉ giữ người có vai trò 'nhan_vien'.
// Admin / thủ kho KHÔNG được tính là người tham gia (họ chỉ là người đại diện nhập phiếu).
async function resolveNhanVienIds(rawIds) {
  const uniq = [...new Set((rawIds || []).map(Number).filter((n) => Number.isInteger(n)))];
  if (uniq.length === 0) throw new AppError(400, 'Phải chọn ít nhất 1 nhân viên tham gia');

  const result = await pool.query('SELECT id, vai_tro FROM NhanSu WHERE id = ANY($1::int[])', [uniq]);
  if (result.rows.length !== uniq.length) {
    throw new AppError(400, 'Một hoặc nhiều nhân sự được chọn không tồn tại');
  }

  const nhanVienIds = result.rows.filter((r) => r.vai_tro === 'nhan_vien').map((r) => r.id);
  if (nhanVienIds.length === 0) {
    throw new AppError(400, 'Phải chọn ít nhất 1 nhân viên tham gia');
  }
  return nhanVienIds;
}

// Kiểm tra tổng tong_lua theo lo_id không vượt so_luong_lo (loại trừ báo cáo lựa lại và loại trừ chính báo cáo đang sửa)
async function checkCapacity(client, { lo_id, dat, hu_bo, la_lua_lai, excludeBaoCaoId }) {
  if (la_lua_lai) return; // báo cáo lựa lại không tính vào giới hạn so_luong_lo

  const loResult = await client.query('SELECT so_luong_lo FROM Lo WHERE id = $1 FOR UPDATE', [
    lo_id,
  ]);
  if (!loResult.rows[0]) throw new AppError(400, 'lo_id không tồn tại');
  const soLuongLo = Number(loResult.rows[0].so_luong_lo);

  const sumParams = [lo_id];
  let excludeClause = '';
  if (excludeBaoCaoId) {
    sumParams.push(excludeBaoCaoId);
    excludeClause = `AND id != $${sumParams.length}`;
  }
  const sumResult = await client.query(
    `SELECT COALESCE(SUM(tong_lua), 0) AS da_lua FROM BaoCao WHERE lo_id = $1 AND la_lua_lai = FALSE ${excludeClause}`,
    sumParams
  );
  const daLua = Number(sumResult.rows[0].da_lua);
  const tongMoi = Number(dat) + Number(hu_bo);

  if (daLua + tongMoi > soLuongLo) {
    const conLai = soLuongLo - daLua;
    throw new AppError(
      400,
      `Vượt quá số lượng lô cho phép. Đã lựa ${daLua}/${soLuongLo}, chỉ còn lại ${conLai < 0 ? 0 : conLai}.`
    );
  }
}

// POST /api/baocao - nhân viên nhập báo cáo (người đại diện = người đăng nhập)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = parseReportBody(req.body);

    // Người nhập là NHÂN VIÊN thì tự có mặt trong danh sách tham gia.
    // Admin / thủ kho nhập hộ thì không tự thêm (và cũng bị lọc ra ở resolveNhanVienIds).
    if (req.user.vai_tro === 'nhan_vien' && !payload.nhansu_ids.includes(req.user.id)) {
      payload.nhansu_ids.push(req.user.id);
    }

    payload.nhansu_ids = await resolveNhanVienIds(payload.nhansu_ids);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await checkCapacity(client, {
        lo_id: payload.lo_id,
        dat: payload.dat,
        hu_bo: payload.hu_bo,
        la_lua_lai: payload.la_lua_lai,
      });

      const insertResult = await client.query(
        `INSERT INTO BaoCao (ngay, lo_id, dat, hu_bo, tg_bat_dau, tg_ket_thuc, nguoi_nhap_id, loi_nguoi_dung, la_lua_lai, ghi_chu)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          payload.ngay,
          payload.lo_id,
          payload.dat,
          payload.hu_bo,
          payload.tg_bat_dau,
          payload.tg_ket_thuc,
          req.user.id,
          payload.loi_nguoi_dung,
          payload.la_lua_lai,
          payload.ghi_chu,
        ]
      );
      const baocaoId = insertResult.rows[0].id;

      for (const nhansuId of payload.nhansu_ids) {
        await client.query(
          'INSERT INTO BaoCao_NhanSu (baocao_id, nhansu_id) VALUES ($1, $2)',
          [baocaoId, nhansuId]
        );
      }

      await client.query('COMMIT');

      const full = await pool.query(`${LIST_SELECT} WHERE bc.id = $1`, [baocaoId]);
      res.status(201).json(full.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// Kiểm tra quyền sửa/xóa: CHỈ admin luôn được; nhân viên VÀ thủ kho chỉ được với
// báo cáo của chính mình, trong ngày nhập
async function assertCanModify(req, baocaoId) {
  const result = await pool.query(
    `SELECT nguoi_nhap_id,
       ((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
         = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS la_hom_nay
     FROM BaoCao WHERE id = $1`,
    [baocaoId]
  );
  const bc = result.rows[0];
  if (!bc) throw new AppError(404, 'Không tìm thấy báo cáo');

  if (req.user.vai_tro === 'admin') return;

  if (bc.nguoi_nhap_id !== req.user.id) {
    throw new AppError(403, 'Bạn chỉ được sửa/xóa báo cáo do chính mình nhập');
  }
  if (!bc.la_hom_nay) {
    throw new AppError(403, 'Chỉ được sửa/xóa báo cáo trong ngày nhập');
  }
}

// PUT /api/baocao/:id - sửa báo cáo.
// - loi_chuan_id: không sửa ở đây (dùng PATCH /:id/loi-chuan, admin & thủ kho).
// - loi_nguoi_dung: sửa được như mọi trường khác, miễn là còn quyền sửa phiếu
//   (nhân viên & thủ kho: phiếu của mình + trong ngày; admin: mọi lúc) - assertCanModify đã kiểm.
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const baocaoId = req.params.id;
    await assertCanModify(req, baocaoId);

    const payload = parseReportBody(req.body);
    payload.nhansu_ids = await resolveNhanVienIds(payload.nhansu_ids);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await checkCapacity(client, {
        lo_id: payload.lo_id,
        dat: payload.dat,
        hu_bo: payload.hu_bo,
        la_lua_lai: payload.la_lua_lai,
        excludeBaoCaoId: baocaoId,
      });

      const updateResult = await client.query(
        `UPDATE BaoCao SET ngay = $1, lo_id = $2, dat = $3, hu_bo = $4, tg_bat_dau = $5,
           tg_ket_thuc = $6, la_lua_lai = $7, ghi_chu = $8, loi_nguoi_dung = $9
         WHERE id = $10 RETURNING id`,
        [
          payload.ngay,
          payload.lo_id,
          payload.dat,
          payload.hu_bo,
          payload.tg_bat_dau,
          payload.tg_ket_thuc,
          payload.la_lua_lai,
          payload.ghi_chu,
          payload.loi_nguoi_dung,
          baocaoId,
        ]
      );
      if (!updateResult.rows[0]) throw new AppError(404, 'Không tìm thấy báo cáo');

      await client.query('DELETE FROM BaoCao_NhanSu WHERE baocao_id = $1', [baocaoId]);
      for (const nhansuId of payload.nhansu_ids) {
        await client.query(
          'INSERT INTO BaoCao_NhanSu (baocao_id, nhansu_id) VALUES ($1, $2)',
          [baocaoId, nhansuId]
        );
      }

      await client.query('COMMIT');

      const full = await pool.query(`${LIST_SELECT} WHERE bc.id = $1`, [baocaoId]);
      res.json(full.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// DELETE /api/baocao/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const baocaoId = req.params.id;
    await assertCanModify(req, baocaoId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM BaoCao_NhanSu WHERE baocao_id = $1', [baocaoId]);
      await client.query('DELETE FROM BaoCao WHERE id = $1', [baocaoId]);
      await client.query('COMMIT');
      res.json({ message: 'Xóa báo cáo thành công' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// PATCH /api/baocao/:id/loi-chuan - admin & thủ kho gán/sửa/gỡ nhãn lỗi chuẩn
router.patch(
  '/:id/loi-chuan',
  requireStaff,
  asyncHandler(async (req, res) => {
    const { loi_chuan_id } = req.body;
    const baocaoId = req.params.id;

    const bcResult = await pool.query(
      `SELECT l.ma_vat_tu FROM BaoCao bc JOIN Lo l ON l.id = bc.lo_id WHERE bc.id = $1`,
      [baocaoId]
    );
    if (!bcResult.rows[0]) throw new AppError(404, 'Không tìm thấy báo cáo');

    if (loi_chuan_id !== null && loi_chuan_id !== undefined) {
      const llResult = await pool.query('SELECT ma_vat_tu FROM LoaiLoi WHERE id = $1', [
        loi_chuan_id,
      ]);
      if (!llResult.rows[0]) throw new AppError(400, 'loi_chuan_id không tồn tại');
      if (llResult.rows[0].ma_vat_tu !== bcResult.rows[0].ma_vat_tu) {
        throw new AppError(400, 'Loại lỗi này không thuộc vật tư của báo cáo');
      }
    }

    const result = await pool.query(
      'UPDATE BaoCao SET loi_chuan_id = $1 WHERE id = $2 RETURNING id',
      [loi_chuan_id ?? null, baocaoId]
    );
    if (!result.rows[0]) throw new AppError(404, 'Không tìm thấy báo cáo');

    const full = await pool.query(`${LIST_SELECT} WHERE bc.id = $1`, [baocaoId]);
    res.json(full.rows[0]);
  })
);

module.exports = router;
