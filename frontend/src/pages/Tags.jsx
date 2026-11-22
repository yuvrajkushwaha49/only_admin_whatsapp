import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import tagsService from '../services/tags.service';
import { useAuth } from '../hooks/useAuth';
import '../styles/dashboard.css';

const PRESET_COLORS = [
  '#7c3aed', // Purple
  '#0d6efd', // Blue
  '#198754', // Green
  '#fd7e14', // Orange
  '#d63384', // Pink
  '#20c997', // Teal
  '#ffc107', // Yellow
  '#0dcaf0'  // Cyan
];

export default function Tags() {
  const { user, isSuperAdmin } = useAuth();
  const canDelete = Boolean((isSuperAdmin && isSuperAdmin()) || user?.role === 'superadmin' || user?.role === 'owner');

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#7c3aed'
  });
  const [saving, setSaving] = useState(false);

  // Delete Confirm Modal State
  const [deletingTag, setDeletingTag] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTags();
  }, []);

  const showToast = (type, text) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchTags = async () => {
    try {
      setLoading(true);
      const res = await tagsService.getTags();
      if (res.success) {
        setTags(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load contact tags:', err);
      showToast('danger', err.response?.data?.message || 'Failed to load contact tags');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTag(null);
    setFormData({ name: '', color: '#7c3aed' });
    setShowModal(true);
  };

  const openEditModal = (tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color || '#7c3aed'
    });
    setShowModal(true);
  };

  const handleSaveTag = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSaving(true);
      if (editingTag) {
        const res = await tagsService.updateTag(editingTag.id, formData);
        if (res.success) {
          showToast('success', 'Contact tag updated successfully!');
          setShowModal(false);
          fetchTags();
        }
      } else {
        const res = await tagsService.createTag(formData);
        if (res.success) {
          showToast('success', 'New contact tag created!');
          setShowModal(false);
          fetchTags();
        }
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!deletingTag) return;
    try {
      setDeleting(true);
      const res = await tagsService.deleteTag(deletingTag.id);
      if (res.success) {
        showToast('success', 'Contact tag deleted.');
        setDeletingTag(null);
        fetchTags();
      }
    } catch (err) {
      showToast('danger', err.response?.data?.message || 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMembers = tags.reduce((acc, t) => acc + (t.contact_count || 0), 0);

  return (
    <div className="contact-groups-page pb-5">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          className={`alert alert-${toastMsg.type} alert-dismissible fade show shadow-sm position-fixed top-0 end-0 m-3 z-3`}
          role="alert"
          style={{ maxWidth: '420px', zIndex: 1080 }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className={`bi ${toastMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}></i>
            <span>{toastMsg.text}</span>
          </div>
          <button type="button" className="btn-close" onClick={() => setToastMsg(null)}></button>
        </div>
      )}

      <div className="cg-page-container">
        {/* Top Hero Banner (Matching Organize Your Contacts) */}
        <div className="cg-hero-banner">
          <div className="cg-hero-left">
            <div className="cg-hero-icon">
              <i className="bi bi-tags-fill"></i>
            </div>
            <div>
              <h1 className="cg-hero-title">Organize Your Tags</h1>
              <p className="cg-hero-subtitle">
                Create and manage targeted contact tags for bulk WhatsApp broadcasts and automations.
              </p>
            </div>
          </div>
          <div className="cg-hero-actions">
            <button
              type="button"
              onClick={fetchTags}
              className="cg-hero-btn-refresh"
              title="Refresh tags list"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="cg-hero-btn-create"
            >
              <i className="bi bi-plus-lg"></i>
              <span>Create New Tag</span>
            </button>
          </div>
        </div>

        {/* 3 Stats Cards Row (Matching Contact Groups) */}
        <div className="cg-stats-grid">
          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-blue">
              <i className="bi bi-tag-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Tags</div>
              <div className="cg-stat-value">{tags.length}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-green">
              <i className="bi bi-people-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Total Tag Members</div>
              <div className="cg-stat-value">{totalMembers}</div>
            </div>
          </div>

          <div className="cg-stat-card">
            <div className="cg-stat-icon-wrap cg-stat-icon-cyan">
              <i className="bi bi-send-fill"></i>
            </div>
            <div>
              <div className="cg-stat-label">Broadcast Ready</div>
              <div className="cg-stat-value text-green">100%</div>
            </div>
          </div>
        </div>

        {/* Tags Grid with Search Bar */}
        <div className="cg-card">
          <div className="cg-card-header">
            <h2 className="cg-card-title">All Contact Tags ({filteredTags.length})</h2>

            <div className="cg-search-box">
              <i className="bi bi-search cg-search-icon"></i>
              <input
                type="text"
                className="cg-search-input"
                placeholder="Search tags..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status"></div>
                <div className="text-muted small mt-2">Loading contact tags...</div>
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-tag fs-1 text-secondary d-block mb-2"></i>
                <h5>No Contact Tags Found</h5>
                <p className="small mb-3">Tag your contacts to easily target them in marketing campaigns.</p>
                <button onClick={openCreateModal} className="cg-hero-btn-create">
                  <i className="bi bi-plus-lg me-1"></i> Create Your First Tag
                </button>
              </div>
            ) : (
              <div className="cg-groups-grid">
                {filteredTags.map(tag => {
                  const tagColor = tag.color || '#7c3aed';
                  return (
                    <div key={tag.id} className="cg-group-item-card">
                      <div className="cg-group-top">
                        <div
                          className="cg-group-avatar"
                          style={{
                            backgroundColor: `${tagColor}18`,
                            color: tagColor
                          }}
                        >
                          <i className="bi bi-tag-fill"></i>
                        </div>
                        <div className="cg-group-info">
                          <div className="cg-group-name-row">
                            <h3 className="cg-group-name text-truncate" title={tag.name}>
                              {tag.name}
                            </h3>
                            <span
                              className="cg-group-badge"
                              style={{
                                backgroundColor: `${tagColor}15`,
                                color: tagColor,
                                borderColor: `${tagColor}40`
                              }}
                            >
                              <i className="bi bi-person-fill"></i>
                              <span>{tag.contact_count || 0} {tag.contact_count === 1 ? 'Contact' : 'Contacts'}</span>
                            </span>
                          </div>
                          <p className="cg-group-desc">
                            Color tag: <span className="fw-bold" style={{ color: tagColor }}>{tagColor}</span> • Created {tag.created_at ? new Date(tag.created_at).toLocaleDateString() : 'Recently'}
                          </p>
                        </div>
                      </div>

                      <div className="cg-group-bottom">
                        <Link
                          to={`/tags/${tag.id}`}
                          className="cg-btn-manage"
                          style={{
                            borderColor: tagColor,
                            color: tagColor
                          }}
                        >
                          <i className="bi bi-people"></i>
                          <span>Manage ({tag.contact_count || 0})</span>
                        </Link>

                        <div className="cg-group-actions-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(tag)}
                            className="cg-btn-edit"
                            title="Edit Tag"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeletingTag(tag)}
                              className="cg-btn-delete"
                              title="Delete Tag"
                            >
                              <i className="bi bi-trash3"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CREATE / EDIT TAG MODAL (Matching Contact Groups Modal) */}
      {/* ========================================================= */}
      {showModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <form onSubmit={handleSaveTag}>
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    {editingTag ? 'Edit Contact Tag' : 'Create New Contact Tag'}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Tag Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. VIP Customer, Lead, Warm Prospect"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Tag Color</label>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          className="rounded-circle border-0 d-inline-block"
                          style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: c,
                            outline: formData.color.toLowerCase() === c.toLowerCase() ? '3px solid #000' : 'none',
                            outlineOffset: '2px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setFormData({ ...formData, color: c })}
                        ></button>
                      ))}
                    </div>

                    <div className="d-flex align-items-center gap-2 mt-2">
                      <input
                        type="color"
                        className="form-control form-control-color"
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                        title="Pick custom hex color"
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ maxWidth: '110px' }}
                        value={formData.color}
                        onChange={e => setFormData({ ...formData, color: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div className="p-3 bg-light rounded-3 text-center border">
                    <div className="small text-muted mb-2">Tag Preview:</div>
                    <span
                      className="cg-group-badge"
                      style={{
                        backgroundColor: `${formData.color}15`,
                        color: formData.color,
                        borderColor: `${formData.color}40`,
                        fontSize: '0.9rem',
                        padding: '0.35rem 0.85rem'
                      }}
                    >
                      <i className="bi bi-tag-fill me-1"></i>
                      <span>{formData.name.trim() || 'Sample Tag'}</span>
                    </span>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-cf-primary d-flex align-items-center gap-1 text-white"
                    style={{ backgroundColor: '#7c3aed', borderColor: '#7c3aed' }}
                  >
                    <i className="bi bi-save"></i>
                    <span>{saving ? 'Saving...' : (editingTag ? 'Update Tag' : 'Create Tag')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DELETE TAG CONFIRM MODAL (Matching Contact Groups Modal) */}
      {/* ========================================================= */}
      {deletingTag && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title fw-bold text-danger">Delete Contact Tag</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeletingTag(null)}
                ></button>
              </div>
              <div className="modal-body">
                <p className="text-muted mb-2">
                  Are you sure you want to delete the tag <strong>"{deletingTag.name}"</strong>?
                </p>
                <div className="small text-danger">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i>
                  The tag will be removed from all assigned contacts. Contacts belonging to this tag will <strong>not</strong> be deleted from your database.
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDeletingTag(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteTag}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete Tag'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
