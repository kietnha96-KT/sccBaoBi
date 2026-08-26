import client from './client';

export const listLoaiLoi = (params) => {
  const p = typeof params === 'string' ? { ma_vat_tu: params } : params;
  return client.get('/loailoi', { params: p }).then((r) => r.data);
};
export const createLoaiLoi = (data) => client.post('/loailoi', data).then((r) => r.data);
export const updateLoaiLoi = (id, data) => client.put(`/loailoi/${id}`, data).then((r) => r.data);
export const deleteLoaiLoi = (id) => client.delete(`/loailoi/${id}`).then((r) => r.data);
