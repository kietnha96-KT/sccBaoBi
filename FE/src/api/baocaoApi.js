import client from './client';

export const listBaoCao = (params) => client.get('/baocao', { params }).then((r) => r.data);
export const getBaoCao = (id) => client.get(`/baocao/${id}`).then((r) => r.data);
export const createBaoCao = (data) => client.post('/baocao', data).then((r) => r.data);
export const updateBaoCao = (id, data) => client.put(`/baocao/${id}`, data).then((r) => r.data);
export const deleteBaoCao = (id) => client.delete(`/baocao/${id}`).then((r) => r.data);
export const ganLoiChuan = (id, loi_chuan_id) =>
  client.patch(`/baocao/${id}/loi-chuan`, { loi_chuan_id }).then((r) => r.data);
