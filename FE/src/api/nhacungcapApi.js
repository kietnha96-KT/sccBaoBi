import client from './client';

export const listNhaCungCap = (params) => client.get('/nhacungcap', { params }).then((r) => r.data);
export const createNhaCungCap = (data) => client.post('/nhacungcap', data).then((r) => r.data);
export const updateNhaCungCap = (ma, data) => client.put(`/nhacungcap/${ma}`, data).then((r) => r.data);
export const deleteNhaCungCap = (ma) => client.delete(`/nhacungcap/${ma}`).then((r) => r.data);
