import { useEffect, useState } from 'react';
import { getBaoCao, createBaoCao, updateBaoCao } from '../api/baocaoApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listNhanSu } from '../api/nhansuApi';
import { getErrorMessage } from '../api/client';
import { formatSoLuong } from '../format';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import Alert from './Alert';
import NumberInput from './NumberInput';
import SearchableSelect from './SearchableSelect';
import VatTuFilterFields from './VatTuFilterFields';
import { ALL_LIMIT } from '../constants';
import { loValue, loLabel } from '../selectHelpers';

// Ngày hôm nay theo giờ máy người dùng (KHÔNG dùng toISOString vì đó là giờ UTC,
// nửa đêm ở VN sẽ ra ngày hôm trước).
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TIME_24H_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const GIO_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const PHUT_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// Dropdown chọn giờ:phút theo định dạng 24h. Giá trị giữ trong form vẫn là chuỗi "HH:MM" (hoặc "").
// Chọn 1 trong 2 ô -> ô còn lại tự lấy "00". Nút "Bỏ giờ" để xóa trắng cả cặp.
function TimeSelect({ label, value, onChange, disabled, required }) {
  const [h, m] = value && value.includes(':') ? value.split(':') : ['', ''];
  const setPart = (nh, nm) => {
    if (!nh && !nm) return onChange('');
    onChange(`${nh || '00'}:${nm || '00'}`);
  };
  return (
    <div className="field">
      <label>
        {label}
        {required && <span className="req">*</span>}
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={h} onChange={(e) => setPart(e.target.value, m)} disabled={disabled} aria-label={`${label} - giờ`}>
          <option value="">Giờ</option>
          {GIO_OPTIONS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <span>:</span>
        <select value={m} onChange={(e) => setPart(h, e.target.value)} disabled={disabled} aria-label={`${label} - phút`}>
          <option value="">Phút</option>
          {PHUT_OPTIONS.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        {value && !disabled && !required && (
          <button type="button" className="btn btn-sm" onClick={() => onChange('')}>
            Bỏ giờ
          </button>
        )}
      </div>
    </div>
  );
}

// Kiểm tra cặp giờ trước khi gửi lên server (đồng bộ với normalizeGioLamViec ở backend).
// Giờ bắt đầu và giờ kết thúc là BẮT BUỘC.
function validateGioLamViec(bd, kt) {
  if (!bd && !kt) return 'Phải nhập giờ bắt đầu và giờ kết thúc';
  if (!bd || !kt) return 'Phải nhập cả giờ bắt đầu và giờ kết thúc';
  if (!TIME_24H_RE.test(bd)) return 'Giờ bắt đầu chưa đúng định dạng 24 giờ HH:MM (ví dụ 08:30)';
  if (!TIME_24H_RE.test(kt)) return 'Giờ kết thúc chưa đúng định dạng 24 giờ HH:MM (ví dụ 17:00)';
  if (kt <= bd) return 'Giờ kết thúc phải sau giờ bắt đầu (trong cùng một ngày)';
  return '';
}

const emptyForm = {
  ngay: todayStr(),
  lo_id: '',
  dat: '',
  hu_bo: '',
  tg_bat_dau: '',
  tg_ket_thuc: '',
  loi_nguoi_dung: '',
  la_lua_lai: false,
  ghi_chu: '',
  nhansu_ids: [],
};

// Form nhập/sửa 1 báo cáo. Dùng được cả trong trang riêng (BaoCaoFormPage) lẫn trong popup.
//  - id       : có -> chế độ sửa (nạp báo cáo đó); không -> tạo mới
//  - onDone(saved) : gọi sau khi Lưu thành công (saved=true) hoặc bấm Hủy (saved=false)
export default function BaoCaoForm({ id, onDone }) {
  const isEdit = !!id;
  const { user, isAdmin } = useAuth();

  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: nhanSuData } = useFetch(() => listNhanSu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  // Chỉ cho tick chọn người có vai trò "nhân viên" (không hiện admin / thủ kho)
  const nhanSuList = (nhanSuData?.data || []).filter((ns) => ns.vai_tro === 'nhan_vien');

  const [maVatTuFilter, setMaVatTuFilter] = useState('');
  const [loList, setLoList] = useState([]);

  const [form, setForm] = useState({
    ...emptyForm,
    // Chỉ tự chọn sẵn bản thân nếu người tạo là nhân viên; admin/thủ kho không tính là người tham gia.
    nhansu_ids: user?.vai_tro === 'nhan_vien' ? [user.id] : [],
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [readOnlyNotice, setReadOnlyNotice] = useState('');

  // nạp báo cáo cũ khi ở chế độ sửa
  useEffect(() => {
    if (!isEdit) return;
    getBaoCao(id)
      .then((bc) => {
        setForm({
          ngay: bc.ngay.substring(0, 10),
          lo_id: bc.lo_id,
          dat: bc.dat,
          hu_bo: bc.hu_bo,
          tg_bat_dau: bc.tg_bat_dau ? bc.tg_bat_dau.substring(0, 5) : '',
          tg_ket_thuc: bc.tg_ket_thuc ? bc.tg_ket_thuc.substring(0, 5) : '',
          loi_nguoi_dung: bc.loi_nguoi_dung || '',
          la_lua_lai: bc.la_lua_lai,
          ghi_chu: bc.ghi_chu || '',
          nhansu_ids: bc.nhansu_tham_gia.map((n) => n.id),
        });
        setMaVatTuFilter(bc.ma_vat_tu);
        if (!bc.co_the_sua_xoa_hom_nay && !isAdmin) {
          setReadOnlyNotice('Báo cáo này không còn trong ngày nhập, bạn không thể sửa (chỉ admin mới sửa được).');
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit, user, isAdmin]);

  // nạp danh sách lô theo vật tư đang lọc
  useEffect(() => {
    listLo({ ma_vat_tu: maVatTuFilter || undefined, limit: ALL_LIMIT }).then((res) => setLoList(res.data));
  }, [maVatTuFilter]);

  const selectedLo = loList.find((l) => l.id === Number(form.lo_id)) || null;

  function toggleNhanSu(nsId) {
    setForm((f) => ({
      ...f,
      nhansu_ids: f.nhansu_ids.includes(nsId)
        ? f.nhansu_ids.filter((x) => x !== nsId)
        : [...f.nhansu_ids, nsId],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Các ô bắt buộc nhập (không được bỏ trống)
    if (!maVatTuFilter) {
      setError('Phải chọn vật tư');
      return;
    }
    if (!form.lo_id) {
      setError('Phải chọn lô');
      return;
    }
    if (form.dat === '' || form.dat === null) {
      setError('Phải nhập số lượng Đạt');
      return;
    }
    if (form.hu_bo === '' || form.hu_bo === null) {
      setError('Phải nhập số lượng Hư bỏ');
      return;
    }
    if (!form.loi_nguoi_dung.trim()) {
      setError('Phải nhập Lỗi');
      return;
    }
    if (form.nhansu_ids.length === 0) {
      setError('Phải chọn ít nhất 1 nhân viên tham gia');
      return;
    }

    const gioError = validateGioLamViec(form.tg_bat_dau.trim(), form.tg_ket_thuc.trim());
    if (gioError) {
      setError(gioError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        lo_id: Number(form.lo_id),
        dat: Number(form.dat),
        hu_bo: Number(form.hu_bo),
        tg_bat_dau: form.tg_bat_dau.trim() || null,
        tg_ket_thuc: form.tg_ket_thuc.trim() || null,
      };
      if (isEdit) {
        await updateBaoCao(id, payload);
      } else {
        await createBaoCao(payload);
      }
      onDone?.(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="spinner-text">Đang tải...</div>;

  const disabled = !!readOnlyNotice;

  return (
    <form onSubmit={handleSubmit}>
      <Alert>{error}</Alert>
      <Alert type="success">{readOnlyNotice}</Alert>

      <div className="form-grid">
        <div className="field">
          <label>Ngày lựa</label>
          <input
            type="date"
            value={form.ngay}
            max={todayStr()}
            onChange={(e) => setForm({ ...form, ngay: e.target.value })}
            disabled={disabled}
            required
          />
        </div>

        <VatTuFilterFields
          vatTuList={vatTuList}
          value={maVatTuFilter}
          onChange={(v) => {
            setMaVatTuFilter(v);
            setForm({ ...form, lo_id: '' });
          }}
          vatTuPlaceholder="Gõ mã hoặc tên vật tư để lọc lô..."
          disabled={disabled}
          showLoai={false}
          vatTuRequired
        />

        <div className="field">
          <label>
            Lô<span className="req">*</span>
          </label>
          <SearchableSelect
            options={loList}
            getValue={loValue}
            getLabel={loLabel}
            value={form.lo_id}
            onChange={(v) => setForm({ ...form, lo_id: v })}
            placeholder="Gõ số lô..."
            disabled={disabled}
            allowClear={false}
          />
          {selectedLo && (
            <span className="field-hint">
              Số lượng lô: {formatSoLuong(selectedLo.so_luong_lo)} | Đã lựa: {formatSoLuong(selectedLo.da_lua)} | Còn lại:{' '}
              <strong>{formatSoLuong(selectedLo.con_lai)}</strong>
            </span>
          )}
        </div>

        <div className="field">
          <label>
            Đạt<span className="req">*</span>
          </label>
          <NumberInput
            value={form.dat}
            onChange={(v) => setForm({ ...form, dat: v })}
            disabled={disabled}
            required
          />
        </div>

        <div className="field">
          <label>
            Hư bỏ<span className="req">*</span>
          </label>
          <NumberInput
            value={form.hu_bo}
            onChange={(v) => setForm({ ...form, hu_bo: v })}
            disabled={disabled}
            required
          />
        </div>

        <div className="field">
          <label>Tổng lựa</label>
          <input value={formatSoLuong((Number(form.dat) || 0) + (Number(form.hu_bo) || 0))} disabled />
        </div>

        <TimeSelect
          label="Giờ bắt đầu (24 giờ)"
          value={form.tg_bat_dau}
          onChange={(v) => setForm({ ...form, tg_bat_dau: v })}
          disabled={disabled}
          required
        />

        <TimeSelect
          label="Giờ kết thúc (24 giờ)"
          value={form.tg_ket_thuc}
          onChange={(v) => setForm({ ...form, tg_ket_thuc: v })}
          disabled={disabled}
          required
        />

        <div className="field checkbox-row" style={{ alignSelf: 'end' }}>
          <input
            type="checkbox"
            id="la_lua_lai"
            checked={form.la_lua_lai}
            onChange={(e) => setForm({ ...form, la_lua_lai: e.target.checked })}
            disabled={disabled}
          />
          <label htmlFor="la_lua_lai" style={{ margin: 0 }}>
            Bấm chọn nếu lựa lại
          </label>
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>
          Lỗi (ghi chú tự do)<span className="req">*</span>
        </label>
        <input
          value={form.loi_nguoi_dung}
          onChange={(e) => setForm({ ...form, loi_nguoi_dung: e.target.value })}
          disabled={disabled}
          placeholder="VD: trong mốp góc, rách bao..."
          required
        />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Ghi chú</label>
        <textarea
          rows={2}
          value={form.ghi_chu}
          onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
          disabled={disabled}
        />
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>
          Nhân sự tham gia<span className="req">*</span>
        </label>
        <div className="checkbox-grid">
          {nhanSuList?.map((ns) => (
            <label key={ns.id}>
              <input
                type="checkbox"
                checked={form.nhansu_ids.includes(ns.id)}
                onChange={() => toggleNhanSu(ns.id)}
                disabled={disabled}
              />
              {ns.ho_ten}
            </label>
          ))}
        </div>
      </div>

      <div className="btn-group" style={{ marginTop: 20 }}>
        <button type="submit" className="btn btn-primary" disabled={saving || disabled}>
          {saving ? 'Đang lưu...' : 'Lưu báo cáo'}
        </button>
        <button type="button" className="btn" onClick={() => onDone?.(false)}>
          Hủy
        </button>
      </div>
    </form>
  );
}
