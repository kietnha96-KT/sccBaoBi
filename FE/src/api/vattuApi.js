import client from './client';

export const listVatTu = (params) => client.get('/vattu', { params }).then((r) => r.data);
export const listLoaiVatTu = () => client.get('/vattu/loai-list').then((r) => r.data);
export const createVatTu = (data) => client.post('/vattu', data).then((r) => r.data);
export const updateVatTu = (ma, data) => client.put(`/vattu/${ma}`, data).then((r) => r.data);
export const deleteVatTu = (ma) => client.delete(`/vattu/${ma}`).then((r) => r.data);
