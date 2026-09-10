import client from './client';

export const dashboardTheoNhanSu = (params) =>
  client.get('/dashboard/nhansu', { params }).then((r) => r.data);
export const dashboardNhanSuTheoVatTu = (params) =>
  client.get('/dashboard/nhansu/vattu', { params }).then((r) => r.data);
export const dashboardTheoVatTu = (params) =>
  client.get('/dashboard/vattu', { params }).then((r) => r.data);
export const dashboardLoiTheoVatTu = (params) =>
  client.get('/dashboard/vattu/loi', { params }).then((r) => r.data);
export const dashboardTheoLo = (params) =>
  client.get('/dashboard/lo', { params }).then((r) => r.data);
export const dashboardTheoLoChiTiet = (params) =>
  client.get('/dashboard/lo/chi-tiet', { params }).then((r) => r.data);
export const dashboardBaoCongTheoLo = (params) =>
  client.get('/dashboard/baocong-lo', { params }).then((r) => r.data);
export const dashboardHuBo = (params) =>
  client.get('/dashboard/hu-bo', { params }).then((r) => r.data);
export const dashboardHuBoChiTiet = (params) =>
  client.get('/dashboard/hu-bo/chi-tiet', { params }).then((r) => r.data);
