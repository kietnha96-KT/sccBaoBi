// Lỗi nghiệp vụ có mã HTTP rõ ràng, để error middleware trả về đúng status
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = AppError;
