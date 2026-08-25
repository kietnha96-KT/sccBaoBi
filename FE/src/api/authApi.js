import client from './client';

export const login = (username, password) =>
  client.post('/auth/login', { username, password }).then((r) => r.data);

export const getMe = () => client.get('/auth/me').then((r) => r.data);

export const changePassword = (mat_khau_cu, mat_khau_moi) =>
  client.put('/auth/change-password', { mat_khau_cu, mat_khau_moi }).then((r) => r.data);
