import client from './client';

export const listXinNghi = (params) => client.get('/xin-nghi', { params }).then((r) => r.data);
export const soLanConLai = (params) => client.get('/xin-nghi/con-lai', { params }).then((r) => r.data);
export const tongHopXinNghi = (params) => client.get('/xin-nghi/tong-hop', { params }).then((r) => r.data);
export const createXinNghi = (data) => client.post('/xin-nghi', data).then((r) => r.data);
export const updateXinNghi = (id, data) => client.put(`/xin-nghi/${id}`, data).then((r) => r.data);
export const deleteXinNghi = (id, params) => client.delete(`/xin-nghi/${id}`, { params }).then((r) => r.data);
export const doiTrangThaiXinNghi = (id, data) => client.patch(`/xin-nghi/${id}/trang-thai`, data).then((r) => r.data);
