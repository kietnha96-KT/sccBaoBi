// Chạy thử toàn bộ luật xin nghỉ qua API THẬT của server đang chạy. CHỈ DÙNG VỚI DB LOCAL.
// Tạo 2 nhân viên tạm, dùng xong xóa sạch (đơn + tài khoản tạm).
// Dùng (trong BE/, server đang chạy):  node scripts/test-xinnghi-flow.js [http://localhost:5000]
require('dotenv').config();
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const pool = require('../db');

if (process.env.DATABASE_URL) {
  console.error('TỪ CHỐI: .env đang trỏ DB cloud.');
  process.exit(1);
}
const BASE = process.argv[2] || 'http://localhost:5000';
let pass = 0;
let fail = 0;
const check = (ten, ok, chiTiet) => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? '  ok  ' : ' LỖI  '} ${ten}${ok ? '' : '  -> ' + JSON.stringify(chiTiet)}`);
};

async function call(token, method, url, body) {
  const res = await fetch(BASE + '/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const homNay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const cong = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const thu = (s) => new Date(`${s}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật

// Thứ Hai đầu tiên của tháng cách hiện tại `k` tháng (tương lai -> nhân viên kê được)
function thuHaiDau(k) {
  const [y, m] = homNay.split('-').map(Number);
  let d = new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 10);
  while (thu(d) !== 1) d = cong(d, 1);
  return d;
}

const taoTam = [];
async function taoNhanSu(ten) {
  const r = await pool.query(
    `INSERT INTO NhanSu (ho_ten, username, password, vai_tro) VALUES ($1, $2, 'x', 'nhan_vien') RETURNING id`,
    [ten, `test_xn_${Date.now()}_${taoTam.length}`]
  );
  taoTam.push(r.rows[0].id);
  return r.rows[0].id;
}
const ky = (id, vai_tro) =>
  jwt.sign({ id, username: 'test', ho_ten: 'Test', vai_tro }, process.env.JWT_SECRET, { expiresIn: '10m' });

async function don() {
  await pool.query('DELETE FROM XinNghi WHERE nhansu_id = ANY($1::int[])', [taoTam]);
  await pool.query('DELETE FROM NhanSu WHERE id = ANY($1::int[])', [taoTam]);
}

async function main() {
  const adminId = (await pool.query("SELECT id FROM NhanSu WHERE vai_tro = 'admin' ORDER BY id LIMIT 1")).rows[0].id;
  const aId = await taoNhanSu('Test Xin Nghỉ A');
  const bId = await taoNhanSu('Test Xin Nghỉ B');
  const admin = ky(adminId, 'admin');
  const a = ky(aId, 'nhan_vien');
  const b = ky(bId, 'nhan_vien');
  const thuKho = ky(adminId, 'thu_kho');
  const ke = (token, body) => call(token, 'POST', '/xin-nghi', body);

  const t2 = thuHaiDau(2); // thứ Hai
  const thang = t2.slice(0, 7);
  const [t3, t4, t5, t6, t7, cn] = [1, 2, 3, 4, 5, 6].map((n) => cong(t2, n));

  console.log('\n[Phân quyền]');
  check('thủ kho xem đơn được', (await call(thuKho, 'GET', '/xin-nghi')).status === 200);
  check('thủ kho kê đơn -> 403', (await ke(thuKho, { loai: 'nghi_phep', ngay: t2 })).status === 403);

  console.log('\n[Nghỉ phép, nhiều ngày, trùng đơn]');
  let r = await ke(a, { loai: 'nghi_phep', ngay: t6, den_ngay: cong(cn, 1) });
  check('phép thứ Sáu -> thứ Hai: 3 dòng, bỏ Chủ nhật', r.status === 201 && r.data.so_ngay === 3, r.data);
  const dot = r.data.ids;
  r = await call(a, 'GET', `/xin-nghi?thang=${thang}&nhansu_id=${aId}`);
  check('danh sách gộp đợt thành 1 dòng, chờ duyệt, xóa được, không sửa được',
    r.data.data.length === 1 && r.data.data[0].so_ngay === 3 && r.data.data[0].co_the_xoa && !r.data.data[0].co_the_sua, r.data);
  r = await call(b, 'GET', `/xin-nghi?thang=${thang}&nhansu_id=${aId}`);
  check('nhân viên B XEM được đơn của A nhưng không sửa/xóa được',
    r.data.data.length === 1 && !r.data.data[0].co_the_xoa && !r.data.data[0].co_the_sua, r.data);
  check('B xóa đơn của A -> 403', (await call(b, 'DELETE', `/xin-nghi/${dot[0]}`)).status === 403);
  check('A tự duyệt -> 403', (await call(a, 'PATCH', `/xin-nghi/${dot[0]}/trang-thai`, { trang_thai: 'da_duyet' })).status === 403);
  check('sửa đợt nhiều ngày -> 403', (await call(a, 'PUT', `/xin-nghi/${dot[0]}`, { loai: 'nghi_phep', ngay: t6 })).status === 403);
  r = await ke(a, { loai: 'nghi_phep', ngay: t4, den_ngay: t7 });
  check('đợt mới đụng 1 ngày -> 409', r.status === 409, r.data);
  check('... và không lưu ngày nào', (await pool.query('SELECT COUNT(*)::int n FROM XinNghi WHERE nhansu_id = $1', [aId])).rows[0].n === 3);
  check('Chủ nhật -> 400', (await ke(a, { loai: 'nghi_phep', ngay: cn })).status === 400);
  check('quá 31 ngày -> 400', (await ke(a, { loai: 'nghi_phep', ngay: t2, den_ngay: cong(t2, 31) })).status === 400);
  check('ngày không tồn tại -> 400', (await ke(a, { loai: 'nghi_phep', ngay: '2027-02-31' })).status === 400);
  check('loại lạ -> 400', (await ke(a, { loai: 'toString', ngay: t2 })).status === 400);
  check('đi trễ nhiều ngày -> 400', (await ke(a, { loai: 'di_tre', ngay: t2, den_ngay: t3, tu_gio: '07:30' })).status === 400);
  check('phép nhiều ngày theo giờ -> 400', (await ke(a, { loai: 'nghi_phep', ngay: t2, den_ngay: t3, phan_ngay: 0.5, tu_gio: '08:00' })).status === 400);
  check('ốm nhập giờ -> 400', (await ke(a, { loai: 'nghi_om', ngay: t2, tu_gio: '08:00', den_gio: '09:00' })).status === 400);
  check('phép giờ tùy ý (không chọn mức) -> 400', (await ke(a, { loai: 'nghi_phep', ngay: t2, tu_gio: '08:00', den_gio: '11:00' })).status === 400);
  check('phép 0,125 ngày -> 400', (await ke(a, { loai: 'nghi_phep', ngay: t2, phan_ngay: 0.125, tu_gio: '08:00' })).status === 400);
  check('phép 0,5 thiếu giờ bắt đầu -> 400', (await ke(a, { loai: 'nghi_phep', ngay: t2, phan_ngay: 0.5 })).status === 400);

  console.log('\n[Duyệt cả đợt]');
  r = await call(admin, 'PATCH', `/xin-nghi/${dot[1]}/trang-thai`, { trang_thai: 'da_duyet' });
  check('admin duyệt 1 lần -> cả 3 ngày', r.status === 200 && r.data.so_ngay === 3, r.data);
  check('đã duyệt: nhân viên không xóa được', (await call(a, 'DELETE', `/xin-nghi/${dot[0]}`)).status === 403);
  r = await call(admin, 'PUT', `/xin-nghi/${dot[2]}`, { loai: 'nghi_phep', ngay: cong(cn, 1), phan_ngay: 0.5, tu_gio: '08:00', den_gio: '23:00' });
  check('admin sửa riêng 1 ngày trong đợt', r.status === 200, r.data);
  r = await call(a, 'GET', `/xin-nghi?thang=all&nhansu_id=${aId}`);
  check('ngày bị sửa tách thành đơn riêng', r.data.data.length === 2, r.data.data.map((x) => x.so_ngay));
  r = await call(admin, 'DELETE', `/xin-nghi/${dot[0]}`);
  check('admin xóa 1 ngày trong đợt', r.status === 200 && r.data.so_ngay === 1, r.data);

  console.log('\n[Giới hạn đi trễ + về sớm = 3]');
  const treA = await ke(a, { loai: 'di_tre', ngay: t2, tu_gio: '07:30' });
  check('đi trễ lần 1', treA.status === 201, treA.data);
  check('về sớm cùng ngày, lần 2', (await ke(a, { loai: 've_som', ngay: t2, tu_gio: '16:00' })).status === 201);
  check('đi trễ 2 lần cùng ngày -> 409', (await ke(a, { loai: 'di_tre', ngay: t2, tu_gio: '09:00' })).status === 409);
  const treA3 = await ke(a, { loai: 'di_tre', ngay: t3, tu_gio: '07:30' });
  check('lần 3', treA3.status === 201, treA3.data);
  r = await ke(a, { loai: 've_som', ngay: t4, tu_gio: '16:00' });
  check('lần 4 -> 409', r.status === 409 && r.data.message.includes('3/3'), r.data);
  check('admin kê hộ cũng bị chặn', (await ke(admin, { nhansu_id: aId, loai: 've_som', ngay: t4, tu_gio: '16:00' })).status === 409);
  r = await call(a, 'GET', `/xin-nghi/con-lai?ngay=${t4}`);
  check('con-lai báo 3/3', r.data.data.find((x) => x.loai.includes('di_tre')).da_dung === 3, r.data);
  r = await call(a, 'PUT', `/xin-nghi/${treA3.data.ids[0]}`, { loai: 'di_tre', ngay: t4, tu_gio: '07:30' });
  check('sửa ngày của đơn thứ 3 vẫn được (không tự tính chính nó)', r.status === 200, r.data);
  await call(admin, 'PATCH', `/xin-nghi/${treA3.data.ids[0]}/trang-thai`, { trang_thai: 'tu_choi', ghi_chu_duyet: 'thử' });
  check('bị từ chối -> trả lại lượt', (await ke(a, { loai: 've_som', ngay: t5, tu_gio: '16:00' })).status === 201);
  check('duyệt lại đơn đã từ chối khi hết lượt -> 409',
    (await call(admin, 'PATCH', `/xin-nghi/${treA3.data.ids[0]}/trang-thai`, { trang_thai: 'da_duyet' })).status === 409);

  console.log('\n[Chế độ nữ = 1, giờ cố định]');
  r = await ke(b, { loai: 'che_do_nu', ngay: t2, tu_gio: '15:00', den_gio: '23:00' });
  check('chế độ nữ lần 1', r.status === 201, r.data);
  const gio = (await pool.query('SELECT den_gio FROM XinNghi WHERE id = $1', [r.data.ids[0]])).rows[0].den_gio;
  check('giờ kết thúc tự tính 1,5 tiếng', gio.startsWith('16:30'), gio);
  check('lần 2 trong tháng -> 409', (await ke(b, { loai: 'che_do_nu', ngay: t3, tu_gio: '15:00' })).status === 409);
  check('tháng khác -> được', (await ke(b, { loai: 'che_do_nu', ngay: thuHaiDau(3), tu_gio: '15:00' })).status === 201);

  console.log('\n[Quên chấm công = 2 mốc] (admin kê cho ngày đã qua)');
  let q = cong(homNay, -40);
  while (thu(q) !== 1) q = cong(q, 1);
  while (cong(q, 4).slice(0, 7) !== q.slice(0, 7)) q = cong(q, -7);
  const quen = (ngay, extra) => ke(admin, { nhansu_id: bId, loai: 'quen_cham_cong', ngay, ...extra });
  check('chọn cả giờ vào lẫn ra trong 1 đơn -> 400', (await quen(q, { tu_gio: '07:30', den_gio: '16:30' })).status === 400);
  r = await quen(q, { tu_gio: '07:30' });
  check('quên vào ngày 1', r.status === 201, r.data);
  const st = (await pool.query('SELECT trang_thai, nguoi_duyet_id FROM XinNghi WHERE id = $1', [r.data.ids?.[0]])).rows[0];
  check('admin kê hộ -> duyệt luôn', st?.trang_thai === 'da_duyet' && st.nguoi_duyet_id === adminId, st);
  check('trùng "giờ vào" cùng ngày -> 409', (await quen(q, { tu_gio: '07:40' })).status === 409);
  check('quên ra cùng ngày (lần thứ 2)', (await quen(q, { den_gio: '16:30' })).status === 201);
  r = await quen(cong(q, 1), { tu_gio: '07:30' });
  check('mốc thứ 3 trong tháng -> 409, báo 2/2', r.status === 409 && JSON.stringify(r.data).includes('2/2'), r.data);
  r = await call(admin, 'GET', `/xin-nghi/tong-hop?thang=${q.slice(0, 7)}`);
  check('tổng hợp đếm theo mốc: 2 lần trong 1 ngày', r.data.data.find((x) => x.nhansu_id === bId)?.quen_cham_cong === 2, r.data);
  check('quên chấm công ngày tương lai -> 400', (await quen(t2, { tu_gio: '07:30' })).status === 400);
  check('không chọn giờ nào -> 400', (await quen(cong(q, 2), {})).status === 400);

  console.log('\n[Hạn kê của nhân viên]');
  const homQua = cong(homNay, -1);
  const homKia = cong(homNay, -2);
  const muon = (s) => (thu(s) === 0 ? 400 : 403); // Chủ nhật bị chặn trước
  r = await ke(a, { loai: 'nghi_phep', ngay: homQua });
  check('phép hôm qua -> chặn', r.status === muon(homQua), r);
  r = await ke(a, { loai: 'nghi_om', ngay: homQua });
  check('ốm hôm qua -> được (trừ khi là Chủ nhật)', r.status === (thu(homQua) === 0 ? 400 : 201), r);
  if (r.status === 201) {
    check('đổi đơn ốm hôm qua thành phép -> chặn', (await call(a, 'PUT', `/xin-nghi/${r.data.ids[0]}`, { loai: 'nghi_phep', ngay: homQua })).status === 403);
    check('xóa đơn ốm hôm qua -> được', (await call(a, 'DELETE', `/xin-nghi/${r.data.ids[0]}`)).status === 200);
  }
  r = await ke(a, { loai: 'nghi_om', ngay: homKia });
  check('ốm hôm kia -> chặn', r.status === muon(homKia), r);
  if (thu(homNay) !== 0) {
    check('phép hôm nay -> được', (await ke(a, { loai: 'nghi_phep', ngay: homNay })).status === 201);
  }

  console.log('\n[Tổng hợp tháng + Excel + Giờ làm trong ngày]');
  r = await call(admin, 'GET', `/xin-nghi/tong-hop?thang=${thang}`);
  const ta = r.data.data.find((x) => x.nhansu_id === aId);
  // A: đã duyệt = đợt phép còn lại; ngày sửa là phép 0,5 từ 08:00; đơn khác còn chờ
  check('tổng hợp A: nửa ngày phép = 0,5, chỉ cộng đơn đã duyệt',
    ta && ta.phep_ngay % 1 === 0.5 && ta.di_tre === 0 && ta.cho_duyet > 0, ta);
  // q = thứ 2 của tháng đã qua (admin kê hộ -> duyệt luôn)
  await ke(admin, { nhansu_id: bId, loai: 'nghi_om', ngay: cong(q, 4) });
  await ke(admin, { nhansu_id: bId, loai: 'nghi_phep', ngay: cong(q, 1), phan_ngay: 0.25, tu_gio: '10:00' });
  await ke(admin, { nhansu_id: bId, loai: 'nghi_phep', ngay: cong(q, 2), phan_ngay: 0.5, tu_gio: '12:00' });
  await ke(admin, { nhansu_id: bId, loai: 'nghi_phep', ngay: cong(q, 3) });
  const gioPhep = (await pool.query(
    "SELECT tu_gio, den_gio FROM XinNghi WHERE nhansu_id = $1 AND loai = 'nghi_phep' AND ngay IN ($2, $3) ORDER BY ngay",
    [bId, cong(q, 1), cong(q, 2)]
  )).rows.map((x) => `${x.tu_gio.slice(0, 5)}-${x.den_gio.slice(0, 5)}`).join();
  check('giờ kết thúc phép tự tính, bỏ qua nghỉ trưa', gioPhep === '10:00-13:00,12:00-16:30', gioPhep);
  r = await call(admin, 'GET', `/xin-nghi/tong-hop?thang=${q.slice(0, 7)}`);
  const tb = r.data.data.find((x) => x.nhansu_id === bId);
  check('phép 1 + 0,5 + 0,25 = 1,75 ngày', tb?.phep_ngay === 1.75, tb);
  check('ốm = 1 ngày, không còn cột giờ lẻ', tb?.om_ngay === 1 && !('om_gio' in tb) && !('phep_gio' in tb), tb);
  r = await call(a, 'GET', `/xin-nghi/tong-hop?thang=${thang}`);
  check('nhân viên chỉ thấy tổng hợp của chính mình', r.data.data.length === 1 && r.data.data[0].nhansu_id === aId, r.data);
  r = await call(a, 'GET', `/xin-nghi/tong-hop?thang=${thang}&nhansu_id=${bId}`);
  check('nhân viên thêm nhansu_id người khác vẫn chỉ ra của mình', r.data.data.every((x) => x.nhansu_id === aId), r.data);
  const xa = await fetch(`${BASE}/api/xin-nghi/tong-hop/export?thang=${thang}`, { headers: { Authorization: 'Bearer ' + a } });
  const wbA = new ExcelJS.Workbook();
  await wbA.xlsx.load(Buffer.from(await xa.arrayBuffer()));
  check('Excel tổng hợp của nhân viên chỉ có dòng của mình (cả 2 sheet)',
    ['TongHop', 'ChiTiet'].every((ten) => {
      const ds = wbA.getWorksheet(ten).getSheetValues().slice(2);
      return ds.length > 0 && ds.every((d) => d[1] === 'Test Xin Nghỉ A');
    }));
  r = await call(thuKho, 'GET', `/xin-nghi?thang=${thang}&limit=3000`);
  check('thủ kho thấy đơn mọi người nhưng không có nút sửa/xóa',
    r.data.data.length > 0 && r.data.data.every((x) => !x.co_the_sua && !x.co_the_xoa), r.data);
  const donBatKy = r.data.data[0].id;
  const maGhi = [
    await call(thuKho, 'PUT', `/xin-nghi/${donBatKy}`, { loai: 'nghi_phep', ngay: t2 }),
    await call(thuKho, 'DELETE', `/xin-nghi/${donBatKy}`),
    await call(thuKho, 'PATCH', `/xin-nghi/${donBatKy}/trang-thai`, { trang_thai: 'da_duyet' }),
  ].map((x) => x.status);
  check('thủ kho sửa / xóa / duyệt -> 403', maGhi.every((s) => s === 403), maGhi);
  r = await call(thuKho, 'GET', `/xin-nghi/tong-hop?thang=${thang}`);
  check('thủ kho xem tổng hợp của mọi người', [aId, bId].every((id) => r.data.data.some((x) => x.nhansu_id === id)), r.data);
  const xk = await fetch(`${BASE}/api/xin-nghi/export?thang=${thang}`, { headers: { Authorization: 'Bearer ' + thuKho } });
  check('thủ kho xuất Excel được', xk.status === 200);

  r = await call(admin, 'GET', '/xin-nghi/tong-hop?thang=2001-01');
  check('admin: tháng không có đơn vẫn liệt kê đủ người, số 0',
    r.data.data.some((x) => x.nhansu_id === bId && x.phep_ngay === 0 && x.cho_duyet === 0), r.data);
  r = await call(a, 'GET', `/xin-nghi?thang=${thang}&limit=3000`);
  check('danh sách tháng có cả đơn bị từ chối', r.data.data.some((x) => x.trang_thai === 'tu_choi'), r.data.data.map((x) => x.trang_thai));
  const xl = await fetch(`${BASE}/api/xin-nghi/tong-hop/export?thang=${thang}`, { headers: { Authorization: 'Bearer ' + admin } });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await xl.arrayBuffer()));
  check('Excel có 2 sheet TongHop + ChiTiet', wb.worksheets.map((w) => w.name).join() === 'TongHop,ChiTiet' && wb.getWorksheet('ChiTiet').rowCount > 1);
  const xd = await fetch(`${BASE}/api/xin-nghi/export?thang=${thang}&nhansu_id=${aId}&trang_thai=tu_choi`, {
    headers: { Authorization: 'Bearer ' + a },
  });
  const wbDon = new ExcelJS.Workbook();
  await wbDon.xlsx.load(Buffer.from(await xd.arrayBuffer()));
  const dong = wbDon.getWorksheet('DonXinNghi').getSheetValues().slice(2);
  check('Excel đơn xin nghỉ theo đúng bộ lọc (người + trạng thái)',
    dong.length > 0 && dong.every((d) => d[1] === 'Test Xin Nghỉ A' && d[7] === 'Từ chối'), dong);
  r = await call(admin, 'GET', `/dashboard/gio-lam-ngay?ngay=${t2}`);
  const ga = r.data.data?.find((x) => x.nhansu_id === aId);
  check('Giờ làm trong ngày có đơn xin nghỉ', ga && ga.xin_nghi.length === 2, ga);
  r = await call(thuKho, 'GET', `/dashboard/gio-lam-ngay?ngay=${t2}`);
  check('thủ kho xem được ở Giờ làm trong ngày', r.status === 200);

  console.log('\n[Kê hộ]');
  const cId = await taoNhanSu('Test Xin Nghỉ C');
  const dId = await taoNhanSu('Test Xin Nghỉ D');
  const c = ky(cId, 'nhan_vien');
  const d = ky(dId, 'nhan_vien');
  const tick = (body) => call(admin, 'PUT', `/nhansu/${cId}`, { ho_ten: 'Test Xin Nghỉ C', ...body });
  const phepHo = { nhansu_id: dId, loai: 'nghi_phep', ngay: t2 };

  check('chưa tick: kê cho người khác -> 403', (await ke(c, phepHo)).status === 403);
  check('nhân viên tự tick cho mình -> 403', (await call(c, 'PUT', `/nhansu/${cId}`, { ho_ten: 'x', duoc_ke_ho: true })).status === 403);
  r = await tick({ duoc_ke_ho: true });
  check('admin tick kê hộ, giới tính mặc định nữ', r.status === 200 && r.data.duoc_ke_ho === true && r.data.gioi_tinh === 'nu', r.data);
  check('giới tính sai -> 400', (await tick({ gioi_tinh: 'abc' })).status === 400);
  check('danh sách báo cho FE biết được kê hộ', (await call(c, 'GET', '/xin-nghi')).data.duoc_ke_ho === true);

  r = await ke(c, phepHo);
  check('đã tick: kê hộ được (không cần đăng nhập lại)', r.status === 201, r.data);
  const donHo = r.data.ids?.[0];
  const dongHo = (await pool.query('SELECT nhansu_id, nguoi_tao_id, trang_thai FROM XinNghi WHERE id = $1', [donHo])).rows[0];
  check('đơn đứng tên D, người kê C, chờ duyệt',
    dongHo?.nhansu_id === dId && dongHo.nguoi_tao_id === cId && dongHo.trang_thai === 'cho_duyet', dongHo);
  check('người kê hộ vẫn bị hạn kê', (await ke(c, { nhansu_id: dId, loai: 'nghi_phep', ngay: cong(homNay, -2) })).status >= 400);
  check('không kê hộ cho admin -> 400', (await ke(c, { ...phepHo, nhansu_id: adminId })).status === 400);
  check('sửa đơn đã kê hộ -> được', (await call(c, 'PUT', `/xin-nghi/${donHo}`, { loai: 'nghi_om', ngay: t2 })).status === 200);
  const coQuyen = async (token) => {
    const kq = await call(token, 'GET', `/xin-nghi?thang=${thang}&nhansu_id=${dId}`);
    return kq.data.data.find((x) => x.id === donHo)?.co_the_sua;
  };
  check('nút Sửa hiện cho người kê hộ và cho chủ đơn', (await coQuyen(c)) === true && (await coQuyen(d)) === true);

  const tuKe = (await ke(d, { loai: 'di_tre', ngay: t3, tu_gio: '07:30' })).data.ids?.[0];
  check('đơn người ta tự kê: người kê hộ không xóa được', (await call(c, 'DELETE', `/xin-nghi/${tuKe}`)).status === 403);
  r = await call(c, 'GET', `/xin-nghi/con-lai?ngay=${t3}&nhansu_id=${dId}`);
  check('xem được số lần còn lại của người được kê hộ', r.data.data.find((x) => x.loai.includes('di_tre')).da_dung === 1, r.data);
  r = await call(c, 'GET', `/xin-nghi/tong-hop?thang=${thang}`);
  check('tổng hợp: người kê hộ vẫn chỉ thấy của mình', r.data.data.length === 1 && r.data.data[0].nhansu_id === cId, r.data);

  await tick({ duoc_ke_ho: false });
  check('bỏ tick: hết quyền với đơn đã kê hộ', (await call(c, 'DELETE', `/xin-nghi/${donHo}`)).status === 403);
  await tick({ duoc_ke_ho: true });
  check('tick lại: xóa được đơn đã kê hộ', (await call(c, 'DELETE', `/xin-nghi/${donHo}`)).status === 200);
  r = await tick({ vai_tro: 'thu_kho', duoc_ke_ho: true });
  check('đổi sang thủ kho thì tự bỏ quyền kê hộ', r.data.duoc_ke_ho === false, r.data);

  console.log('\n[Có làm xử lý hàng]');
  // lo_id không tồn tại -> không bao giờ ghi được báo cáo thật
  const baoCao = () => call(admin, 'POST', '/baocao', { ngay: homNay, lo_id: 999999999, dat: 1, hu_bo: 0, nhansu_ids: [dId] });
  const coTrongGioLam = async () =>
    (await call(admin, 'GET', `/dashboard/gio-lam-ngay?ngay=${t2}`)).data.data.some((x) => x.nhansu_id === dId);
  const loiBaoCao = async () => JSON.stringify((await baoCao()).data);
  check('mặc định có làm: qua được bước chọn người (dừng ở lô không tồn tại)', !(await loiBaoCao()).includes('không làm xử lý hàng'));
  check('mặc định có làm: hiện ở Giờ làm trong ngày', await coTrongGioLam());
  r = await call(admin, 'PUT', `/nhansu/${dId}`, { ho_ten: 'Test Xin Nghỉ D', xu_ly_hang: false });
  check('admin bỏ tick', r.status === 200 && r.data.xu_ly_hang === false, r.data);
  check('bỏ tick: không chọn vào báo cáo được', (await loiBaoCao()).includes('không làm xử lý hàng'));
  check('bỏ tick: ẩn khỏi Giờ làm trong ngày', !(await coTrongGioLam()));
  r = await call(admin, 'GET', `/xin-nghi/tong-hop?thang=${thang}`);
  check('bỏ tick: vẫn có trong tổng hợp xin nghỉ', r.data.data.some((x) => x.nhansu_id === dId), r.data);
  r = await call(admin, 'PUT', `/nhansu/${dId}`, { ho_ten: 'Test Xin Nghỉ D' });
  check('sửa tên không gửi ô tick thì giữ nguyên', r.data.xu_ly_hang === false, r.data);
  // danh sách nhân sự báo ai đã có báo cáo (đối chiếu thẳng với DB; chỉ đọc)
  const ds = (await call(admin, 'GET', '/nhansu?limit=3000')).data.data;
  const coThat = (await pool.query(
    'SELECT nhansu_id AS id FROM BaoCao_NhanSu UNION SELECT nguoi_nhap_id FROM BaoCao'
  )).rows.map((x) => x.id);
  check('co_bao_cao khớp dữ liệu báo cáo', ds.every((x) => x.co_bao_cao === coThat.includes(x.id)), ds);
  check('người mới chưa có báo cáo -> co_bao_cao = false', ds.find((x) => x.id === dId)?.co_bao_cao === false);
}

main()
  .catch((err) => {
    fail++;
    console.error('Lỗi:', err);
  })
  .finally(async () => {
    await don().catch((e) => console.error('Không dọn được dữ liệu tạm:', e.message));
    await pool.end();
    console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
    process.exit(fail ? 1 : 0);
  });
