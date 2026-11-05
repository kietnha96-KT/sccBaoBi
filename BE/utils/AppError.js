// Lỗi nghiệp vụ có mã HTTP rõ ràng, để error middleware trả về đúng status.
// extra (tùy chọn): { code, details } - mã lỗi + số liệu thô để FE tự ghép thông báo và
// định dạng số (xem FE/src/errorMessages.js). message vẫn là câu dự phòng đọc được.
class AppError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = AppError;
