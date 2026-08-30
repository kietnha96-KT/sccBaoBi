import { useState } from 'react';
import { listLoaiVatTu } from '../api/vattuApi';
import { useFetch } from '../hooks/useFetch';
import SearchableSelect from './SearchableSelect';
import { vatTuValue, vatTuLabel } from '../selectHelpers';

/**
 * Cặp field "Loại vật tư" (select) + "Vật tư" (combobox gõ-tìm), dùng chung ở mọi bộ lọc/form
 * có chọn vật tư. Chọn Loại sẽ tự lọc bớt danh sách Vật tư theo loại đó (không hiện tất cả nữa).
 * Chỉ hiện field "Loại" khi có ít nhất 1 vật tư đã được gán loại (tránh dropdown trống vô nghĩa).
 *
 * vatTuList: mảng vật tư đầy đủ (đã có sẵn ở component cha, component này không tự fetch lại)
 * value / onChange: giá trị ma_vat_tu đang chọn, giống SearchableSelect
 */
export default function VatTuFilterFields({
  vatTuList,
  value,
  onChange,
  allowClear = true,
  disabled = false,
  vatTuPlaceholder = 'Gõ mã hoặc tên vật tư...',
  loaiLabel = 'Loại vật tư',
  vatTuLabelText = 'Vật tư',
  vatTuRequired = false,
  showLoai = true,
}) {
  const [loai, setLoai] = useState('');
  const { data: loaiOptions } = useFetch(listLoaiVatTu, []);

  const filteredVatTu = loai ? (vatTuList || []).filter((v) => v.loai === loai) : vatTuList || [];

  function handleLoaiChange(next) {
    setLoai(next);
    // nếu vật tư đang chọn không thuộc loại mới thì bỏ chọn, tránh trạng thái mâu thuẫn
    if (next && value) {
      const stillMatches = (vatTuList || []).some(
        (v) => vatTuValue(v) === value && v.loai === next
      );
      if (!stillMatches) onChange('');
    }
  }

  return (
    <>
      {showLoai && loaiOptions?.length > 0 && (
        <div className="field">
          <label>{loaiLabel}</label>
          <select value={loai} onChange={(e) => handleLoaiChange(e.target.value)} disabled={disabled}>
            <option value="">Tất cả</option>
            {loaiOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field" style={{ minWidth: 260 }}>
        <label>
          {vatTuLabelText}
          {vatTuRequired && <span className="req">*</span>}
        </label>
        <SearchableSelect
          options={filteredVatTu}
          getValue={vatTuValue}
          getLabel={vatTuLabel}
          value={value}
          onChange={onChange}
          placeholder={vatTuPlaceholder}
          allowClear={allowClear}
          disabled={disabled}
        />
      </div>
    </>
  );
}
