import { api } from './api';

export const authService = {
  async register(payload) {
    const { data } = await api.post('/auth/register', payload);
    return data.data;
  },

  async login(payload) {
    const { data } = await api.post('/auth/login', payload);
    return data.data;
  },

  async getProfile() {
    const { data } = await api.get('/auth/profile');
    return data.data.user;
  },

  async updateProfile(payload) {
    const { data } = await api.put('/auth/profile', payload);
    return data.data.user;
  },

  async changePassword(payload) {
    const { data } = await api.put('/auth/password', payload);
    return data.data;
  },
};

export default authService;
