import client from './client';

export const listNhanSu = () => client.get('/nhansu').then((r) => r.data);
export const getNhanSu = (id) => client.get(`/nhansu/${id}`).then((r) => r.data);
export const createNhanSu = (data) => client.post('/nhansu', data).then((r) => r.data);
export const updateNhanSu = (id, data) => client.put(`/nhansu/${id}`, data).then((r) => r.data);
export const resetPassword = (id, mat_khau_moi) =>
  client.put(`/nhansu/${id}/reset-password`, { mat_khau_moi }).then((r) => r.data);
export const deleteNhanSu = (id) => client.delete(`/nhansu/${id}`).then((r) => r.data);
