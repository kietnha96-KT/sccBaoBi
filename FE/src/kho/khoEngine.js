// Engine bản đồ kho 3D - chuyển từ bản demo ban-do-kho-3d.html (three r128 + DOM) sang module độc lập.
// Engine KHÔNG đụng DOM giao diện: nhận canvas + khung (wrap) + layout, trả về 1 object điều khiển;
// mọi thay đổi trạng thái (ô đang chọn, chế độ xem, cửa sổ nhóm, thanh trượt...) báo ra ngoài qua onState(snapshot)
// để React vẽ thanh công cụ / thẻ thông tin. Bấm ô, kéo, cuộn, chụm, WASD... xử lý ở đây.
//
// Quy ước toạ độ (khớp doc/kho/PROMPT.md): x,z = tâm kệ (mét). U = hướng tăng của `o`, V = hướng tăng của
// `chieu_sau`, tùy `xoay`. Tâm ô (o, s) = tâm kệ + a*U + b*V với
//   a = (o-0.5)*o_dai - so_o*o_dai/2 ; b = (s-0.5)*ke_rong - chieu_sau*ke_rong/2
import * as THREE from 'three';

// Giữ nguyên cách tô màu/ánh sáng như bản demo (three r128): tắt quản lý màu mới, xuất màu tuyến tính,
// và nhân cường độ đèn với PI để bù việc three mới dùng đèn "vật lý".
THREE.ColorManagement.enabled = false;

const LEVEL = 1.5; // cao mỗi tầng (m)
const EYE = 1.7; // độ cao mắt khi đi bộ
const DIRS = { 0: [[1, 0], [0, -1]], 90: [[0, -1], [-1, 0]], 180: [[-1, 0], [0, 1]], 270: [[0, 1], [1, 0]] };
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapAngle = (a) => (((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const num = (v, a, b, d) => {
  v = Number(v);
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d;
};

// Màu nền, sàn, nét... (bản sáng - app không có giao diện tối)
const THEME = {
  bg: '#e6ebf1', floor: '#d3dae3', aisle: '#c3ccd8', edge: '#6f7e94', sel: '#1d2fd1', selBlock: '#1f3cff', selEmpty: '#2f6bff', ghost: '#3a4bbd', fg: '#16202c',
};

// Khối hàng: MỌI khối cùng chiều cao, cùng màu (vàng) - chưa có dữ liệu thể tích / diện tích vật tư nên không thể hiện gì thêm.
// Chỉ ô đang chọn đổi màu (xanh dương đậm, xem selBlock/selEmpty) -> vàng và xanh dương đối nhau nên dễ phân biệt nhất,
// cũng an toàn với người khó phân biệt đỏ-xanh lá.
const LOAD_H = 1.0; // cao khối hàng (m)
const LOAD_COLOR = '#d9ad74'; // màu bìa carton

// Chuẩn hóa layout JSON (chặn số liệu hỏng) - cùng logic bản demo
function normalize(raw) {
  if (!raw || !Array.isArray(raw.ke) || !raw.ke.length) return null;
  const ke = [];
  raw.ke.forEach((k) => {
    if (!k || typeof k.ma_ke !== 'string' || !Number.isFinite(Number(k.x)) || !Number.isFinite(Number(k.z))) return;
    const san = k.loai_ke === 'san';
    const xo = (((Math.round(num(k.xoay, -720, 720, 0) / 90) * 90) % 360) + 360) % 360;
    ke.push({
      ma_ke: k.ma_ke.slice(0, 12), loai_ke: san ? 'san' : 'selective', khu: typeof k.khu === 'string' ? k.khu : '',
      nhom: !san && typeof k.nhom === 'string' ? k.nhom.trim() : '',
      so_o: Math.round(num(k.so_o, 1, 60, 1)), chieu_sau: san ? Math.round(num(k.chieu_sau, 1, 20, 1)) : 1,
      so_tang: Math.round(num(k.so_tang, 1, 10, 1)), x: Number(k.x), z: Number(k.z), xoay: xo,
    });
  });
  return ke.length ? { o_dai_m: num(raw.o_dai_m, 0.5, 3, 1.3), ke_rong_m: num(raw.ke_rong_m, 0.5, 3, 1.2), ke } : null;
}

// Dựng kệ, nhóm (khối drive-in), ô từ layout. Hàng trong ô lấy sau từ API (setOccupancy), không sinh giả ở đây.
function build(L) {
  const CW = L.o_dai_m;
  const KW = L.ke_rong_m;
  const racks = L.ke.map((k, i) => {
    const len = k.so_o * CW;
    const dep = k.chieu_sau * KW;
    const hor = k.xoay % 180 === 0;
    const d = DIRS[k.xoay];
    const hw = (hor ? len : dep) / 2;
    const hd = (hor ? dep : len) / 2;
    return {
      id: i, code: k.ma_ke, loai: k.loai_ke, khu: k.khu, nhom: k.nhom, so_o: k.so_o, cs: k.chieu_sau, tiers: k.so_tang,
      cx: k.x, cz: k.z, xoay: k.xoay, hor, U: d[0], V: d[1], len, dep, H: k.so_tang * LEVEL + 0.2,
      rect: [k.x - hw, k.z - hd, k.x + hw, k.z + hd],
    };
  });
  const units = [];
  const byKey = {};
  racks.forEach((r) => {
    const key = r.nhom ? 'g:' + r.nhom : 'k:' + r.code;
    if (!byKey[key]) {
      byKey[key] = { id: units.length, nhom: r.nhom, ks: [], kind: r.nhom ? 'group' : r.loai === 'san' ? 'san' : 'sel' };
      units.push(byKey[key]);
    }
    byKey[key].ks.push(r);
    r.unit = byKey[key].id;
  });
  units.forEach((u) => {
    u.rect = [1e9, 1e9, -1e9, -1e9];
    u.ks.forEach((r) => {
      u.rect[0] = Math.min(u.rect[0], r.rect[0]); u.rect[1] = Math.min(u.rect[1], r.rect[1]);
      u.rect[2] = Math.max(u.rect[2], r.rect[2]); u.rect[3] = Math.max(u.rect[3], r.rect[3]);
    });
    u.n = u.ks.length;
    u.maxTiers = Math.max(...u.ks.map((r) => r.tiers));
    u.depthN = u.kind === 'sel' ? 1 : Math.max(...u.ks.map((r) => (u.kind === 'group' ? r.so_o : r.cs)));
    u.name = u.kind === 'group' ? u.nhom : u.ks[0].code; // 1 kệ đơn: chỉ hiện mã kệ (K54, S1...)
    const hor = u.ks[0].hor;
    [...u.ks].sort((a, b) => (hor ? a.cz - b.cz : a.cx - b.cx)).forEach((r, j) => { r.lane = j + 1; });
  });
  const cells = [];
  racks.forEach((r) => {
    for (let t = 1; t <= r.tiers; t++) {
      for (let o = 1; o <= r.so_o; o++) {
        for (let s = 1; s <= r.cs; s++) {
          const a = (o - 0.5) * CW - r.len / 2;
          const b = (s - 0.5) * KW - r.dep / 2;
          const code = r.code + '-O' + pad2(o) + '-T' + t + (r.cs > 1 ? '-S' + s : ''); // độ sâu (kệ sàn) đứng cuối: S1-O10-T2-S4
          cells.push({
            i: cells.length, rack: r.id, o, s, t, code,
            x: r.cx + a * r.U[0] + b * r.V[0], y: (t - 1) * LEVEL + 0.9, z: r.cz + a * r.U[1] + b * r.V[1],
            filled: false, info: null, h: 1,
          });
        }
      }
    }
  });
  return { racks, units, cells, CW, KW };
}

// host: div rỗng để engine gắn <canvas> vào (mỗi lần dựng 1 canvas mới -> an toàn với React StrictMode);
// wrap: khung nhận phím/focus và đo kích thước (có thể chính là host hoặc cha của nó).
export function createKhoEngine({ host, wrap, tipEl, layout: rawLayout, onState }) {
  const L = normalize(rawLayout);
  if (!L) throw new Error('Layout kho không hợp lệ');
  const canvas = document.createElement('canvas');
  canvas.className = 'kho-canvas';
  host.appendChild(canvas);
  const D = build(L);
  const { racks: RACKS, units: UNITS, cells, CW, KW } = D;
  const cellByCode = new Map(cells.map((c) => [c.code, c]));
  const rackOf = (c) => RACKS[c.rack];
  const unitOf = (c) => UNITS[RACKS[c.rack].unit];
  const MAXT = Math.max(...RACKS.map((r) => r.tiers));
  const MAXD = Math.max(...UNITS.map((u) => u.depthN)) - 1;
  const B = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
  RACKS.forEach((r) => {
    B.x0 = Math.min(B.x0, r.rect[0]); B.z0 = Math.min(B.z0, r.rect[1]); B.x1 = Math.max(B.x1, r.rect[2]); B.z1 = Math.max(B.z1, r.rect[3]);
  });
  const H = MAXT * LEVEL + 0.2;
  const state = { peel: 0, cut: 0, only: null, pop: null, sel: -1, iso: null };
  const cleanups = [];
  let destroyed = false;

  // ---------- Renderer / cảnh ----------
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(new THREE.Color(THEME.bg));
  } catch {
    renderer = null;
  }
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(48, 1, 0.12, 500);
  cam.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b929c, 0.95 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55 * Math.PI);
  sun.position.set((B.x0 + B.x1) / 2 - 14, 40, (B.z0 + B.z1) / 2 - 10);
  scene.add(sun);

  const floorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(THEME.floor) });
  const aisleMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(THEME.aisle) });
  const floorObjs = [];
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0 + 16, B.z1 - B.z0 + 16), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
  scene.add(floor);
  floorObjs.push(floor);
  UNITS.filter((u) => u.kind !== 'sel').forEach((u) => {
    const r = u.rect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r[2] - r[0] + 0.7, r[3] - r[1] + 0.7), aisleMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((r[0] + r[2]) / 2, 0.02, (r[1] + r[3]) / 2);
    scene.add(m);
    floorObjs.push(m);
  });

  const unitGeo = new THREE.BoxGeometry(1, 1, 1);
  const _q = new THREE.Quaternion();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const mat4 = (x, y, z, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
  const world = (r, a, b) => [r.cx + a * r.U[0] + b * r.V[0], r.cz + a * r.U[1] + b * r.V[1]];
  function makeInst(n, color) {
    const m = new THREE.InstancedMesh(unitGeo, new THREE.MeshLambertMaterial({ color }), Math.max(1, n));
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }

  // cột (xanh), thanh ngang (cam); kệ sàn dùng tấm sàn riêng
  const blue = [];
  const orange = [];
  const decks = [];
  const deckM = new THREE.MeshLambertMaterial({ color: 0x8d98a6 });
  const lip = new THREE.MeshLambertMaterial({ color: 0xf0501c });
  const extraGeos = [];
  RACKS.forEach((r) => {
    const edges = [-r.dep / 2 + 0.05, r.dep / 2 - 0.05];
    // Cột đứng: kệ sàn và kệ selective RIÊNG (không thuộc nhóm drive-in) cứ 2 ô mới có 1 cột (luôn có cột ở 2 đầu kệ);
    // kệ trong nhóm drive-in giữ cột ở mọi ranh giới ô
    const step = r.loai === 'san' || !r.nhom ? 2 : 1;
    // Cột chỉ cao tới mặt sàn của tầng trên cùng (không nhô lên trên tầng đó cho đỡ rối)
    // Kệ có tấm sàn tầng trên cùng (drive-in, kệ sàn): cột cắt bằng mặt sàn. Kệ selective riêng: cột tới thanh đỡ cam tầng trên cùng.
    const postH = r.tiers > 1 ? (r.tiers - 1) * LEVEL + (r.nhom || r.loai === 'san' ? 0.18 : 0.3) : r.H;
    for (let i = 0; i <= r.so_o; i += i < r.so_o && i + step > r.so_o ? r.so_o - i : step) {
      edges.forEach((b) => {
        const p = world(r, i * CW - r.len / 2, b);
        blue.push({ rack: r.id, m: mat4(p[0], postH / 2, p[1], 0.1, postH, 0.1) });
      });
    }
    if (r.loai === 'san') {
      for (let t = 1; t <= r.tiers; t++) {
        const g = new THREE.Group();
        const y = (t - 1) * LEVEL + 0.15;
        const sx = r.hor ? r.len : r.dep;
        const sz = r.hor ? r.dep : r.len;
        const slabGeo = new THREE.BoxGeometry(sx, 0.06, sz);
        const slab = new THREE.Mesh(slabGeo, deckM);
        slab.position.set(r.cx, y, r.cz);
        g.add(slab);
        const p = world(r, 0, -r.dep / 2 + 0.03);
        const lipGeo = new THREE.BoxGeometry(r.hor ? r.len : 0.07, 0.12, r.hor ? 0.07 : r.len);
        const ls = new THREE.Mesh(lipGeo, lip);
        ls.position.set(p[0], y, p[1]);
        g.add(ls);
        extraGeos.push(slabGeo, lipGeo);
        scene.add(g);
        decks.push({ g, t, rack: r.id });
      }
    } else {
      for (let t = 1; t <= r.tiers; t++) {
        if (t === r.tiers && r.tiers > 1 && r.nhom) continue; // tầng trên cùng của kệ trong nhóm drive-in: tấm sàn kim loại thay cho thanh đỡ (dựng ở dưới)
        edges.forEach((b) => {
          const p = world(r, 0, b);
          orange.push({ rack: r.id, m: mat4(p[0], (t - 1) * LEVEL + 0.15, p[1], r.hor ? r.len : 0.07, 0.1, r.hor ? 0.07 : r.len) });
        });
      }
    }
  });
  // Tầng trên cùng của kệ trong nhóm DRIVE-IN: TẤM SÀN KIM LOẠI, các ô nằm trên mặt tấm (kệ selective riêng vẫn dùng thanh đỡ cam).
  // Mỗi kệ một tấm, nới thêm 3cm mỗi phía để các làn đứng sát nhau (kể cả khe 3cm) dính liền thành 1 mặt sàn,
  // không lộ đường nối. Kệ sàn đã có tấm sàn riêng ở mọi tầng. Hiện/ẩn theo tầng cùng cơ chế với tấm sàn của kệ sàn.
  const SLAB_GROW = 0.06;
  RACKS.forEach((r) => {
    if (!r.nhom || r.tiers < 2) return;
    const geo = new THREE.BoxGeometry((r.hor ? r.len : r.dep) + SLAB_GROW, 0.06, (r.hor ? r.dep : r.len) + SLAB_GROW);
    const slab = new THREE.Mesh(geo, deckM);
    slab.position.set(r.cx, (r.tiers - 1) * LEVEL + 0.15, r.cz);
    const g = new THREE.Group();
    g.add(slab);
    extraGeos.push(geo);
    scene.add(g);
    decks.push({ g, t: r.tiers, rack: r.id });
  });
  const blueMesh = makeInst(blue.length, 0x2d5da8);
  const orangeMesh = makeInst(orange.length, 0xf0501c);

  // pallet và hàng: 1 instance cho MỖI ô (ô trống thu về scale 0), cập nhật khi có dữ liệu hiện trạng
  const palMesh = makeInst(cells.length, 0x7a5834);
  const loadMesh = new THREE.InstancedMesh(unitGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, cells.length));
  loadMesh.frustumCulled = false;
  scene.add(loadMesh);
  const cu = CW - 0.2;
  const cv = KW - 0.2;
  const palMat = cells.map((c) => {
    const r = rackOf(c);
    const base = (c.t - 1) * LEVEL + 0.2;
    return mat4(c.x, base + 0.07, c.z, r.hor ? cu : cv, 0.14, r.hor ? cv : cu);
  });
  const loadMat = []; // phụ thuộc chiều cao hàng c.h -> tính trong setOccupancy

  // ô vô hình để bấm chọn (kể cả ô trống)
  const slotMesh = new THREE.InstancedMesh(unitGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), cells.length);
  slotMesh.frustumCulled = false;
  slotMesh.visible = false;
  scene.add(slotMesh);
  const slotMat = cells.map((c) => {
    const r = rackOf(c);
    return r.hor ? mat4(c.x, c.y, c.z, CW, 1.4, KW - 0.05) : mat4(c.x, c.y, c.z, KW - 0.05, 1.4, CW);
  });
  const half = (c) => (rackOf(c).hor ? [CW / 2, 0.75, (KW - 0.05) / 2] : [(KW - 0.05) / 2, 0.75, CW / 2]);

  const CORN = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
  const EDGE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
  function pushBox(arr, c, hx, hy, hz) {
    for (let e = 0; e < 12; e++) {
      const a = CORN[EDGE[e][0]];
      const b = CORN[EDGE[e][1]];
      arr.push(c.x + a[0] * hx, c.y + a[1] * hy, c.z + a[2] * hz, c.x + b[0] * hx, c.y + b[1] * hy, c.z + b[2] * hz);
    }
  }
  let dirty = true;
  function makeLines(mat) {
    const l = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
    l.frustumCulled = false;
    scene.add(l);
    return l;
  }
  function setLines(obj, arr) {
    obj.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    obj.geometry = g;
    dirty = true;
  }
  const baseMat = new THREE.LineBasicMaterial({ color: new THREE.Color(THEME.edge), transparent: true, opacity: 0.16 });
  const ghostMat = new THREE.LineBasicMaterial({ color: new THREE.Color(THEME.ghost), transparent: true, opacity: 0.8 });
  const selMat = new THREE.LineBasicMaterial({ color: new THREE.Color(THEME.sel), depthTest: false });
  const baseLines = makeLines(baseMat);
  const ghostLines = makeLines(ghostMat);
  // Ô đang chọn: KHÔNG vẽ khung viền cả ô. Ô có hàng -> phủ xanh lên chính khối hàng; ô trống -> chỉ tô xanh mặt đáy của ô.
  const selBlockMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(THEME.selBlock), transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
  const selBlock = new THREE.Mesh(unitGeo, selBlockMat); // khối hàng (kích thước theo loadMat)
  selBlock.matrixAutoUpdate = false;
  selBlock.visible = false;
  selBlock.renderOrder = 10;
  scene.add(selBlock);
  const selEmptyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(THEME.selEmpty), transparent: true, opacity: 0.8, depthTest: false, depthWrite: false });
  const selEmpty = new THREE.Mesh(unitGeo, selEmptyMat); // ô trống: tô mặt đáy
  selEmpty.matrixAutoUpdate = false;
  selEmpty.visible = false;
  selEmpty.renderOrder = 10;
  scene.add(selEmpty);
  const GROW = new THREE.Matrix4().makeScale(1.05, 1.03, 1.05);
  const rackHi = makeLines(selMat);
  rackHi.renderOrder = 10;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.5, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(THEME.sel), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.visible = false;
  ring.renderOrder = 9;
  scene.add(ring);

  // ---------- Chữ trên sàn và nhãn nổi ----------
  const sprites = [];
  function labelTexture(text, w, h, size) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = THEME.fg;
    g.globalAlpha = 0.6;
    g.font = '700 ' + size + 'px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
    return new THREE.CanvasTexture(c);
  }
  // Nhãn số kệ: viên thuốc trắng nhỏ LƠ LỬNG phía trên đầu kệ, kích thước CỐ ĐỊNH trên màn hình (zoom xa gần vẫn đọc được, không phình to che kệ).
  // Hiện theo ngữ cảnh để không rối (xem refreshLabels): toàn cảnh hiện nhãn mọi kệ,
  // đi tới 1 kệ / 1 nhóm thì hiện đúng kệ trong cửa sổ đó, đi bộ thì hiện kệ ở gần.
  function pillTexture(text) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 56;
    const g = c.getContext('2d');
    const x0 = 3; const y0 = 3; const w = 122; const h = 50; const rad = 25;
    g.beginPath();
    g.moveTo(x0 + rad, y0);
    g.arcTo(x0 + w, y0, x0 + w, y0 + h, rad);
    g.arcTo(x0 + w, y0 + h, x0, y0 + h, rad);
    g.arcTo(x0, y0 + h, x0, y0, rad);
    g.arcTo(x0, y0, x0 + w, y0, rad);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = '#5b6b82';
    g.stroke();
    g.fillStyle = THEME.fg;
    g.font = '700 30px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 30);
    return new THREE.CanvasTexture(c);
  }
  // Nhãn TẦNG (T1..T5): viên tối nhỏ treo cạnh kệ, CHỈ hiện trong cửa sổ kệ / nhóm (đi tới, bấm kết quả tìm lô), toàn cảnh không có.
  // Nhóm drive-in chỉ có MỘT cột nhãn tầng (ở đầu lối vào, mép ngoài của làn đầu tiên), không lặp theo từng làn.
  function tierTexture(text) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 56;
    const g = c.getContext('2d');
    const x0 = 3; const y0 = 3; const w = 90; const h = 50; const rad = 14;
    g.beginPath();
    g.moveTo(x0 + rad, y0);
    g.arcTo(x0 + w, y0, x0 + w, y0 + h, rad);
    g.arcTo(x0 + w, y0 + h, x0, y0 + h, rad);
    g.arcTo(x0, y0 + h, x0, y0, rad);
    g.arcTo(x0, y0, x0 + w, y0, rad);
    g.closePath();
    g.fillStyle = 'rgba(30,41,59,0.92)';
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '700 30px "Be Vietnam Pro", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 48, 30);
    return new THREE.CanvasTexture(c);
  }
  const TIER_PX = 16;
  const tierLabels = [];
  for (let t = 1; t <= MAXT; t++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tierTexture('T' + t), transparent: true, depthTest: false, sizeAttenuation: false }));
    sp.renderOrder = 6;
    sp.visible = false;
    scene.add(sp);
    tierLabels.push({ sp, t });
  }
  let tierKey = '';
  const LABEL_PX = 18; // chiều cao nhãn trên màn hình (px)
  const rackLabels = [];
  // Mọi nhãn nằm ở ĐẦU kệ (đầu lối vào), lơ lửng phía trên. Nhóm drive-in xoay dọc (9, 10) có thể đè nhau ở toàn cảnh: người dùng xoay camera / đi tới nhóm để xem.
  RACKS.forEach((r) => {
    const y = (r.tiers - 1) * LEVEL + 1.9;
    const p = world(r, -r.len / 2 - 0.35, 0);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pillTexture(r.code), transparent: true, depthTest: false, sizeAttenuation: false }));
    sp.position.set(p[0], y, p[1]);
    sp.renderOrder = 6;
    sp.visible = false;
    scene.add(sp);
    rackLabels.push({ sp, rack: r });
  });
  function updateLabelScale() {
    // sizeAttenuation=false: cỡ trên màn hình = scale / (2 * tan(fov/2)) so với chiều cao khung
    const h = wrap.clientHeight || 600;
    const sy = (LABEL_PX / h) * 2 * Math.tan((cam.fov * Math.PI) / 360);
    rackLabels.forEach((o) => o.sp.scale.set((sy * 128) / 56, sy, 1));
    const st = (TIER_PX / h) * 2 * Math.tan((cam.fov * Math.PI) / 360);
    tierLabels.forEach((o) => o.sp.scale.set((st * 96) / 56, st, 1));
  }
  function refreshLabels() {
    rackLabels.forEach(({ sp, rack: r }) => {
      let on;
      if (mode === 'tween') on = false;
      else if (mode === 'walk') on = rackShown(r) && Math.hypot(pose.x - r.cx, pose.z - r.cz) < 22;
      else if (state.pop) on = inIso(r);
      else on = rackShown(r) && r.loai !== 'san'; // kệ sàn đã có nhãn lớn "KỆ SÀN S1" ở toàn cảnh
      sp.visible = on;
    });
    refreshTierLabels();
  }
  function refreshTierLabels() {
    const u = state.pop;
    if (!u || mode === 'tween') {
      tierLabels.forEach((o) => { o.sp.visible = false; });
      return;
    }
    // góc đặt: đầu lối vào (ô 1), ở mép NGOÀI cùng của khối - chọn mép nằm bên TRÁI màn hình theo góc nhìn mặc định của cửa sổ
    // (bên phải là bảng điều khiển). Nhóm drive-in chỉ 1 cột, kệ đơn / nhóm 1 làn cũng vậy.
    const r = u.ks.find((k) => k.lane === 1) || u.ks[0];
    const rN = u.ks.reduce((m, k) => (k.lane > m.lane ? k : m), r);
    const key = u.id + '|' + r.id;
    if (key !== tierKey) {
      tierKey = key;
      const th = popViews(u).obl.theta;
      const rx = Math.cos(th);
      const rz = -Math.sin(th); // vector "phải" của camera trên mặt sàn
      const pA = world(r, -r.len / 2 - 0.5, -r.dep / 2 - 0.35); // mép làn đầu tiên
      const pB = world(rN, -rN.len / 2 - 0.5, rN.dep / 2 + 0.35); // mép làn cuối cùng
      const p = pA[0] * rx + pA[1] * rz <= pB[0] * rx + pB[1] * rz ? pA : pB; // lấy mép nằm bên trái hơn
      tierLabels.forEach((o) => o.sp.position.set(p[0], (o.t - 1) * LEVEL + 0.9, p[1]));
    }
    const top = r.tiers - Math.min(state.cut, r.tiers - 1); // tầng trên cùng còn hiện (khi "ẩn bớt tầng")
    tierLabels.forEach((o) => { o.sp.visible = o.t <= u.maxTiers && o.t <= top && (state.only === null || state.only === o.t); });
  }
  // Nhãn lớn chỉ dành cho KỆ SÀN (drive-in dùng nhãn nhỏ từng làn ở rackLabels, không có nhãn lớn nữa)
  UNITS.filter((u) => u.kind === 'san').forEach((u) => {
    const text = 'KỆ SÀN ' + u.ks[0].code;
    const cx = (u.rect[0] + u.rect[2]) / 2;
    const cz = (u.rect[1] + u.rect[3]) / 2;
    const W = Math.min(8, Math.max(5, (u.rect[2] - u.rect[0]) * 0.5));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, 512, 128, 64), transparent: true, depthTest: false }));
    sp.scale.set(W, W / 4, 1);
    sp.position.set(cx, u.maxTiers * LEVEL + 1.7, cz);
    sp.renderOrder = 4;
    scene.add(sp);
    sprites.push({ sp, rack: u.ks[0] });
  });

  // ---------- Hiển thị theo nhóm đang xem, ẩn bớt ô ngoài / tầng ----------
  // iso = { unit, rack? }: chỉ hiện 1 nhóm/kệ; có rack => chỉ hiện ĐÚNG kệ đó (đi tới 1 kệ trong nhóm drive-in thì ẩn các kệ còn lại)
  // Đang tìm lô: chỉ hiện các kệ CÓ CHỨA lô (khung kệ, ô, nhãn); hiRacks = tập id kệ đó, null = hiện mọi kệ (không tìm lô)
  let hiRacks = null;
  const rackShown = (r) => hiRacks === null || hiRacks.has(r.id);
  const inIso = (r) => rackShown(r) && (!state.iso || (r.unit === state.iso.unit && (state.iso.rack == null || r.id === state.iso.rack)));
  const structOn = (rack) => inIso(RACKS[rack]);
  function applyVis() {
    const base = [];
    const ghost = [];
    cells.forEach((c, i) => {
      const r = rackOf(c);
      const on = inIso(r);
      const idx = r.nhom ? c.o - 1 : r.loai === 'san' ? c.s - 1 : 99;
      const lim = r.nhom ? r.so_o : r.cs;
      const peelEff = r.nhom || r.loai === 'san' ? Math.min(state.peel, lim - 1) : 0;
      const peeled = idx < peelEff;
      const tierOff = c.t > r.tiers - Math.min(state.cut, r.tiers - 1) || (state.only !== null && c.t !== state.only);
      c.pick = on && !peeled && !tierOff;
      slotMesh.setMatrixAt(i, c.pick ? slotMat[i] : ZERO);
      const hf = half(c);
      if (c.pick) pushBox(base, c, hf[0], hf[1], hf[2]);
      else if (on && peeled && !tierOff && c.filled && hiSet.size === 0) pushBox(ghost, c, hf[0] - 0.05, hf[1] - 0.05, hf[2] - 0.06);
      // đang tìm lô (hiSet có ô): ẩn hàng của mọi ô khác để các ô của lô nổi bật
      const show = c.pick && c.filled && (hiSet.size === 0 || hiSet.has(c.code));
      palMesh.setMatrixAt(i, show ? palMat[i] : ZERO);
      loadMesh.setMatrixAt(i, show && loadMat[i] ? loadMat[i] : ZERO);
    });
    slotMesh.instanceMatrix.needsUpdate = true;
    slotMesh.computeBoundingSphere(); // tia chọn ô dùng hình cầu bao: phải tính lại khi ô hiện/ẩn
    palMesh.instanceMatrix.needsUpdate = true;
    loadMesh.instanceMatrix.needsUpdate = true;
    blue.forEach((o, i) => blueMesh.setMatrixAt(i, structOn(o.rack) ? o.m : ZERO));
    blueMesh.instanceMatrix.needsUpdate = true;
    orange.forEach((o, i) => orangeMesh.setMatrixAt(i, structOn(o.rack) ? o.m : ZERO));
    orangeMesh.instanceMatrix.needsUpdate = true;
    decks.forEach((d) => {
      const r = RACKS[d.rack];
      d.g.visible = structOn(d.rack) && (state.only !== null ? d.t === state.only : d.t <= r.tiers - Math.min(state.cut, r.tiers - 1));
    });
    setLines(baseLines, base);
    setLines(ghostLines, ghost);
    if (state.sel >= 0 && !cells[state.sel].pick) selectCell(-1);
    else updateSel();
    dirty = true;
  }

  // ---------- Hiện trạng ô (từ API) ----------
  // rows: [{ ma_vi_tri, so_lo_trong_o, so_lo_dau }] (xem listViTriBanDo)
  function setOccupancy(rows) {
    cells.forEach((c) => { c.filled = false; c.info = null; });
    const col = new THREE.Color(LOAD_COLOR);
    for (const r of rows) {
      const c = cellByCode.get(r.ma_vi_tri);
      if (!c || !(r.so_lo_trong_o > 0)) continue;
      c.filled = true;
      c.info = r;
      c.h = LOAD_H;
      const rack = rackOf(c);
      const base = (c.t - 1) * LEVEL + 0.2;
      loadMat[c.i] = mat4(c.x, base + 0.14 + c.h / 2, c.z, (rack.hor ? cu : cv) - 0.1, c.h, (rack.hor ? cv : cu) - 0.1);
      loadMesh.setColorAt(c.i, col);
    }
    if (loadMesh.instanceColor) loadMesh.instanceColor.needsUpdate = true;
    applyVis();
    emit();
  }

  // ---------- Chọn ô, tô sáng ----------
  function updateSel() {
    selBlock.visible = false;
    selEmpty.visible = false;
    if (state.sel >= 0) {
      const c = cells[state.sel];
      if (c.filled && loadMat[c.i]) {
        selBlock.matrix.copy(loadMat[c.i]).multiply(GROW);
        selBlock.visible = true;
      } else {
        const hf = half(c);
        // ô trống: chỉ tô xanh MẶT ĐÁY (tấm phẳng nằm trên thanh đỡ của tầng đó)
        selEmpty.matrix.copy(mat4(c.x, (c.t - 1) * LEVEL + 0.21, c.z, hf[0] * 2 * 0.94, 0.03, hf[2] * 2 * 0.94));
        selEmpty.visible = true;
      }
    }
    dirty = true;
  }
  // Tìm lô: tập mã ô của lô đang tìm. Rỗng = hiện bình thường.
  let hiSet = new Set();
  function selInfo() {
    if (state.sel < 0) return null;
    const c = cells[state.sel];
    const r = rackOf(c);
    const u = UNITS[r.unit];
    return {
      code: c.code, ke: r.code, khu: r.khu, nhom: r.nhom, lane: r.lane, laneN: u.n, loai_ke: r.loai,
      o: c.o, tang: c.t, sau: c.s, soSau: r.cs, satLoiVao: !!r.nhom && c.o === 1, info: c.info,
    };
  }
  function selectCell(i) {
    state.sel = i;
    updateSel();
    emit();
  }
  function selectByCode(code, { focus = true, open = true } = {}) {
    const c = cellByCode.get(code);
    if (!c) return false;
    if (open && (!state.pop || state.pop.id !== unitOf(c).id || (state.pop.solo && state.pop.ks[0].id !== c.rack))) openPop(unitOf(c), c.i);
    else {
      if (!c.pick) return false;
      selectCell(c.i);
      if (focus) focusCell(c.i);
    }
    return true;
  }
  function highlight(codes, { fly: doFly = true } = {}) {
    const list = codes.filter((x) => cellByCode.has(x));
    hiSet = new Set(list);
    hiRacks = list.length ? new Set(list.map((x) => cellByCode.get(x).rack)) : null; // chỉ giữ các kệ có chứa lô
    applyVis();
    refreshLabels();
    syncSprites();
    if (!doFly || !list.length) return;
    const c = cellByCode.get(list[0]);
    if (!c) return;
    const u = unitOf(c);
    if (!state.pop || state.pop.id !== u.id || (state.pop.solo && state.pop.ks[0].id !== c.rack)) openPop(u, undefined, rackOf(c));
  }

  // ---------- Vật cản và tìm đường ----------
  const RECTS = RACKS.filter((r) => r.loai !== 'san').map((r) => r.rect);
  const WB = { x0: B.x0 - 3, x1: B.x1 + 3, z0: B.z0 - 3, z1: B.z1 + 3 };
  function blockedAt(x, z, pad) {
    if (x < WB.x0 || x > WB.x1 || z < WB.z0 || z > WB.z1) return true;
    for (let i = 0; i < RECTS.length; i++) {
      const r = RECTS[i];
      if (x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad) return true;
    }
    return false;
  }
  const GR = 0.35;
  const GX0 = WB.x0;
  const GZ0 = WB.z0;
  const GW = Math.ceil((WB.x1 - WB.x0) / GR) + 1;
  const GH = Math.ceil((WB.z1 - WB.z0) / GR) + 1;
  const CLEAR = 0.55;
  const blocked = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) blocked[j * GW + i] = blockedAt(GX0 + i * GR, GZ0 + j * GR, CLEAR) ? 1 : 0;
  const toGrid = (x, z) => [Math.round((x - GX0) / GR), Math.round((z - GZ0) / GR)];
  const toWorld = (i, j) => ({ x: GX0 + i * GR, z: GZ0 + j * GR });
  function snapFree(x, z) {
    x = clamp(x, WB.x0, WB.x1);
    z = clamp(z, WB.z0, WB.z1);
    if (!blockedAt(x, z, CLEAR)) return { x, z };
    const g = toGrid(x, z);
    for (let r = 1; r <= 40; r++) {
      let best = null;
      let bd = 1e9;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = g[0] + di;
          const j = g[1] + dj;
          if (i < 0 || j < 0 || i >= GW || j >= GH || blocked[j * GW + i]) continue;
          const w = toWorld(i, j);
          const d = (w.x - x) * (w.x - x) + (w.z - z) * (w.z - z);
          if (d < bd) { bd = d; best = w; }
        }
      }
      if (best) return best;
    }
    return null;
  }
  function astar(s, t) {
    const open = [];
    const g = new Float32Array(GW * GH).fill(1e9);
    const came = new Int32Array(GW * GH).fill(-1);
    const closed = new Uint8Array(GW * GH);
    const push = (f, n) => {
      open.push([f, n]);
      let i = open.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (open[p][0] <= open[i][0]) break;
        const tmp = open[p]; open[p] = open[i]; open[i] = tmp;
        i = p;
      }
    };
    const pop = () => {
      const top = open[0];
      const last = open.pop();
      if (open.length) {
        open[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < open.length && open[l][0] < open[m][0]) m = l;
          if (r < open.length && open[r][0] < open[m][0]) m = r;
          if (m === i) break;
          const tmp = open[m]; open[m] = open[i]; open[i] = tmp;
          i = m;
        }
      }
      return top;
    };
    const ti = t % GW;
    const tj = (t / GW) | 0;
    const h = (n) => {
      const dx = Math.abs((n % GW) - ti);
      const dz = Math.abs(((n / GW) | 0) - tj);
      return dx + dz - 0.5858 * Math.min(dx, dz);
    };
    g[s] = 0;
    push(h(s), s);
    while (open.length) {
      const n = pop()[1];
      if (n === t) break;
      if (closed[n]) continue;
      closed[n] = 1;
      const ni = n % GW;
      const nj = (n / GW) | 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const mi = ni + di;
          const mj = nj + dj;
          if (mi < 0 || mj < 0 || mi >= GW || mj >= GH) continue;
          const m = mj * GW + mi;
          if (blocked[m] || closed[m]) continue;
          if (di && dj && (blocked[nj * GW + mi] || blocked[mj * GW + ni])) continue;
          const c = g[n] + (di && dj ? 1.4142 : 1);
          if (c < g[m]) { g[m] = c; came[m] = n; push(c + h(m), m); }
        }
      }
    }
    if (came[t] === -1 && s !== t) return null;
    const out = [];
    for (let n = t; n !== -1; n = came[n]) {
      out.push(n);
      if (n === s) break;
    }
    return out.reverse();
  }
  function los(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(d / 0.15));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (blockedAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.5)) return false;
    }
    return true;
  }
  function findPath(from, to) {
    const s = snapFree(from.x, from.z);
    if (!s) return null;
    const gs = toGrid(s.x, s.z);
    const gt = toGrid(to.x, to.z);
    const nodes = astar(gs[1] * GW + gs[0], gt[1] * GW + gt[0]);
    if (!nodes) return null;
    const pts = nodes.map((n) => toWorld(n % GW, (n / GW) | 0));
    pts[0] = { x: from.x, z: from.z };
    pts[pts.length - 1] = { x: to.x, z: to.z };
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !los(pts[a], pts[b])) b--;
      out.push(pts[b]);
      a = b;
    }
    return out;
  }

  // ---------- Camera: toàn cảnh (xoay quanh) và đi bộ ----------
  function overview() {
    const a = cam.aspect || 1.6;
    const th = Math.tan((cam.fov * Math.PI) / 360);
    const r = Math.max((B.z1 - B.z0) / (2 * th), (B.x1 - B.x0) / (2 * th * a)) * 1.12 + 4;
    return { tx: (B.x0 + B.x1) / 2, ty: 0.5, tz: (B.z0 + B.z1) / 2, theta: 0, phi: 0.2, r };
  }
  const view = overview();
  const pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  let mode = 'orbit';
  let fly = null;
  let tw = null;
  let walkPath = null;
  let hudOrbit = 'Toàn cảnh';
  let hudShown = -1;
  let targetY = EYE;
  let vHold = 0;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function poseOf(v, out) {
    const sp = Math.sin(v.phi);
    const px = v.tx + v.r * sp * Math.sin(v.theta);
    const py = v.ty + v.r * Math.cos(v.phi);
    const pz = v.tz + v.r * sp * Math.cos(v.theta);
    const dx = v.tx - px; const dy = v.ty - py; const dz = v.tz - pz;
    const Ln = Math.hypot(dx, dy, dz);
    out.x = px; out.y = py; out.z = pz; out.yaw = Math.atan2(-dx, -dz); out.pitch = Math.asin(dy / Ln);
    return out;
  }
  function camFromOrbit() {
    const sp = Math.sin(view.phi);
    cam.position.set(view.tx + view.r * sp * Math.sin(view.theta), view.ty + view.r * Math.cos(view.phi), view.tz + view.r * sp * Math.cos(view.theta));
    cam.lookAt(view.tx, view.ty, view.tz);
  }
  function camFromPose() {
    cam.position.set(pose.x, pose.y, pose.z);
    cam.rotation.set(pose.pitch, pose.yaw, 0);
  }
  function hudText() {
    if (mode !== 'walk') return mode === 'orbit' ? hudOrbit : 'Đang di chuyển';
    return 'Đang đi trong kho · cao ' + (Math.round(pose.y * 10) / 10).toFixed(1) + ' m';
  }
  function updHud() {
    if (mode !== 'walk') { emit(); return; }
    const hh = Math.round(pose.y * 10);
    if (hh === hudShown) return;
    hudShown = hh;
    emit();
  }
  // Nhãn lớn "KỆ SÀN ..." : chỉ ở toàn cảnh (không đi bộ, không đang xem 1 nhóm) và chỉ khi kệ đó không bị ẩn do đang tìm lô
  function syncSprites() {
    const showLabels = mode !== 'walk' && !state.iso;
    sprites.forEach((o) => { o.sp.visible = showLabels && rackShown(o.rack); });
  }
  function setMode(m) {
    mode = m;
    hudShown = -1;
    syncSprites();
    if (m !== 'walk') { walkPath = null; ring.visible = false; }
    canvas.classList.toggle('go', m === 'walk');
    dirty = true;
    emit();
  }
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function startTween(steps, done) {
    if (mode === 'orbit') poseOf(view, pose);
    setMode('tween');
    fly = null;
    steps[0].to.yaw = pose.yaw + wrapAngle(steps[0].to.yaw - pose.yaw);
    tw = { steps, i: 0, from: { ...pose }, t0: performance.now(), done };
  }
  function stepTween(now) {
    const s = tw.steps[tw.i];
    const dur = reduceMotion() ? 1 : s.dur;
    const k = Math.min(1, (now - tw.t0) / dur);
    const e = ease(k);
    const a = tw.from;
    const b = s.to;
    pose.x = a.x + (b.x - a.x) * e; pose.y = a.y + (b.y - a.y) * e; pose.z = a.z + (b.z - a.z) * e;
    pose.yaw = a.yaw + (b.yaw - a.yaw) * e; pose.pitch = a.pitch + (b.pitch - a.pitch) * e;
    dirty = true;
    if (k < 1) return;
    tw.i++;
    tw.from = { ...pose };
    tw.t0 = now;
    if (tw.i >= tw.steps.length) {
      const d = tw.done;
      tw = null;
      d();
    } else {
      const n = tw.steps[tw.i];
      n.to.yaw = pose.yaw + wrapAngle(n.to.yaw - pose.yaw);
    }
  }
  const snapYaw = (y) => Math.round(y / (Math.PI / 2)) * (Math.PI / 2);
  function goWalk(t) {
    if (mode === 'orbit') poseOf(view, pose);
    const h = snapYaw(pose.yaw);
    startTween(
      [
        { to: { x: t.x, y: 9, z: t.z, yaw: h, pitch: -0.55 }, dur: 1000 },
        { to: { x: t.x, y: EYE, z: t.z, yaw: h, pitch: -0.03 }, dur: 800 },
      ],
      () => { targetY = EYE; setMode('walk'); }
    );
  }
  function flyTo(t) {
    if (reduceMotion()) { Object.assign(view, t); dirty = true; return; }
    const to = { ...view, ...t };
    to.theta = view.theta + wrapAngle(to.theta - view.theta);
    fly = { from: { ...view }, to, t0: performance.now(), dur: 800 };
  }
  function stepFly(now) {
    const k = Math.min(1, (now - fly.t0) / fly.dur);
    const e = ease(k);
    ['tx', 'ty', 'tz', 'theta', 'phi', 'r'].forEach((key) => { view[key] = fly.from[key] + (fly.to[key] - fly.from[key]) * e; });
    dirty = true;
    if (k >= 1) fly = null;
  }
  function toView(v, label) {
    hudOrbit = label;
    if (mode === 'orbit') { setMode('orbit'); flyTo(v); return; }
    if (mode === 'walk') {
      const o = poseOf(v, {});
      startTween(
        [
          { to: { x: pose.x, y: 9, z: pose.z, yaw: pose.yaw, pitch: -0.5 }, dur: 750 },
          { to: o, dur: 1200 },
        ],
        () => { Object.assign(view, v); setMode('orbit'); }
      );
    }
  }
  function hiRect(r) {
    const arr = [];
    if (r) {
      const y = 0.07;
      [0, 0.08].forEach((g) => {
        const a = r[0] + g; const b = r[1] + g; const c = r[2] - g; const d = r[3] - g;
        [[a, b, c, b], [c, b, c, d], [c, d, a, d], [a, d, a, b]].forEach((e) => arr.push(e[0], y, e[1], e[2], y, e[3]));
      });
    }
    setLines(rackHi, arr);
  }
  const frontTheta = (u) => {
    const r = u.ks[0];
    const f = u.kind === 'group' ? [-r.U[0], -r.U[1]] : [-r.V[0], -r.V[1]];
    return Math.atan2(f[0], f[1]);
  };
  function unitTop(u) {
    const r = u.rect;
    const size = Math.max(r[2] - r[0], r[3] - r[1]);
    return { tx: (r[0] + r[2]) / 2, ty: 0.5, tz: (r[1] + r[3]) / 2, theta: frontTheta(u), phi: 0.2, r: Math.max(9, size * 1.1 + 4) };
  }
  function goOverview() {
    if (mode === 'tween') return;
    state.iso = null;
    applyVis();
    hiRect(null);
    toView(overview(), 'Toàn cảnh');
  }
  function goUnit(u) {
    if (mode === 'tween') return;
    state.iso = null;
    applyVis();
    hiRect(u.rect);
    toView(unitTop(u), u.kind === 'group' ? u.nhom : 'Kệ ' + u.ks[0].code);
  }

  // ---------- Tìm kệ / nhóm ----------
  const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function findRack(q) {
    let n = norm(q);
    if (!n) return null;
    if (/^\d+$/.test(n)) n = 'K' + n.padStart(2, '0');
    else if (/^K\d$/.test(n)) n = 'K0' + n.slice(1);
    const r = RACKS.find((x) => norm(x.code) === n);
    if (r) return { unit: UNITS[r.unit], rack: r };
    const u = UNITS.find((x) => x.kind === 'group' && norm(x.nhom) === n);
    return u ? { unit: u, rack: null } : null;
  }
  function find(q) {
    const f = findRack(q);
    if (!f) return { ok: false };
    openPop(f.unit, undefined, f.rack, true); // gõ mã 1 kệ -> chỉ hiện kệ đó; gõ tên nhóm (f.rack = null) -> hiện cả nhóm
    return { ok: true, label: f.rack ? f.rack.code : f.unit.nhom };
  }
  // Gợi ý cho ô "Tìm kệ hoặc nhóm": chỉ có mã kệ / tên nhóm, không kèm dòng mô tả phụ
  const searchOptions = [
    ...RACKS.map((r) => ({ value: r.code })),
    // ...UNITS.filter((u) => u.kind === 'group').map((u) => ({ value: u.nhom })),
  ];

  // ---------- Cửa sổ riêng của một kệ / một nhóm ----------
  function popViews(u) {
    const r = u.rect;
    const size = Math.max(r[2] - r[0], r[3] - r[1]);
    const hh = u.maxTiers * LEVEL + 0.2;
    const cx = (r[0] + r[2]) / 2;
    const cz = (r[1] + r[3]) / 2;
    const ft = frontTheta(u);
    const fit = Math.max(9, size * 1.1 + 4);
    const side = Math.max(11, size * 0.95 + 7);
    return {
      top: { tx: cx, ty: 0.5, tz: cz, theta: ft, phi: 0.2, r: fit },
      front: { tx: cx, ty: hh * 0.45, tz: cz, theta: ft, phi: 1.42, r: side },
      side: { tx: cx, ty: hh * 0.45, tz: cz, theta: ft - Math.PI / 2, phi: 1.42, r: side },
      obl: { tx: cx, ty: hh * 0.5, tz: cz, theta: ft - 0.62, phi: 0.95, r: side },
    };
  }
  // Cửa sổ của 1 kệ đơn trong nhóm: dùng chung cấu trúc 'đơn vị' nhưng rect/ks chỉ gồm kệ đó
  function soloView(u, r) {
    return {
      ...u, ks: [r], n: 1, rect: r.rect, depthN: r.so_o, maxTiers: r.tiers, name: r.code,
      sub: '', solo: true, // chỉ hiện mã kệ, không kèm mô tả
    };
  }
  function popSub(u) {
    if (u.sub !== undefined) return u.sub;
    const k = u.ks[0];
    if (u.kind === 'group') return u.n + ' kệ selective xoay dọc (' + u.ks.map((r) => r.code).slice(0, 4).join(', ') + (u.n > 4 ? '…' : '') + '), mỗi kệ là một làn · ' + k.so_o + ' ô × ' + k.tiers + ' tầng';
    return ''; // kệ đơn (selective / sàn): chỉ hiện mã kệ ở tiêu đề, không kèm mô tả
  }
  let popSaved = null;
  // single=true (chỉ khi đi tới 1 kệ cụ thể trong nhóm): cửa sổ chỉ hiện ĐÚNG kệ focusRack, không hiện các kệ khác trong nhóm
  function openPop(u0, ci, focusRack, single = false) {
    if (mode === 'tween') return;
    const solo = single && focusRack && u0.kind === 'group';
    const u = solo ? soloView(u0, focusRack) : u0;
    if (!state.pop) {
      popSaved = { mode, view: { ...view }, pose: { ...pose }, targetY, peel: state.peel, cut: state.cut, hud: hudOrbit };
      walkPath = null; keys.clear(); vHold = 0;
    }
    const wasWalk = mode === 'walk';
    state.pop = u; state.iso = { unit: u0.id, rack: solo ? focusRack.id : null }; state.peel = 0; state.cut = 0; state.only = null;
    hiRect(focusRack && !solo ? focusRack.rect : null);
    state.sel = -1; updateSel();
    hudOrbit = solo ? 'Kệ ' + focusRack.code : u.kind === 'group' ? u.nhom : 'Kệ ' + u.ks[0].code;
    const v = popViews(u).obl;
    if (wasWalk) { fly = null; Object.assign(view, v); setMode('orbit'); } else { setMode('orbit'); flyTo(v); }
    applyVis();
    if (ci !== undefined) { selectCell(ci); focusCell(ci); }
    dirty = true;
    emit();
  }
  function closePop() {
    if (!state.pop || mode === 'tween') return;
    const sv = popSaved;
    popSaved = null;
    state.pop = null; state.iso = null; state.peel = sv.peel; state.cut = sv.cut; state.only = null; fly = null;
    hiRect(null);
    state.sel = -1; updateSel();
    hudOrbit = sv.hud;
    if (sv.mode === 'walk') { Object.assign(pose, sv.pose); targetY = sv.targetY; setMode('walk'); } else { Object.assign(view, sv.view); setMode('orbit'); }
    applyVis();
    dirty = true;
    emit();
  }
  function focusCell(ci) {
    const c = cells[ci];
    flyTo({ tx: c.x, ty: c.y, tz: c.z, r: 5.5 });
  }
  function setPopView(name) {
    if (state.pop) flyTo(popViews(state.pop)[name]);
  }

  // ---------- Đi bộ: theo đường tìm được, hoặc phím W A S D ----------
  const WALK_V = 4.2;
  function startPath(t) {
    const p = findPath({ x: pose.x, z: pose.z }, t);
    if (!p || p.length < 2) return;
    walkPath = { pts: p, i: 1, t: 0 };
  }
  function followPath(dt) {
    const w = walkPath;
    w.t += dt;
    const tgt = w.pts[w.i];
    const dx = tgt.x - pose.x;
    const dz = tgt.z - pose.z;
    const d = Math.hypot(dx, dz);
    let rem = d;
    for (let i = w.i + 1; i < w.pts.length; i++) rem += Math.hypot(w.pts[i].x - w.pts[i - 1].x, w.pts[i].z - w.pts[i - 1].z);
    const v = WALK_V * clamp(Math.min(w.t / 0.6, rem / 2.2), 0.2, 1);
    const step = v * dt;
    if (step >= d) { pose.x = tgt.x; pose.z = tgt.z; w.i++; if (w.i >= w.pts.length) walkPath = null; } else { pose.x += (dx / d) * step; pose.z += (dz / d) * step; }
    if (d > 0.05) pose.yaw += wrapAngle(Math.atan2(-dx, -dz) - pose.yaw) * (1 - Math.exp(-dt * 5));
    dirty = true;
  }
  const keys = new Set();
  let boost = false;
  let hover = false;
  const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const VERT_KEYS = new Set(['KeyE', 'KeyQ', 'PageUp', 'PageDown']);
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') { if (state.sel >= 0) selectCell(-1); else if (state.pop) closePop(); return; }
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || mode === 'tween' || !(hover || document.activeElement === wrap)) return;
    boost = e.shiftKey;
    if (VERT_KEYS.has(e.code)) { keys.add(e.code); e.preventDefault(); } else if (mode === 'walk' && MOVE_KEYS.has(e.code)) { keys.add(e.code); walkPath = null; e.preventDefault(); }
  });
  on(document, 'keyup', (e) => { boost = e.shiftKey; keys.delete(e.code); });
  const dropKeys = () => { keys.clear(); boost = false; };
  on(wrap, 'blur', dropKeys);
  on(window, 'blur', dropKeys);
  on(wrap, 'pointerenter', () => { hover = true; });
  on(wrap, 'pointerleave', () => { hover = false; });
  function walkBy(fwd, str) {
    const sy = Math.sin(pose.yaw);
    const cy = Math.cos(pose.yaw);
    const dx = -sy * fwd + cy * str;
    const dz = -cy * fwd - sy * str;
    const free = pose.y > H + 0.6 || blockedAt(pose.x, pose.z, 0.45);
    const nx = pose.x + dx;
    if (free || !blockedAt(nx, pose.z, 0.45)) pose.x = nx;
    const nz = pose.z + dz;
    if (free || !blockedAt(pose.x, nz, 0.45)) pose.z = nz;
    dirty = true;
  }
  function walkStep(dt) {
    let u = 0;
    if (keys.has('KeyE') || keys.has('PageUp') || vHold > 0) u += 1;
    if (keys.has('KeyQ') || keys.has('PageDown') || vHold < 0) u -= 1;
    if (u) targetY = clamp(targetY + u * 2.8 * dt, 0.6, 12);
    if (Math.abs(targetY - pose.y) > 0.004) { pose.y += (targetY - pose.y) * (1 - Math.exp(-dt * (u ? 14 : 5))); dirty = true; updHud(); }
    if (walkPath) { followPath(dt); return; }
    let f = 0; let s = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
    if (!f && !s) return;
    const Ln = Math.hypot(f, s);
    const v = 3.2 * (boost ? 2 : 1) * dt;
    walkBy((f / Ln) * v, (s / Ln) * v);
  }

  // ---------- Chuột và cảm ứng ----------
  const rotate = (dx, dy) => { view.theta -= dx * 0.006; view.phi = clamp(view.phi - dy * 0.006, 0.15, state.pop ? 1.7 : 1.5); dirty = true; };
  const zoom = (f) => { view.r = clamp(view.r * f, 3, 160); dirty = true; };
  function pan(dx, dy) {
    const h = wrap.clientHeight || 600;
    const k = (2 * view.r * Math.tan((24 * Math.PI) / 180)) / h;
    const fx = -Math.sin(view.theta); const fz = -Math.cos(view.theta);
    const rx = Math.cos(view.theta); const rz = -Math.sin(view.theta);
    view.tx += -rx * dx * k + fx * dy * k;
    view.tz += -rz * dx * k + fz * dy * k;
    dirty = true;
  }
  const look = (dx, dy) => { pose.yaw -= dx * 0.005; pose.pitch = clamp(pose.pitch - dy * 0.005, -1.4, 1.4); dirty = true; };
  const dolly = (m) => { if (!walkPath) walkBy(m, 0); };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(cx, cy) {
    if (!renderer) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    cam.updateMatrixWorld();
    raycaster.setFromCamera(ndc, cam);
    const hits = raycaster.intersectObject(slotMesh, false);
    let cellHit = null;
    if (hits.length) {
      let best = hits[0];
      for (let i = 0; i < hits.length; i++) {
        if (hits[i].distance > hits[0].distance + 2.5) break;
        if (cells[hits[i].instanceId].filled) { best = hits[i]; break; }
      }
      cellHit = { c: cells[best.instanceId], d: best.distance };
    }
    const f = raycaster.intersectObjects(floorObjs, false);
    const fh = f.length ? f[0] : null;
    if (cellHit && (!fh || cellHit.d <= fh.distance)) return { type: 'cell', cell: cellHit.c };
    if (fh) {
      const p = fh.point;
      if (p.x < WB.x0 - 1 || p.x > WB.x1 + 1 || p.z < WB.z0 - 1 || p.z > WB.z1 + 1) return null;
      return { type: 'floor', x: p.x, z: p.z };
    }
    return null;
  }
  function onClick(cx, cy) {
    const h = pickAt(cx, cy);
    if (!h) { selectCell(-1); return; }
    if (h.type === 'cell') { selectCell(h.cell.i); return; }
    if (state.iso) return;
    const t = snapFree(h.x, h.z);
    if (!t) return;
    if (mode === 'orbit') goWalk(t);
    else if (mode === 'walk') startPath(t);
  }
  let hoverRaf = 0;
  let hx = 0;
  let hy = 0;
  function hideHover() {
    if (tipEl) tipEl.hidden = true;
    ring.visible = false;
    dirty = true;
  }
  function hoverAt(e) {
    hx = e.clientX; hy = e.clientY;
    if (hoverRaf || fly || tw) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      if (destroyed) return;
      const h = pickAt(hx, hy);
      const r = wrap.getBoundingClientRect();
      if (h && h.type === 'cell') {
        ring.visible = false; dirty = true;
        if (tipEl) {
          const inf = h.cell.info;
          tipEl.textContent = h.cell.code + (h.cell.filled ? (inf?.so_lo_dau ? ' · ' + inf.so_lo_dau + (inf.so_lo_trong_o > 1 ? ' +' + (inf.so_lo_trong_o - 1) : '') : '') : ' · trống');
          tipEl.style.left = Math.min(hx - r.left + 14, Math.max(8, r.width - 300)) + 'px';
          tipEl.style.top = hy - r.top + 14 + 'px';
          tipEl.hidden = false;
        }
      } else if (h && h.type === 'floor' && !state.iso) {
        if (tipEl) tipEl.hidden = true;
        const t = snapFree(h.x, h.z);
        if (t) { ring.position.x = t.x; ring.position.z = t.z; ring.visible = true; } else ring.visible = false;
        dirty = true;
      } else hideHover();
    });
  }
  const ptrs = new Map();
  let down = null;
  let lastPinch = 0;
  const pinchDist = () => {
    const a = Array.from(ptrs.values());
    return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  on(canvas, 'pointerdown', (e) => {
    if (mode === 'tween') return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
    fly = null; hideHover(); wrap.focus({ preventScroll: true });
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) down = { moved: 0, btn: e.button, shift: e.shiftKey };
    else { if (down) down.moved = 99; lastPinch = pinchDist(); }
  });
  on(canvas, 'pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse' && mode !== 'tween') hoverAt(e); return; }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size >= 2) {
      const d = pinchDist();
      if (mode === 'orbit') { if (lastPinch > 0 && d > 0) zoom(lastPinch / d); pan(dx / 2, dy / 2); } else if (mode === 'walk' && lastPinch > 0) dolly((d - lastPinch) * 0.03);
      lastPinch = d;
      return;
    }
    if (!down) return;
    down.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'orbit') { if (down.btn === 0 && !down.shift) rotate(dx, dy); else pan(dx, dy); } else if (mode === 'walk') look(dx, dy);
  });
  function endPtr(e) {
    if (!ptrs.has(e.pointerId)) return;
    const single = ptrs.size === 1;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) lastPinch = 0;
    if (single && down && down.moved < 6 && down.btn === 0 && e.type === 'pointerup' && mode !== 'tween') onClick(e.clientX, e.clientY);
    if (ptrs.size === 0) down = null;
  }
  on(canvas, 'pointerup', endPtr);
  on(canvas, 'pointercancel', endPtr);
  on(canvas, 'pointerleave', hideHover);
  on(canvas, 'contextmenu', (e) => e.preventDefault());
  on(canvas, 'wheel', (e) => {
    e.preventDefault();
    if (mode === 'tween') return;
    if (mode === 'orbit') { fly = null; zoom(Math.exp(e.deltaY * 0.001)); } else dolly(-e.deltaY * 0.008);
  }, { passive: false });

  // ---------- API điều khiển cho giao diện ----------
  function holdVert(dir) {
    if (dir === 0) { vHold = 0; return; }
    if (mode === 'tween') return;
    vHold = dir;
  }
  function nudgeHeight(dir) { targetY = clamp(targetY + dir * 1.5, 0.6, 12); }
  function setTierHeight(t) {
    const y = (t - 1) * LEVEL + 0.9;
    if (mode === 'walk') { targetY = y; pose.pitch = Math.abs(pose.pitch) > 0.4 ? 0 : pose.pitch; } else if (mode === 'orbit') flyTo({ ty: y });
  }
  function resetHeight() {
    if (mode === 'walk') targetY = EYE;
    else if (mode === 'orbit') flyTo({ ty: 0.5 });
  }
  const setPeel = (n) => { state.peel = n; applyVis(); emit(); };
  const setCut = (n) => { state.cut = n; applyVis(); emit(); };
  const setOnly = (n) => { state.only = n === 0 ? null : n; applyVis(); emit(); };

  // ---------- Snapshot cho React ----------
  function emit() {
    if (destroyed || !onState) return;
    const u = state.pop;
    onState({
      hud: hudText(),
      mode,
      peel: state.peel,
      cut: state.cut,
      only: state.only,
      sel: selInfo(),
      pop: u ? { id: u.id, name: u.name, sub: popSub(u), kind: u.kind, maxTiers: u.maxTiers, depthN: u.depthN, nhom: u.nhom } : null,
    });
  }

  // ---------- Vòng vẽ ----------
  let last = performance.now();
  let raf = 0;
  function loop(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (fly) stepFly(now);
    if (tw) stepTween(now);
    if (mode === 'walk') walkStep(dt);
    else if (mode === 'orbit') {
      let u = 0;
      if (keys.has('KeyE') || keys.has('PageUp') || vHold > 0) u += 1;
      if (keys.has('KeyQ') || keys.has('PageDown') || vHold < 0) u -= 1;
      if (u) { fly = null; view.ty = clamp(view.ty + u * 2.8 * dt, 0, 12); dirty = true; }
    }
    if (!dirty || !renderer) return;
    dirty = false;
    if (mode === 'orbit') camFromOrbit(); else camFromPose();
    refreshLabels();
    renderer.render(scene, cam);
  }
  function resize() {
    if (!renderer) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 60 : 48;
    cam.updateProjectionMatrix();
    updateLabelScale();
    dirty = true;
  }
  let firstFit = true;
  const onResize = () => {
    resize();
    if (firstFit && mode === 'orbit' && !state.pop && cam.aspect) { firstFit = false; Object.assign(view, overview()); }
  };
  let ro = null;
  if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(wrap); } else on(window, 'resize', onResize);

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(hoverRaf);
    cleanups.forEach((fn) => fn());
    if (ro) ro.disconnect();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { if (x.map) x.map.dispose(); x.dispose(); });
    });
    extraGeos.forEach((g) => g.dispose());
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    canvas.remove();
  }

  applyVis();
  setMode('orbit');
  onResize();
  raf = requestAnimationFrame(loop);

  return {
    hasWebGL: !!renderer,
    stats: {
      racks: RACKS.length, san: RACKS.filter((r) => r.loai === 'san').length, cells: cells.length,
      groups: UNITS.filter((u) => u.kind === 'group').length, maxTiers: MAXT, maxDepth: MAXD,
    },
    searchOptions,
    has: (code) => cellByCode.has(code),
    // Danh sách MỌI ô trong kho cho ô chọn "Đến ô" (gõ để lọc). Không phân biệt ô trống / có hàng, không kiểm tra gì thêm.
    cellOptions: () => cells.map((c) => ({ value: c.code, label: c.code })),
    overview: goOverview,
    find,
    closePop,
    setPopView,
    setPeel,
    setCut,
    setOnly,
    holdVert,
    nudgeHeight,
    setTierHeight,
    resetHeight,
    setOccupancy,
    selectByCode,
    clearSelection: () => selectCell(-1),
    highlight,
    clearHighlight: () => { if (hiSet.size) { hiSet = new Set(); hiRacks = null; applyVis(); refreshLabels(); syncSprites(); } },
    zoomToSelected: () => { if (state.sel >= 0) focusCell(state.sel); },
    openPopForSelected: () => { if (state.sel >= 0) { const c = cells[state.sel]; openPop(unitOf(c), c.i); } },
    topForSelected: () => { if (state.sel >= 0) goUnit(unitOf(cells[state.sel])); },
    destroy,
  };
}
