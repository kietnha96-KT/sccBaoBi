import { useState } from 'react';
import { changePassword } from '../api/authApi';
import { getErrorMessage } from '../api/client';
import Alert from '../components/Alert';

export default function ChangePasswordPage() {
  const [matKhauCu, setMatKhauCu] = useState('');
  const [matKhauMoi, setMatKhauMoi] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await changePassword(matKhauCu, matKhauMoi);
      setSuccess('Đổi mật khẩu thành công');
      setMatKhauCu('');
      setMatKhauMoi('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        Đổi mật khẩu
      </h1>
      <div className="card" style={{ maxWidth: 420 }}>
        <form className="card-body" onSubmit={handleSubmit}>
          <Alert>{error}</Alert>
          <Alert type="success">{success}</Alert>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="field">
              <label>Mật khẩu hiện tại</label>
              <input
                type="password"
                value={matKhauCu}
                onChange={(e) => setMatKhauCu(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Mật khẩu mới (tối thiểu 6 ký tự)</label>
              <input
                type="password"
                value={matKhauMoi}
                onChange={(e) => setMatKhauMoi(e.target.value)}
                minLength={6}
                required
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={loading}>
            {loading ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
