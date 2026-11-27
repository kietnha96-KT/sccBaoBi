import { useState } from 'react';
import { listNhanSu } from '../api/nhansuApi';
import { createXinNghi, updateXinNghi, soLanConLai } from '../api/xinNghiApi';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { todayStr } from '../format';
import { ALL_LIMIT } from '../constants';
import { nhanSuValue, nhanSuLabel } from '../selectHelpers';
import { LOAI_NGHI, PHAN_NGAY_PHEP, gio5 } from '../xinNghi';
import Alert from './Alert';
import SearchableSelect from './SearchableSelect';
import TimeSelect from './TimeSelect';

// Ngày sớm nhất nhân viên được chọn: hôm nay lùi `buLui` ngày
function ngaySomNhat(buLui) {
  const d = new Date(`${todayStr()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - buLui);
  return d.toISOString().slice(0, 10);
}

function congPhut(gio, phut) {
  if (!gio) return '';
  const [h, m] = gio.split(':').map(Number);
  const tong = h * 60 + m + phut;
  if (tong >= 24 * 60) return '';
  return `${String(Math.floor(tong / 60)).padStart(2, '0')}:${String(tong % 60).padStart(2, '0')}`;
}

const doiRaPhut = (gio) => Number(gio.slice(0, 2)) * 60 + Number(gio.slice(3, 5));

// Giờ kết thúc phép 0,5 / 0,25 ngày, bỏ qua nghỉ trưa 11:30-12:30 (BE tính lại y như vậy khi lưu)
function ketThucPhep(tuGio, phut) {
  if (!tuGio) return '';
  const batDau = tuGio >= '11:30' && tuGio < '12:30' ? '12:30' : tuGio;
  const ketThuc = congPhut(batDau, phut);
  return batDau < '11:30' && ketThuc > '11:30' ? congPhut(ketThuc, 60) : ketThuc;
}

// Đơn đang sửa là mức nào: tính từ số phút làm việc giữa 2 giờ. Đơn kiểu cũ (giờ tùy ý) -> '1'.
function phanNgayCuaDon(don) {
  if (!don?.tu_gio || !don.den_gio) return '1';
  const tu = doiRaPhut(don.tu_gio);
  const den = doiRaPhut(don.den_gio);
  const trua = Math.max(0, Math.min(den, doiRaPhut('12:30')) - Math.max(tu, doiRaPhut('11:30')));
  return PHAN_NGAY_PHEP.find((p) => p.phut === den - tu - trua)?.value || '1';
}

// don = null: kê mới. don = { id, nhansu_id, ho_ten, loai, ngay, tu_gio, den_gio, ly_do }: sửa 1 ngày.
export default function XinNghiForm({ don, keHo, onSaved }) {
  const { user, isAdmin } = useAuth();
  const isEdit = !!don;
  const chonNguoi = isAdmin || keHo; // được chọn người nghỉ
  const [form, setForm] = useState(() => ({
    nhansu_id: don?.nhansu_id ?? (keHo ? user.id : ''), // kê hộ: mặc định là chính mình
    loai: don?.loai || 'nghi_phep',
    ngay: don?.ngay || todayStr(),
    den_ngay: '',
    phan_ngay: phanNgayCuaDon(don), // chỉ dùng cho nghỉ phép
    tu_gio: gio5(don?.tu_gio),
    den_gio: gio5(don?.den_gio),
    moc: don?.den_gio && !don?.tu_gio ? 'ra' : 'vao', // quên chấm công: chỉ 1 trong 2
    ly_do: don?.ly_do || '',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: nhanSuData } = useFetch(
    () => (chonNguoi && !isEdit ? listNhanSu({ limit: ALL_LIMIT }) : Promise.resolve(null)),
    []
  );
  const nhanVienList = (nhanSuData?.data || []).filter((ns) => ns.vai_tro === 'nhan_vien');

  const nhanSuId = chonNguoi ? form.nhansu_id : user.id;
  const { data: conLaiData } = useFetch(
    () =>
      nhanSuId && form.ngay
        ? soLanConLai({ nhansu_id: nhanSuId, ngay: form.ngay, bo_qua_id: don?.id })
        : Promise.resolve(null),
    [nhanSuId, form.ngay]
  );

  const loai = LOAI_NGHI[form.loai];
  const laQuen = form.loai === 'quen_cham_cong';
  const truongQuen = form.moc === 'vao' ? 'tu_gio' : 'den_gio';
  const tenMoc = form.moc === 'vao' ? 'Giờ vào' : 'Giờ ra';
  const laPhep = form.loai === 'nghi_phep';
  const nghiTheoNgay = !loai.soPhut && !laQuen; // phép / ốm
  const nhieuNgay = nghiTheoNgay && form.den_ngay > form.ngay;
  // > 0 khi là phép 0,5 / 0,25 ngày (đợt nhiều ngày luôn là cả ngày)
  const phutPhep = laPhep && !nhieuNgay ? PHAN_NGAY_PHEP.find((p) => p.value === form.phan_ngay)?.phut : undefined;
  const min = isAdmin ? undefined : ngaySomNhat(loai.buLui);
  const gioiHan = (conLaiData?.data || []).find((g) => g.loai.includes(form.loai));
  const laChuNhat = form.ngay && new Date(`${form.ngay}T00:00:00Z`).getUTCDay() === 0;

  const doi = (patch) => setForm((f) => ({ ...f, ...patch }));

  function doiLoai(value) {
    const moi = LOAI_NGHI[value];
    const somNhat = ngaySomNhat(moi.buLui);
    const quaHan = !isAdmin && form.ngay < somNhat;
    doi({ loai: value, tu_gio: '', den_gio: '', phan_ngay: '1', den_ngay: '', ...(quaHan && { ngay: todayStr() }) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (chonNguoi && !nhanSuId) return setError('Chọn nhân viên');
    if ((loai.soPhut || phutPhep) && !form.tu_gio) return setError('Chọn giờ bắt đầu');
    if (laQuen && !form[truongQuen]) return setError(`Chọn ${tenMoc.toLowerCase()}`);

    const boGio = nghiTheoNgay && !phutPhep; // ốm và phép cả ngày: không gửi giờ
    const body = {
      loai: form.loai,
      ngay: form.ngay,
      den_ngay: nhieuNgay ? form.den_ngay : undefined,
      tu_gio: boGio || (laQuen && form.moc !== 'vao') ? null : form.tu_gio || null,
      den_gio: laQuen && form.moc === 'ra' ? form.den_gio : null, // các loại khác BE tự tính giờ kết thúc
      phan_ngay: phutPhep ? Number(form.phan_ngay) : undefined,
      ly_do: form.ly_do,
    };
    setSaving(true);
    try {
      if (isEdit) await updateXinNghi(don.id, body);
      else await createXinNghi({ ...body, nhansu_id: chonNguoi ? Number(nhanSuId) : undefined });
      onSaved(form.ngay);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Alert>{error}</Alert>
      <div className="form-grid form-grid-1">
        {chonNguoi && (
          <div className="field">
            <label>
              Nhân viên<span className="req">*</span>
            </label>
            {isEdit ? (
              <input value={don.ho_ten} disabled />
            ) : (
              <SearchableSelect
                options={nhanVienList}
                getValue={nhanSuValue}
                getLabel={nhanSuLabel}
                value={form.nhansu_id}
                onChange={(v) => doi({ nhansu_id: v })}
                placeholder="Gõ tên nhân viên..."
                clearLabel="Chưa chọn"
              />
            )}
          </div>
        )}

        <div className="field">
          <label>
            Loại<span className="req">*</span>
          </label>
          <select value={form.loai} onChange={(e) => doiLoai(e.target.value)}>
            {Object.entries(LOAI_NGHI).map(([key, v]) => (
              <option key={key} value={key}>
                {v.ten}
              </option>
            ))}
          </select>
          {gioiHan && (
            <span className={gioiHan.da_dung >= gioiHan.toi_da ? 'field-hint text-danger' : 'field-hint'}>
              Tháng {form.ngay.slice(5, 7)}/{form.ngay.slice(0, 4)}: đã dùng {gioiHan.da_dung}/{gioiHan.toi_da} lần{' '}
              {gioiHan.ten}
            </span>
          )}
        </div>

        <div className="field">
          <label>
            {nghiTheoNgay && !isEdit ? 'Từ ngày' : 'Ngày'}
            <span className="req">*</span>
          </label>
          <input
            type="date"
            value={form.ngay}
            min={min}
            max={laQuen ? todayStr() : undefined}
            onChange={(e) => doi({ ngay: e.target.value })}
            required
          />
          {laChuNhat && <span className="field-hint text-danger">Chủ nhật không cần kê</span>}
        </div>

        {nghiTheoNgay && !isEdit && (
          <div className="field">
            <label>Đến ngày</label>
            <input type="date" value={form.den_ngay} min={form.ngay} onChange={(e) => doi({ den_ngay: e.target.value })} />
            <span className="field-hint">Bỏ trống nếu chỉ nghỉ 1 ngày</span>
          </div>
        )}

        {laPhep && !nhieuNgay && (
          <div className="field">
            <label>
              Số ngày nghỉ<span className="req">*</span>
            </label>
            <select value={form.phan_ngay} onChange={(e) => doi({ phan_ngay: e.target.value, tu_gio: '' })}>
              {PHAN_NGAY_PHEP.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.ten}
                </option>
              ))}
            </select>
          </div>
        )}

        {phutPhep && (
          <div>
            <TimeSelect label="Giờ bắt đầu" value={form.tu_gio} onChange={(v) => doi({ tu_gio: v })} required />
            {form.tu_gio && (
              <span className="field-hint">
                Kết thúc: {ketThucPhep(form.tu_gio, phutPhep) || 'vượt quá ngày'} (không tính nghỉ trưa)
              </span>
            )}
          </div>
        )}

        {loai.soPhut && (
          <div>
            <TimeSelect label="Giờ bắt đầu" value={form.tu_gio} onChange={(v) => doi({ tu_gio: v })} required />
            {form.tu_gio && (
              <span className="field-hint">
                Kết thúc: {congPhut(form.tu_gio, loai.soPhut) || 'vượt quá ngày'}
              </span>
            )}
          </div>
        )}

        {laQuen && (
          <>
            <div className="field">
              <label>
                Quên chấm<span className="req">*</span>
              </label>
              <select value={form.moc} onChange={(e) => doi({ moc: e.target.value, tu_gio: '', den_gio: '' })}>
                <option value="vao">Giờ vào</option>
                <option value="ra">Giờ ra</option>
              </select>
              <span className="field-hint">Mỗi đơn tính 1 lần. Quên cả vào lẫn ra thì kê 2 đơn.</span>
            </div>
            <TimeSelect label={tenMoc} value={form[truongQuen]} onChange={(v) => doi({ [truongQuen]: v })} required />
          </>
        )}

        <div className="field">
          <label>Lý do</label>
          <textarea rows={2} maxLength={255} value={form.ly_do} onChange={(e) => doi({ ly_do: e.target.value })} />
        </div>
      </div>

      {isAdmin && !isEdit && <p className="field-hint mt-10">Đơn admin kê hộ được duyệt luôn.</p>}
      {keHo && !isEdit && Number(nhanSuId) !== user.id && (
        <p className="field-hint mt-10">Đơn kê hộ vẫn chờ admin duyệt.</p>
      )}
      <button type="submit" className="btn btn-primary mt-16" disabled={saving}>
        {saving ? 'Đang lưu...' : 'Lưu'}
      </button>
    </form>
  );
}
