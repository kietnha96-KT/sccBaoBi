// Thanh phân trang gọn cho di động: chỉ Trước/Sau + "Trang x/y (tổng z)", không hiện số trang rời rạc
export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total_pages <= 1) return null;
  const { page, total_pages, total } = pagination;

  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ‹ Trước
      </button>
      <span>
        Trang {page}/{total_pages} <span className="field-hint">({total} kết quả)</span>
      </span>
      <button className="btn btn-sm" disabled={page >= total_pages} onClick={() => onPageChange(page + 1)}>
        Sau ›
      </button>
    </div>
  );
}
