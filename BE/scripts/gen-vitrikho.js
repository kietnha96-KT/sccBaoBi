#!/usr/bin/env node
// Sinh seed ViTriKho từ data/kho-layout.json. Không cần thư viện ngoài, KHÔNG đụng DB (chỉ in SQL ra stdout).
// Dùng (từ thư mục BE/):
//   node scripts/gen-vitrikho.js > migrations/010_seed_vitrikho.sql
//   node scripts/run-schema.js migrations/010_seed_vitrikho.sql
// Chạy lại an toàn (ON CONFLICT DO NOTHING). Thêm kệ mới vào layout rồi chạy lại là có ô mới.
const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'data', 'kho-layout.json');
const L = JSON.parse(fs.readFileSync(file, 'utf8'));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const p2 = (n) => String(n).padStart(2, '0');

const rows = [];
for (const k of L.ke) {
  const cs = k.loai_ke === 'san' ? k.chieu_sau || 1 : 1;
  for (let o = 1; o <= k.so_o; o++)
    for (let t = 1; t <= k.so_tang; t++)
      for (let s = 1; s <= cs; s++) {
        const ma = k.ma_ke + '-O' + p2(o) + '-T' + t + (cs > 1 ? '-S' + s : ''); // độ sâu (kệ sàn) đứng cuối: S1-O10-T2-S4
        rows.push(
          '(' +
            [q(ma), k.khu ? q(k.khu) : 'NULL', q(k.ma_ke), q(k.loai_ke), k.nhom ? q(k.nhom) : 'NULL', o, s, t].join(', ') +
            ')'
        );
      }
}

const out = [];
for (let i = 0; i < rows.length; i += 500)
  out.push(
    'INSERT INTO ViTriKho (ma_vi_tri, khu, ke, loai_ke, nhom, o, chieu_sau, tang) VALUES\n' +
      rows.slice(i, i + 500).join(',\n') +
      '\nON CONFLICT (ke, o, chieu_sau, tang) DO NOTHING;'
  );
console.log('-- Sinh từ data/kho-layout.json: ' + L.ke.length + ' kệ, ' + rows.length + ' ô\n' + out.join('\n\n'));
console.error(L.ke.length + ' kệ, ' + rows.length + ' ô');
