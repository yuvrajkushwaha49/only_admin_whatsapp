import api from './api';

const tagsService = {
  async getTags() {
    const res = await api.get('/tags');
    return res.data;
  },

  async getTagStats() {
    const res = await api.get('/tags/stats');
    return res.data;
  },

  async getTagDetail(tagId, params = {}) {
    const res = await api.get(`/tags/${tagId}`, { params });
    return res.data;
  },

  async createTag(payload) {
    const res = await api.post('/tags', payload);
    return res.data;
  },

  async updateTag(tagId, payload) {
    const res = await api.put(`/tags/${tagId}`, payload);
    return res.data;
  },

  async deleteTag(tagId) {
    const res = await api.delete(`/tags/${tagId}`);
    return res.data;
  },

  async addContactsToTag(tagId, contactIds) {
    const res = await api.post(`/tags/${tagId}/contacts`, { contactIds });
    return res.data;
  },

  async removeContactFromTag(tagId, contactId) {
    const res = await api.delete(`/tags/${tagId}/contacts/${contactId}`);
    return res.data;
  }
};

export default tagsService;
