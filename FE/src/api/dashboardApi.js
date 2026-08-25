import client from './client';

export const dashboardTheoNhanSu = (params) =>
  client.get('/dashboard/nhansu', { params }).then((r) => r.data);
export const dashboardTheoVatTu = (params) =>
  client.get('/dashboard/vattu', { params }).then((r) => r.data);
export const dashboardLoiTheoVatTu = (params) =>
  client.get('/dashboard/vattu/loi', { params }).then((r) => r.data);
export const dashboardTheoLo = (params) =>
  client.get('/dashboard/lo', { params }).then((r) => r.data);
export const dashboardTheoThoiGian = (params) =>
  client.get('/dashboard/thoigian', { params }).then((r) => r.data);
