const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { BC_CALC_CTE } = require('../utils/productivity');

const router = express.Router();
router.use(authenticateToken);

// la_lua_lai: 'false' (mặc định, loại báo cáo lựa lại - đúng "dashboard chính"),
// 'true' (chỉ báo cáo lựa lại), 'all' (gộp cả hai)
function laLuaLaiClause(query, params, alias = 'bcns') {
  const val = query.la_lua_lai;
  if (val === 'all') return '';
  params.push(val === 'true');
  return `AND ${alias}.la_lua_lai = $${params.length}`;
}

function dateRangeClause(query, params, alias = 'bcns') {
  let clause = '';
  if (query.tu_ngay) {
    params.push(query.tu_ngay);
    clause += ` AND ${alias}.ngay >= $${params.length}`;
  }
  if (query.den_ngay) {
    params.push(query.den_ngay);
    clause += ` AND ${alias}.ngay <= $${params.length}`;
  }
  return clause;
}

// ================= 1. DASHBOARD THEO NHÂN SỰ =================
function buildTheoNhanSuQuery(query) {
  const params = [];
  let where = 'WHERE 1=1';
  where += ` ${laLuaLaiClause(query, params)}`;
  where += dateRangeClause(query, params);
  if (query.ma_vat_tu) {
    params.push(query.ma_vat_tu);
    where += ` AND l.ma_vat_tu = $${params.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      ns.id AS nhansu_id, ns.ho_ten,
      COUNT(*) AS so_bao_cao,
      ROUND(AVG(bcns.nang_suat_8h)::numeric, 2) AS nang_suat_tb,
      SUM(bcns.dat) AS tong_dat,
      SUM(bcns.hu_bo) AS tong_hu_bo,
      SUM(bcns.tong_lua) AS tong_lua
    FROM bc_nang_suat bcns
    JOIN Lo l ON l.id = bcns.lo_id
    JOIN BaoCao_NhanSu bn ON bn.baocao_id = bcns.id
    JOIN NhanSu ns ON ns.id = bn.nhansu_id
    ${where}
    GROUP BY ns.id, ns.ho_ten
    ORDER BY nang_suat_tb DESC NULLS LAST
  `;
  return { sql, params };
}

router.get(
  '/nhansu',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoNhanSuQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(result.rows);
  })
);

router.get(
  '/nhansu/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoNhanSuQuery(req.query);
    const result = await pool.query(sql, params);
    await sendExcel(res, {
      sheetName: 'NangSuatNhanSu',
      fileName: 'dashboard_nang_suat_theo_nhan_su',
      columns: [
        { header: 'ID', key: 'nhansu_id', width: 8 },
        { header: 'Họ tên', key: 'ho_ten', width: 28 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 14 },
        { header: 'Năng suất TB (8h)', key: 'nang_suat_tb', width: 18 },
        { header: 'Tổng đạt', key: 'tong_dat', width: 14 },
        { header: 'Tổng hư bỏ', key: 'tong_hu_bo', width: 14 },
        { header: 'Tổng lựa', key: 'tong_lua', width: 14 },
      ],
      rows: result.rows,
    });
  })
);

// ================= 2. DASHBOARD THEO VẬT TƯ =================
function buildTheoVatTuQuery(query) {
  const params = [];
  let where = 'WHERE 1=1';
  where += ` ${laLuaLaiClause(query, params)}`;
  where += dateRangeClause(query, params);
  if (query.loi_chuan_id) {
    params.push(query.loi_chuan_id);
    where += ` AND bcns.loi_chuan_id = $${params.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      v.ma_vat_tu, v.ten_vat_tu,
      COUNT(*) AS so_bao_cao,
      ROUND(AVG(bcns.nang_suat_8h)::numeric, 2) AS nang_suat_tb,
      SUM(bcns.dat) AS tong_dat,
      SUM(bcns.hu_bo) AS tong_hu_bo,
      SUM(bcns.tong_lua) AS tong_lua,
      ROUND((SUM(bcns.hu_bo) / NULLIF(SUM(bcns.tong_lua), 0) * 100)::numeric, 2) AS ty_le_hu_bo_pct
    FROM bc_nang_suat bcns
    JOIN Lo l ON l.id = bcns.lo_id
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    ${where}
    GROUP BY v.ma_vat_tu, v.ten_vat_tu
    ORDER BY v.ma_vat_tu ASC
  `;
  return { sql, params };
}

router.get(
  '/vattu',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoVatTuQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(result.rows);
  })
);

router.get(
  '/vattu/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoVatTuQuery(req.query);
    const result = await pool.query(sql, params);
    await sendExcel(res, {
      sheetName: 'NangSuatVatTu',
      fileName: 'dashboard_nang_suat_theo_vat_tu',
      columns: [
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 30 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 14 },
        { header: 'Năng suất TB (8h)', key: 'nang_suat_tb', width: 18 },
        { header: 'Tổng đạt', key: 'tong_dat', width: 14 },
        { header: 'Tổng hư bỏ', key: 'tong_hu_bo', width: 14 },
        { header: 'Tổng lựa', key: 'tong_lua', width: 14 },
        { header: 'Tỷ lệ hư bỏ (%)', key: 'ty_le_hu_bo_pct', width: 16 },
      ],
      rows: result.rows,
    });
  })
);

// 2b. Breakdown lỗi chuẩn theo vật tư (dùng để lọc/xem chi tiết trong dashboard theo vật tư)
function buildLoiTheoVatTuQuery(query) {
  const params = [];
  let where = 'WHERE 1=1';
  where += ` ${laLuaLaiClause(query, params, 'bc')}`;
  where += dateRangeClause(query, params, 'bc');
  if (query.ma_vat_tu) {
    params.push(query.ma_vat_tu);
    where += ` AND l.ma_vat_tu = $${params.length}`;
  }

  const sql = `
    SELECT
      v.ma_vat_tu, v.ten_vat_tu,
      COALESCE(ll.id, 0) AS loi_chuan_id,
      COALESCE(ll.ten_loi, 'Chưa gán nhãn') AS ten_loi,
      COUNT(*) AS so_bao_cao,
      SUM(bc.hu_bo) AS tong_hu_bo
    FROM BaoCao bc
    JOIN Lo l ON l.id = bc.lo_id
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    LEFT JOIN LoaiLoi ll ON ll.id = bc.loi_chuan_id
    ${where}
    GROUP BY v.ma_vat_tu, v.ten_vat_tu, ll.id, ll.ten_loi
    ORDER BY v.ma_vat_tu ASC, so_bao_cao DESC
  `;
  return { sql, params };
}

router.get(
  '/vattu/loi',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildLoiTheoVatTuQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(result.rows);
  })
);

router.get(
  '/vattu/loi/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildLoiTheoVatTuQuery(req.query);
    const result = await pool.query(sql, params);
    await sendExcel(res, {
      sheetName: 'LoiTheoVatTu',
      fileName: 'dashboard_loi_theo_vat_tu',
      columns: [
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 30 },
        { header: 'Loại lỗi', key: 'ten_loi', width: 30 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 14 },
        { header: 'Tổng hư bỏ', key: 'tong_hu_bo', width: 14 },
      ],
      rows: result.rows,
    });
  })
);

// ================= 3. DASHBOARD THEO LÔ =================
function buildTheoLoQuery(query) {
  const aggParams = [];
  let aggWhere = 'WHERE 1=1';
  aggWhere += ` ${laLuaLaiClause(query, aggParams)}`;
  aggWhere += dateRangeClause(query, aggParams);

  const outerParams = [...aggParams];
  let outerWhere = 'WHERE 1=1';
  if (query.ma_vat_tu) {
    outerParams.push(query.ma_vat_tu);
    outerWhere += ` AND l.ma_vat_tu = $${outerParams.length}`;
  }
  if (query.lo_id) {
    outerParams.push(query.lo_id);
    outerWhere += ` AND l.id = $${outerParams.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      l.id AS lo_id, l.so_lo, l.ma_vat_tu, v.ten_vat_tu, l.ngay_san_xuat, l.so_luong_lo,
      COALESCE(cap.da_lua, 0) AS da_lua,
      l.so_luong_lo - COALESCE(cap.da_lua, 0) AS con_lai,
      COALESCE(agg.so_bao_cao, 0) AS so_bao_cao,
      agg.nang_suat_tb
    FROM Lo l
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    LEFT JOIN (
      SELECT lo_id, SUM(tong_lua) AS da_lua FROM BaoCao WHERE la_lua_lai = FALSE GROUP BY lo_id
    ) cap ON cap.lo_id = l.id
    LEFT JOIN (
      SELECT lo_id, COUNT(*) AS so_bao_cao, ROUND(AVG(nang_suat_8h)::numeric, 2) AS nang_suat_tb
      FROM bc_nang_suat bcns
      ${aggWhere}
      GROUP BY lo_id
    ) agg ON agg.lo_id = l.id
    ${outerWhere}
    ORDER BY l.id DESC
  `;
  return { sql, params: outerParams };
}

router.get(
  '/lo',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoLoQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(result.rows);
  })
);

router.get(
  '/lo/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoLoQuery(req.query);
    const result = await pool.query(sql, params);
    await sendExcel(res, {
      sheetName: 'NangSuatLo',
      fileName: 'dashboard_nang_suat_theo_lo',
      columns: [
        { header: 'ID lô', key: 'lo_id', width: 8 },
        { header: 'Số lô', key: 'so_lo', width: 18 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 28 },
        { header: 'Ngày sản xuất', key: 'ngay_san_xuat', width: 16 },
        { header: 'Số lượng lô', key: 'so_luong_lo', width: 14 },
        { header: 'Đã lựa', key: 'da_lua', width: 14 },
        { header: 'Còn lại', key: 'con_lai', width: 14 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 14 },
        { header: 'Năng suất TB (8h)', key: 'nang_suat_tb', width: 18 },
      ],
      rows: result.rows,
    });
  })
);

// ================= 4. DASHBOARD THEO THỜI GIAN =================
function buildTheoThoiGianQuery(query) {
  const groupBy = query.group_by === 'thang' ? 'thang' : 'ngay';
  const kyExpr = groupBy === 'thang' ? `date_trunc('month', bcns.ngay)` : `bcns.ngay`;

  const params = [];
  let where = 'WHERE 1=1';
  where += ` ${laLuaLaiClause(query, params)}`;
  where += dateRangeClause(query, params);
  if (query.ma_vat_tu) {
    params.push(query.ma_vat_tu);
    where += ` AND l.ma_vat_tu = $${params.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      ${kyExpr} AS ky,
      COUNT(*) AS so_bao_cao,
      SUM(bcns.dat) AS tong_dat,
      SUM(bcns.hu_bo) AS tong_hu_bo,
      SUM(bcns.tong_lua) AS tong_lua,
      ROUND(AVG(bcns.nang_suat_8h)::numeric, 2) AS nang_suat_tb
    FROM bc_nang_suat bcns
    JOIN Lo l ON l.id = bcns.lo_id
    ${where}
    GROUP BY ky
    ORDER BY ky ASC
  `;
  return { sql, params };
}

router.get(
  '/thoigian',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoThoiGianQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(result.rows);
  })
);

router.get(
  '/thoigian/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoThoiGianQuery(req.query);
    const result = await pool.query(sql, params);
    await sendExcel(res, {
      sheetName: 'NangSuatThoiGian',
      fileName: 'dashboard_nang_suat_theo_thoi_gian',
      columns: [
        { header: 'Kỳ', key: 'ky', width: 16 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 14 },
        { header: 'Tổng đạt', key: 'tong_dat', width: 14 },
        { header: 'Tổng hư bỏ', key: 'tong_hu_bo', width: 14 },
        { header: 'Tổng lựa', key: 'tong_lua', width: 14 },
        { header: 'Năng suất TB (8h)', key: 'nang_suat_tb', width: 18 },
      ],
      rows: result.rows,
    });
  })
);

module.exports = router;
