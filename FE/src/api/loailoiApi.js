import client from './client';

export const listLoaiLoi = (ma_vat_tu) =>
  client.get('/loailoi', { params: ma_vat_tu ? { ma_vat_tu } : {} }).then((r) => r.data);
export const createLoaiLoi = (data) => client.post('/loailoi', data).then((r) => r.data);
export const updateLoaiLoi = (id, data) => client.put(`/loailoi/${id}`, data).then((r) => r.data);
export const deleteLoaiLoi = (id) => client.delete(`/loailoi/${id}`).then((r) => r.data);
