import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import Alert from '../components/Alert';
import NumberInput from '../components/NumberInput';
import SearchableSelect from '../components/SearchableSelect';
import SearchInput from '../components/SearchInput';
import { useFetch } from '../hooks/useFetch';
import { formatSoLuong } from '../format';
import { getErrorMessage } from '../api/client';
import { vatTuValue, vatTuLabel } from '../selectHelpers';
import { nhapViTri, xuatViTri, chuyenViTri, dieuChinhViTri, goiYViTri } from '../api/khoApi';

const TITLE = {
  nhap: 'Nhập lô vào ô',
  xuat: 'Xuất lô khỏi ô',
  chuyen: 'Chuyển lô sang ô khác',
  dieu_chinh: 'Sửa số lượng trong ô',
};

// Số lượng ô nhập (chuỗi chữ số) -> null nếu bỏ trống, ngược lại Number
const toSoLuong = (s) => (s === '' || s === undefined ? null : Number(s));

/**
 * Form 4 thao tác vị trí (nhập / xuất / chuyển / điều chỉnh) trong 1 modal.
 * action: { type, ma_vi_tri, ma_vat_tu?, so_lo?, ten_vat_tu?, dang_co? }  (lô có sẵn với xuất/chuyển/điều chỉnh;
 *         nhập thì chọn vật tư + gõ số lô - lô ở kho độc lập với bảng Lo bên lựa, gõ số lô mới tinh cũng được)
 * NHẬP NHANH: type = 'nhap' mà ma_vi_tri để trống (mở từ nút ngoài bản đồ, chưa chọn ô) -> người dùng tự gõ mã ô
 *         (có gợi ý), và có thêm nút "nhập tiếp" để nhập liên tục nhiều pallet mà không phải mở lại form.
 * vatTuList: danh mục vật tư (chọn khi nhập). loTrongKho: các lô đang có trong kho, chỉ để GỢI Ý số lô khi gõ.
 * Chỉ gọi API và báo kết quả ra ngoài (onDone); không tự cập nhật danh sách - nơi dùng sẽ nạp lại.
 */
export default function KhoActionModal({ action, vatTuList, loTrongKho, cellOptions, onClose, onDone }) {
  const { type } = action;
  const nhanh = type === 'nhap' && !action.ma_vi_tri;
  const [maO, setMaO] = useState(action.ma_vi_tri || '');
  const [okMsg, setOkMsg] = useState(''); // nhập nhanh: báo kết quả lần nhập trước ngay trong form (form vẫn mở)
  // Gợi ý mã ô khi gõ (chỉ nhập nhanh): chờ ngừng gõ 250ms rồi mới hỏi BE
  const [maOGoiY, setMaOGoiY] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setMaOGoiY(maO.trim()), 250);
    return () => clearTimeout(t);
  }, [maO]);
  const goiYQ = useFetch(() => (nhanh && maOGoiY ? goiYViTri(maOGoiY) : Promise.resolve(null)), [nhanh, maOGoiY]);
  const [maVatTu, setMaVatTu] = useState(action.ma_vat_tu || '');
  const [soLo, setSoLo] = useState(action.so_lo || '');
  // Số lô gợi ý: lô đang có trong kho của vật tư đã chọn
  const goiYSoLo = [...new Set((loTrongKho || []).filter((l) => l.ma_vat_tu === maVatTu).map((l) => l.so_lo))];
  const [soLuong, setSoLuong] = useState(
    type === 'dieu_chinh' && action.dang_co !== null && action.dang_co !== undefined ? String(Math.round(action.dang_co)) : ''
  );
  const [den, setDen] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  // ô đích: mọi ô trong kho trừ ô đang đứng
  const denOptions = (cellOptions || []).filter((o) => o.value !== action.ma_vi_tri);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // giuMo = true (chỉ nhập nhanh): lưu xong KHÔNG đóng form, giữ vật tư + số lô, xóa ô + số lượng để nhập tiếp
  async function luu(giuMo) {
    setError('');
    setOkMsg('');
    const o = maO.trim().toUpperCase();
    if (!o) { setError('Hãy nhập mã ô'); return; }
    if (!maVatTu) { setError('Hãy chọn vật tư'); return; }
    if (!soLo.trim()) { setError('Hãy nhập số lô'); return; }
    if (type === 'chuyen') {
      const d = den.trim().toUpperCase();
      if (!d) { setError('Hãy nhập hoặc chọn ô đích'); return; }
      if (d === action.ma_vi_tri) { setError('Ô đích phải khác ô hiện tại'); return; }
    }
    setSaving(true);
    try {
      const base = { ma_vat_tu: maVatTu, so_lo: soLo.trim(), ghi_chu: ghiChu.trim() || undefined };
      let res;
      if (type === 'nhap') res = await nhapViTri({ ...base, ma_vi_tri: o, so_luong: toSoLuong(soLuong) });
      else if (type === 'xuat') res = await xuatViTri({ ...base, ma_vi_tri: o, so_luong: toSoLuong(soLuong) });
      else if (type === 'chuyen') {
        res = await chuyenViTri({ ...base, tu_vi_tri: o, den_vi_tri: den.trim().toUpperCase(), so_luong: toSoLuong(soLuong) });
      } else res = await dieuChinhViTri({ ...base, ma_vi_tri: o, so_luong: toSoLuong(soLuong) });
      if (giuMo) {
        const v = res.vi_tri[0];
        setOkMsg(`Đã nhập ${res.so_lo} (${res.ma_vat_tu}) vào ô ${v.ma_vi_tri}${v.so_luong === null ? '' : ` - trong ô hiện có ${formatSoLuong(v.so_luong)}`}. Nhập tiếp:`);
        setMaO('');
        setSoLuong('');
        document.getElementById('kho-nhanh-o')?.focus();
      }
      onDone(res, giuMo);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const slHint = {
    nhap: 'Bỏ trống nếu chưa biết số lượng.',
    xuat: 'Bỏ trống = lấy hết khỏi ô.',
    chuyen: 'Bỏ trống = chuyển hết.',
    dieu_chinh: 'Bỏ trống = chưa biết số lượng. Nhập 0 = xóa khỏi ô.',
  }[type];

  return (
    <Modal title={TITLE[type]} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); luu(false); }}>
        <Alert type="success">{okMsg}</Alert>
        <Alert>{error}</Alert>
        <div className="form-grid form-grid-1">
          <div className="field">
            <label htmlFor={nhanh ? 'kho-nhanh-o' : undefined}>{type === 'chuyen' ? 'Từ ô' : 'Ô'}</label>
            {nhanh ? (
              <>
                <SearchInput
                  id="kho-nhanh-o"
                  placeholder="Gõ mã ô, vd K05-O03-T2, S1-O03-T2-S4..."
                  ariaLabel="Mã ô cần nhập hàng vào"
                  value={maO}
                  onChange={(v) => setMaO(v.toUpperCase())}
                  suggestions={goiYQ.data?.data}
                  suggestionsTotal={goiYQ.data?.total}
                />
                <span className="field-hint">Gõ mã kệ để gợi ý.</span>
              </>
            ) : (
              <input value={action.ma_vi_tri} readOnly />
            )}
          </div>

          {type === 'nhap' ? (
            <>
              <div className="field">
                <label>Vật tư</label>
                <SearchableSelect
                  options={vatTuList || []}
                  getValue={vatTuValue}
                  getLabel={vatTuLabel}
                  value={maVatTu}
                  onChange={setMaVatTu}
                  allowClear={false}
                  placeholder="Gõ mã hoặc tên vật tư..."
                />
              </div>
              <div className="field">
                <label htmlFor="kho-so-lo">Số lô</label>
                <input
                  id="kho-so-lo"
                  list="kho-solo-goiy"
                  value={soLo}
                  onChange={(e) => setSoLo(e.target.value)}
                  maxLength={50}
                  autoComplete="off"
                  placeholder="Gõ số lô"
                />
                <datalist id="kho-solo-goiy">
                  {goiYSoLo.map((v) => <option key={v} value={v} />)}
                </datalist>
                <span className="field-hint">Gõ trùng lô đã có trong ô thì cộng dồn.</span>
              </div>
            </>
          ) : (
            <div className="field">
              <label>Lô</label>
              <input value={`${action.so_lo} (${action.ma_vat_tu})${action.ten_vat_tu ? ' - ' + action.ten_vat_tu : ''}`} readOnly />
            </div>
          )}

          {type === 'chuyen' && (
            <div className="field">
              <label>Đến ô</label>
              <SearchableSelect
                options={denOptions}
                getValue={(o) => o.value}
                getLabel={(o) => o.label}
                value={den}
                onChange={setDen}
                allowClear={false}
                maxItems={5000}
                placeholder="Gõ mã kệ hoặc ô, vd K31, S1-O03, K05-O03-T2..."
              />
            </div>
          )}

          <div className="field">
            <label>
              Số lượng
              {action.dang_co !== undefined && type !== 'nhap' && (
                <span className="field-hint"> (đang có: {action.dang_co === null ? 'chưa biết' : formatSoLuong(action.dang_co)})</span>
              )}
            </label>
            <NumberInput value={soLuong} onChange={setSoLuong} placeholder={type === 'nhap' ? 'Chưa biết' : type === 'dieu_chinh' ? 'Chưa biết' : 'Tất cả'} />
            <span className="field-hint">{slHint}</span>
          </div>

          <div className="field">
            <label>Ghi chú</label>
            <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} maxLength={500} placeholder="Không bắt buộc" />
          </div>
        </div>
        <div className="btn-group" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Xác nhận'}
          </button>
          {nhanh && (
            <button type="button" className="btn" disabled={saving} onClick={() => luu(true)}>
              Xác nhận và nhập tiếp
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {okMsg ? 'Đóng' : 'Hủy'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
