// Chuẩn hóa tham số phân trang dùng chung cho các API danh sách.
// Mặc định 15/trang (hợp lý cho UX di động), cho phép limit cao hơn khi cần lấy full
// danh sách (vd: đổ vào dropdown/select) nhưng vẫn có trần để tránh query quá nặng.
function getPagination(query, { defaultLimit = 15, maxLimit = 3000 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildPaginationMeta({ page, limit, total }) {
  return { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) };
}

// Phan trang tren mang da co san trong bo nho (dung cho ket qua GROUP BY cua dashboard,
// nhung query nay da phai gom nhom/join phuc tap nen phan trang bang SQL LIMIT/OFFSET
// rieng cho tung truong hop se rat cong kenh - cat mang sau khi query xong don gian hon nhieu).
function paginateArray(rows, query, opts) {
  const { page, limit } = getPagination(query, opts);
  const total = rows.length;
  const start = (page - 1) * limit;
  return { data: rows.slice(start, start + limit), pagination: buildPaginationMeta({ page, limit, total }) };
}

module.exports = { getPagination, buildPaginationMeta, paginateArray };
