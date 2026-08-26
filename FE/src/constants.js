// Kích thước trang mặc định cho các danh sách có phân trang (hợp lý cho UX di động)
export const PAGE_SIZE = 15;

// Limit "cao" dùng khi cần lấy gần như toàn bộ danh sách để đổ vào dropdown/select/filter
// (khác với màn hình danh sách chính vốn cần phân trang thật sự).
// Khớp với maxLimit mặc định phía backend (BE/utils/pagination.js) để tránh bị cắt bớt.
export const ALL_LIMIT = 3000;
