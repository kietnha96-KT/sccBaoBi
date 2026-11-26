// Đối chiếu hiện trạng Lo_ViTri với sổ ViTri_GiaoDich: phát lại toàn bộ sổ theo thứ tự thời gian (id tăng dần)
// rồi so với Lo_ViTri đang có. Lệch dòng nào thì in ra dòng đó; có lệch -> thoát mã 1.
// Dùng (trong BE/):  node scripts/kiem-tra-vitri.js          (đọc DB theo .env, chỉ ĐỌC - không ghi gì)
require('dotenv').config();
const pool = require('../db');

// Quy tắc phát lại PHẢI khớp utils/viTri.js (xem chú thích đầu file đó)
function apDung(state, thaoTac, q) {
  switch (thaoTac) {
    case 'nhap':
    case 'chuyen_den':
      if (!state.co) return { co: true, so: q };
      if (q === null) return state;
      return { co: true, so: state.so === null ? q : Math.round((state.so + q) * 100) / 100 };
    case 'xuat':
    case 'chuyen_di':
      if (q === null) return { co: false, so: null };
      if (state.so === null) return state;
      {
        const con = Math.round((state.so - q) * 100) / 100;
        return con <= 0 ? { co: false, so: null } : { co: true, so: con };
      }
    case 'dieu_chinh':
      return q === 0 ? { co: false, so: null } : { co: true, so: q };
    default:
      throw new Error('thao_tac lạ: ' + thaoTac);
  }
}

async function main() {
  const gd = await pool.query(
    'SELECT ma_vat_tu, so_lo, vi_tri_id, thao_tac, nhom_id, so_luong FROM ViTri_GiaoDich ORDER BY id'
  );
  const replay = new Map(); // "vattu|solo|vitri" -> state (so_lo không phân biệt hoa/thường)
  const nhom = new Map(); // nhom_id -> { di, den }
  for (const r of gd.rows) {
    const key = `${r.ma_vat_tu}|${r.so_lo.toLowerCase()}|${r.vi_tri_id}`;
    const q = r.so_luong === null ? null : Number(r.so_luong);
    replay.set(key, apDung(replay.get(key) || { co: false, so: null }, r.thao_tac, q));
    if (r.nhom_id) {
      const n = nhom.get(r.nhom_id) || { di: 0, den: 0, soDi: null, soDen: null };
      if (r.thao_tac === 'chuyen_di') { n.di++; n.soDi = q; }
      if (r.thao_tac === 'chuyen_den') { n.den++; n.soDen = q; }
      nhom.set(r.nhom_id, n);
    }
  }

  const hienTrang = await pool.query(
    `SELECT lv.ma_vat_tu, lv.so_lo, lv.vi_tri_id, lv.so_luong, v.ma_vi_tri
     FROM Lo_ViTri lv JOIN ViTriKho v ON v.id = lv.vi_tri_id`
  );
  const that = new Map();
  for (const r of hienTrang.rows) that.set(`${r.ma_vat_tu}|${r.so_lo.toLowerCase()}|${r.vi_tri_id}`, { so: r.so_luong === null ? null : Number(r.so_luong), ma: r.ma_vi_tri });

  let loi = 0;
  for (const [key, st] of replay) {
    const t = that.get(key);
    if (st.co && !t) { console.log(`THIẾU trong Lo_ViTri: vật tư|lô|ô ${key} (sổ nói còn ${st.so})`); loi++; }
    else if (!st.co && t) { console.log(`THỪA trong Lo_ViTri: vật tư|lô|ô ${key} (${t.ma}) số ${t.so}, sổ nói đã hết`); loi++; }
    else if (st.co && t && st.so !== t.so) { console.log(`LỆCH SỐ: vật tư|lô|ô ${key} (${t.ma}) bảng=${t.so} sổ=${st.so}`); loi++; }
  }
  for (const [key, t] of that) {
    if (!replay.has(key)) { console.log(`KHÔNG CÓ trong sổ: vật tư|lô|ô ${key} (${t.ma}) số ${t.so}`); loi++; }
  }
  let capLoi = 0;
  for (const [id, n] of nhom) {
    if (n.di !== 1 || n.den !== 1 || n.soDi !== n.soDen) { console.log(`NHÓM CHUYỂN LỖI ${id}: di=${n.di} den=${n.den} soDi=${n.soDi} soDen=${n.soDen}`); capLoi++; }
  }
  const am = await pool.query('SELECT COUNT(*) FROM Lo_ViTri WHERE so_luong < 0');

  console.log(`Sổ: ${gd.rows.length} giao dịch | ${nhom.size} lần chuyển | Lo_ViTri: ${that.size} dòng | phát lại ra ${[...replay.values()].filter((s) => s.co).length} dòng`);
  console.log(`Lệch Lo_ViTri/sổ: ${loi} | cặp chuyen_di/chuyen_den lỗi: ${capLoi} | số âm: ${am.rows[0].count}`);
  console.log(loi === 0 && capLoi === 0 && Number(am.rows[0].count) === 0 ? 'KHỚP' : 'CÓ LỆCH');
  await pool.end();
  process.exit(loi === 0 && capLoi === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Lỗi:', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
