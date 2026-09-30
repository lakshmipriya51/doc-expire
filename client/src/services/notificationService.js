import { api } from './api';

export const notificationService = {
  async list({ unreadOnly = false } = {}) {
    const { data } = await api.get('/notifications', {
      params: unreadOnly ? { unreadOnly: 'true' } : {},
    });
    return data.data;
  },

  async markAsRead(id) {
    const { data } = await api.put(`/notifications/${id}/read`);
    return data.data;
  },

  async markAllAsRead() {
    const { data } = await api.put('/notifications/read-all');
    return data.data;
  },
};

export const dashboardService = {
  async getStats() {
    const { data } = await api.get('/dashboard/stats');
    return data.data;
  },
};

export default notificationService;
