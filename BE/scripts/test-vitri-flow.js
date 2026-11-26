// Chạy thử luồng nhập -> chuyển -> xuất (+ điều chỉnh, các ca lỗi, phân quyền, tính ĐỘC LẬP với bảng Lo) qua API THẬT của
// server đang chạy. CHỈ DÙNG VỚI DB LOCAL: script ký token tạm bằng JWT_SECRET trong .env,
// và từ chối chạy nếu .env có DATABASE_URL (DB cloud).
// Dùng (trong BE/, server đang chạy):  node scripts/test-vitri-flow.js [http://localhost:5000]
// Lô thử có số lô riêng KHÔNG tồn tại trong bảng Lo (chứng minh kho độc lập). Dọn sau khi chạy: lô thử được lấy hết khỏi
// các ô thử, không đụng dữ liệu seed (sổ giao dịch thì giữ lại, vì sổ chỉ thêm).
require('dotenv').config();
const jwt = require('jsonwebtoken');
const pool = require('../db');

if (process.env.DATABASE_URL) {
  console.error('TỪ CHỐI: .env đang trỏ DB cloud.');
  process.exit(1);
}
const BASE = process.argv[2] || 'http://localhost:5000';
let pass = 0;
let fail = 0;
const check = (ten, ok, chiTiet = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? '  ok  ' : ' LỖI  '} ${ten}${ok ? '' : '  -> ' + chiTiet}`);
};

async function call(token, method, url, body) {
  const res = await fetch(BASE + '/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* không có body */ }
  return { status: res.status, data };
}

async function main() {
  const ns = await pool.query("SELECT id, vai_tro FROM NhanSu WHERE vai_tro IN ('admin','thu_kho','nhan_vien') ORDER BY id");
  const byRole = {};
  for (const r of ns.rows) byRole[r.vai_tro] ??= r.id;
  const mk = (role) => jwt.sign({ id: byRole[role], username: 'test-' + role, ho_ten: 'Test', vai_tro: role }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const admin = mk('admin');
  const nv = mk('nhan_vien');

  // 1 vật tư thật + số lô THỬ không có trong bảng Lo + 2 ô TRỐNG khác nhau (1 selective, 1 kệ sàn)
  const vt = (await pool.query('SELECT ma_vat_tu FROM VatTu ORDER BY ma_vat_tu LIMIT 1')).rows[0].ma_vat_tu;
  const soLo = 'TEST-KHO-' + Date.now().toString(36).toUpperCase();
  const loBody = { ma_vat_tu: vt, so_lo: soLo };
  const dem = async (sql) => Number((await pool.query(sql)).rows[0].n);
  const loTruoc = await dem('SELECT COUNT(*) AS n FROM Lo');
  const bcTruoc = await dem('SELECT COUNT(*) AS n FROM BaoCao');
  const trong = await pool.query(
    `SELECT v.ma_vi_tri FROM ViTriKho v
     WHERE NOT EXISTS (SELECT 1 FROM Lo_ViTri x WHERE x.vi_tri_id = v.id)
       AND v.loai_ke = 'selective' ORDER BY v.id DESC LIMIT 1`);
  const trongSan = await pool.query(
    `SELECT v.ma_vi_tri FROM ViTriKho v
     WHERE NOT EXISTS (SELECT 1 FROM Lo_ViTri x WHERE x.vi_tri_id = v.id)
       AND v.loai_ke = 'san' ORDER BY v.id DESC LIMIT 1`);
  if (!trong.rows[0] || !trongSan.rows[0]) throw new Error('Không tìm được ô trống để thử');
  const A = trong.rows[0].ma_vi_tri;
  const B = trongSan.rows[0].ma_vi_tri;
  console.log(`Vật tư ${vt}, lô thử "${soLo}" (không có trong bảng Lo); ô A=${A} (selective), ô B=${B} (kệ sàn)`);

  const soLuongTrongO = async (ma, lo = soLo) => {
    const r = await call(admin, 'GET', '/vi-tri/' + ma);
    const d = r.data?.lo?.find((x) => x.ma_vat_tu === vt && x.so_lo.toLowerCase() === lo.toLowerCase());
    return d ? (d.so_luong === null ? null : Number(d.so_luong)) : undefined; // undefined = lô không có trong ô
  };

  console.log('\n[Phân quyền & dữ liệu sai]');
  check('không token -> 401', (await call(null, 'GET', '/vi-tri')).status === 401);
  check('nhân viên XEM được danh mục ô', (await call(nv, 'GET', '/vi-tri?ke=K01')).status === 200);
  check('nhân viên nhập -> 403', (await call(nv, 'POST', '/vi-tri/nhap', { ...loBody, ma_vi_tri: A, so_luong: 5 })).status === 403);
  check('nhân viên xuất/chuyển/điều chỉnh -> 403',
    (await call(nv, 'POST', '/vi-tri/xuat', { ...loBody, ma_vi_tri: A })).status === 403 &&
    (await call(nv, 'POST', '/vi-tri/chuyen', { ...loBody, tu_vi_tri: A, den_vi_tri: B })).status === 403 &&
    (await call(nv, 'POST', '/vi-tri/dieu-chinh', { ...loBody, ma_vi_tri: A, so_luong: 1 })).status === 403);
  check('số lượng âm -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { ...loBody, ma_vi_tri: A, so_luong: -3 })).status === 400);
  check('số lượng chữ -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { ...loBody, ma_vi_tri: A, so_luong: 'abc' })).status === 400);
  check('số lượng 0 -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { ...loBody, ma_vi_tri: A, so_luong: 0 })).status === 400);
  check('thiếu so_lo -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { ma_vat_tu: vt, ma_vi_tri: A, so_luong: 1 })).status === 400);
  check('so_lo toàn khoảng trắng -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { ma_vat_tu: vt, so_lo: '   ', ma_vi_tri: A, so_luong: 1 })).status === 400);
  check('thiếu ma_vat_tu -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { so_lo: soLo, ma_vi_tri: A, so_luong: 1 })).status === 400);
  check('mã vật tư không có trong danh mục -> 400', (await call(admin, 'POST', '/vi-tri/nhap', { ma_vat_tu: 'KHONG-CO-XX', so_lo: soLo, ma_vi_tri: A, so_luong: 1 })).status === 400);
  check('ô không tồn tại -> 404', (await call(admin, 'POST', '/vi-tri/nhap', { ...loBody, ma_vi_tri: 'ZZ-O99-T9', so_luong: 1 })).status === 404);
  check('xuất lô không có trong ô -> 404', (await call(admin, 'POST', '/vi-tri/xuat', { ...loBody, ma_vi_tri: A })).status === 404);
  check('chuyển A -> A -> 400', (await call(admin, 'POST', '/vi-tri/chuyen', { ...loBody, tu_vi_tri: A, den_vi_tri: A })).status === 400);
  check('GET /theo-lo thiếu so_lo -> 400', (await call(admin, 'GET', '/vi-tri/theo-lo?ma_vat_tu=' + vt)).status === 400);
  check('lô chưa có trong kho: /theo-lo trả rỗng (200)', (await call(admin, 'GET', `/vi-tri/theo-lo?ma_vat_tu=${vt}&so_lo=${soLo}`)).data?.data?.length === 0);

  console.log('\n[Nhập]');
  let r = await call(admin, 'POST', '/vi-tri/nhap', { ...loBody, ma_vi_tri: A, so_luong: 100, ghi_chu: 'thử' });
  check('nhập 100 vào A -> 201 (lô không cần có trong bảng Lo)', r.status === 201 && r.data.vi_tri[0].so_luong === 100, JSON.stringify(r.data));
  r = await call(admin, 'POST', '/vi-tri/nhap', { ma_vat_tu: vt.toLowerCase(), so_lo: ' ' + soLo.toLowerCase() + ' ', ma_vi_tri: A.toLowerCase(), so_luong: 20 });
  check('nhập thêm 20 (mã vật tư, số lô, mã ô viết thường / thừa khoảng trắng) -> cộng dồn 120, vẫn 1 dòng', r.status === 201 && r.data.vi_tri[0].so_luong === 120, JSON.stringify(r.data));
  check('GET ô A thấy lô với 120', (await soLuongTrongO(A)) === 120);
  check('ô A chỉ có 1 dòng cho lô thử (không tách vì hoa/thường)',
    (await call(admin, 'GET', '/vi-tri/' + A)).data.lo.filter((x) => x.so_lo.toLowerCase() === soLo.toLowerCase()).length === 1);
  const theoLo = await call(admin, 'GET', `/vi-tri/theo-lo?ma_vat_tu=${vt}&so_lo=${encodeURIComponent(soLo.toLowerCase())}`);
  check('GET /vi-tri/theo-lo (gõ thường) có ô A', theoLo.status === 200 && theoLo.data.data.some((x) => x.ma_vi_tri === A), JSON.stringify(theoLo.data));
  const tong = await call(admin, 'GET', '/vi-tri/tong-theo-lo');
  check('/tong-theo-lo có lô thử: 1 ô, tổng 120',
    tong.data?.data?.some((x) => x.ma_vat_tu === vt && x.so_lo.toLowerCase() === soLo.toLowerCase() && x.so_o === 1 && Number(x.tong_so_luong) === 120), JSON.stringify(tong.data?.data?.slice(0, 1)));
  {
    const day = (await call(admin, 'GET', '/vi-tri?co_hang=1')).data;
    const gon = (await call(admin, 'GET', '/vi-tri?co_hang=1&gon=1')).data;
    const theoMa = new Map(day.data.map((d) => [d.ma_vi_tri, d])); // bản gọn không sắp xếp -> so theo mã ô, không theo vị trí
    const khop = gon.data.length === day.data.length && gon.data.every((g) => { const d = theoMa.get(g[0]); return d && g[1] === d.so_lo_trong_o && g[2] === d.so_lo_dau; });
    check('GET /vi-tri?gon=1 khớp bản đầy đủ (mã ô, số lô trong ô, số lô đầu), dạng mảng', gon.cot?.join() === 'ma_vi_tri,so_lo_trong_o,so_lo_dau' && khop, JSON.stringify(gon.data?.[0]));
  }
  check('GET /vi-tri?co_hang=1&ke lọc đúng ô có hàng',
    (await call(admin, 'GET', '/vi-tri?co_hang=1&ke=' + A.split('-')[0])).data.data.some((x) => x.ma_vi_tri === A && x.so_lo_trong_o >= 1));
  check('GET /vi-tri?ma_vat_tu= lọc ra ô A',
    (await call(admin, 'GET', `/vi-tri?ma_vat_tu=${vt}`)).data.data.some((x) => x.ma_vi_tri === A));

  console.log('\n[Chuyển]');
  r = await call(admin, 'POST', '/vi-tri/chuyen', { ...loBody, tu_vi_tri: A, den_vi_tri: B, so_luong: 50 });
  check('chuyển 50 từ A sang B', r.status === 200 && r.data.vi_tri[0].so_luong === 70 && r.data.vi_tri[1].so_luong === 50, JSON.stringify(r.data));
  const nhomId = r.data?.nhom_id;
  check('A còn 70, B có 50', (await soLuongTrongO(A)) === 70 && (await soLuongTrongO(B)) === 50);
  const gd = await call(admin, 'GET', `/vi-tri/giao-dich?nhom_id=${nhomId}`);
  check('sổ có đúng 2 dòng chung nhom_id (chuyen_di + chuyen_den)',
    gd.data?.data?.length === 2 && gd.data.data.map((x) => x.thao_tac).sort().join() === 'chuyen_den,chuyen_di', JSON.stringify(gd.data?.data?.map((x) => x.thao_tac)));
  r = await call(admin, 'POST', '/vi-tri/chuyen', { ...loBody, tu_vi_tri: A, den_vi_tri: B, so_luong: 9999 });
  check('chuyển vượt số đang có -> 400, không đổi gì', r.status === 400 && (await soLuongTrongO(A)) === 70 && (await soLuongTrongO(B)) === 50, JSON.stringify(r.data));

  console.log('\n[Điều chỉnh]');
  r = await call(admin, 'POST', '/vi-tri/dieu-chinh', { ...loBody, ma_vi_tri: B, so_luong: 45 });
  check('điều chỉnh B về 45', r.status === 200 && (await soLuongTrongO(B)) === 45, JSON.stringify(r.data));
  r = await call(admin, 'POST', '/vi-tri/dieu-chinh', { ...loBody, ma_vi_tri: B, so_luong: null });
  check('điều chỉnh B về "chưa biết" (null)', r.status === 200 && (await soLuongTrongO(B)) === null);
  check('điều chỉnh thiếu so_luong -> 400', (await call(admin, 'POST', '/vi-tri/dieu-chinh', { ...loBody, ma_vi_tri: B })).status === 400);

  console.log('\n[Xuất]');
  r = await call(admin, 'POST', '/vi-tri/xuat', { ...loBody, ma_vi_tri: A, so_luong: 30 });
  check('xuất 30 khỏi A -> còn 40', r.status === 200 && r.data.vi_tri[0].so_luong === 40, JSON.stringify(r.data));
  r = await call(admin, 'POST', '/vi-tri/xuat', { ...loBody, ma_vi_tri: A, so_luong: 41 });
  check('xuất 41 > 40 -> 400', r.status === 400);
  r = await call(admin, 'POST', '/vi-tri/xuat', { ...loBody, ma_vi_tri: A });
  check('xuất hết A (bỏ trống số lượng) -> xóa dòng', r.status === 200 && r.data.vi_tri[0].da_xoa === true && (await soLuongTrongO(A)) === undefined, JSON.stringify(r.data));
  r = await call(admin, 'POST', '/vi-tri/xuat', { ...loBody, ma_vi_tri: B });
  check('xuất hết B (đang "chưa biết") -> xóa dòng', r.status === 200 && (await soLuongTrongO(B)) === undefined, JSON.stringify(r.data));

  console.log('\n[Đối chiếu sổ + độc lập với phần lựa]');
  const nguoi = await call(admin, 'GET', `/vi-tri/giao-dich?so_lo=${encodeURIComponent(soLo)}&limit=3`);
  check('sổ lọc được theo so_lo, ghi người thực hiện từ phiên đăng nhập', nguoi.data?.data?.[0]?.nguoi_thuc_hien_id === byRole.admin && nguoi.data.data[0].so_lo === soLo, JSON.stringify(nguoi.data?.data?.[0]));
  check('bảng Lo KHÔNG bị thêm dòng nào', (await dem('SELECT COUNT(*) AS n FROM Lo')) === loTruoc);
  check('bảng BaoCao không đổi', (await dem('SELECT COUNT(*) AS n FROM BaoCao')) === bcTruoc);
  check('kho không còn dòng nào của lô thử', (await dem(`SELECT COUNT(*) AS n FROM Lo_ViTri WHERE so_lo = '${soLo}'`)) === 0);
  await pool.end();
  console.log(`\nKết quả: ${pass} đạt, ${fail} lỗi`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Lỗi:', err);
  await pool.end().catch(() => {});
  process.exit(1);
});
