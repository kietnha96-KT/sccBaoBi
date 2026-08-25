// Thanh lọc dùng chung cho 4 trang dashboard: khoảng ngày, vật tư, lô, loại báo cáo (la_lua_lai)
export default function DashboardFilterBar({ filters, setFilters, vatTuList, showLo, loList, extra }) {
  return (
    <div className="filter-bar">
      <div className="field">
        <label>Từ ngày</label>
        <input type="date" value={filters.tu_ngay} onChange={(e) => setFilters({ ...filters, tu_ngay: e.target.value })} />
      </div>
      <div className="field">
        <label>Đến ngày</label>
        <input type="date" value={filters.den_ngay} onChange={(e) => setFilters({ ...filters, den_ngay: e.target.value })} />
      </div>
      {vatTuList !== undefined && (
        <div className="field">
          <label>Vật tư</label>
          <select value={filters.ma_vat_tu} onChange={(e) => setFilters({ ...filters, ma_vat_tu: e.target.value })}>
            <option value="">Tất cả</option>
            {vatTuList?.map((v) => (
              <option key={v.ma_vat_tu} value={v.ma_vat_tu}>
                {v.ma_vat_tu} - {v.ten_vat_tu}
              </option>
            ))}
          </select>
        </div>
      )}
      {showLo && (
        <div className="field">
          <label>Lô</label>
          <select value={filters.lo_id || ''} onChange={(e) => setFilters({ ...filters, lo_id: e.target.value })}>
            <option value="">Tất cả</option>
            {loList?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.so_lo}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>Loại báo cáo</label>
        <select value={filters.la_lua_lai} onChange={(e) => setFilters({ ...filters, la_lua_lai: e.target.value })}>
          <option value="false">Lựa chính (mặc định)</option>
          <option value="true">Lựa lại</option>
          <option value="all">Gộp cả hai</option>
        </select>
      </div>
      {extra}
    </div>
  );
}
