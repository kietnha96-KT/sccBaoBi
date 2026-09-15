// Tiêu đề cột bấm được để sắp xếp bảng. sortKey phải khớp với key BE nhận (whitelist ở BE).
export default function SortableTh({ label, sortKey, sortBy, sortDir, onSort, ...thProps }) {
  const active = sortBy === sortKey;
  return (
    <th
      className={`sortable-th${active ? ' sortable-th-active' : ''}`}
      onClick={() => onSort(sortKey)}
      {...thProps}
    >
      {label}
      <span className="sort-indicator">{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
    </th>
  );
}
