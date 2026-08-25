// Bọc route handler async để tự động chuyển lỗi cho error middleware, khỏi phải try/catch lặp lại
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
