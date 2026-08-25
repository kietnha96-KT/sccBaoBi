import client from './client';

export const listLo = (params) => client.get('/lo', { params }).then((r) => r.data);
export const getLo = (id) => client.get(`/lo/${id}`).then((r) => r.data);
export const createLo = (data) => client.post('/lo', data).then((r) => r.data);
export const updateLo = (id, data) => client.put(`/lo/${id}`, data).then((r) => r.data);
export const deleteLo = (id) => client.delete(`/lo/${id}`).then((r) => r.data);
