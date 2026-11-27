import { useEffect, useState } from 'react';
import { listXinNghi, deleteXinNghi, doiTrangThaiXinNghi } from '../api/xinNghiApi';
import { listNhanSu } from '../api/nhansuApi';
import { getErrorMessage, downloadExcel } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useRowSelect } from '../hooks/useRowSelect';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useCloseOnBackButton } from '../hooks/useCloseOnBackButton';
import { PAGE_SIZE, ALL_LIMIT } from '../constants';
import { nhanSuValue, nhanSuLabel } from '../selectHelpers';
import { todayStr } from '../format';
import { LOAI_NGHI, TRANG_THAI, tenLoai, ngayVN, moTaGio } from '../xinNghi';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import SearchableSelect from '../components/SearchableSelect';
import SelectionActionBar from '../components/SelectionActionBar';
import SortableTh from '../components/SortableTh';
import TruncatedText from '../components/TruncatedText';
import XinNghiForm from '../components/XinNghiForm';

const thoiGian = (r) =>
  r.so_ngay > 1 ? `${ngayVN(r.tu_ngay)} → ${ngayVN(r.den_ngay)} (${r.so_ngay} ngày)` : ngayVN(r.tu_ngay);

const badge = (trangThai) => (
  <span className={`badge ${TRANG_THAI[trangThai].badge}`}>{TRANG_THAI[trangThai].ten}</span>
);

// Dữ liệu đưa vào form sửa 1 ngày
const donDeSua = (r, ngay) => ({
  id: ngay.id,
  nhansu_id: r.nhansu_id,
  ho_ten: r.ho_ten,
  loai: r.loai,
  ngay: ngay.ngay,
  tu_gio: ngay.tu_gio,
  den_gio: ngay.den_gio,
  ly_do: ngay.ly_do,
});

export default function XinNghiPage() {
  const { isAdmin, isThuKho } = useAuth(); // thủ kho chỉ xem
  const { filters, page, sortBy, sortDir, updateFilter, setPage, toggleSort } = useUrlFilters({
    thang: '',
    loai: '',
    trang_thai: '',
    nhansu_id: '',
  });
  const { loai, trang_thai, nhansu_id } = filters;
  // mặc định tháng hiện tại; 'all' (mọi tháng) chỉ dùng cho nút xem đơn chờ duyệt của admin
  const thang = filters.thang || todayStr().slice(0, 7);
  const moiThang = thang === 'all';

  const { data, loading, error, reload } = useFetch(
    () =>
      listXinNghi({
        page,
        limit: PAGE_SIZE,
        thang,
        loai: loai || undefined,
        trang_thai: trang_thai || undefined,
        nhansu_id: nhansu_id || undefined,
        sort_by: sortBy || undefined,
        sort_dir: sortDir,
      }),
    [page, thang, loai, trang_thai, nhansu_id, sortBy, sortDir]
  );
  const { data: nhanSuData } = useFetch(() => listNhanSu({ limit: ALL_LIMIT }), []);
  const nhanVienList = (nhanSuData?.data || []).filter((ns) => ns.vai_tro === 'nhan_vien');

  const { selectedRowId, setSelectedRowId, getRowProps } = useRowSelect();
  const [formDon, setFormDon] = useState(undefined); // undefined = đóng, null = kê mới, object = sửa
  const [viewKhoa, setViewKhoa] = useState(null);
  const [busy, setBusy] = useState(false);
  useCloseOnBackButton(!!viewKhoa, () => setViewKhoa(null));

  const rows = data?.data || [];
  const selected = rows.find((r) => r.khoa === selectedRowId) || null;
  const viewRow = rows.find((r) => r.khoa === viewKhoa) || null;
  const choDuyet = data?.cho_duyet_tong || 0;
  const keHo = !isAdmin && !!data?.duoc_ke_ho; // nhân viên được admin tick "kê hộ"

  useEffect(() => {
    setSelectedRowId(null);
  }, [page, thang, loai, trang_thai, nhansu_id, setSelectedRowId]);

  // xuất theo đúng bộ lọc đang xem (không phân trang)
  function xuatExcel() {
    const params = {
      thang,
      loai: loai || undefined,
      trang_thai: trang_thai || undefined,
      nhansu_id: nhansu_id || undefined,
    };
    downloadExcel('/xin-nghi/export', params, `don_xin_nghi_${moiThang ? 'tat_ca' : thang}.xlsx`).catch((err) =>
      alert(getErrorMessage(err))
    );
  }

  async function thucHien(fn) {
    setBusy(true);
    try {
      await fn();
      setSelectedRowId(null);
      reload({ silent: true });
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function doiTrangThai(r, trangThai) {
    let ghi_chu_duyet;
    if (trangThai === 'tu_choi') {
      ghi_chu_duyet = prompt(`Lý do từ chối đơn của ${r.ho_ten} (có thể để trống):`, '');
      if (ghi_chu_duyet === null) return; // bấm Hủy
    }
    thucHien(() => doiTrangThaiXinNghi(r.id, { trang_thai: trangThai, ghi_chu_duyet }));
  }

  function xoa(r) {
    const cau =
      r.so_ngay > 1
        ? `Xóa cả đợt ${r.so_ngay} ngày (${thoiGian(r)})?`
        : `Xóa đơn ${tenLoai(r.loai)} ngày ${ngayVN(r.tu_ngay)}?`;
    if (!confirm(cau)) return;
    thucHien(() => deleteXinNghi(r.id, { ca_dot: true }));
  }

  function xoaMotNgay(ngay) {
    if (!confirm(`Xóa riêng ngày ${ngayVN(ngay.ngay)} khỏi đợt nghỉ?`)) return;
    setViewKhoa(null);
    thucHien(() => deleteXinNghi(ngay.id));
  }

  function daLuu(ngay) {
    setFormDon(undefined);
    setSelectedRowId(null);
    // đơn rơi vào tháng khác tháng đang xem -> chuyển sang tháng đó cho thấy ngay
    if (!moiThang && ngay.slice(0, 7) !== thang) updateFilter({ thang: ngay.slice(0, 7) });
    else reload({ silent: true });
  }

  return (
    <div className={selected ? 'has-selection-bar' : undefined}>
      <h1 className="page-title">Đơn xin nghỉ</h1>
      <Alert>{error}</Alert>
      {isAdmin && choDuyet > 0 && !(moiThang && trang_thai === 'cho_duyet') && (
        <Alert type="warning">
          Có <strong>{choDuyet}</strong> đơn đang chờ duyệt.{' '}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => updateFilter({ thang: 'all', trang_thai: 'cho_duyet', loai: '', nhansu_id: '' })}
          >
            Xem đơn chờ duyệt
          </button>
        </Alert>
      )}

      <div className="filter-bar">
        <div className="field">
          <label>Tháng {moiThang && '(đang xem mọi tháng)'}</label>
          <input type="month" value={moiThang ? '' : thang} onChange={(e) => updateFilter({ thang: e.target.value })} />
        </div>
        <div className="field field-md">
          <label>Nhân viên</label>
          <SearchableSelect
            options={nhanVienList}
            getValue={nhanSuValue}
            getLabel={nhanSuLabel}
            value={nhansu_id}
            onChange={(v) => updateFilter({ nhansu_id: v })}
            placeholder="Tất cả"
          />
        </div>
        <div className="field">
          <label>Loại</label>
          <select value={loai} onChange={(e) => updateFilter({ loai: e.target.value })}>
            <option value="">Tất cả</option>
            {Object.keys(LOAI_NGHI).map((key) => (
              <option key={key} value={key}>
                {tenLoai(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Trạng thái</label>
          <select value={trang_thai} onChange={(e) => updateFilter({ trang_thai: e.target.value })}>
            <option value="">Tất cả</option>
            {Object.entries(TRANG_THAI).map(([key, v]) => (
              <option key={key} value={key}>
                {v.ten}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Danh sách đơn {data?.pagination ? `(${data.pagination.total})` : ''}</h2>
          <div className="btn-group">
            <button className="btn btn-sm" onClick={xuatExcel}>
              Xuất Excel
            </button>
            {!isThuKho && (
              <button className="btn btn-primary btn-sm" onClick={() => setFormDon(null)}>
                {isAdmin ? '+ Kê hộ nhân viên' : '+ Kê xin nghỉ'}
              </button>
            )}
          </div>
        </div>

        <SelectionActionBar
          selected={selected}
          onClear={() => setSelectedRowId(null)}
          idleHint={
            isAdmin
              ? 'Bấm vào một dòng để Duyệt / Từ chối / Sửa / Xóa'
              : isThuKho
                ? 'Bấm vào một dòng để Xem'
                : `Bấm vào một dòng để Xem (đơn của bạn${keHo ? ' hoặc bạn kê hộ' : ''} thì Sửa / Xóa được)`
          }
          label={selected && `${selected.ho_ten} — ${tenLoai(selected.loai)}, ${thoiGian(selected)}`}
        >
          {isAdmin && selected && selected.trang_thai !== 'da_duyet' && (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => doiTrangThai(selected, 'da_duyet')}>
              Duyệt
            </button>
          )}
          {isAdmin && selected?.trang_thai === 'cho_duyet' && (
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => doiTrangThai(selected, 'tu_choi')}>
              Từ chối
            </button>
          )}
          {isAdmin && selected && selected.trang_thai !== 'cho_duyet' && (
            <button className="btn btn-sm" disabled={busy} onClick={() => doiTrangThai(selected, 'cho_duyet')}>
              Về chờ duyệt
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setViewKhoa(selected.khoa)}>
            Xem
          </button>
          {selected?.co_the_sua && (
            <button className="btn btn-sm" onClick={() => setFormDon(donDeSua(selected, selected.cac_ngay[0]))}>
              Sửa
            </button>
          )}
          {selected?.co_the_xoa && (
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => xoa(selected)}>
              Xóa
            </button>
          )}
        </SelectionActionBar>

        <div className="table-wrap">
          {loading ? (
            <div className="spinner-text">Đang tải...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Nhân viên" sortKey="ho_ten" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Thời gian" sortKey="tu_ngay" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Loại" sortKey="loai" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <th>Giờ</th>
                  <th>Lý do</th>
                  <SortableTh label="Trạng thái" sortKey="trang_thai" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.khoa} {...getRowProps(r.khoa)}>
                    <td>{r.ho_ten}</td>
                    <td className="nowrap">{thoiGian(r)}</td>
                    <td className="nowrap">{tenLoai(r.loai)}</td>
                    <td className="nowrap">{moTaGio(r)}</td>
                    <td>
                      <TruncatedText text={r.ly_do || '-'} maxWidth={200} />
                    </td>
                    <td>{badge(r.trang_thai)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Không có đơn nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <Pagination pagination={data?.pagination} onPageChange={setPage} />
      </div>

      {viewRow && !formDon && (
        <Modal title="Chi tiết đơn xin nghỉ" onClose={() => setViewKhoa(null)}>
          <dl className="detail-list mb-16">
            <dt>Nhân viên:</dt>
            <dd>{viewRow.ho_ten}</dd>
            <dt>Loại:</dt>
            <dd>{tenLoai(viewRow.loai)}</dd>
            <dt>Thời gian:</dt>
            <dd>{thoiGian(viewRow)}</dd>
            <dt>Giờ:</dt>
            <dd>{moTaGio(viewRow)}</dd>
            <dt>Lý do:</dt>
            <dd className="pre-wrap">{viewRow.ly_do || '-'}</dd>
            <dt>Trạng thái:</dt>
            <dd>
              {badge(viewRow.trang_thai)}
              {viewRow.nguoi_duyet && ` bởi ${viewRow.nguoi_duyet}`}
            </dd>
            {viewRow.ghi_chu_duyet && (
              <>
                <dt>Ghi chú duyệt:</dt>
                <dd>{viewRow.ghi_chu_duyet}</dd>
              </>
            )}
            <dt>Người kê:</dt>
            <dd>{viewRow.nguoi_tao}</dd>
          </dl>

          {viewRow.so_ngay > 1 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày trong đợt</th>
                    {isAdmin && <th>Sửa riêng ngày này</th>}
                  </tr>
                </thead>
                <tbody>
                  {viewRow.cac_ngay.map((n) => (
                    <tr key={n.id}>
                      <td>{ngayVN(n.ngay)}</td>
                      {isAdmin && (
                        <td>
                          <div className="row-actions">
                            <button className="btn btn-sm" onClick={() => setFormDon(donDeSua(viewRow, n))}>
                              Sửa
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => xoaMotNgay(n)}>
                              Xóa
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {formDon !== undefined && (
        <Modal title={formDon ? 'Sửa đơn xin nghỉ' : 'Kê xin nghỉ'} onClose={() => setFormDon(undefined)}>
          <XinNghiForm
            don={formDon}
            keHo={keHo}
            onSaved={(ngay) => {
              setViewKhoa(null);
              daLuu(ngay);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
