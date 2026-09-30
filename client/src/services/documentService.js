import { api } from './api';

export const documentService = {
  /**
   * @param {object} params search / status / type / sort / page / limit
   */
  async list(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
    );
    const { data } = await api.get('/documents', { params: cleanParams });
    return data.data;
  },

  async getById(id) {
    const { data } = await api.get(`/documents/${id}`);
    return data.data.document;
  },

  async create(formData) {
    const { data } = await api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.document;
  },

  async update(id, formData) {
    const { data } = await api.put(`/documents/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data.document;
  },

  async remove(id) {
    const { data } = await api.delete(`/documents/${id}`);
    return data;
  },
};

export default documentService;
