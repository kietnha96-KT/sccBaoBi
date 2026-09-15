import { useSearchParams } from 'react-router-dom';

// Đồng bộ bộ lọc (filters) + số trang (page) + sắp xếp (sort) với querystring trên URL - URL là
// NGUỒN SỰ THẬT DUY NHẤT, không có useState riêng cho filters/page/sort ở trang gọi hook này. Nhờ vậy:
//  - F5 không mất bộ lọc/trang/sắp xếp đang xem (đọc lại từ URL).
//  - Dán link cho người khác mở đúng bộ lọc đó.
//  - Không có chuyện "state và URL lệch nhau" - chỉ có 1 nơi lưu.
//
// defaults: object khai tên field lọc + giá trị mặc định (thường là ''), vd:
//   useUrlFilters({ ma_vat_tu: '', lo_id: '', thu_kho: '' })
//
// opts (tùy chọn) - dùng khi 1 trang có NHIỀU bảng dùng chung bộ lọc nhưng phân trang/sắp xếp
// riêng (vd DashboardVatTuPage: bảng chính + bảng breakdown lỗi): gọi hook này 1 lần cho bộ lọc +
// bảng chính (dùng key mặc định), rồi gọi thêm 1 lần nữa cho bảng phụ với defaults={} và đổi tên
// key để không đụng key của bảng chính:
//   useUrlFilters({}, { pageKey: 'loi_page', sortByKey: 'loi_sort_by', sortDirKey: 'loi_sort_dir' })
//
// Trả về:
//   filters      : object đọc từ URL (thiếu field nào lấy giá trị mặc định)
//   page         : số trang hiện tại (mặc định 1)
//   sortBy       : cột đang sắp xếp ('' = chưa bấm gì, dùng ORDER BY mặc định của BE)
//   sortDir      : 'asc' | 'desc'
//   updateFilter : gộp patch vào filters hiện tại, ghi lên URL, TỰ reset về trang 1
//                  (patch2 tùy chọn: { alsoResetPageKeys: [...] } để reset thêm trang của bảng
//                  phụ khác trong CÙNG 1 lần ghi URL - tránh gọi setSearchParams 2 lần liền nhau
//                  làm mất tác dụng lẫn nhau)
//   setPage      : đổi trang, không đụng tới filters/sort
//   toggleSort   : bấm vào tiêu đề cột - chu kỳ 3 bước: chưa sort -> asc -> desc -> chưa sort
//                  (nhả sort, về lại thứ tự mặc định của BE); cột khác thì luôn bắt đầu từ asc.
//                  Mỗi lần bấm đều về trang 1.
//   resetAll     : xóa filters/page/sort của CHÍNH hook này (về lại mặc định)
//
// Dùng { replace: true } khi ghi URL - đổi lọc không tạo thêm 1 mục lịch sử trình duyệt
// (nếu không, bấm nút Back sẽ phải bấm lại nhiều lần mới lùi ra khỏi trang, vì mỗi lần gõ
// vào ô lọc lại thành 1 bước lịch sử riêng).
export function useUrlFilters(defaults, opts = {}) {
  const pageKey = opts.pageKey || 'page';
  const sortByKey = opts.sortByKey || 'sort_by';
  const sortDirKey = opts.sortDirKey || 'sort_dir';
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {};
  for (const key of Object.keys(defaults)) {
    const v = searchParams.get(key);
    filters[key] = v === null ? defaults[key] : v;
  }
  const page = Number(searchParams.get(pageKey)) || 1;
  const sortBy = searchParams.get(sortByKey) || '';
  const sortDir = searchParams.get(sortDirKey) === 'desc' ? 'desc' : 'asc';

  // Ghi 1 lô thay đổi lên URL trong ĐÚNG 1 lần gọi setSearchParams (nếu trang cần đổi nhiều
  // nhóm key cùng lúc, ví dụ đổi lọc + reset trang bảng phụ, phải gộp vào đây - gọi
  // setSearchParams nhiều lần liên tiếp trong cùng 1 handler sẽ ghi đè lẫn nhau vì mỗi lần đều
  // build "next" từ "searchParams" cũ, chưa thấy thay đổi của lần gọi trước).
  function applyPatch(patch, extraDeleteKeys = []) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value !== '' && value !== null && value !== undefined) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    for (const key of extraDeleteKeys) next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function updateFilter(patch, patch2 = {}) {
    applyPatch(patch, [pageKey, ...(patch2.alsoResetPageKeys || [])]);
  }

  function setPage(p) {
    applyPatch({ [pageKey]: p > 1 ? p : '' });
  }

  function toggleSort(key) {
    if (sortBy !== key) {
      applyPatch({ [sortByKey]: key, [sortDirKey]: 'asc' }, [pageKey]);
    } else if (sortDir === 'asc') {
      applyPatch({ [sortByKey]: key, [sortDirKey]: 'desc' }, [pageKey]);
    } else {
      // đang desc, bấm lần 3 -> nhả sort, về thứ tự mặc định
      applyPatch({ [sortByKey]: '', [sortDirKey]: '' }, [pageKey]);
    }
  }

  function resetAll() {
    const next = new URLSearchParams(searchParams);
    for (const key of Object.keys(defaults)) next.delete(key);
    next.delete(pageKey);
    next.delete(sortByKey);
    next.delete(sortDirKey);
    setSearchParams(next, { replace: true });
  }

  return { filters, page, sortBy, sortDir, updateFilter, setPage, toggleSort, resetAll };
}
