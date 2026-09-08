const express = require('express');
const pool = require('../db');
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken } = require('../middleware/auth');
const { sendExcel } = require('../utils/excelExport');
const { BC_CALC_CTE } = require('../utils/productivity');
const { paginateArray } = require('../utils/pagination');
const { LO_DA_LUA_JOIN, dacBietToText } = require('../utils/loiDacBiet');

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
  if (query.lo_id) {
    params.push(query.lo_id);
    where += ` AND bcns.lo_id = $${params.length}`;
  }
  if (query.nhansu_id) {
    params.push(query.nhansu_id);
    where += ` AND ns.id = $${params.length}`;
  }
  if (query.loi_chuan_id) {
    params.push(query.loi_chuan_id);
    where += ` AND bcns.loi_chuan_id = $${params.length}`;
  }
  if (query.ma_ncc) {
    params.push(query.ma_ncc);
    where += ` AND l.ma_ncc = $${params.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      ns.id AS nhansu_id, ns.ho_ten,
      COUNT(*) AS so_bao_cao,
      ROUND(AVG(bcns.nang_suat_8h)::numeric, 2) AS nang_suat_tb,
      SUM(bcns.dat) AS tong_dat,
      SUM(bcns.hu_bo) AS tong_hu_bo,
      SUM(bcns.tong_lua) AS tong_lua,
      ROUND((SUM(bcns.hu_bo) / NULLIF(SUM(bcns.tong_lua), 0) * 100)::numeric, 2) AS ty_le_hu_bo_pct
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

// 1b. Breakdown theo vật tư + lô + loại lỗi CHO TỪNG nhân sự
// Moi dong = 1 nhan su + 1 vat tu + 1 lo + 1 loai loi cu the (khong gop nhieu lo/loi lai).
// Loc nguoc: chon vat tu/lo/nhan su o filter chinh -> bang nay va bang chinh deu chi con
// nhung gi khop dieu kien, kem so lieu tuong ung.
function buildNhanSuVatTuBreakdownQuery(query) {
  const params = [];
  let where = 'WHERE 1=1';
  where += ` ${laLuaLaiClause(query, params)}`;
  where += dateRangeClause(query, params);
  if (query.ma_vat_tu) {
    params.push(query.ma_vat_tu);
    where += ` AND l.ma_vat_tu = $${params.length}`;
  }
  if (query.lo_id) {
    params.push(query.lo_id);
    where += ` AND bcns.lo_id = $${params.length}`;
  }
  if (query.nhansu_id) {
    params.push(query.nhansu_id);
    where += ` AND ns.id = $${params.length}`;
  }
  if (query.loi_chuan_id) {
    params.push(query.loi_chuan_id);
    where += ` AND bcns.loi_chuan_id = $${params.length}`;
  }
  if (query.ma_ncc) {
    params.push(query.ma_ncc);
    where += ` AND l.ma_ncc = $${params.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      ns.id AS nhansu_id, ns.ho_ten,
      v.ma_vat_tu, v.ten_vat_tu,
      l.id AS lo_id, l.so_lo,
      n.ten_ncc,
      COALESCE(ll.id, 0) AS loi_chuan_id,
      COALESCE(ll.ten_loi, 'Chưa gán nhãn') AS ten_loi,
      COUNT(*) AS so_bao_cao,
      ROUND(AVG(bcns.nang_suat_8h)::numeric, 2) AS nang_suat_tb,
      SUM(bcns.dat) AS tong_dat,
      SUM(bcns.hu_bo) AS tong_hu_bo,
      SUM(bcns.tong_lua) AS tong_lua,
      ROUND((SUM(bcns.hu_bo) / NULLIF(SUM(bcns.tong_lua), 0) * 100)::numeric, 2) AS ty_le_hu_bo_pct
    FROM bc_nang_suat bcns
    JOIN Lo l ON l.id = bcns.lo_id
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    LEFT JOIN NhaCungCap n ON n.ma_ncc = l.ma_ncc
    LEFT JOIN LoaiLoi ll ON ll.id = bcns.loi_chuan_id
    JOIN BaoCao_NhanSu bn ON bn.baocao_id = bcns.id
    JOIN NhanSu ns ON ns.id = bn.nhansu_id
    ${where}
    GROUP BY ns.id, ns.ho_ten, v.ma_vat_tu, v.ten_vat_tu, l.id, l.so_lo, n.ten_ncc, ll.id, ll.ten_loi
    ORDER BY ns.ho_ten ASC, v.ma_vat_tu ASC, l.so_lo ASC, so_bao_cao DESC
  `;
  return { sql, params };
}

router.get(
  '/nhansu',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoNhanSuQuery(req.query);
    const result = await pool.query(sql, params);
    // summary tinh tren TOAN BO ket qua da loc (khong phai chi trang hien tai) de cac the thong ke luon dung
    const nangSuatValues = result.rows.map((r) => r.nang_suat_tb).filter((v) => v != null).map(Number);
    const summary = {
      tong_bao_cao: result.rows.reduce((s, r) => s + Number(r.so_bao_cao), 0),
      nang_suat_cao_nhat: nangSuatValues.length ? Math.max(...nangSuatValues) : null,
    };
    res.json({ ...paginateArray(result.rows, req.query), summary });
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
        { header: 'Tỷ lệ hư bỏ (%)', key: 'ty_le_hu_bo_pct', width: 16 },
      ],
      rows: result.rows,
    });
  })
);

// GET /api/dashboard/nhansu/vattu - breakdown theo vật tư cho từng nhân sự
// (loc nguoc: chon vat tu/lo o filter chinh se chi con nhung nhan su co lam vat tu/lo do)
router.get(
  '/nhansu/vattu',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildNhanSuVatTuBreakdownQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(paginateArray(result.rows, req.query));
  })
);

router.get(
  '/nhansu/vattu/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildNhanSuVatTuBreakdownQuery(req.query);
    const result = await pool.query(sql, params);
    await sendExcel(res, {
      sheetName: 'NhanSuTheoVatTu',
      fileName: 'dashboard_nhan_su_theo_vat_tu',
      columns: [
        { header: 'Nhân sự', key: 'ho_ten', width: 24 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 30 },
        { header: 'Nhà cung cấp', key: 'ten_ncc', width: 22 },
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
  if (query.ma_vat_tu) {
    params.push(query.ma_vat_tu);
    where += ` AND v.ma_vat_tu = $${params.length}`;
  }
  if (query.lo_id) {
    params.push(query.lo_id);
    where += ` AND bcns.lo_id = $${params.length}`;
  }
  if (query.ma_ncc) {
    params.push(query.ma_ncc);
    where += ` AND l.ma_ncc = $${params.length}`;
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
    res.json(paginateArray(result.rows, req.query));
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

// 2b. Breakdown lỗi chuẩn theo TỪNG LÔ của vật tư (dùng để lọc/xem chi tiết trong dashboard theo vật tư)
// Moi dong = 1 lo cu the (so_lo lay tu danh muc Lo) + 1 loai loi cu the, cac chi so con lai
// (nang suat, tong dat/hu bo/lua, ty le hu bo) chi tinh tren bao cao thuoc DUNG lo + DUNG loi do
// - khong gop chung nhieu lo lai thanh 1 dong dem so luong nhu truoc.
function buildLoiTheoVatTuQuery(query) {
  const params = [];
  let where = 'WHERE 1=1';
  where += ` ${laLuaLaiClause(query, params)}`;
  where += dateRangeClause(query, params);
  if (query.ma_vat_tu) {
    params.push(query.ma_vat_tu);
    where += ` AND l.ma_vat_tu = $${params.length}`;
  }
  if (query.lo_id) {
    params.push(query.lo_id);
    where += ` AND bcns.lo_id = $${params.length}`;
  }
  if (query.ma_ncc) {
    params.push(query.ma_ncc);
    where += ` AND l.ma_ncc = $${params.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      v.ma_vat_tu, v.ten_vat_tu,
      l.id AS lo_id, l.so_lo,
      n.ten_ncc,
      COALESCE(ll.id, 0) AS loi_chuan_id,
      COALESCE(ll.ten_loi, 'Chưa gán nhãn') AS ten_loi,
      COUNT(*) AS so_bao_cao,
      ROUND(AVG(bcns.nang_suat_8h)::numeric, 2) AS nang_suat_tb,
      SUM(bcns.dat) AS tong_dat,
      SUM(bcns.hu_bo) AS tong_hu_bo,
      SUM(bcns.tong_lua) AS tong_lua,
      ROUND((SUM(bcns.hu_bo) / NULLIF(SUM(bcns.tong_lua), 0) * 100)::numeric, 2) AS ty_le_hu_bo_pct
    FROM bc_nang_suat bcns
    JOIN Lo l ON l.id = bcns.lo_id
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    LEFT JOIN NhaCungCap n ON n.ma_ncc = l.ma_ncc
    LEFT JOIN LoaiLoi ll ON ll.id = bcns.loi_chuan_id
    ${where}
    GROUP BY v.ma_vat_tu, v.ten_vat_tu, l.id, l.so_lo, n.ten_ncc, ll.id, ll.ten_loi
    ORDER BY v.ma_vat_tu ASC, l.so_lo ASC, so_bao_cao DESC
  `;
  return { sql, params };
}

router.get(
  '/vattu/loi',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildLoiTheoVatTuQuery(req.query);
    const result = await pool.query(sql, params);
    res.json(paginateArray(result.rows, req.query));
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
        { header: 'Số lô', key: 'so_lo', width: 10 },
        { header: 'Nhà cung cấp', key: 'ten_ncc', width: 22 },
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
  if (query.ma_ncc) {
    outerParams.push(query.ma_ncc);
    outerWhere += ` AND l.ma_ncc = $${outerParams.length}`;
  }

  const sql = `
    ${BC_CALC_CTE}
    SELECT
      l.id AS lo_id, l.so_lo, l.ma_vat_tu, v.ten_vat_tu, l.ngay_san_xuat, l.so_luong_lo,
      n.ten_ncc,
      COALESCE(dl.da_lua, 0) AS da_lua,
      COALESCE(dl.da_lua_dac_biet, '[]') AS da_lua_dac_biet,
      l.so_luong_lo - COALESCE(dl.da_lua, 0) AS con_lai,
      COALESCE(agg.so_bao_cao, 0) AS so_bao_cao,
      agg.nang_suat_tb
    FROM Lo l
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    LEFT JOIN NhaCungCap n ON n.ma_ncc = l.ma_ncc
    ${LO_DA_LUA_JOIN}
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
    res.json(paginateArray(result.rows, req.query));
  })
);

router.get(
  '/lo/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildTheoLoQuery(req.query);
    const result = await pool.query(sql, params);
    const rows = result.rows.map((r) => ({
      ...r,
      _dac_biet_txt: dacBietToText(r.da_lua_dac_biet),
    }));
    await sendExcel(res, {
      sheetName: 'NangSuatLo',
      fileName: 'dashboard_nang_suat_theo_lo',
      columns: [
        { header: 'ID lô', key: 'lo_id', width: 8 },
        { header: 'Số lô', key: 'so_lo', width: 18 },
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 28 },
        { header: 'Ngày sản xuất', key: 'ngay_san_xuat', width: 16 },
        { header: 'Nhà cung cấp', key: 'ten_ncc', width: 22 },
        { header: 'Số lượng lô', key: 'so_luong_lo', width: 14 },
        { header: 'Đã lựa (không tính lỗi đặc biệt)', key: 'da_lua', width: 22 },
        { header: 'Lỗi đặc biệt (chi tiết)', key: '_dac_biet_txt', width: 32 },
        { header: 'Còn lại', key: 'con_lai', width: 14 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 14 },
        { header: 'Năng suất TB (8h)', key: 'nang_suat_tb', width: 18 },
      ],
      rows,
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
  if (query.ma_ncc) {
    params.push(query.ma_ncc);
    where += ` AND l.ma_ncc = $${params.length}`;
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

// ================= 5. BÁO CÔNG (GIỜ LÀM) THEO LÔ =================
// Khác các dashboard trên (chỉ đo năng suất). Ở đây gom TỔNG GIỜ LÀM của từng lô, tách
// làm 2: giờ theo LỖI THƯỜNG (gồm cả báo cáo chưa gán nhãn) và giờ theo LỖI ĐẶC BIỆT
// (LoaiLoi.la_loi_dac_biet). Báo cáo nhiều người thì giờ chia đều cho từng người rồi
// cộng dồn -> tổng các phần chia đều = tổng giờ của lô.
// Phạm vi: TOÀN BỘ lịch sử của lô (không lọc ngày). CHỈ tính báo cáo LỰA CHÍNH
// (la_lua_lai = FALSE), có đủ giờ + có nhân sự.
function buildBaoCongTheoLoQuery(query) {
  const outerParams = [];
  let outerWhere = 'WHERE bc_agg.lo_id IS NOT NULL';
  if (query.ma_vat_tu) {
    outerParams.push(query.ma_vat_tu);
    outerWhere += ` AND l.ma_vat_tu = $${outerParams.length}`;
  }
  if (query.lo_id) {
    outerParams.push(query.lo_id);
    outerWhere += ` AND l.id = $${outerParams.length}`;
  }
  if (query.ma_ncc) {
    outerParams.push(query.ma_ncc);
    outerWhere += ` AND l.ma_ncc = $${outerParams.length}`;
  }

  // gio_lam mỗi người của 1 báo cáo = gio_lam / so_nhansu
  const gioNguoi = 'bcns.gio_lam / NULLIF(bcns.so_nhansu, 0)';
  const laDacBiet = 'll.la_loi_dac_biet IS TRUE';

  const sql = `
    ${BC_CALC_CTE}
    , per_person AS (
      SELECT bcns.lo_id, ns.id AS nhansu_id, ns.ho_ten,
        COUNT(*) AS so_bao_cao,
        SUM(${gioNguoi}) AS gio,
        SUM(${gioNguoi}) FILTER (WHERE ${laDacBiet}) AS gio_dac_biet,
        SUM(${gioNguoi}) FILTER (WHERE NOT (${laDacBiet})) AS gio_thuong
      FROM bc_nang_suat bcns
      JOIN BaoCao_NhanSu bn ON bn.baocao_id = bcns.id
      JOIN NhanSu ns ON ns.id = bn.nhansu_id
      LEFT JOIN LoaiLoi ll ON ll.id = bcns.loi_chuan_id
      WHERE bcns.gio_lam IS NOT NULL AND bcns.la_lua_lai = FALSE
      GROUP BY bcns.lo_id, ns.id, ns.ho_ten
    )
    SELECT
      l.id AS lo_id, l.so_lo, l.so_luong_lo, l.ma_vat_tu, v.ten_vat_tu, n.ten_ncc,
      bc_agg.so_bao_cao,
      ROUND(bc_agg.tong_gio_lam::numeric, 2) AS tong_gio_lam,
      ROUND(COALESCE(bc_agg.gio_thuong, 0)::numeric, 2) AS gio_thuong,
      ROUND(COALESCE(bc_agg.gio_dac_biet, 0)::numeric, 2) AS gio_dac_biet,
      COALESCE(pp.so_nguoi, 0) AS so_nguoi,
      COALESCE(pp.chi_tiet, '[]') AS chi_tiet_nguoi
    FROM Lo l
    JOIN VatTu v ON v.ma_vat_tu = l.ma_vat_tu
    LEFT JOIN NhaCungCap n ON n.ma_ncc = l.ma_ncc
    LEFT JOIN (
      SELECT bcns.lo_id, COUNT(*) AS so_bao_cao,
        SUM(bcns.gio_lam) AS tong_gio_lam,
        SUM(bcns.gio_lam) FILTER (WHERE ${laDacBiet}) AS gio_dac_biet,
        SUM(bcns.gio_lam) FILTER (WHERE NOT (${laDacBiet})) AS gio_thuong
      FROM bc_nang_suat bcns
      LEFT JOIN LoaiLoi ll ON ll.id = bcns.loi_chuan_id
      WHERE bcns.gio_lam IS NOT NULL AND bcns.so_nhansu > 0 AND bcns.la_lua_lai = FALSE
      GROUP BY bcns.lo_id
    ) bc_agg ON bc_agg.lo_id = l.id
    LEFT JOIN (
      SELECT lo_id, COUNT(*) AS so_nguoi,
        json_agg(
          json_build_object(
            'nhansu_id', nhansu_id, 'ho_ten', ho_ten, 'so_bao_cao', so_bao_cao,
            'gio', ROUND(gio::numeric, 2),
            'gio_thuong', ROUND(COALESCE(gio_thuong, 0)::numeric, 2),
            'gio_dac_biet', ROUND(COALESCE(gio_dac_biet, 0)::numeric, 2)
          )
          ORDER BY gio DESC
        ) AS chi_tiet
      FROM per_person
      GROUP BY lo_id
    ) pp ON pp.lo_id = l.id
    ${outerWhere}
    ORDER BY bc_agg.tong_gio_lam DESC NULLS LAST, l.id DESC
  `;
  return { sql, params: outerParams };
}

router.get(
  '/baocong-lo',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildBaoCongTheoLoQuery(req.query);
    const result = await pool.query(sql, params);
    // summary tính trên TOÀN BỘ kết quả đã lọc (không chỉ trang hiện tại)
    const summary = {
      so_lo: result.rows.length,
      tong_gio_lam: result.rows.reduce((s, r) => s + Number(r.tong_gio_lam || 0), 0),
      gio_thuong: result.rows.reduce((s, r) => s + Number(r.gio_thuong || 0), 0),
      gio_dac_biet: result.rows.reduce((s, r) => s + Number(r.gio_dac_biet || 0), 0),
      tong_bao_cao: result.rows.reduce((s, r) => s + Number(r.so_bao_cao || 0), 0),
    };
    res.json({ ...paginateArray(result.rows, req.query), summary });
  })
);

router.get(
  '/baocong-lo/export',
  asyncHandler(async (req, res) => {
    const { sql, params } = buildBaoCongTheoLoQuery(req.query);
    const result = await pool.query(sql, params);
    // Xuất phẳng: mỗi dòng = 1 (lô × người), tách giờ lỗi thường / lỗi đặc biệt.
    const rows = [];
    for (const lo of result.rows) {
      const ct = lo.chi_tiet_nguoi || [];
      const base = {
        ma_vat_tu: lo.ma_vat_tu, ten_vat_tu: lo.ten_vat_tu, so_lo: lo.so_lo, ten_ncc: lo.ten_ncc,
        lo_gio_thuong: lo.gio_thuong, lo_gio_dac_biet: lo.gio_dac_biet, lo_tong_gio: lo.tong_gio_lam,
      };
      if (ct.length === 0) {
        rows.push({ ...base, ho_ten: '', so_bao_cao: lo.so_bao_cao, gio_thuong: null, gio_dac_biet: null, gio: null });
      } else {
        for (const p of ct) {
          rows.push({
            ...base, ho_ten: p.ho_ten, so_bao_cao: p.so_bao_cao,
            gio_thuong: p.gio_thuong, gio_dac_biet: p.gio_dac_biet, gio: p.gio,
          });
        }
      }
    }
    await sendExcel(res, {
      sheetName: 'BaoCongTheoLo',
      fileName: 'bao_cong_theo_lo',
      columns: [
        { header: 'Mã vật tư', key: 'ma_vat_tu', width: 14 },
        { header: 'Tên vật tư', key: 'ten_vat_tu', width: 28 },
        { header: 'Số lô', key: 'so_lo', width: 18 },
        { header: 'Nhà cung cấp', key: 'ten_ncc', width: 22 },
        { header: 'Họ tên', key: 'ho_ten', width: 20 },
        { header: 'Số báo cáo', key: 'so_bao_cao', width: 12 },
        { header: 'Giờ lỗi thường (người)', key: 'gio_thuong', width: 20 },
        { header: 'Giờ lỗi đặc biệt (người)', key: 'gio_dac_biet', width: 20 },
        { header: 'Giờ tổng (người)', key: 'gio', width: 16 },
        { header: 'Lô: giờ lỗi thường', key: 'lo_gio_thuong', width: 18 },
        { header: 'Lô: giờ lỗi đặc biệt', key: 'lo_gio_dac_biet', width: 18 },
        { header: 'Lô: tổng giờ', key: 'lo_tong_gio', width: 14 },
      ],
      rows,
    });
  })
);

module.exports = router;
