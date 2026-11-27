// openapi.js - Định nghĩa OpenAPI 3.0 cho toàn bộ API, phục vụ trang Swagger UI tại /api-docs
// Đây là tài liệu mô tả (không sinh code), viết tay để khớp với các route trong routes/*.js

const errorRef = { $ref: '#/components/schemas/Error' };

const responses = {
  BadRequest: { description: 'Dữ liệu không hợp lệ', content: { 'application/json': { schema: errorRef } } },
  Unauthorized: { description: 'Thiếu/sai token đăng nhập', content: { 'application/json': { schema: errorRef } } },
  Forbidden: { description: 'Không đủ quyền (thường do không phải admin)', content: { 'application/json': { schema: errorRef } } },
  NotFound: { description: 'Không tìm thấy', content: { 'application/json': { schema: errorRef } } },
  Conflict: { description: 'Xung đột dữ liệu (trùng, đang bị tham chiếu...)', content: { 'application/json': { schema: errorRef } } },
};

const pTuNgay = { name: 'tu_ngay', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Lọc từ ngày (yyyy-mm-dd)' };
const pDenNgay = { name: 'den_ngay', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Lọc đến ngày (yyyy-mm-dd)' };
const pMaVatTu = { name: 'ma_vat_tu', in: 'query', schema: { type: 'string' } };
const pMaNcc = { name: 'ma_ncc', in: 'query', schema: { type: 'string' }, description: 'Lọc theo lô thuộc nhà cung cấp này' };
const pLaLuaLaiDashboard = {
  name: 'la_lua_lai',
  in: 'query',
  schema: { type: 'string', enum: ['true', 'false', 'all'], default: 'false' },
  description: "'false' (mặc định) = loại báo cáo lựa lại; 'true' = chỉ báo cáo lựa lại; 'all' = gộp cả hai",
};
const pPage = { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } };
const pLimit = {
  name: 'limit',
  in: 'query',
  schema: { type: 'integer', default: 15, maximum: 3000 },
  description: 'Mặc định 15/trang. Có thể truyền cao (vd 3000) để lấy gần như toàn bộ danh sách cho dropdown/select.',
};
const paginationMetaSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer' },
    limit: { type: 'integer' },
    total: { type: 'integer' },
    total_pages: { type: 'integer' },
  },
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'SCC Bao Bi - API quản lý báo cáo lựa vật tư',
    version: '1.0.0',
    description:
      'Toàn bộ API backend (Node/Express + PostgreSQL). Đăng nhập ở /api/auth/login lấy token, ' +
      "bấm nút Authorize phía trên và dán token (không cần gõ chữ Bearer) để test các API cần đăng nhập.",
  },
  servers: [{ url: '/', description: 'Server hiện tại' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: { type: 'object', properties: { message: { type: 'string' } } },
      PaginationMeta: paginationMetaSchema,
      NhanSu: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          ho_ten: { type: 'string' },
          username: { type: 'string' },
          vai_tro: { type: 'string', enum: ['admin', 'nhan_vien', 'thu_kho'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      VatTu: {
        type: 'object',
        properties: {
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          loai: { type: 'string', nullable: true, description: 'Loại vật tư, text tự do, có thể để trống' },
          thu_kho: { type: 'string', nullable: true, description: 'Tên thủ kho quản lý vật tư này (chỉ hiện trong trang quản trị)' },
        },
      },
      Lo: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          so_lo: { type: 'string' },
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          ngay_san_xuat: { type: 'string', format: 'date' },
          so_luong_lo: { type: 'number' },
          ma_ncc: { type: 'string', nullable: true, description: '0-1, để trống nếu chưa có nhà cung cấp' },
          ten_ncc: { type: 'string', nullable: true },
          da_lua: { type: 'number', description: 'Tổng tong_lua các báo cáo (không tính lựa lại)' },
          con_lai: { type: 'number', description: 'so_luong_lo - da_lua' },
        },
      },
      NhaCungCap: {
        type: 'object',
        properties: {
          ma_ncc: { type: 'string' },
          ten_ncc: { type: 'string' },
        },
      },
      LoaiLoi: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          ten_loi: { type: 'string' },
        },
      },
      NhanSuThamGia: {
        type: 'object',
        properties: { id: { type: 'integer' }, ho_ten: { type: 'string' } },
      },
      BaoCao: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          ngay: { type: 'string', format: 'date' },
          lo_id: { type: 'integer' },
          so_lo: { type: 'string' },
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          so_luong_lo: { type: 'number' },
          dat: { type: 'number' },
          hu_bo: { type: 'number' },
          tong_lua: { type: 'number', description: 'Tự tính = dat + hu_bo' },
          tg_bat_dau: { type: 'string', example: '08:00' },
          tg_ket_thuc: { type: 'string', example: '12:00' },
          nguoi_nhap_id: { type: 'integer' },
          nguoi_nhap_ho_ten: { type: 'string' },
          loi_nguoi_dung: { type: 'string', nullable: true, description: 'Text tự do người nhập ghi; sửa được khi còn quyền sửa phiếu' },
          loi_chuan_id: { type: 'integer', nullable: true },
          loi_chuan_ten: { type: 'string', nullable: true },
          la_lua_lai: { type: 'boolean' },
          ghi_chu: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          co_the_sua_xoa_hom_nay: { type: 'boolean' },
          nhansu_tham_gia: { type: 'array', items: { $ref: '#/components/schemas/NhanSuThamGia' } },
        },
      },
      BaoCaoInput: {
        type: 'object',
        required: ['ngay', 'lo_id', 'nhansu_ids'],
        properties: {
          ngay: { type: 'string', format: 'date' },
          lo_id: { type: 'integer' },
          dat: { type: 'number', default: 0 },
          hu_bo: { type: 'number', default: 0 },
          tg_bat_dau: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '08:00', nullable: true, description: 'Định dạng 24 giờ HH:MM. Để trống thì phải trống cả tg_ket_thuc.' },
          tg_ket_thuc: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '17:00', nullable: true, description: 'Định dạng 24 giờ HH:MM, phải sau tg_bat_dau (cùng ngày).' },
          loi_nguoi_dung: { type: 'string', nullable: true, description: 'Ghi chú lỗi tự do; sửa được cả khi PUT nếu còn quyền sửa phiếu' },
          la_lua_lai: { type: 'boolean', default: false },
          loi_noi_bo_id: { type: 'integer', nullable: true, description: 'Lỗi NỘI BỘ (LoaiLoi.la_loi_noi_bo) của vật tư, người nhập chọn; ghi vào loi_chuan_id. Mỗi lỗi nội bộ có trần riêng = so_luong_lo của lô, không dùng cùng lúc với la_lua_lai.' },
          ghi_chu: { type: 'string', nullable: true },
          nhansu_ids: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Danh sách id nhân sự cùng tham gia (người nhập sẽ tự động được thêm vào nếu thiếu)',
          },
        },
      },
      DashboardNhanSu: {
        type: 'object',
        properties: {
          nhansu_id: { type: 'integer' },
          ho_ten: { type: 'string' },
          so_bao_cao: { type: 'integer' },
          nang_suat_tb: { type: 'number', nullable: true, description: 'Năng suất chuẩn hóa 8h, trung bình' },
          tong_dat: { type: 'number' },
          tong_hu_bo: { type: 'number' },
          tong_lua: { type: 'number' },
          ty_le_hu_bo_pct: { type: 'number', nullable: true },
        },
      },
      DashboardNhanSuTheoVatTu: {
        type: 'object',
        description: 'Mỗi dòng = 1 nhân sự + 1 vật tư + 1 lô + 1 loại lỗi cụ thể (không gộp)',
        properties: {
          nhansu_id: { type: 'integer' },
          ho_ten: { type: 'string' },
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          lo_id: { type: 'integer' },
          so_lo: { type: 'string' },
          ten_ncc: { type: 'string', nullable: true },
          loi_chuan_id: { type: 'integer' },
          ten_loi: { type: 'string' },
          so_bao_cao: { type: 'integer' },
          nang_suat_tb: { type: 'number', nullable: true },
          tong_dat: { type: 'number' },
          tong_hu_bo: { type: 'number' },
          tong_lua: { type: 'number' },
          ty_le_hu_bo_pct: { type: 'number', nullable: true },
        },
      },
      DashboardVatTu: {
        type: 'object',
        properties: {
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          so_bao_cao: { type: 'integer' },
          nang_suat_tb: { type: 'number', nullable: true },
          tong_dat: { type: 'number' },
          tong_hu_bo: { type: 'number' },
          tong_lua: { type: 'number' },
          ty_le_hu_bo_pct: { type: 'number', nullable: true },
        },
      },
      DashboardLoiTheoVatTu: {
        type: 'object',
        description: 'Mỗi dòng = 1 lô cụ thể + 1 loại lỗi cụ thể (không gộp nhiều lô lại)',
        properties: {
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          lo_id: { type: 'integer' },
          so_lo: { type: 'string', description: 'Số lô thật, lấy từ danh mục Lô' },
          ten_ncc: { type: 'string', nullable: true },
          loi_chuan_id: { type: 'integer' },
          ten_loi: { type: 'string' },
          so_bao_cao: { type: 'integer' },
          nang_suat_tb: { type: 'number', nullable: true },
          tong_dat: { type: 'number' },
          tong_hu_bo: { type: 'number' },
          tong_lua: { type: 'number' },
          ty_le_hu_bo_pct: { type: 'number', nullable: true },
        },
      },
      DashboardLo: {
        type: 'object',
        properties: {
          lo_id: { type: 'integer' },
          so_lo: { type: 'string' },
          ma_vat_tu: { type: 'string' },
          ten_vat_tu: { type: 'string' },
          ngay_san_xuat: { type: 'string', format: 'date' },
          ten_ncc: { type: 'string', nullable: true },
          so_luong_lo: { type: 'number' },
          da_lua: { type: 'number' },
          con_lai: { type: 'number' },
          so_bao_cao: { type: 'integer' },
          nang_suat_tb: { type: 'number', nullable: true },
        },
      },
      DashboardThoiGian: {
        type: 'object',
        properties: {
          ky: { type: 'string', format: 'date', description: 'Ngày hoặc đầu tháng, tùy group_by' },
          so_bao_cao: { type: 'integer' },
          tong_dat: { type: 'number' },
          tong_hu_bo: { type: 'number' },
          tong_lua: { type: 'number' },
          nang_suat_tb: { type: 'number', nullable: true },
        },
      },
    },
    responses,
  },
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Đăng nhập / tài khoản của tôi' },
    { name: 'NhanSu', description: 'Quản lý tài khoản nhân sự (tạo tài khoản: admin)' },
    { name: 'VatTu', description: 'Danh mục vật tư (chỉ admin sửa/xóa)' },
    { name: 'Lo', description: 'Danh mục lô (chỉ admin sửa/xóa)' },
    { name: 'NhaCungCap', description: 'Danh mục nhà cung cấp (chỉ admin sửa/xóa)' },
    { name: 'LoaiLoi', description: 'Danh mục lỗi chuẩn theo vật tư (chỉ admin sửa/xóa)' },
    { name: 'BaoCao', description: 'Báo cáo lựa vật tư' },
    { name: 'Dashboard', description: '4 dashboard năng suất' },
    { name: 'ViTriKho', description: 'Vị trí kho: bản đồ ô, lô nằm ở ô nào, nhập/xuất/chuyển/điều chỉnh (đọc: mọi người dùng; ghi: admin hoặc thủ kho)' },
    { name: 'XinNghi', description: 'Kê khai xin nghỉ (mọi vai trò XEM được đơn của mọi người; ghi: admin và nhân viên, thủ kho chỉ xem; tổng hợp tháng: nhân viên chỉ xem của mình)' },
  ],
  paths: {
    '/api/xin-nghi': {
      get: {
        tags: ['XinNghi'],
        summary: 'Danh sách đơn (các ngày cùng đợt gộp 1 dòng)',
        parameters: [
          { name: 'thang', in: 'query', schema: { type: 'string' }, description: 'YYYY-MM hoặc all' },
          { name: 'trang_thai', in: 'query', schema: { type: 'string', enum: ['cho_duyet', 'da_duyet', 'tu_choi'] } },
          { name: 'loai', in: 'query', schema: { type: 'string' } },
          { name: 'nhansu_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo người' },
          pPage,
        ],
        responses: { 200: { description: 'OK' }, 403: responses.Forbidden },
      },
      post: {
        tags: ['XinNghi'],
        summary: 'Kê đơn (nhân viên: chờ duyệt, được tick kê hộ thì kê cho mọi nhân viên; admin kê hộ: duyệt luôn)',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['loai', 'ngay'], properties: { nhansu_id: { type: 'integer', description: 'Bắt buộc khi admin kê hộ; nhân viên được kê hộ thì chọn người, bỏ trống = chính mình' }, loai: { type: 'string', enum: ['nghi_phep', 'nghi_om', 'che_do_nu', 'di_tre', 've_som', 'quen_cham_cong'] }, ngay: { type: 'string', format: 'date' }, den_ngay: { type: 'string', format: 'date', description: 'Chỉ nghỉ phép / ốm' }, tu_gio: { type: 'string', example: '08:00' }, den_gio: { type: 'string', example: '10:00', description: 'Chỉ dùng cho quên chấm công (giờ ra); loại khác tự tính' }, phan_ngay: { type: 'number', enum: [1, 0.5, 0.25], description: 'Chỉ nghỉ phép; 0.5 / 0.25 cần tu_gio. Nghỉ ốm không nhập giờ' }, ly_do: { type: 'string' } } } } } },
        responses: { 201: { description: 'Đã lưu' }, 400: responses.BadRequest, 403: responses.Forbidden, 409: { description: 'Trùng đơn hoặc hết số lần trong tháng' } },
      },
    },
    '/api/xin-nghi/{id}': {
      put: { tags: ['XinNghi'], summary: 'Sửa 1 ngày (body như POST, không có den_ngay)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound } },
      delete: { tags: ['XinNghi'], summary: 'Xóa đơn (nhân viên: cả đợt; admin: 1 ngày, hoặc ca_dot=true)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }, { name: 'ca_dot', in: 'query', schema: { type: 'boolean' } }], responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound } },
    },
    '/api/xin-nghi/{id}/trang-thai': {
      patch: { tags: ['XinNghi'], summary: 'Duyệt / từ chối / bỏ duyệt cả đợt - admin', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['trang_thai'], properties: { trang_thai: { type: 'string', enum: ['cho_duyet', 'da_duyet', 'tu_choi'] }, ghi_chu_duyet: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound } },
    },
    '/api/xin-nghi/con-lai': {
      get: { tags: ['XinNghi'], summary: 'Số lần đã dùng trong tháng của ngày chọn', parameters: [{ name: 'ngay', in: 'query', required: true, schema: { type: 'string', format: 'date' } }, { name: 'nhansu_id', in: 'query', schema: { type: 'integer' } }, { name: 'bo_qua_id', in: 'query', schema: { type: 'integer' }, description: 'Đơn đang sửa' }], responses: { 200: { description: 'OK' } } },
    },
    '/api/xin-nghi/tong-hop': {
      get: { tags: ['XinNghi'], summary: 'Tổng hợp tháng (chỉ cộng đơn đã duyệt). Admin: mọi nhân viên; nhân viên: chỉ của mình', parameters: [{ name: 'thang', in: 'query', required: true, schema: { type: 'string' }, description: 'YYYY-MM' }], responses: { 200: { description: 'OK' } } },
    },
    '/api/xin-nghi/export': {
      get: { tags: ['XinNghi'], summary: 'Xuất Excel đơn xin nghỉ, mỗi dòng 1 ngày, cùng bộ lọc với danh sách', parameters: [{ name: 'thang', in: 'query', schema: { type: 'string' }, description: 'YYYY-MM, bỏ trống = tất cả' }, { name: 'nhansu_id', in: 'query', schema: { type: 'integer' } }, { name: 'loai', in: 'query', schema: { type: 'string' } }, { name: 'trang_thai', in: 'query', schema: { type: 'string' } }], responses: { 200: { description: 'File Excel' } } },
    },
    '/api/xin-nghi/tong-hop/export': {
      get: { tags: ['XinNghi'], summary: 'Xuất Excel tháng: sheet tổng hợp + chi tiết (nhân viên chỉ ra của mình)', parameters: [{ name: 'thang', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'File Excel' } } },
    },
    '/api/test-db': {
      get: {
        tags: ['Auth'],
        summary: 'Kiểm tra kết nối database (không cần token)',
        security: [],
        responses: { 200: { description: 'OK' } },
      },
    },

    // ---------- AUTH ----------
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: { username: { type: 'string' }, password: { type: 'string' } },
              },
              example: { username: 'admin', password: 'admin123456' },
            },
          },
        },
        responses: {
          200: {
            description: 'Đăng nhập thành công',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: { $ref: '#/components/schemas/NhanSu' },
                  },
                },
              },
            },
          },
          400: responses.BadRequest,
          401: responses.Unauthorized,
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Thông tin tài khoản đang đăng nhập',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NhanSu' } } } }, 401: responses.Unauthorized },
      },
    },
    '/api/auth/change-password': {
      put: {
        tags: ['Auth'],
        summary: 'Tự đổi mật khẩu',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mat_khau_cu', 'mat_khau_moi'],
                properties: { mat_khau_cu: { type: 'string' }, mat_khau_moi: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 401: responses.Unauthorized },
      },
    },

    // ---------- NHANSU ----------
    '/api/nhansu': {
      get: {
        tags: ['NhanSu'],
        summary: 'Danh sách nhân sự (mọi người đăng nhập), có phân trang + tìm kiếm',
        parameters: [
          pPage,
          pLimit,
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo họ tên hoặc username' },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/NhanSu' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          401: responses.Unauthorized,
        },
      },
      post: {
        tags: ['NhanSu'],
        summary: 'Admin tạo tài khoản mới',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['ho_ten', 'username', 'password'],
                properties: {
                  ho_ten: { type: 'string' },
                  username: { type: 'string' },
                  password: { type: 'string' },
                  vai_tro: { type: 'string', enum: ['admin', 'nhan_vien', 'thu_kho'], default: 'nhan_vien' },
                  gioi_tinh: { type: 'string', enum: ['nam', 'nu'], default: 'nu' },
                  duoc_ke_ho: { type: 'boolean', description: 'Được kê xin nghỉ hộ (chỉ nhân viên)' },
                  xu_ly_hang: { type: 'boolean', default: true, description: 'Có làm xử lý hàng; false = không chọn được vào báo cáo' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Đã tạo', content: { 'application/json': { schema: { $ref: '#/components/schemas/NhanSu' } } } }, 400: responses.BadRequest, 403: responses.Forbidden, 409: responses.Conflict },
      },
    },
    '/api/nhansu/export': {
      get: { tags: ['NhanSu'], summary: 'Xuất Excel danh sách nhân sự (admin)', responses: { 200: { description: 'File Excel' }, 403: responses.Forbidden } },
    },
    '/api/nhansu/{id}': {
      get: {
        tags: ['NhanSu'],
        summary: 'Chi tiết 1 nhân sự',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NhanSu' } } } }, 404: responses.NotFound },
      },
      put: {
        tags: ['NhanSu'],
        summary: 'Admin sửa họ tên / vai trò / giới tính / quyền kê hộ',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ho_ten'], properties: { ho_ten: { type: 'string' }, vai_tro: { type: 'string', enum: ['admin', 'nhan_vien', 'thu_kho'] }, gioi_tinh: { type: 'string', enum: ['nam', 'nu'] }, duoc_ke_ho: { type: 'boolean' }, xu_ly_hang: { type: 'boolean' } } } } },
        },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
      delete: {
        tags: ['NhanSu'],
        summary: 'Admin xóa tài khoản (chặn nếu đã có báo cáo liên quan)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound, 409: responses.Conflict },
      },
    },
    '/api/nhansu/{id}/reset-password': {
      put: {
        tags: ['NhanSu'],
        summary: 'Admin đặt lại mật khẩu cho nhân sự',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mat_khau_moi'], properties: { mat_khau_moi: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },

    // ---------- VATTU ----------
    '/api/vattu': {
      get: {
        tags: ['VatTu'],
        summary: 'Danh sách vật tư, có phân trang + tìm kiếm',
        parameters: [
          pPage,
          pLimit,
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo mã hoặc tên vật tư' },
          { name: 'loai', in: 'query', schema: { type: 'string' }, description: 'Lọc đúng theo loại vật tư' },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/VatTu' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['VatTu'],
        summary: 'Admin tạo vật tư',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_vat_tu', 'ten_vat_tu'], properties: { ma_vat_tu: { type: 'string' }, ten_vat_tu: { type: 'string' }, loai: { type: 'string' }, thu_kho: { type: 'string' } } } } } },
        responses: { 201: { description: 'Đã tạo' }, 400: responses.BadRequest, 403: responses.Forbidden, 409: responses.Conflict },
      },
    },
    '/api/vattu/loai-list': {
      get: {
        tags: ['VatTu'],
        summary: 'Danh sách các giá trị "loại" khác nhau đang có (dùng đổ vào dropdown lọc)',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { type: 'string' } } } } } },
      },
    },
    '/api/vattu/export': { get: { tags: ['VatTu'], summary: 'Xuất Excel danh mục vật tư (admin)', responses: { 200: { description: 'File Excel' }, 403: responses.Forbidden } } },
    '/api/vattu/{ma_vat_tu}': {
      get: { tags: ['VatTu'], summary: 'Chi tiết vật tư', parameters: [{ name: 'ma_vat_tu', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: responses.NotFound } },
      put: {
        tags: ['VatTu'],
        summary: 'Admin sửa tên/loại/thủ kho vật tư',
        parameters: [{ name: 'ma_vat_tu', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ten_vat_tu'], properties: { ten_vat_tu: { type: 'string' }, loai: { type: 'string' }, thu_kho: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
      delete: {
        tags: ['VatTu'],
        summary: 'Admin xóa vật tư (chặn nếu đã có lô/danh mục lỗi liên quan)',
        parameters: [{ name: 'ma_vat_tu', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound, 409: responses.Conflict },
      },
    },

    // ---------- LO ----------
    '/api/lo': {
      get: {
        tags: ['Lo'],
        summary: 'Danh sách lô (kèm da_lua / con_lai), có phân trang',
        parameters: [pMaVatTu, { name: 'so_lo', in: 'query', schema: { type: 'string' }, description: 'Tìm gần đúng theo số lô' }, pPage, pLimit],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Lo' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Lo'],
        summary: 'Admin tạo lô mới',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['so_lo', 'ma_vat_tu'],
                properties: { so_lo: { type: 'string' }, ma_vat_tu: { type: 'string' }, ngay_san_xuat: { type: 'string', format: 'date' }, so_luong_lo: { type: 'number' }, ma_ncc: { type: 'string', nullable: true, description: '0-1, để trống nếu chưa có nhà cung cấp' } },
              },
            },
          },
        },
        responses: { 201: { description: 'Đã tạo' }, 400: responses.BadRequest, 403: responses.Forbidden },
      },
    },
    '/api/lo/export': { get: { tags: ['Lo'], summary: 'Xuất Excel danh sách lô (admin)', responses: { 200: { description: 'File Excel' }, 403: responses.Forbidden } } },
    '/api/lo/{id}': {
      get: { tags: ['Lo'], summary: 'Chi tiết lô', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 404: responses.NotFound } },
      put: {
        tags: ['Lo'],
        summary: 'Admin sửa lô (không cho hạ so_luong_lo thấp hơn số đã lựa)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['so_lo', 'ma_vat_tu'], properties: { so_lo: { type: 'string' }, ma_vat_tu: { type: 'string' }, ngay_san_xuat: { type: 'string', format: 'date' }, so_luong_lo: { type: 'number' }, ma_ncc: { type: 'string', nullable: true } } } } },
        },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
      delete: {
        tags: ['Lo'],
        summary: 'Admin xóa lô (chặn nếu đã có báo cáo liên quan)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound, 409: responses.Conflict },
      },
    },

    // ---------- NHACUNGCAP ----------
    '/api/nhacungcap': {
      get: {
        tags: ['NhaCungCap'],
        summary: 'Danh sách nhà cung cấp, có phân trang + tìm kiếm',
        parameters: [
          pPage,
          pLimit,
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Tìm theo mã hoặc tên nhà cung cấp' },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/NhaCungCap' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['NhaCungCap'],
        summary: 'Admin tạo nhà cung cấp',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_ncc', 'ten_ncc'], properties: { ma_ncc: { type: 'string' }, ten_ncc: { type: 'string' } } } } } },
        responses: { 201: { description: 'Đã tạo' }, 400: responses.BadRequest, 403: responses.Forbidden, 409: responses.Conflict },
      },
    },
    '/api/nhacungcap/export': { get: { tags: ['NhaCungCap'], summary: 'Xuất Excel danh mục nhà cung cấp (admin)', responses: { 200: { description: 'File Excel' }, 403: responses.Forbidden } } },
    '/api/nhacungcap/{ma_ncc}': {
      get: { tags: ['NhaCungCap'], summary: 'Chi tiết nhà cung cấp', parameters: [{ name: 'ma_ncc', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: responses.NotFound } },
      put: {
        tags: ['NhaCungCap'],
        summary: 'Admin sửa tên nhà cung cấp',
        parameters: [{ name: 'ma_ncc', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ten_ncc'], properties: { ten_ncc: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
      delete: {
        tags: ['NhaCungCap'],
        summary: 'Admin xóa nhà cung cấp (chặn nếu đã được gán cho lô)',
        parameters: [{ name: 'ma_ncc', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound, 409: responses.Conflict },
      },
    },

    // ---------- LOAILOI ----------
    '/api/loailoi': {
      get: {
        tags: ['LoaiLoi'],
        summary: 'Danh sách loại lỗi, lọc theo ma_vat_tu, có phân trang',
        parameters: [pMaVatTu, pPage, pLimit],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/LoaiLoi' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['LoaiLoi'],
        summary: 'Admin tạo loại lỗi cho 1 vật tư',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_vat_tu', 'ten_loi'], properties: { ma_vat_tu: { type: 'string' }, ten_loi: { type: 'string' } } } } } },
        responses: { 201: { description: 'Đã tạo' }, 400: responses.BadRequest, 403: responses.Forbidden },
      },
    },
    '/api/loailoi/export': { get: { tags: ['LoaiLoi'], summary: 'Xuất Excel danh mục lỗi (admin)', responses: { 200: { description: 'File Excel' }, 403: responses.Forbidden } } },
    '/api/loailoi/{id}': {
      get: { tags: ['LoaiLoi'], summary: 'Chi tiết loại lỗi', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK' }, 404: responses.NotFound } },
      put: {
        tags: ['LoaiLoi'],
        summary: 'Admin sửa tên lỗi',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ten_loi'], properties: { ten_loi: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
      delete: {
        tags: ['LoaiLoi'],
        summary: 'Admin xóa loại lỗi (chặn nếu đang được gán cho báo cáo)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound, 409: responses.Conflict },
      },
    },

    // ---------- BAOCAO ----------
    '/api/baocao': {
      get: {
        tags: ['BaoCao'],
        summary: 'Danh sách báo cáo (lọc + phân trang)',
        parameters: [
          pTuNgay,
          pDenNgay,
          pMaVatTu,
          { name: 'lo_id', in: 'query', schema: { type: 'integer' } },
          { name: 'nguoi_nhap_id', in: 'query', schema: { type: 'integer' } },
          { name: 'nhansu_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo nhân sự tham gia (kể cả không phải người đại diện)' },
          { name: 'la_lua_lai', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/BaoCao' } },
                    pagination: {
                      type: 'object',
                      properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, total_pages: { type: 'integer' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['BaoCao'],
        summary: 'Nhập báo cáo mới (validate không vượt so_luong_lo của lô)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BaoCaoInput' } } } },
        responses: { 201: { description: 'Đã tạo', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaoCao' } } } }, 400: responses.BadRequest, 401: responses.Unauthorized },
      },
    },
    '/api/baocao/export': {
      get: {
        tags: ['BaoCao'],
        summary: 'Xuất Excel danh sách báo cáo (theo cùng bộ lọc với GET /api/baocao, tối đa 20000 dòng)',
        parameters: [pTuNgay, pDenNgay, pMaVatTu, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, { name: 'nguoi_nhap_id', in: 'query', schema: { type: 'integer' } }, { name: 'nhansu_id', in: 'query', schema: { type: 'integer' } }, { name: 'la_lua_lai', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }, { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'File Excel' } },
      },
    },
    '/api/baocao/{id}': {
      get: { tags: ['BaoCao'], summary: 'Chi tiết báo cáo', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaoCao' } } } }, 404: responses.NotFound } },
      put: {
        tags: ['BaoCao'],
        summary: 'Sửa báo cáo (nhân viên: chỉ báo cáo của mình, trong ngày nhập; admin: toàn quyền). Không sửa được loi_nguoi_dung/loi_chuan_id.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BaoCaoInput' } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
      delete: {
        tags: ['BaoCao'],
        summary: 'Xóa báo cáo (nhân viên: chỉ báo cáo của mình, trong ngày nhập; admin: toàn quyền)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' }, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },
    '/api/baocao/{id}/loi-chuan': {
      patch: {
        tags: ['BaoCao'],
        summary: 'Admin gán/sửa/gỡ nhãn lỗi chuẩn cho báo cáo',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { loi_chuan_id: { type: 'integer', nullable: true, description: 'null để gỡ nhãn' } } } } },
        },
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/BaoCao' } } } }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },

    // ---------- DASHBOARD ----------
    '/api/dashboard/nhansu': {
      get: {
        tags: ['Dashboard'],
        summary: 'Dashboard năng suất theo nhân sự, có phân trang (15/trang). Lọc theo vật tư/lô/nhân sự sẽ chỉ trả về những gì khớp điều kiện.',
        parameters: [
          pTuNgay,
          pDenNgay,
          pMaVatTu,
          { name: 'lo_id', in: 'query', schema: { type: 'integer' } },
          { name: 'nhansu_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo 1 nhân sự cụ thể' },
          { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo lỗi chuẩn admin đã gán (nên chọn kèm ma_vat_tu vì lỗi gắn theo từng vật tư)' },
          pMaNcc,
          pLaLuaLaiDashboard,
          pPage,
          pLimit,
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DashboardNhanSu' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                    summary: {
                      type: 'object',
                      description: 'Tổng hợp trên TOÀN BỘ kết quả đã lọc (không chỉ trang hiện tại)',
                      properties: {
                        tong_bao_cao: { type: 'integer' },
                        nang_suat_cao_nhat: { type: 'number', nullable: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard/nhansu/export': { get: { tags: ['Dashboard'], summary: 'Xuất Excel dashboard theo nhân sự', parameters: [pTuNgay, pDenNgay, pMaVatTu, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, { name: 'nhansu_id', in: 'query', schema: { type: 'integer' } }, { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' } }, pMaNcc, pLaLuaLaiDashboard], responses: { 200: { description: 'File Excel' } } } },
    '/api/dashboard/nhansu/vattu': {
      get: {
        tags: ['Dashboard'],
        summary: 'Breakdown theo vật tư + lô + loại lỗi cho từng nhân sự, có phân trang (15/trang)',
        parameters: [
          pTuNgay,
          pDenNgay,
          pMaVatTu,
          { name: 'lo_id', in: 'query', schema: { type: 'integer' } },
          { name: 'nhansu_id', in: 'query', schema: { type: 'integer' } },
          { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' } },
          pMaNcc,
          pLaLuaLaiDashboard,
          pPage,
          pLimit,
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DashboardNhanSuTheoVatTu' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard/nhansu/vattu/export': { get: { tags: ['Dashboard'], summary: 'Xuất Excel breakdown theo vật tư + lô + loại lỗi cho từng nhân sự', parameters: [pTuNgay, pDenNgay, pMaVatTu, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, { name: 'nhansu_id', in: 'query', schema: { type: 'integer' } }, { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' } }, pMaNcc, pLaLuaLaiDashboard], responses: { 200: { description: 'File Excel' } } } },

    '/api/dashboard/vattu': {
      get: {
        tags: ['Dashboard'],
        summary: 'Dashboard năng suất theo vật tư, có phân trang (15/trang)',
        parameters: [
          pTuNgay,
          pDenNgay,
          pLaLuaLaiDashboard,
          { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo lỗi chuẩn admin đã gán' },
          pMaVatTu,
          { name: 'lo_id', in: 'query', schema: { type: 'integer' }, description: 'Lọc theo 1 lô cụ thể' },
          pMaNcc,
          pPage,
          pLimit,
        ],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DashboardVatTu' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard/vattu/export': { get: { tags: ['Dashboard'], summary: 'Xuất Excel dashboard theo vật tư', parameters: [pTuNgay, pDenNgay, pLaLuaLaiDashboard, { name: 'loi_chuan_id', in: 'query', schema: { type: 'integer' } }, pMaVatTu, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, pMaNcc], responses: { 200: { description: 'File Excel' } } } },
    '/api/dashboard/vattu/loi': {
      get: {
        tags: ['Dashboard'],
        summary: 'Breakdown số lượng theo từng loại lỗi, theo vật tư (đầy đủ chỉ số như bảng chính), có phân trang (15/trang)',
        parameters: [pTuNgay, pDenNgay, pMaVatTu, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, pMaNcc, pLaLuaLaiDashboard, pPage, pLimit],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DashboardLoiTheoVatTu' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard/vattu/loi/export': { get: { tags: ['Dashboard'], summary: 'Xuất Excel breakdown lỗi theo vật tư', parameters: [pTuNgay, pDenNgay, pMaVatTu, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, pMaNcc, pLaLuaLaiDashboard], responses: { 200: { description: 'File Excel' } } } },

    '/api/dashboard/lo': {
      get: {
        tags: ['Dashboard'],
        summary: 'Dashboard năng suất / tiến độ theo lô, có phân trang (15/trang)',
        parameters: [pTuNgay, pDenNgay, pMaVatTu, pLaLuaLaiDashboard, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, pMaNcc, pPage, pLimit],
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/DashboardLo' } },
                    pagination: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/dashboard/lo/export': { get: { tags: ['Dashboard'], summary: 'Xuất Excel dashboard theo lô', parameters: [pTuNgay, pDenNgay, pMaVatTu, pLaLuaLaiDashboard, { name: 'lo_id', in: 'query', schema: { type: 'integer' } }, pMaNcc], responses: { 200: { description: 'File Excel' } } } },

    '/api/dashboard/thoigian': {
      get: {
        tags: ['Dashboard'],
        summary: 'Dashboard năng suất theo thời gian (ngày/tháng)',
        parameters: [pTuNgay, pDenNgay, pMaVatTu, pLaLuaLaiDashboard, pMaNcc, { name: 'group_by', in: 'query', schema: { type: 'string', enum: ['ngay', 'thang'], default: 'ngay' } }],
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/DashboardThoiGian' } } } } } },
      },
    },
    '/api/dashboard/thoigian/export': { get: { tags: ['Dashboard'], summary: 'Xuất Excel dashboard theo thời gian', parameters: [pTuNgay, pDenNgay, pMaVatTu, pLaLuaLaiDashboard, pMaNcc, { name: 'group_by', in: 'query', schema: { type: 'string', enum: ['ngay', 'thang'] } }], responses: { 200: { description: 'File Excel' } } } },

    '/api/kho/layout': { get: { tags: ['ViTriKho'], summary: 'Bố cục không gian kho (kho-layout.json) để dựng bản đồ 3D', responses: { 200: { description: 'OK' } } } },
    '/api/vi-tri': {
      get: {
        tags: ['ViTriKho'],
        summary: 'Danh mục ô kho + tóm tắt hàng đang chứa',
        parameters: [
          { name: 'ke', in: 'query', schema: { type: 'string' }, description: 'Mã kệ, vd K05, S1' },
          { name: 'nhom', in: 'query', schema: { type: 'string' }, description: 'Nhóm drive-in, vd "Drive-in 5"' },
          { name: 'khu', in: 'query', schema: { type: 'string' } },
          { name: 'tang', in: 'query', schema: { type: 'integer' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Tìm theo mã ô (chứa chuỗi)' },
          { name: 'co_hang', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Chỉ ô đang có hàng' },
          { name: 'gon', in: 'query', schema: { type: 'string', enum: ['1'] }, description: "Chế độ gọn cho bản đồ 3D: trả { cot, data: [[ma_vi_tri, so_lo_trong_o, so_lo_dau], ...], total } (nhỏ hơn ~90%)" },
          pMaVatTu,
        ],
        responses: { 200: { description: '{ data: [ô...], total }' }, 401: responses.Unauthorized },
      },
    },
    '/api/vi-tri/goi-y': {
      get: {
        tags: ['ViTriKho'],
        summary: 'Gợi ý mã ô cho ô tìm kiếm (mã chứa q, bắt đầu bằng q xếp trước)',
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 30 } },
        ],
        responses: { 200: { description: '{ data: [mã ô], total }' } },
      },
    },
    '/api/vi-tri/tong-theo-lo': {
      get: {
        tags: ['ViTriKho'],
        summary: 'Các lô ĐANG nằm trong kho (mỗi vật tư + số lô một dòng): tổng SL trong kho (cộng Lo_ViTri), số ô, cờ co_chua_biet. Độc lập với bảng Lo bên lựa',
        responses: { 200: { description: '{ data: [{ ma_vat_tu, so_lo, so_o, tong_so_luong, co_chua_biet }] }' } },
      },
    },
    '/api/vi-tri/theo-lo': {
      get: {
        tags: ['ViTriKho'],
        summary: 'Các ô mà 1 lô (mã vật tư + số lô, không phân biệt hoa/thường) đang nằm; lô chưa có ô nào -> data rỗng',
        parameters: [
          { name: 'ma_vat_tu', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'so_lo', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: '{ ma_vat_tu, so_lo, data: [ô...] }' }, 400: responses.BadRequest },
      },
    },
    '/api/vi-tri/giao-dich': {
      get: {
        tags: ['ViTriKho'],
        summary: 'Sổ giao dịch vị trí (mới nhất trước)',
        parameters: [
          pPage, pLimit,
          { name: 'so_lo', in: 'query', schema: { type: 'string' }, description: 'Khớp đúng cả chuỗi (không phân biệt hoa/thường)' },
          { name: 'ma_vi_tri', in: 'query', schema: { type: 'string' } },
          { name: 'thao_tac', in: 'query', schema: { type: 'string', enum: ['nhap', 'xuat', 'chuyen_di', 'chuyen_den', 'dieu_chinh'] } },
          { name: 'nhom_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Ghép cặp chuyen_di / chuyen_den' },
          pMaVatTu,
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['thoi_gian', 'thao_tac', 'ma_vi_tri', 'so_lo', 'so_luong'] } },
          { name: 'sort_dir', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/api/vi-tri/{ma_vi_tri}': {
      get: { tags: ['ViTriKho'], summary: 'Một ô + các lô đang chứa', parameters: [{ name: 'ma_vi_tri', in: 'path', required: true, schema: { type: 'string' }, example: 'K05-O03-T2' }], responses: { 200: { description: 'OK' }, 404: responses.NotFound } },
    },
    '/api/vi-tri/nhap': {
      post: {
        tags: ['ViTriKho'],
        summary: 'Đặt lô vào ô (cộng dồn nếu đã có) - admin/thủ kho. Lô = ma_vat_tu (phải có trong danh mục VatTu) + so_lo gõ tự do, KHÔNG cần lô đã khai bên lựa',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_vat_tu', 'so_lo', 'ma_vi_tri'], properties: { ma_vat_tu: { type: 'string' }, so_lo: { type: 'string' }, ma_vi_tri: { type: 'string' }, so_luong: { type: 'number', nullable: true, description: 'Bỏ trống = chưa biết số' }, ghi_chu: { type: 'string' } } } } } },
        responses: { 201: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },
    '/api/vi-tri/xuat': {
      post: {
        tags: ['ViTriKho'],
        summary: 'Lấy lô ra khỏi ô - admin/thủ kho',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_vat_tu', 'so_lo', 'ma_vi_tri'], properties: { ma_vat_tu: { type: 'string' }, so_lo: { type: 'string' }, ma_vi_tri: { type: 'string' }, so_luong: { type: 'number', nullable: true, description: 'Bỏ trống = lấy hết' }, ghi_chu: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },
    '/api/vi-tri/chuyen': {
      post: {
        tags: ['ViTriKho'],
        summary: 'Chuyển lô từ ô A sang ô B (1 transaction, 2 dòng sổ chung nhom_id) - admin/thủ kho',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_vat_tu', 'so_lo', 'tu_vi_tri', 'den_vi_tri'], properties: { ma_vat_tu: { type: 'string' }, so_lo: { type: 'string' }, tu_vi_tri: { type: 'string' }, den_vi_tri: { type: 'string' }, so_luong: { type: 'number', nullable: true, description: 'Bỏ trống = chuyển hết' }, ghi_chu: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },
    '/api/vi-tri/dieu-chinh': {
      post: {
        tags: ['ViTriKho'],
        summary: 'Sửa số lượng của lô trong ô (null = chưa biết, 0 = bỏ khỏi ô) - admin/thủ kho',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ma_vat_tu', 'so_lo', 'ma_vi_tri', 'so_luong'], properties: { ma_vat_tu: { type: 'string' }, so_lo: { type: 'string' }, ma_vi_tri: { type: 'string' }, so_luong: { type: 'number', nullable: true }, ghi_chu: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK' }, 400: responses.BadRequest, 403: responses.Forbidden, 404: responses.NotFound },
      },
    },
  },
};

module.exports = spec;
