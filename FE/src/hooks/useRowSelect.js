import { useState } from 'react';

// Chọn 1 dòng bảng bằng cách bấm vào dòng đó -> tô nền nhẹ để người dùng biết đang xem dòng nào
// (nhất là khi bảng bị cuộn ngang). Bấm lại chính dòng đang chọn thì bỏ chọn.
// Hiện chưa gắn hành động gì thêm - chỉ là chỉ dấu thị giác.
export function useRowSelect() {
  const [selectedRowId, setSelectedRowId] = useState(null);

  function getRowProps(id) {
    return {
      className: selectedRowId === id ? 'row-selected' : undefined,
      onClick: (e) => {
        // Bỏ qua khi bấm vào nút / link / ô nhập trong dòng (Sửa, Xóa, dropdown gán nhãn...)
        if (e.target.closest('button, a, select, input, textarea, label')) return;
        setSelectedRowId((cur) => (cur === id ? null : id));
      },
    };
  }

  return { selectedRowId, setSelectedRowId, getRowProps };
}