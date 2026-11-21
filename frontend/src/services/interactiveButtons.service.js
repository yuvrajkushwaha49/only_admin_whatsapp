import api from './api';

export const interactiveButtonsService = {
  getButtons: async (params = {}) => {
    const res = await api.get('/interactive-buttons', { params });
    return res.data;
  },

  getButton: async (id) => {
    const res = await api.get(`/interactive-buttons/${id}`);
    return res.data;
  },

  createButton: async (data) => {
    const res = await api.post('/interactive-buttons', data);
    return res.data;
  },

  updateButton: async (id, data) => {
    const res = await api.put(`/interactive-buttons/${id}`, data);
    return res.data;
  },

  deleteButton: async (id) => {
    const res = await api.delete(`/interactive-buttons/${id}`);
    return res.data;
  }
};

export default interactiveButtonsService;
