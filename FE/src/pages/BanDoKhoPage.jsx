import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { listVatTu } from '../api/vattuApi';
import { getKhoLayout, listViTriBanDo, getViTri, getTheoLo, listTongTheoLo } from '../api/khoApi';
import { ALL_LIMIT } from '../constants';
import { formatSoLuong } from '../format';
import Alert from '../components/Alert';
import SearchableSelect from '../components/SearchableSelect';
import KhoCellCard from '../kho/KhoCellCard';
import KhoActionModal from '../kho/KhoActionModal';
import '../kho/kho.css';

const UI0 = { hud: 'Toàn cảnh', mode: 'orbit', peel: 0, cut: 0, only: null, sel: null, pop: null };
// Ô tìm lô: danh sách = các lô ĐANG nằm trong kho (từ chính dữ liệu kho, không liên quan bảng Lo bên lựa).
// Nhãn: mã vật tư đứng trước, rồi số lô, rồi SL TRONG KHO (cộng Lo_ViTri của lô). Giá trị chọn = "vật tư|số lô".
const loKhoValue = (l) => `${l.ma_vat_tu}|${l.so_lo}`;
const loKhoLabel = (l) => `${l.ma_vat_tu} - ${l.so_lo} - ${formatSoLuong(Number(l.tong_so_luong || 0))}`;
const peelText = (n) => (n === 0 ? 'Hiện đủ' : `Ẩn ${n} ô ngoài`);
const cutText = (n) => (n === 0 ? 'Hiện đủ' : `Ẩn ${n} tầng trên`);

export default function BanDoKhoPage() {
  const { isStaff } = useAuth();
  const { filters, updateFilter } = useUrlFilters({ vt: '', lo: '' }); // lô đang tìm (vật tư + số lô): nằm trên URL (F5 / dán link vẫn giữ)

  const wrapRef = useRef(null);
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const engineRef = useRef(null);
  const [engine, setEngine] = useState(null);
  const [ui, setUi] = useState(UI0);

  // Bản đồ 3D mặc định ẨN: chỉ khi bấm "Mở bản đồ" mới tải engine three.js + hiện trạng ô và dựng lên.
  // Khi mở thì khớp bộ lọc phía trên (lô đang tìm được tô sáng; mã kệ đã gõ / ô đã bấm được mở sẵn).
  const [moBanDo, setMoBanDo] = useState(false);
  const pendingRef = useRef(null); // việc cần làm ngay khi engine dựng xong: { find: 'K31' } hoặc { cell: 'K53-O02-T1' }
  const [rackQ, setRackQ] = useState(''); // chữ trong ô "Tìm kệ"
  const [rackMsg, setRackMsg] = useState('');

  const layoutQ = useFetch(getKhoLayout, []); // nhỏ, cần sớm để gợi ý tên kệ dù bản đồ đang ẩn
  const occQ = useFetch(() => (moBanDo ? listViTriBanDo() : Promise.resolve(null)), [moBanDo]);
  const tongQ = useFetch(listTongTheoLo, []); // các lô đang nằm trong kho (nguồn của ô tìm lô + gợi ý số lô khi nhập)
  const loTrongKho = tongQ.data?.data;
  // Danh mục vật tư chỉ cần khi nhập lô vào ô -> chỉ staff mới tải
  const vatTuQ = useFetch(() => (isStaff ? listVatTu({ limit: ALL_LIMIT }) : Promise.resolve(null)), [isStaff]);

  // ----- Hành động: nhập / xuất / chuyển / sửa -----
  const [action, setAction] = useState(null);
  const [notice, setNotice] = useState('');
  const [popCtlOpen, setPopCtlOpen] = useState(false); // điện thoại: bảng điều khiển của cửa sổ nhóm mặc định gập
  const [showMore, setShowMore] = useState(false); // điện thoại: gập các tùy chọn hiển thị phụ cho gọn

  // Engine báo trạng thái -> state React. Giữ bản xử lý mới nhất trong ref để engine (tạo 1 lần) luôn gọi đúng.
  const onEngineState = useRef(null);
  useEffect(() => {
    onEngineState.current = (snap) => setUi(snap);
  });

  // Dựng engine khi bản đồ được mở và có layout; hủy khi ẩn bản đồ / rời trang. three.js nằm trong khoEngine nên chỉ tải lúc này.
  useEffect(() => {
    if (!moBanDo || !layoutQ.data || !hostRef.current) return undefined;
    let eng = null;
    let huy = false;
    import('../kho/khoEngine').then(({ createKhoEngine }) => {
      if (huy || !hostRef.current) return;
      try {
        eng = createKhoEngine({
          host: hostRef.current,
          wrap: wrapRef.current,
          tipEl: tipRef.current,
          layout: layoutQ.data,
          onState: (snap) => onEngineState.current?.(snap),
        });
      } catch (err) {
        console.error(err);
        return;
      }
      engineRef.current = eng;
      setEngine(eng);
      // Việc người dùng đã yêu cầu lúc bản đồ còn ẩn (gõ mã kệ rồi bấm Đi tới, hoặc bấm 1 ô của lô)
      const p = pendingRef.current;
      pendingRef.current = null;
      if (p?.find) {
        const r = eng.find(p.find);
        if (r.ok) { setRackQ(r.label); setRackMsg(''); } else setRackMsg('Không có kệ này');
      } else if (p?.cell) eng.selectByCode(p.cell);
    });
    return () => {
      huy = true;
      if (eng) {
        eng.destroy();
        engineRef.current = null;
        setEngine(null);
      }
    };
  }, [layoutQ.data, moBanDo]);

  // Đẩy hiện trạng ô (từ API) vào engine
  useEffect(() => {
    if (engine && occQ.data) engine.setOccupancy(occQ.data.data);
  }, [engine, occQ.data]);

  // Thẻ chi tiết ô đang chọn
  const selCode = ui.sel?.code || '';
  const detailQ = useFetch(() => (selCode ? getViTri(selCode) : Promise.resolve(null)), [selCode]);

  // Tìm lô: các ô lô đang nằm -> tô sáng trên bản đồ
  const finderQ = useFetch(() => (filters.vt && filters.lo ? getTheoLo(filters.vt, filters.lo) : Promise.resolve(null)), [filters.vt, filters.lo]);
  const finderRows = useMemo(() => {
    const d = finderQ.data;
    const khop = d && filters.vt && filters.lo && d.ma_vat_tu === filters.vt.trim() && d.so_lo.toLowerCase() === filters.lo.trim().toLowerCase();
    return khop ? d.data : null; // bỏ kết quả của lần tìm cũ (lô khác) còn sót lại
  }, [filters.vt, filters.lo, finderQ.data]);
  useEffect(() => {
    if (!engine) return;
    if (finderRows && finderRows.length) engine.highlight(finderRows.map((r) => r.ma_vi_tri), { fly: false });
    else engine.clearHighlight();
  }, [engine, finderRows]);

  // Danh sách ô cho ô chọn "Đến ô" khi chuyển lô (tính lại khi hiện trạng ô đổi)
  const cellOptions = useMemo(() => (engine && occQ.data ? engine.cellOptions() : []), [engine, occQ.data]);

  function openAction(type, lot) {
    setNotice('');
    setAction({
      type,
      ma_vi_tri: ui.sel.code,
      ma_vat_tu: lot?.ma_vat_tu,
      so_lo: lot?.so_lo,
      ten_vat_tu: lot?.ten_vat_tu,
      dang_co: lot ? (lot.so_luong === null ? null : Number(lot.so_luong)) : undefined,
    });
  }

  // giuMo: nhập nhanh bấm "nhập tiếp" -> form vẫn mở để nhập pallet kế, chỉ nạp lại dữ liệu phía sau
  function handleDone(res, giuMo = false) {
    const o = res.vi_tri[0];
    const conLai = o.da_xoa ? 'ô đã hết lô này' : o.so_luong === null ? 'chưa biết số lượng' : `trong ô còn ${formatSoLuong(o.so_luong)}`;
    // Chỉ dựng câu của đúng thao tác (khi nhập/xuất/sửa thì vi_tri[1] không tồn tại)
    let msg;
    if (res.thao_tac === 'nhap') msg = `Đã nhập lô vào ô ${o.ma_vi_tri} (${conLai}).`;
    else if (res.thao_tac === 'xuat') msg = `Đã xuất lô khỏi ô ${o.ma_vi_tri} (${conLai}).`;
    else if (res.thao_tac === 'chuyen') msg = `Đã chuyển lô từ ${o.ma_vi_tri} sang ${res.vi_tri[1].ma_vi_tri}.`;
    else msg = `Đã sửa số lượng ở ô ${o.ma_vi_tri} (${conLai}).`;
    setNotice(msg);
    if (!giuMo) setAction(null);
    occQ.reload({ silent: true });
    tongQ.reload({ silent: true });
    detailQ.reload({ silent: true });
    if (filters.vt && filters.lo) finderQ.reload({ silent: true });
  }

  // Mở bản đồ (kèm việc cần làm khi dựng xong). Đã mở sẵn thì không làm gì thêm.
  // Khớp bộ lọc theo thứ tự ưu tiên: có lô đang tìm ("Tìm mã trong kho") thì mở theo lô (tô sáng các ô của lô, KHÔNG nhảy
  // tới kệ đã gõ - kệ đó có thể chẳng chứa lô); không có lô mà có kệ thì mở kệ; không có gì thì toàn cảnh.
  function openMap(pending) {
    pendingRef.current = pending || (!loDangTim && rackQ.trim() ? { find: rackQ.trim() } : null);
    setMoBanDo(true);
  }
  function closeMap() {
    pendingRef.current = null;
    setMoBanDo(false);
    setUi(UI0);
  }
  // Đi tới 1 ô: bản đồ đang mở thì chọn luôn, đang ẩn thì mở lên rồi chọn
  function goCell(code) {
    if (engine) engine.selectByCode(code);
    else openMap({ cell: code });
  }
  function goRack() {
    const q = rackQ.trim();
    if (!q) return;
    if (!engine) { openMap({ find: q }); return; }
    const r = engine.find(q);
    if (!r.ok) { setRackMsg('Không có kệ này'); return; }
    setRackMsg('');
    setRackQ(r.label);
  }
  // Gợi ý MÃ KỆ (không gợi ý tên nhóm drive-in), lấy thẳng từ layout nên dùng được cả khi bản đồ đang ẩn
  const rackOptions = useMemo(() => (layoutQ.data?.ke || []).map((k) => k.ma_ke), [layoutQ.data]);

  // Các nút "ô lô đang nằm" - dùng ở 2 chỗ: thanh tìm lô phía trên và thanh tiêu đề cửa sổ nhóm
  // (để đang ở trong cửa sổ nhóm vẫn bấm nhảy sang ô kế tiếp được). Ô đang chọn tô đậm.
  const finderChips = (finderRows || []).map((r) => (
    <button
      key={r.ma_vi_tri}
      type="button"
      className={'kho-chip' + (ui.sel?.code === r.ma_vi_tri ? ' kho-chip-on' : '')}
      onClick={() => goCell(r.ma_vi_tri)}
    >
      {r.ma_vi_tri}
      <span className="kho-m"> · {r.so_luong === null ? '?' : formatSoLuong(r.so_luong)}</span>
    </button>
  ));

  // Lô đang tìm: mã vật tư + số lô nằm thẳng trên URL
  const loDangTim = filters.vt && filters.lo ? { ma_vat_tu: filters.vt, so_lo: filters.lo } : null;

  const pop = ui.pop;
  const loiTai = layoutQ.error || occQ.error;
  const khongWebGL = engine && !engine.hasWebGL;

  return (
    <div className="kho-page">
      <h1 className="page-title">Bản đồ kho</h1>

      <Alert>{loiTai}</Alert>
      <Alert type="success">{notice}</Alert>

      <div className="card kho-tools">
        <div className="kho-toolbar">
          {/* Nút MỞ bản đồ nằm ở thẻ "Bản đồ 3D đang ẩn" bên dưới; trên thanh công cụ chỉ có nút ẨN khi bản đồ đang mở (tránh 2 nút trùng nhau) */}
          {moBanDo && (
            <>
              <div className="field kho-tool">
                <label>Bản đồ 3D</label>
                <button type="button" className="btn btn-sm" onClick={closeMap}>Ẩn bản đồ</button>
              </div>
              <div className="field kho-tool">
                <label>Góc nhìn</label>
                <button type="button" className="btn btn-sm" onClick={() => engine?.overview()} disabled={!engine}>Toàn cảnh (từ trên)</button>
              </div>
            </>
          )}

          <FindRack q={rackQ} setQ={setRackQ} msg={rackMsg} setMsg={setRackMsg} options={rackOptions} onGo={goRack} />

          <div className="field kho-tool kho-tool-lot">
            <label>Tìm mã trong kho</label>
            <SearchableSelect
              options={loTrongKho || []}
              getValue={loKhoValue}
              getLabel={loKhoLabel}
              value={loDangTim ? loKhoValue({ ma_vat_tu: filters.vt, so_lo: filters.lo }) : ''}
              onChange={(v) => {
                const l = (loTrongKho || []).find((x) => loKhoValue(x) === v);
                updateFilter({ vt: l?.ma_vat_tu || '', lo: l?.so_lo || '' });
              }}
              placeholder="Gõ số lô / mã vật tư..."
              clearLabel="Bỏ tìm lô"
            />
          </div>

          {isStaff && (
            <div className="field kho-tool">
              <label>Nhập định vị</label>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setNotice(''); setAction({ type: 'nhap', ma_vi_tri: '' }); }}>
                + Nhập
              </button>
            </div>
          )}

          {moBanDo && (
          <>
          <button type="button" className="btn btn-sm kho-more-btn" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
            {showMore ? 'Ẩn tùy chọn hiển thị ▴' : 'Tùy chọn hiển thị ▾'}
          </button>
          <div className={'kho-more' + (showMore ? ' kho-more-open' : '')}>
            <div className="field kho-tool">
              <label htmlFor="kho-peel">Ẩn bớt ô ngoài (drive-in, kệ sàn)</label>
              <div className="kho-slider">
                <input id="kho-peel" type="range" min="0" max={Math.max(1, Math.min(9, engine?.stats.maxDepth ?? 1))} step="1" value={ui.peel} onChange={(e) => engine?.setPeel(+e.target.value)} />
                <output>{peelText(ui.peel)}</output>
              </div>
            </div>
            <div className="field kho-tool">
              <label htmlFor="kho-cut">Ẩn bớt tầng trên cùng</label>
              <div className="kho-slider">
                <input id="kho-cut" type="range" min="0" max={Math.max(1, (engine?.stats.maxTiers ?? 2) - 1)} step="1" value={ui.cut} onChange={(e) => engine?.setCut(+e.target.value)} />
                <output>{cutText(ui.cut)}</output>
              </div>
            </div>

          </div>
          </>
          )}
        </div>

        {loDangTim && (
          <div className="kho-finder">
            {finderQ.loading && !finderRows ? (
              <span className="field-hint">Đang tìm...</span>
            ) : finderRows && finderRows.length === 0 ? (
              <span className="field-hint">Lô này chưa được xếp vào ô nào.</span>
            ) : (
              <>
                <span className="field-hint"><b>{loDangTim?.ma_vat_tu}</b> - lô <b>{loDangTim?.so_lo}</b> đang nằm ở {finderRows?.length ?? 0} ô, bấm để đi tới:</span>
                {finderChips}
              </>
            )}
          </div>
        )}
      </div>

      {!moBanDo && (
        <div className="card kho-closed">
          <b>Bản đồ 3D đang ẩn</b>
          <p className="field-hint">
            Bấm "Mở bản đồ" khi cần xem. Bản đồ sẽ mở khớp với bộ lọc phía trên:{' '}
            {loDangTim ? (
              <>
                tô sáng các ô của <b>{loDangTim.ma_vat_tu}</b> - lô <b>{loDangTim.so_lo}</b>
                {rackQ.trim() && <> (đang ưu tiên lọc theo mã trong kho, bỏ qua kệ <b>{rackQ.trim()}</b>)</>}.
              </>
            ) : rackQ.trim() ? (
              <>
                mở kệ <b>{rackQ.trim()}</b>.
              </>
            ) : (
              'chưa lọc gì nên hiện toàn cảnh kho.'
            )}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => openMap()}>Mở bản đồ</button>
        </div>
      )}

      {moBanDo && (
      <div className="card kho-stage">
        <div className="kho-slot">
          <div ref={wrapRef} className={'kho-wrap' + (pop ? ' popmode' : '') + (pop && finderChips.length > 0 ? ' has-finder' : '')} tabIndex={0} aria-label="Bản đồ kho 3D. Bấm vào sàn lối đi để đi vào đó, bấm vào ô để chọn ô.">
            <div ref={hostRef} className="kho-host" />
            <div ref={tipRef} className="kho-tip" hidden />
            {!pop && <div className="kho-hud">{ui.hud}</div>}
            {(layoutQ.loading || (engine && occQ.loading)) && <div className="kho-loading">Đang tải bản đồ...</div>}
            {khongWebGL && <div className="kho-nogl">Trình duyệt này không bật được WebGL nên chưa vẽ được kho 3D.</div>}

            {pop && (
              <>
                <div className="kho-pophead">
                  <div className="kho-popleft">
                    {finderChips.length > 0 ? (
                      <div className="kho-popfinder">
                        <span className="field-hint"><b>{loDangTim?.ma_vat_tu}</b> - lô <b>{loDangTim?.so_lo}</b> đang ở {finderChips.length} ô, bấm để đi tới:</span>
                        <div className="kho-popchips">{finderChips}</div>
                      </div>
                    ) : (
                      <div className="kho-poptitle"><b>{pop.name}</b>{pop.sub && <span>{pop.sub}</span>}</div>
                    )}
                  </div>
                  <div className="btn-group">
                    <button type="button" className="btn btn-sm kho-popctl-btn" aria-expanded={popCtlOpen} onClick={() => setPopCtlOpen((v) => !v)}>
                      {popCtlOpen ? 'Ẩn tùy chọn' : 'Tùy chọn'}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => engine.closePop()}>Đóng</button>
                  </div>
                </div>
                <div className={'kho-popctl' + (popCtlOpen ? ' kho-popctl-open' : '')}>
                  <div className="kho-pcg">
                    <span className="kho-glabel">Góc nhìn</span>
                    <div className="kho-pcrow">
                      {[['top', 'Từ trên'], ['front', 'Từ lối vào'], ['side', 'Từ bên'], ['obl', 'Nghiêng']].map(([k, t]) => (
                        <button key={k} type="button" className="btn btn-sm" onClick={() => engine.setPopView(k)}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className="kho-pcg">
                    <span className="kho-glabel">Chỉ xem tầng</span>
                    <div className="kho-pcrow">
                      {Array.from({ length: pop.maxTiers + 1 }, (_, n) => n).map((n) => (
                        <button key={n} type="button" className={'btn btn-sm' + ((ui.only ?? 0) === n ? ' kho-on' : '')} onClick={() => engine.setOnly(n)}>
                          {n === 0 ? 'Tất cả' : `Tầng ${n}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="kho-pcg">
                    <label className="kho-glabel" htmlFor="kho-pcut">Ẩn bớt tầng trên cùng</label>
                    <div className="kho-slider">
                      <input id="kho-pcut" type="range" min="0" max={Math.max(1, pop.maxTiers - 1)} step="1" value={ui.cut} onChange={(e) => engine.setCut(+e.target.value)} />
                      <output>{cutText(ui.cut)}</output>
                    </div>
                  </div>
                  {pop.kind !== 'sel' && (
                    <div className="kho-pcg">
                      <label className="kho-glabel" htmlFor="kho-ppeel">Ẩn bớt ô ngoài</label>
                      <div className="kho-slider">
                        <input id="kho-ppeel" type="range" min="0" max={Math.max(1, pop.depthN - 1)} step="1" value={ui.peel} onChange={(e) => engine.setPeel(+e.target.value)} />
                        <output>{peelText(ui.peel)}</output>
                      </div>
                    </div>
                  )}
                  <p className="field-hint">Kéo để xoay, cuộn hoặc chụm để phóng, giữ Shift kéo để dời. Bấm vào ô để xem lô.</p>
                </div>
              </>
            )}

            {ui.sel && (
              <KhoCellCard
                sel={ui.sel}
                detail={detailQ}
                isStaff={isStaff}
                inPop={!!pop}
                onClose={() => engine.clearSelection()}
                onAction={openAction}
                onZoom={() => engine.zoomToSelected()}
                onOpenPop={() => engine.openPopForSelected()}
                onTop={() => engine.topForSelected()}
              />
            )}
          </div>
        </div>
        <div className="kho-foot">
          <p className="field-hint"><b>Toàn cảnh:</b> kéo để xoay, cuộn hoặc chụm hai ngón để phóng, giữ <kbd>Shift</kbd> (hoặc chuột phải, hai ngón) rồi kéo để dời. Bấm vào sàn lối đi để bay xuống và tự đi tới đó. Gõ mã kệ (vd K31, S1) vào ô "Tìm kệ". Ô có hàng hiện khối màu theo vật tư.</p>
          <p className="field-hint"><b>Đang đi trong kho:</b> kéo để nhìn quanh, bấm sàn để đi tiếp, hoặc dùng <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (giữ <kbd>Shift</kbd> để đi nhanh), bay lên cao bằng <kbd>E</kbd> / <kbd>Q</kbd>. <kbd>Esc</kbd> bỏ chọn ô / đóng cửa sổ nhóm.</p>
        </div>
      </div>
      )}

      {action && (
        <KhoActionModal
          key={action.type + action.ma_vi_tri + (action.ma_vat_tu || '') + (action.so_lo || '')}
          action={action}
          vatTuList={vatTuQ.data?.data}
          loTrongKho={loTrongKho}
          cellOptions={cellOptions}
          onClose={() => setAction(null)}
          onDone={handleDone}
        />
      )}
    </div>
  );
}

// Ô gõ mã kệ -> mở cửa sổ riêng của kệ đó (bản đồ đang ẩn thì tự mở lên rồi đi tới).
// Chữ gõ (q) và thông báo (msg) do trang giữ, để nút "Mở bản đồ" cũng biết kệ đã gõ.
function FindRack({ q, setQ, msg, setMsg, options, onGo }) {
  return (
    <div className="field kho-tool">
      <label htmlFor="kho-find">Tìm kệ</label>
      <div className="kho-find">
        <span className="kho-find-wrap">
          <input
            id="kho-find"
            list="kho-kelist"
            value={q}
            onChange={(e) => { setQ(e.target.value); setMsg(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onGo(); } }}
            placeholder="VD: K31, S1"
            autoComplete="off"
            maxLength={16}
          />
          {q && (
            <button type="button" className="kho-find-clear" aria-label="Xóa tên kệ đã nhập" onClick={() => { setQ(''); setMsg(''); document.getElementById('kho-find')?.focus(); }}>
              ×
            </button>
          )}
        </span>
        <datalist id="kho-kelist">
          {options.map((v) => <option key={v} value={v} />)}
        </datalist>
        <button type="button" className="btn btn-sm" onClick={onGo} disabled={!q.trim()}>Đi tới</button>
        {msg && <span className="kho-warn">{msg}</span>}
      </div>
    </div>
  );
}
