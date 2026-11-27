const express = require('express');
const pool = require('../db');
const AppError = require('../utils/AppError');
const { authenticateToken, requireAdmin, requireAdminOrNhanVien } = require('../middleware/auth');
const { sendExcelSheets } = require('../utils/excelExport');
const { paginateArray } = require('../utils/pagination');
const { sortRows } = require('../utils/sort');
const { GIO_NGHI_TRUA_BAT_DAU, GIO_NGHI_TRUA_KET_THUC } = require('../utils/productivity');
const xinNghi = require('../utils/xinNghi');

const router = express.Router();
router.use(authenticateToken);
// Thủ kho XEM được (danh sách, tổng hợp, xuất Excel) nhưng không ghi gì: mọi route ghi gắn requireAdminOrNhanVien.

const SORT_COLUMNS = { ho_ten: 'ho_ten', tu_ngay: 'tu_ngay', loai: 'loai', trang_thai: 'trang_thai' };
const KHOA_DOT = 'COALESCE(x.nhom_id::text, x.id::text)'; // các ngày cùng đợt gộp thành 1 dòng

// XEM đơn: nhân viên và admin đều thấy đơn của MỌI người (?nhansu_id= để lọc).
// XEM tổng hợp tháng: admin và thủ kho thấy mọi người, nhân viên chỉ thấy của mình.
// GHI: nhân viên chỉ thao tác được đơn của mình, người được kê hộ thêm đơn đã nhập hộ (kiểm trong utils/xinNghi.js).
function locNhanSu(req) {
  if (!req.query.nhansu_id) return null;
  const id = Number(req.query.nhansu_id);
  if (!Number.isInteger(id)) throw new AppError(400, 'nhansu_id không hợp lệ');
  return id;
}

// 'YYYY-MM' -> ngày đầu tháng
function dauThang(thang) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(thang || ''))) throw new AppError(400, 'Tháng không hợp lệ (YYYY-MM)');
  return `${thang}-01`;
}

const trongThang = (n) => `x.ngay >= $${n}::date AND x.ngay < ($${n}::date + INTERVAL '1 month')`;

// Bộ lọc dùng chung cho danh sách và xuất Excel
function locDon(req) {
  const { thang, trang_thai, loai } = req.query;
  const nhansuId = locNhanSu(req);
  const conditions = [];
  const params = [];
  const them = (sql, value) => {
    params.push(value);
    conditions.push(sql(params.length));
  };
  if (thang && thang !== 'all') them(trongThang, dauThang(thang));
  if (nhansuId) them((n) => `x.nhansu_id = $${n}`, nhansuId);
  if (trang_thai) them((n) => `x.trang_thai = $${n}`, trang_thai);
  if (loai) them((n) => `x.loai = $${n}`, loai);
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

// Excel: mỗi dòng = 1 người, 1 ngày (đợt nhiều ngày tách ra từng ngày)
const COT_CHI_TIET = [
  { header: 'Họ tên', key: 'ho_ten', width: 28 },
  { header: 'Ngày', key: 'ngay', width: 14 },
  { header: 'Loại', key: 'loai', width: 18 },
  { header: 'Từ giờ / giờ vào', key: 'tu_gio', width: 18 },
  { header: 'Đến giờ / giờ ra', key: 'den_gio', width: 18 },
  { header: 'Lý do', key: 'ly_do', width: 40 },
  { header: 'Trạng thái', key: 'trang_thai', width: 14 },
];

async function dongChiTiet(where, params) {
  const result = await pool.query(
    `SELECT ns.ho_ten, x.ngay, x.loai, x.tu_gio, x.den_gio, x.ly_do, x.trang_thai
     FROM XinNghi x JOIN NhanSu ns ON ns.id = x.nhansu_id
     ${where}
     ORDER BY ns.ho_ten, ns.id, x.ngay, x.tu_gio NULLS FIRST`,
    params
  );
  return result.rows.map((r) => ({
    ...r,
    loai: xinNghi.LOAI[r.loai].ten,
    tu_gio: !r.tu_gio && !r.den_gio ? 'Cả ngày' : r.tu_gio?.slice(0, 5) || '',
    den_gio: r.den_gio?.slice(0, 5) || '',
    trang_thai: xinNghi.TRANG_THAI[r.trang_thai],
  }));
}

// GET /api/xin-nghi/export - Excel đơn xin nghỉ theo cùng bộ lọc với danh sách (không phân trang)
router.get('/export', async (req, res) => {
  const { where, params } = locDon(req);
  const { thang } = req.query;
  await sendExcelSheets(res, {
    fileName: `don_xin_nghi_${thang && thang !== 'all' ? thang : 'tat_ca'}`,
    sheets: [{ sheetName: 'DonXinNghi', columns: COT_CHI_TIET, rows: await dongChiTiet(where, params) }],
  });
});

// GET /api/xin-nghi?thang=YYYY-MM|all&trang_thai=&loai=&nhansu_id= : mỗi dòng = 1 đơn (hoặc 1 đợt)
router.get('/', async (req, res) => {
  const { where, params } = locDon(req);

  const result = await pool.query(
    `SELECT ${KHOA_DOT} AS khoa, MIN(x.id) AS id, x.nhom_id, x.nhansu_id, ns.ho_ten, x.loai, x.trang_thai,
       MIN(x.ngay) AS tu_ngay, MAX(x.ngay) AS den_ngay, COUNT(*)::int AS so_ngay,
       MIN(x.tu_gio) AS tu_gio, MIN(x.den_gio) AS den_gio, MIN(x.ly_do) AS ly_do,
       MIN(x.ghi_chu_duyet) AS ghi_chu_duyet, MIN(nd.ho_ten) AS nguoi_duyet, MIN(nt.ho_ten) AS nguoi_tao,
       MIN(x.nguoi_tao_id) AS nguoi_tao_id,
       json_agg(json_build_object('id', x.id, 'ngay', x.ngay, 'tu_gio', x.tu_gio, 'den_gio', x.den_gio,
                                  'ly_do', x.ly_do) ORDER BY x.ngay) AS cac_ngay
     FROM XinNghi x
     JOIN NhanSu ns ON ns.id = x.nhansu_id
     JOIN NhanSu nt ON nt.id = x.nguoi_tao_id
     LEFT JOIN NhanSu nd ON nd.id = x.nguoi_duyet_id
     WHERE ${KHOA_DOT} IN (SELECT ${KHOA_DOT} FROM XinNghi x ${where})
     GROUP BY ${KHOA_DOT}, x.nhom_id, x.nhansu_id, ns.ho_ten, x.loai, x.trang_thai
     ORDER BY MIN(x.ngay) DESC, MIN(x.id) DESC`,
    params
  );

  const laAdmin = req.user.vai_tro === 'admin';
  const keHo = await xinNghi.duocKeHo(pool, req.user);
  const rows = result.rows.map((r) => {
    // quyền tính ở server theo giờ VN, FE chỉ việc ẩn/hiện nút
    const duocPhep =
      laAdmin ||
      (req.user.vai_tro === 'nhan_vien' &&
        xinNghi.laDonCua(req.user, r, keHo) &&
        r.trang_thai === 'cho_duyet' &&
        xinNghi.conHan(r.loai, r.tu_ngay));
    return { ...r, co_the_xoa: duocPhep, co_the_sua: duocPhep && !r.nhom_id };
  });

  // admin: đếm đơn chờ duyệt ở MỌI tháng, để không bị sót đơn ngoài tháng đang xem
  let choDuyet = 0;
  if (laAdmin) {
    const r = await pool.query(
      `SELECT COUNT(DISTINCT ${KHOA_DOT})::int AS n FROM XinNghi x WHERE x.trang_thai = 'cho_duyet'`
    );
    choDuyet = r.rows[0].n;
  }

  res.json({
    ...paginateArray(sortRows(rows, req.query, SORT_COLUMNS), req.query),
    cho_duyet_tong: choDuyet,
    duoc_ke_ho: keHo, // FE dựa vào đây để hiện ô chọn nhân viên
  });
});

// GET /api/xin-nghi/con-lai?ngay=&nhansu_id=&bo_qua_id= : số lần đã dùng trong tháng của `ngay`
router.get('/con-lai', requireAdminOrNhanVien, async (req, res) => {
  // số lượt còn lại (dùng trong form kê): admin và người được kê hộ hỏi được cho người khác
  const chonNguoi = req.user.vai_tro === 'admin' || (await xinNghi.duocKeHo(pool, req.user));
  const nhansuId = chonNguoi ? locNhanSu(req) : req.user.id;
  if (!nhansuId) throw new AppError(400, 'Thiếu nhansu_id');
  const ngay = xinNghi.docNgay(req.query.ngay, 'ngay');
  const boQua = Number(req.query.bo_qua_id);
  const data = await xinNghi.soLanTrongThang(nhansuId, ngay, Number.isInteger(boQua) && boQua > 0 ? [boQua] : []);
  res.json({ data });
});

const GIO_CONG_NGAY = 8; // để quy giờ nghỉ phép ra ngày

// Số giờ của đơn nghỉ theo giờ, trừ phần trùng nghỉ trưa (giống cách tính giờ làm)
const SO_GIO = `(EXTRACT(EPOCH FROM (x.den_gio - x.tu_gio))
  - GREATEST(0, EXTRACT(EPOCH FROM (LEAST(x.den_gio, TIME '${GIO_NGHI_TRUA_KET_THUC}')
      - GREATEST(x.tu_gio, TIME '${GIO_NGHI_TRUA_BAT_DAU}'))))) / 3600.0`;

// Tổng hợp tháng: admin (nhansuId = null) liệt kê MỌI nhân viên kể cả người không có đơn; nhân viên chỉ 1 dòng
// của mình. Số liệu CHỈ cộng đơn đã duyệt; cho_duyet = số ngày còn chờ để cảnh báo.
// Phép: cả ngày = 1, theo giờ = số giờ / 8 (ra số lẻ thập phân). Ốm: có đơn trong ngày là 1 ngày, kể cả kê theo giờ.
async function tongHop(thang, nhansuId) {
  const params = [dauThang(thang)];
  if (nhansuId) params.push(nhansuId);
  const duyet = (dk) => `FILTER (WHERE x.trang_thai = 'da_duyet' AND ${dk})`;
  const result = await pool.query(
    `SELECT ns.id AS nhansu_id, ns.ho_ten,
       ROUND(COALESCE(SUM(CASE WHEN x.tu_gio IS NULL THEN 1 ELSE ${SO_GIO} / ${GIO_CONG_NGAY} END)
         ${duyet("x.loai = 'nghi_phep'")}, 0)::numeric, 3)::float AS phep_ngay,
       (COUNT(DISTINCT x.ngay) ${duyet("x.loai = 'nghi_om'")})::int AS om_ngay,
       (COUNT(*) ${duyet("x.loai = 'che_do_nu'")})::int AS che_do_nu,
       (COUNT(*) ${duyet("x.loai = 'di_tre'")})::int AS di_tre,
       (COUNT(*) ${duyet("x.loai = 've_som'")})::int AS ve_som,
       (COUNT(*) ${duyet("x.loai = 'quen_cham_cong'")})::int AS quen_cham_cong,
       (COUNT(x.id) FILTER (WHERE x.trang_thai = 'cho_duyet'))::int AS cho_duyet
     FROM NhanSu ns
     LEFT JOIN XinNghi x ON x.nhansu_id = ns.id AND ${trongThang(1)} AND x.trang_thai <> 'tu_choi'
     WHERE (ns.vai_tro = 'nhan_vien' OR x.id IS NOT NULL) ${nhansuId ? 'AND ns.id = $2' : ''}
     GROUP BY ns.id, ns.ho_ten
     ORDER BY ns.ho_ten, ns.id`,
    params
  );
  return result.rows;
}

// null = xem tất cả (admin, thủ kho). Lấy từ token, không nhận từ query nên nhân viên không đổi được.
const chiXemCuaAi = (req) => (req.user.vai_tro === 'nhan_vien' ? req.user.id : null);

router.get('/tong-hop', async (req, res) => {
  res.json({ data: await tongHop(req.query.thang, chiXemCuaAi(req)) });
});

// Excel 2 sheet: "Tổng hợp" (chỉ đơn đã duyệt) + "Chi tiết" (từng ngày, mọi trạng thái)
router.get('/tong-hop/export', async (req, res) => {
  const { thang } = req.query;
  const nhansuId = chiXemCuaAi(req);
  const tong = await tongHop(thang, nhansuId);
  const chiTiet = await dongChiTiet(
    `WHERE ${trongThang(1)} ${nhansuId ? 'AND x.nhansu_id = $2' : ''}`,
    nhansuId ? [dauThang(thang), nhansuId] : [dauThang(thang)]
  );

  await sendExcelSheets(res, {
    fileName: `xin_nghi_${thang}`,
    sheets: [
      {
        sheetName: 'TongHop',
        columns: [
          { header: 'Họ tên', key: 'ho_ten', width: 28 },
          { header: 'Phép (ngày)', key: 'phep_ngay', width: 14 },
          { header: 'Ốm (ngày)', key: 'om_ngay', width: 12 },
          { header: 'Chế độ nữ (lần)', key: 'che_do_nu', width: 16 },
          { header: 'Đi trễ (lần)', key: 'di_tre', width: 14 },
          { header: 'Về sớm (lần)', key: 've_som', width: 14 },
          { header: 'Quên chấm công (lần)', key: 'quen_cham_cong', width: 22 },
          { header: 'Còn chờ duyệt (chưa cộng)', key: 'cho_duyet', width: 26 },
        ],
        rows: tong,
      },
      { sheetName: 'ChiTiet', columns: COT_CHI_TIET, rows: chiTiet },
    ],
  });
});

// POST /api/xin-nghi - nhân viên kê cho mình hoặc kê hộ nếu được tick (chờ duyệt); admin kê hộ (duyệt luôn)
router.post('/', requireAdminOrNhanVien, async (req, res) => {
  res.status(201).json(await xinNghi.taoDon(req.user, req.body || {}));
});

router.put('/:id', requireAdminOrNhanVien, async (req, res) => {
  res.json(await xinNghi.suaDon(req.user, req.params.id, req.body || {}));
});

// ?ca_dot=true (admin) : xóa cả đợt. Nhân viên luôn xóa cả đợt.
router.delete('/:id', requireAdminOrNhanVien, async (req, res) => {
  res.json(await xinNghi.xoaDon(req.user, req.params.id, req.query.ca_dot === 'true'));
});

router.patch('/:id/trang-thai', requireAdmin, async (req, res) => {
  const { trang_thai, ghi_chu_duyet } = req.body || {};
  res.json(await xinNghi.doiTrangThai(req.user, req.params.id, trang_thai, ghi_chu_duyet));
});

module.exports = router;
