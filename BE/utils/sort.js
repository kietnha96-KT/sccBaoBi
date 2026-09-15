// Sắp xếp theo cột (bấm tiêu đề bảng ở FE) - dùng chung cho các route danh sách.
// Không parameterize được TÊN CỘT trong SQL -> bắt buộc whitelist (columnMap) để chặn
// SQL injection qua query string (?sort_by=...). columnMap: { <sort_key FE gửi lên>: '<cột SQL an toàn>' }

// Dùng cho route phân trang bằng SQL LIMIT/OFFSET (NhaCungCap, NhanSu, VatTu, Lo, LoaiLoi, BaoCao).
function buildOrderBy(query, columnMap, defaultOrderBy) {
  const col = columnMap[query.sort_by];
  if (!col) return defaultOrderBy;
  const dir = query.sort_dir === 'desc' ? 'DESC' : 'ASC';
  return `ORDER BY ${col} ${dir}`;
}

// Dùng cho route dashboard: kết quả đã gom nhóm/lọc xong nằm sẵn trong mảng JS (paginateArray
// cắt trang sau), nên sắp xếp lại mảng đó thay vì sửa SQL. columnMap: { <sort_key>: '<tên field trong row>' }
function sortRows(rows, query, columnMap) {
  const field = columnMap[query.sort_by];
  if (!field) return rows;
  const dir = query.sort_dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const an = Number(av);
    const bn = Number(bv);
    if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== '' && bv !== '') {
      return (an - bn) * dir;
    }
    return String(av).localeCompare(String(bv), 'vi') * dir;
  });
}

module.exports = { buildOrderBy, sortRows };
