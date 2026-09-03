// Giai ma van ban tieng Viet kieu TCVN3 cu (dang bi loi font hien thi qua Windows-1252/Latin-1)
// thanh Unicode chuan. Dung khi import du lieu cu (danh muc nha cung cap, vat tu...) tu file
// Excel/CSV xuat ra tu he thong cu.
//
// Co che: cac ky tu Latin-1 mo rong (Â Á À Å Ä Û Ø Ù Õ Ï...) trong van ban goc thuc ra la
// TCVN3 dung lam "dau ghep" - ghep vao NGUYEN AM ngay truoc no de tao thanh chu co dau chuan:
// - Nhom "them dau mu" (chi ap dung cho a/e/o): Â=mu khong dau, Á=mu+sac, À=mu+huyen,
//   Å=mu+hoi, Ä=mu+nang
// - Nhom "them thanh dieu" (ap dung cho nguyen am bat ky, giu nguyen hinh dang co san):
//   Û=hoi, Ø=huyen, Ù=sac, Õ=nga, Ï/ï=nang
// - Mot so ky tu la chu doc lap (khong ghep): Ô/ô=ơ, Ö/ö=ư, Ò/ò=ị, Ó=ĩ, Ñ=đ
// Bang nay duoc suy ra va kiem chung truc tiep tren du lieu thuc te (khong co canh bao nao
// khi chay qua toan bo danh muc nha cung cap - xem scripts/_tcvn3_v2.mjs cho qua trinh kiem chung).

const LOWER = {
  a: ['a', 'à', 'ả', 'ã', 'á', 'ạ'],
  ă: ['ă', 'ằ', 'ẳ', 'ẵ', 'ắ', 'ặ'],
  â: ['â', 'ầ', 'ẩ', 'ẫ', 'ấ', 'ậ'],
  e: ['e', 'è', 'ẻ', 'ẽ', 'é', 'ẹ'],
  ê: ['ê', 'ề', 'ể', 'ễ', 'ế', 'ệ'],
  i: ['i', 'ì', 'ỉ', 'ĩ', 'í', 'ị'],
  o: ['o', 'ò', 'ỏ', 'õ', 'ó', 'ọ'],
  ô: ['ô', 'ồ', 'ổ', 'ỗ', 'ố', 'ộ'],
  ơ: ['ơ', 'ờ', 'ở', 'ỡ', 'ớ', 'ợ'],
  u: ['u', 'ù', 'ủ', 'ũ', 'ú', 'ụ'],
  ư: ['ư', 'ừ', 'ử', 'ữ', 'ứ', 'ự'],
  y: ['y', 'ỳ', 'ỷ', 'ỹ', 'ý', 'ỵ'],
};
const ALL = { ...LOWER };
for (const base in LOWER) {
  ALL[base.toUpperCase()] = LOWER[base].map((c) => c.toUpperCase());
}

function rowOf(ch) {
  return ALL[ch] || null;
}

// "Thêm dấu mũ" (biến a/e/o -> â/ê/ô kèm thanh điệu). Có cả bản chữ HOA lẫn chữ thường:
// văn bản gốc viết hoa -> dấu ghép ra chữ hoa (Â Á À Å Ä), viết thường -> chữ thường (â á à å ä).
const CIRCUMFLEX_APPLIERS = {
  Â: 0, â: 0, // mũ, không dấu
  Á: 4, á: 4, // mũ + sắc
  À: 1, à: 1, // mũ + huyền
  Å: 2, å: 2, // mũ + hỏi
  Ã: 3, ã: 3, // mũ + ngã
  Ä: 5, ä: 5, // mũ + nặng
};
const CIRCUMFLEX_TARGET_BASE = { a: 'â', e: 'ê', o: 'ô', A: 'Â', E: 'Ê', O: 'Ô' };
// "Thêm dấu á" (biến a -> ă kèm thanh điệu). Chỉ áp dụng cho a/A.
// Hiện chỉ gặp bản "á + sắc" (é/É) trong dữ liệu thực tế; thêm dần khi gặp bản khác.
const BREVE_APPLIERS = { é: 4, É: 4 };
const BREVE_TARGET_BASE = { a: 'ă', A: 'Ă' };
// "Thêm thanh điệu" (giữ nguyên hình dạng nguyên âm có sẵn). Bản HOA và thường.
const TONE_APPLIERS = {
  Û: 2, û: 2, // hỏi
  Ø: 1, ø: 1, // huyền
  Ù: 4, ù: 4, // sắc
  Õ: 3, õ: 3, // ngã
  Ï: 5, ï: 5, // nặng
};
const STANDALONE = { Ô: 'Ơ', ô: 'ơ', Ö: 'Ư', ö: 'ư', Ò: 'Ị', ò: 'ị', Ó: 'Ĩ', Ñ: 'Đ' };

function tcvn3ToUnicode(text) {
  const out = [];
  const warnings = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch in CIRCUMFLEX_APPLIERS) {
      const prev = out[out.length - 1];
      const targetBase = prev != null ? CIRCUMFLEX_TARGET_BASE[prev] : undefined;
      if (!targetBase) {
        warnings.push(`vi tri ${i}: dau mu '${ch}' nhung ky tu truoc '${prev}' khong phai a/e/o`);
        out.push(ch);
        continue;
      }
      out[out.length - 1] = rowOf(targetBase)[CIRCUMFLEX_APPLIERS[ch]];
      continue;
    }
    if (ch in BREVE_APPLIERS) {
      const prev = out[out.length - 1];
      const targetBase = prev != null ? BREVE_TARGET_BASE[prev] : undefined;
      if (!targetBase) {
        warnings.push(`vi tri ${i}: dau a '${ch}' nhung ky tu truoc '${prev}' khong phai a`);
        out.push(ch);
        continue;
      }
      out[out.length - 1] = rowOf(targetBase)[BREVE_APPLIERS[ch]];
      continue;
    }
    if (ch in TONE_APPLIERS) {
      const prev = out[out.length - 1];
      const row = prev != null ? rowOf(prev) : null;
      if (!row) {
        warnings.push(`vi tri ${i}: thanh dieu '${ch}' nhung ky tu truoc '${prev}' khong phai nguyen am`);
        out.push(ch);
        continue;
      }
      out[out.length - 1] = row[TONE_APPLIERS[ch]];
      continue;
    }
    if (ch in STANDALONE) {
      out.push(STANDALONE[ch]);
      continue;
    }
    out.push(ch);
  }
  return { text: out.join(''), warnings };
}

module.exports = { tcvn3ToUnicode };
