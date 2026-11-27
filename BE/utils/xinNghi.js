// Nghiệp vụ kê khai xin nghỉ. DB chỉ giữ dữ liệu, MỌI luật nằm ở đây.
// Mọi thao tác ghi chạy trong transaction + khóa theo từng người (khoaNhanSu) để bấm 2 lần
// / dùng 2 máy cùng lúc không lọt qua giới hạn số lần.
const crypto = require('crypto');
const pool = require('../db');
const AppError = require('./AppError');
const { GIO_NGHI_TRUA_BAT_DAU, GIO_NGHI_TRUA_KET_THUC } = require('./productivity');

// buLui: nhân viên được kê lùi mấy ngày (0 = từ hôm nay, 1 = từ hôm qua). Admin không bị giới hạn.
// soPhut: loại có thời lượng cố định -> chỉ nhập giờ bắt đầu, giờ kết thúc tự tính.
// nhieuNgay: được chọn "đến ngày" (luôn là cả ngày).
// Nghỉ phép: chỉ 1 ngày, 0,5 hoặc 0,25 ngày (phan_ngay). Nghỉ ốm: luôn trọn ngày, không nhập giờ.
const LOAI = {
  nghi_phep: { ten: 'Nghỉ phép', buLui: 0, nhieuNgay: true },
  nghi_om: { ten: 'Nghỉ ốm', buLui: 1, nhieuNgay: true },
  che_do_nu: { ten: 'Chế độ nữ', buLui: 0, soPhut: 90 },
  di_tre: { ten: 'Đi trễ', buLui: 0, soPhut: 30 },
  ve_som: { ten: 'Về sớm', buLui: 0, soPhut: 30 },
  quen_cham_cong: { ten: 'Quên chấm công', buLui: 1 },
};

const PHUT_PHEP = { 0.5: 240, 0.25: 120 }; // phép theo phần ngày -> số phút làm việc được nghỉ

const TRANG_THAI = { cho_duyet: 'Chờ duyệt', da_duyet: 'Đã duyệt', tu_choi: 'Từ chối' };

// Giới hạn số lần trong 1 THÁNG DƯƠNG LỊCH của ngày nghỉ. Đơn chờ duyệt + đã duyệt đều tính.
// Quên chấm công: 1 đơn = 1 mốc (giờ vào HOẶC giờ ra) = 1 lần; quên cả hai trong 1 ngày = 2 đơn = 2 lần.
const GIOI_HAN = [
  { ten: 'đi trễ/về sớm', loai: ['di_tre', 've_som'], toiDa: 3 },
  { ten: 'quên chấm công', loai: ['quen_cham_cong'], toiDa: 2 },
  { ten: 'chế độ nữ', loai: ['che_do_nu'], toiDa: 1 },
];

const MAX_NGAY_MOT_DOT = 31;
const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const GIO_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Ngày: luôn là chuỗi 'YYYY-MM-DD', tính trên UTC để không lệch múi giờ ----------
const homNayVN = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

const toDate = (s) => new Date(`${s}T00:00:00Z`);

function congNgay(s, n) {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const laChuNhat = (s) => toDate(s).getUTCDay() === 0;
const ngayVN = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

function docNgay(value, ten) {
  const s = String(value || '');
  // so lại với chính nó để loại ngày không tồn tại (vd 2026-02-31)
  if (!NGAY_RE.test(s) || Number.isNaN(toDate(s).getTime()) || toDate(s).toISOString().slice(0, 10) !== s) {
    throw new AppError(400, `${ten} không hợp lệ (định dạng YYYY-MM-DD)`);
  }
  return s;
}

function docGio(value, ten) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).slice(0, 5);
  if (!GIO_RE.test(s)) throw new AppError(400, `${ten} không hợp lệ, cần định dạng 24 giờ HH:MM`);
  return s;
}

function congPhut(gio, phut) {
  const [h, m] = gio.split(':').map(Number);
  const tong = h * 60 + m + phut;
  if (tong >= 24 * 60) throw new AppError(400, 'Giờ kết thúc vượt quá ngày, hãy chọn giờ bắt đầu sớm hơn');
  return `${String(Math.floor(tong / 60)).padStart(2, '0')}:${String(tong % 60).padStart(2, '0')}`;
}

// Giờ kết thúc của phép 0,5 / 0,25 ngày: không tính khung nghỉ trưa
function gioKetThucPhep(tu_gio, phut) {
  const trongGioTrua = tu_gio >= GIO_NGHI_TRUA_BAT_DAU && tu_gio < GIO_NGHI_TRUA_KET_THUC;
  const batDau = trongGioTrua ? GIO_NGHI_TRUA_KET_THUC : tu_gio;
  const ketThuc = congPhut(batDau, phut);
  const vatQuaTrua = batDau < GIO_NGHI_TRUA_BAT_DAU && ketThuc > GIO_NGHI_TRUA_BAT_DAU;
  return vatQuaTrua ? congPhut(ketThuc, 60) : ketThuc;
}

// Chuẩn hóa dữ liệu 1 đơn gửi lên. Trả về { loai, ngay, den_ngay, tu_gio, den_gio, ly_do }.
function chuanHoaDon(body = {}) {
  const loai = body.loai;
  const cauHinh = Object.hasOwn(LOAI, loai) ? LOAI[loai] : null;
  if (!cauHinh) throw new AppError(400, 'Loại nghỉ không hợp lệ');

  const ngay = docNgay(body.ngay, 'Ngày nghỉ');
  const den_ngay = body.den_ngay ? docNgay(body.den_ngay, 'Đến ngày') : ngay;
  if (den_ngay < ngay) throw new AppError(400, '"Đến ngày" phải từ ngày bắt đầu trở đi');

  const nhieuNgay = den_ngay !== ngay;
  if (nhieuNgay && !cauHinh.nhieuNgay) {
    throw new AppError(400, `${cauHinh.ten} chỉ kê được từng ngày một`);
  }

  let tu_gio = docGio(body.tu_gio, 'Từ giờ');
  let den_gio = docGio(body.den_gio, 'Đến giờ');

  if (cauHinh.soPhut) {
    if (!tu_gio) throw new AppError(400, `${cauHinh.ten}: cần chọn giờ bắt đầu`);
    den_gio = congPhut(tu_gio, cauHinh.soPhut);
  } else if (loai === 'quen_cham_cong') {
    if (!tu_gio === !den_gio) {
      throw new AppError(400, 'Quên chấm công: mỗi đơn chỉ chọn 1 mốc, giờ vào hoặc giờ ra (quên cả hai thì kê 2 đơn)');
    }
  } else if (loai === 'nghi_om') {
    if (tu_gio || den_gio) throw new AppError(400, 'Nghỉ ốm tính trọn ngày, không nhập giờ');
  } else {
    // nghỉ phép: cả ngày (không có giờ) hoặc 0,5 / 0,25 ngày (chọn giờ bắt đầu, giờ kết thúc tự tính)
    const phan = body.phan_ngay ? Number(body.phan_ngay) : 1;
    if (phan === 1) {
      if (tu_gio || den_gio) throw new AppError(400, 'Nghỉ phép theo giờ thì chọn 0,5 hoặc 0,25 ngày');
    } else {
      if (!Object.hasOwn(PHUT_PHEP, String(phan))) throw new AppError(400, 'Nghỉ phép chỉ được 1, 0,5 hoặc 0,25 ngày');
      if (nhieuNgay) throw new AppError(400, 'Nghỉ nhiều ngày chỉ kê được cả ngày');
      if (!tu_gio) throw new AppError(400, 'Nghỉ phép: cần chọn giờ bắt đầu');
      den_gio = gioKetThucPhep(tu_gio, PHUT_PHEP[phan]);
    }
  }
  if (tu_gio && den_gio && den_gio <= tu_gio) throw new AppError(400, 'Giờ sau phải lớn hơn giờ trước');

  const ly_do = String(body.ly_do || '').trim().slice(0, 255) || null;
  return { loai, ngay, den_ngay, tu_gio, den_gio, ly_do };
}

// Các ngày thực sự tạo dòng: bỏ Chủ nhật.
function dsNgayNghi(ngay, den_ngay) {
  if (congNgay(ngay, MAX_NGAY_MOT_DOT - 1) < den_ngay) {
    throw new AppError(400, `Một đợt tối đa ${MAX_NGAY_MOT_DOT} ngày`);
  }
  const ds = [];
  for (let d = ngay; d <= den_ngay; d = congNgay(d, 1)) {
    if (!laChuNhat(d)) ds.push(d);
  }
  if (!ds.length) throw new AppError(400, 'Chủ nhật không cần kê xin nghỉ');
  return ds;
}

function kiemNgayHopLe(loai, ngay) {
  if (laChuNhat(ngay)) throw new AppError(400, 'Chủ nhật không cần kê xin nghỉ');
  if (loai === 'quen_cham_cong' && ngay > homNayVN()) {
    throw new AppError(400, 'Quên chấm công chỉ kê cho hôm nay hoặc ngày đã qua');
  }
}

// ---------- Hạn kê của nhân viên ----------
const ngaySomNhat = (loai) => congNgay(homNayVN(), -LOAI[loai].buLui);
const conHan = (loai, ngay) => ngay >= ngaySomNhat(loai);

function kiemHan(loai, ngay) {
  if (conHan(loai, ngay)) return;
  throw new AppError(
    403,
    `Ngày ${ngayVN(ngay)} đã quá hạn. ${LOAI[loai].ten} chỉ kê/sửa được từ ngày ${ngayVN(ngaySomNhat(loai))}, các ngày trước đó nhờ admin.`
  );
}

// ---------- Kiểm tra trùng đơn + giới hạn số lần ----------
const gio5 = (t) => (t ? t.slice(0, 5) : null);
const caNgay = (d) => (d.loai === 'nghi_phep' || d.loai === 'nghi_om') && !d.tu_gio;

function biTrung(a, b) {
  if (caNgay(a) || caNgay(b)) return true;
  const quenA = a.loai === 'quen_cham_cong';
  const quenB = b.loai === 'quen_cham_cong';
  // quên chấm công là mốc bấm giờ, không phải khoảng nghỉ: chỉ trùng khi cùng kê 1 đầu (vào/ra)
  if (quenA && quenB) return !!((a.tu_gio && b.tu_gio) || (a.den_gio && b.den_gio));
  if (quenA || quenB) return false;
  // đi trễ / về sớm / chế độ nữ: mỗi loại 1 đơn / ngày
  if (a.loai === b.loai && LOAI[a.loai].soPhut) return true;
  return gio5(a.tu_gio) < gio5(b.den_gio) && gio5(b.tu_gio) < gio5(a.den_gio);
}

async function kiemTrung(db, nhansuId, don, boQua = []) {
  const r = await db.query(
    `SELECT loai, tu_gio, den_gio FROM XinNghi
     WHERE nhansu_id = $1 AND ngay = $2 AND trang_thai <> 'tu_choi' AND NOT (id = ANY($3::int[]))`,
    [nhansuId, don.ngay, boQua]
  );
  const trung = r.rows.find((cu) => biTrung(don, cu));
  if (trung) throw new AppError(409, `Ngày ${ngayVN(don.ngay)} đã có đơn ${LOAI[trung.loai].ten}, trùng giờ`);
}

// Số đơn đang được tính vào 1 giới hạn trong tháng của `ngay`.
async function soDaDung(db, nhansuId, gioiHan, ngay, boQua) {
  const r = await db.query(
    `SELECT COUNT(*)::int AS n FROM XinNghi
     WHERE nhansu_id = $1 AND loai = ANY($2::text[]) AND trang_thai <> 'tu_choi'
       AND ngay >= $3::date AND ngay < ($3::date + INTERVAL '1 month')
       AND NOT (id = ANY($4::int[]))`,
    [nhansuId, gioiHan.loai, `${ngay.slice(0, 7)}-01`, boQua]
  );
  return r.rows[0].n;
}

async function kiemGioiHan(db, nhansuId, don, boQua = []) {
  const gioiHan = GIOI_HAN.find((g) => g.loai.includes(don.loai));
  if (!gioiHan) return;
  const daDung = await soDaDung(db, nhansuId, gioiHan, don.ngay, boQua);
  if (daDung >= gioiHan.toiDa) {
    const thang = `${don.ngay.slice(5, 7)}/${don.ngay.slice(0, 4)}`;
    throw new AppError(
      409,
      `Đã dùng ${daDung}/${gioiHan.toiDa} lần ${gioiHan.ten} trong tháng ${thang}, không kê thêm được`
    );
  }
}

// Số lần đã dùng của mọi giới hạn trong tháng của `ngay` (để form hiện "còn x lần").
async function soLanTrongThang(nhansuId, ngay, boQua = []) {
  return Promise.all(
    GIOI_HAN.map(async (g) => ({
      ten: g.ten,
      loai: g.loai,
      toi_da: g.toiDa,
      da_dung: await soDaDung(pool, nhansuId, g, ngay, boQua),
    }))
  );
}

// ---------- Quyền kê hộ ----------
// Admin tick NhanSu.duoc_ke_ho cho nhân viên phụ trách. Đọc thẳng DB nên tick / bỏ tick có hiệu lực ngay.
async function duocKeHo(db, user) {
  if (user.vai_tro !== 'nhan_vien') return false;
  const r = await db.query('SELECT duoc_ke_ho FROM NhanSu WHERE id = $1', [user.id]);
  return !!r.rows[0]?.duoc_ke_ho;
}

// Nhân viên được đụng vào: đơn đứng tên mình; người được kê hộ thêm đơn do chính mình nhập.
const laDonCua = (user, don, keHo) => don.nhansu_id === user.id || (keHo && don.nguoi_tao_id === user.id);

// ---------- Ghi dữ liệu ----------
async function trongGiaoDich(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const kq = await fn(client);
    await client.query('COMMIT');
    return kq;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Khóa theo người. NO KEY UPDATE: không cản các bảng khác đang tham chiếu khóa ngoại tới NhanSu
// (vd nhập báo cáo lựa cùng lúc).
async function khoaNhanSu(client, nhansuId) {
  const r = await client.query('SELECT id, vai_tro FROM NhanSu WHERE id = $1 FOR NO KEY UPDATE', [nhansuId]);
  if (!r.rows[0]) throw new AppError(400, 'Nhân sự không tồn tại');
  return r.rows[0];
}

// Đọc đơn theo id sau khi đã khóa người nghỉ; kèm toàn bộ các dòng cùng đợt.
async function docDon(client, id, user) {
  const so = Number(id);
  if (!Number.isInteger(so) || so <= 0) throw new AppError(404, 'Không tìm thấy đơn');
  const chu = await client.query('SELECT nhansu_id FROM XinNghi WHERE id = $1', [so]);
  if (!chu.rows[0]) throw new AppError(404, 'Không tìm thấy đơn');
  await khoaNhanSu(client, chu.rows[0].nhansu_id);

  const r = await client.query('SELECT * FROM XinNghi WHERE id = $1', [so]);
  const don = r.rows[0];
  if (!don) throw new AppError(404, 'Không tìm thấy đơn');
  if (user.vai_tro !== 'admin' && !laDonCua(user, don, await duocKeHo(client, user))) {
    throw new AppError(403, 'Bạn chỉ được thao tác đơn của mình hoặc đơn bạn đã kê hộ');
  }
  const dot = don.nhom_id
    ? (await client.query('SELECT * FROM XinNghi WHERE nhom_id = $1 ORDER BY ngay', [don.nhom_id])).rows
    : [don];
  return { don, dot };
}

// Nhân viên chỉ sửa/xóa khi còn chờ duyệt và ngày đầu đợt còn hạn.
function kiemQuyenNhanVien(dot) {
  if (dot.some((d) => d.trang_thai !== 'cho_duyet')) {
    throw new AppError(403, 'Đơn đã được xử lý, bạn không sửa/xóa được nữa. Cần đổi thì nhờ admin.');
  }
  kiemHan(dot[0].loai, dot[0].ngay);
}

// Admin kê hộ -> duyệt luôn. Nhân viên được tick kê hộ -> kê cho mọi nhân viên, vẫn chờ duyệt + theo hạn kê.
async function taoDon(user, body) {
  const laAdmin = user.vai_tro === 'admin';
  const nhansuId = Number(laAdmin ? body.nhansu_id : body.nhansu_id || user.id);
  if (!Number.isInteger(nhansuId) || nhansuId <= 0) throw new AppError(400, 'Chưa chọn nhân viên');

  const don = chuanHoaDon(body);
  const dsNgay = dsNgayNghi(don.ngay, don.den_ngay);
  dsNgay.forEach((ngay) => kiemNgayHopLe(don.loai, ngay));
  if (!laAdmin) kiemHan(don.loai, dsNgay[0]);

  return trongGiaoDich(async (client) => {
    if (!laAdmin && nhansuId !== user.id && !(await duocKeHo(client, user))) {
      throw new AppError(403, 'Bạn chưa được phân quyền kê hộ người khác');
    }
    const ns = await khoaNhanSu(client, nhansuId);
    if (ns.vai_tro !== 'nhan_vien') throw new AppError(400, 'Chỉ kê xin nghỉ cho nhân viên');

    // kiểm hết các ngày TRƯỚC khi ghi: 1 ngày lỗi thì không lưu ngày nào
    for (const ngay of dsNgay) {
      await kiemTrung(client, nhansuId, { ...don, ngay });
      await kiemGioiHan(client, nhansuId, { ...don, ngay });
    }

    const nhomId = dsNgay.length > 1 ? crypto.randomUUID() : null;
    const ids = [];
    for (const ngay of dsNgay) {
      const r = await client.query(
        `INSERT INTO XinNghi (nhansu_id, ngay, loai, tu_gio, den_gio, ly_do, nhom_id,
                              trang_thai, nguoi_duyet_id, duyet_luc, nguoi_tao_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9::int IS NULL THEN NULL ELSE NOW() END, $10)
         RETURNING id`,
        [nhansuId, ngay, don.loai, don.tu_gio, don.den_gio, don.ly_do, nhomId,
          laAdmin ? 'da_duyet' : 'cho_duyet', laAdmin ? user.id : null, user.id]
      );
      ids.push(r.rows[0].id);
    }
    return { ids, so_ngay: ids.length };
  });
}

// Sửa 1 dòng (1 ngày). Nhân viên: chỉ đơn 1 ngày. Admin: sửa được cả 1 ngày trong đợt, ngày đó
// tách ra thành đơn riêng để các ngày còn lại trong đợt vẫn đồng nhất.
async function suaDon(user, id, body) {
  const moi = chuanHoaDon({ ...body, den_ngay: null });
  kiemNgayHopLe(moi.loai, moi.ngay);

  return trongGiaoDich(async (client) => {
    const { don } = await docDon(client, id, user);
    if (user.vai_tro !== 'admin') {
      if (don.nhom_id) throw new AppError(403, 'Đơn nhiều ngày không sửa được, hãy xóa cả đợt rồi kê lại');
      kiemQuyenNhanVien([don]);
      kiemHan(moi.loai, moi.ngay);
    }
    if (don.trang_thai !== 'tu_choi') {
      await kiemTrung(client, don.nhansu_id, moi, [don.id]);
      await kiemGioiHan(client, don.nhansu_id, moi, [don.id]);
    }
    await client.query(
      `UPDATE XinNghi SET ngay = $1, loai = $2, tu_gio = $3, den_gio = $4, ly_do = $5,
         nhom_id = NULL, updated_at = NOW()
       WHERE id = $6`,
      [moi.ngay, moi.loai, moi.tu_gio, moi.den_gio, moi.ly_do, don.id]
    );
    return { id: don.id };
  });
}

// Nhân viên: luôn xóa cả đợt. Admin: xóa 1 ngày, hoặc cả đợt nếu caDot.
async function xoaDon(user, id, caDot) {
  return trongGiaoDich(async (client) => {
    const { don, dot } = await docDon(client, id, user);
    let ids = [don.id];
    if (user.vai_tro !== 'admin') {
      kiemQuyenNhanVien(dot);
      ids = dot.map((d) => d.id);
    } else if (caDot) {
      ids = dot.map((d) => d.id);
    }
    await client.query('DELETE FROM XinNghi WHERE id = ANY($1::int[])', [ids]);
    return { so_ngay: ids.length };
  });
}

// Admin duyệt / từ chối / bỏ duyệt: áp dụng cho CẢ ĐỢT.
async function doiTrangThai(user, id, trangThai, ghiChu) {
  if (!Object.hasOwn(TRANG_THAI, trangThai)) throw new AppError(400, 'Trạng thái không hợp lệ');
  const ghi_chu = String(ghiChu || '').trim().slice(0, 255) || null;

  return trongGiaoDich(async (client) => {
    const { dot } = await docDon(client, id, user);
    const ids = dot.map((d) => d.id);
    // đơn đã từ chối không giữ chỗ -> dùng lại thì phải kiểm trùng + số lần
    if (trangThai !== 'tu_choi') {
      for (const d of dot.filter((x) => x.trang_thai === 'tu_choi')) {
        await kiemTrung(client, d.nhansu_id, d, ids);
        await kiemGioiHan(client, d.nhansu_id, d, ids);
      }
    }
    const daXuLy = trangThai !== 'cho_duyet';
    await client.query(
      `UPDATE XinNghi SET trang_thai = $1, nguoi_duyet_id = $2,
         duyet_luc = CASE WHEN $2::int IS NULL THEN NULL ELSE NOW() END,
         ghi_chu_duyet = $3, updated_at = NOW()
       WHERE id = ANY($4::int[])`,
      [trangThai, daXuLy ? user.id : null, daXuLy ? ghi_chu : null, ids]
    );
    return { so_ngay: ids.length };
  });
}

module.exports = {
  LOAI,
  TRANG_THAI,
  conHan,
  docNgay,
  duocKeHo,
  laDonCua,
  soLanTrongThang,
  taoDon,
  suaDon,
  xoaDon,
  doiTrangThai,
};
