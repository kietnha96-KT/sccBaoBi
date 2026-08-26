import SearchableSelect from './SearchableSelect';
import VatTuFilterFields from './VatTuFilterFields';

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
        <VatTuFilterFields
          vatTuList={vatTuList}
          value={filters.ma_vat_tu}
          onChange={(v) => setFilters({ ...filters, ma_vat_tu: v })}
        />
      )}
      {showLo && (
        <div className="field" style={{ minWidth: 220 }}>
          <label>Lô</label>
          <SearchableSelect
            options={loList || []}
            getValue={(l) => l.id}
            getLabel={(l) => l.so_lo}
            value={filters.lo_id || ''}
            onChange={(v) => setFilters({ ...filters, lo_id: v })}
            placeholder="Gõ số lô..."
          />
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
