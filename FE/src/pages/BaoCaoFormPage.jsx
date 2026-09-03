import { useNavigate, useParams } from 'react-router-dom';
import BaoCaoForm from '../components/BaoCaoForm';

// Trang riêng cho form báo cáo - giữ lại để mở bằng URL trực tiếp / deep-link
// (/baocao/moi, /baocao/:id/sua). Trong luồng bình thường, danh sách báo cáo mở
// form này bằng popup (không rời trang).
export default function BaoCaoFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 16 }}>
        {id ? 'Sửa báo cáo' : 'Nhập báo cáo lựa vật tư'}
      </h1>
      <div className="card">
        <div className="card-body">
          <BaoCaoForm id={id} onDone={() => navigate('/baocao')} />
        </div>
      </div>
    </div>
  );
}
