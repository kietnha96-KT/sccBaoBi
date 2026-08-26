import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBaoCao, createBaoCao, updateBaoCao } from '../api/baocaoApi';
import { listVatTu } from '../api/vattuApi';
import { listLo } from '../api/loApi';
import { listNhanSu } from '../api/nhansuApi';
import { getErrorMessage } from '../api/client';
import { formatSoLuong } from '../format';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import Alert from '../components/Alert';
import SearchableSelect from '../components/SearchableSelect';
import VatTuFilterFields from '../components/VatTuFilterFields';
import { ALL_LIMIT } from '../constants';
import { loValue, loLabel } from '../selectHelpers';

const todayStr = () => new Date().toISOString().substring(0, 10);

const emptyForm = {
  ngay: todayStr(),
  lo_id: '',
  dat: 0,
  hu_bo: 0,
  tg_bat_dau: '',
  tg_ket_thuc: '',
  loi_nguoi_dung: '',
  la_lua_lai: false,
  ghi_chu: '',
  nhansu_ids: [],
};

export default function BaoCaoFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: vatTuData } = useFetch(() => listVatTu({ limit: ALL_LIMIT }), []);
  const { data: nhanSuData } = useFetch(() => listNhanSu({ limit: ALL_LIMIT }), []);
  const vatTuList = vatTuData?.data;
  const nhanSuList = nhanSuData?.data;

  const [maVatTuFilter, setMaVatTuFilter] = useState('');
  const [loList, setLoList] = useState([]);

  const [form, setForm] = useState({
    ...emptyForm,
    nhansu_ids: user ? [user.id] : [],
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
        if (!bc.co_the_sua_xoa_hom_nay && user?.vai_tro !== 'admin') {
          setReadOnlyNotice('Báo cáo này không còn trong ngày nhập, bạn không thể sửa (chỉ admin mới sửa được).');
        }
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit, user]);

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

    if (form.nhansu_ids.length === 0) {
      setError('Phải chọn ít nhất 1 nhân sự tham gia');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        lo_id: Number(form.lo_id),
        dat: Number(form.dat),
        hu_bo: Number(form.hu_bo),
        tg_bat_dau: form.tg_bat_dau || null,
        tg_ket_thuc: form.tg_ket_thuc || null,
      };
      if (isEdit) {
        await updateBaoCao(id, payload);
      } else {
        await createBaoCao(payload);
      }
      navigate('/baocao');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="spinner-text">Đang tải...</div>;

  const disabled = !!readOnlyNotice;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        {isEdit ? 'Sửa báo cáo' : 'Nhập báo cáo lựa vật tư'}
      </h1>

      <Alert>{error}</Alert>
      <Alert type="success">{readOnlyNotice}</Alert>

      <form className="card" onSubmit={handleSubmit}>
        <div className="card-body">
          <div className="form-grid">
            <div className="field">
              <label>Ngày lựa</label>
              <input
                type="date"
                value={form.ngay}
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
            />

            <div className="field">
              <label>Lô</label>
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
              <label>Đạt</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.dat}
                onChange={(e) => setForm({ ...form, dat: e.target.value })}
                disabled={disabled}
                required
              />
            </div>

            <div className="field">
              <label>Hư bỏ</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.hu_bo}
                onChange={(e) => setForm({ ...form, hu_bo: e.target.value })}
                disabled={disabled}
                required
              />
            </div>

            <div className="field">
              <label>Tổng lựa</label>
              <input value={(Number(form.dat) || 0) + (Number(form.hu_bo) || 0)} disabled />
            </div>

            <div className="field">
              <label>Giờ bắt đầu</label>
              <input
                type="time"
                value={form.tg_bat_dau}
                onChange={(e) => setForm({ ...form, tg_bat_dau: e.target.value })}
                disabled={disabled}
              />
            </div>

            <div className="field">
              <label>Giờ kết thúc</label>
              <input
                type="time"
                value={form.tg_ket_thuc}
                onChange={(e) => setForm({ ...form, tg_ket_thuc: e.target.value })}
                disabled={disabled}
              />
            </div>

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
            <label>Lỗi (ghi chú tự do){isEdit ? ' - không thể sửa sau khi tạo' : ''}</label>
            <input
              value={form.loi_nguoi_dung}
              onChange={(e) => setForm({ ...form, loi_nguoi_dung: e.target.value })}
              disabled={disabled || isEdit}
              placeholder="VD: trong mốp góc, rách bao..."
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
            <label>Nhân sự tham gia</label>
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
            <button type="button" className="btn" onClick={() => navigate('/baocao')}>
              Hủy
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
